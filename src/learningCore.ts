import {
  type Action,
  type EvalPoint,
  type TrainingConfig,
  ACTION_COUNT,
  GOMOKU_CELLS,
  Mulberry32,
  OBSERVATION_SIZE,
  actionCountForEnvironment,
  clamp,
  createEnvironment,
  isActionLegal
} from "./rl.ts";
import {
  gomokuObservationCenterControl,
  longestGomokuObservationLine
} from "./gomoku.ts";

export interface PolicyEvaluation {
  fitness: number;
  distance: number;
  steps: number;
}

export type OutcomeLabel = "win" | "draw" | "loss";

export interface OutcomeCounts {
  games: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface OutcomeRates {
  winRate: number;
  drawRate: number;
  lossRate: number;
}

export interface OutcomeSummary extends OutcomeRates {
  games: number;
  score: number;
}

export interface ValuePredictionStats {
  samples: number;
  squaredError: number;
  decisiveSamples: number;
  correctSigns: number;
}

export interface ValuePredictionSummary {
  mse: number;
  signAccuracy: number;
  samples: number;
}

export function newOutcomeCounts(): OutcomeCounts {
  return {
    games: 0,
    wins: 0,
    draws: 0,
    losses: 0
  };
}

export function recordOutcome(counts: OutcomeCounts, outcome: OutcomeLabel): void {
  counts.games += 1;
  if (outcome === "win") {
    counts.wins += 1;
  } else if (outcome === "draw") {
    counts.draws += 1;
  } else {
    counts.losses += 1;
  }
}

export function ratesFromCounts(counts: OutcomeCounts): OutcomeRates {
  return {
    winRate: safeRate(counts.wins, counts.games),
    drawRate: safeRate(counts.draws, counts.games),
    lossRate: safeRate(counts.losses, counts.games)
  };
}

export function safeRate(count: number, total: number): number {
  return total > 0 ? count / total : 0;
}

export function scoreOutcomeCounts(counts: OutcomeCounts): number {
  return safeRate(counts.wins + counts.draws * 0.5, counts.games);
}

export function summarizeOutcomeCounts(counts: OutcomeCounts): OutcomeSummary {
  const rates = ratesFromCounts(counts);
  return {
    games: counts.games,
    winRate: rates.winRate,
    drawRate: rates.drawRate,
    lossRate: rates.lossRate,
    score: scoreOutcomeCounts(counts)
  };
}

export function newValuePredictionStats(): ValuePredictionStats {
  return {
    samples: 0,
    squaredError: 0,
    decisiveSamples: 0,
    correctSigns: 0
  };
}

export function recordValuePredictions(
  stats: ValuePredictionStats,
  predictions: readonly number[],
  outcome: OutcomeLabel
): void {
  const target = valueTargetForOutcome(outcome);
  for (const prediction of predictions) {
    const clippedPrediction = clamp(prediction, -1, 1);
    const error = clippedPrediction - target;
    stats.samples += 1;
    stats.squaredError += error * error;
    if (target !== 0) {
      stats.decisiveSamples += 1;
      if (Math.sign(clippedPrediction) === Math.sign(target)) {
        stats.correctSigns += 1;
      }
    }
  }
}

export function summarizeValuePredictionStats(stats: ValuePredictionStats): ValuePredictionSummary {
  return {
    mse: stats.samples > 0 ? stats.squaredError / stats.samples : 0,
    signAccuracy:
      stats.decisiveSamples > 0 ? stats.correctSigns / stats.decisiveSamples : 0,
    samples: stats.samples
  };
}

function valueTargetForOutcome(outcome: OutcomeLabel): number {
  if (outcome === "win") {
    return 1;
  }
  if (outcome === "loss") {
    return -1;
  }
  return 0;
}

export function normalizedDistributionEntropy(values: ArrayLike<number>): number {
  let total = 0;
  let active = 0;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value > 0) {
      total += value;
      active += 1;
    }
  }
  if (total <= 0 || active <= 1) {
    return 0;
  }

  let entropy = 0;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value > 0) {
      const probability = value / total;
      entropy -= probability * Math.log(probability);
    }
  }
  return entropy / Math.log(active);
}

export class ReplayBuffer {
  readonly capacity: number;
  private cursor = 0;
  private stored = 0;
  private states: Float32Array;
  private nextStates: Float32Array;
  private actions: Uint8Array;
  private rewards: Float32Array;
  private dones: Uint8Array;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.states = new Float32Array(capacity * OBSERVATION_SIZE);
    this.nextStates = new Float32Array(capacity * OBSERVATION_SIZE);
    this.actions = new Uint8Array(capacity);
    this.rewards = new Float32Array(capacity);
    this.dones = new Uint8Array(capacity);
  }

  get size(): number {
    return this.stored;
  }

  add(
    state: Float32Array,
    action: Action,
    reward: number,
    nextState: Float32Array,
    done: boolean
  ): void {
    const offset = this.cursor * OBSERVATION_SIZE;
    this.states.set(state, offset);
    this.nextStates.set(nextState, offset);
    this.actions[this.cursor] = action;
    this.rewards[this.cursor] = reward;
    this.dones[this.cursor] = done ? 1 : 0;
    this.cursor = (this.cursor + 1) % this.capacity;
    this.stored = Math.min(this.stored + 1, this.capacity);
  }

  read(index: number, state: Float32Array, nextState: Float32Array): ReplaySample {
    const offset = index * OBSERVATION_SIZE;
    state.set(this.states.subarray(offset, offset + OBSERVATION_SIZE));
    nextState.set(this.nextStates.subarray(offset, offset + OBSERVATION_SIZE));
    return {
      action: this.actions[index] as Action,
      reward: this.rewards[index],
      done: this.dones[index] === 1
    };
  }
}

interface ReplaySample {
  action: Action;
  reward: number;
  done: boolean;
}

export class Mlp {
  private static readonly HIDDEN1 = 48;
  private static readonly HIDDEN2 = 32;
  private w1: Float32Array;
  private b1: Float32Array;
  private w2: Float32Array;
  private b2: Float32Array;
  private w3: Float32Array;
  private b3: Float32Array;
  private gw1: Float32Array;
  private gb1: Float32Array;
  private gw2: Float32Array;
  private gb2: Float32Array;
  private gw3: Float32Array;
  private gb3: Float32Array;
  private mw1: Float32Array;
  private mb1: Float32Array;
  private mw2: Float32Array;
  private mb2: Float32Array;
  private mw3: Float32Array;
  private mb3: Float32Array;
  private vw1: Float32Array;
  private vb1: Float32Array;
  private vw2: Float32Array;
  private vb2: Float32Array;
  private vw3: Float32Array;
  private vb3: Float32Array;
  private z1 = new Float32Array(Mlp.HIDDEN1);
  private h1 = new Float32Array(Mlp.HIDDEN1);
  private z2 = new Float32Array(Mlp.HIDDEN2);
  private h2 = new Float32Array(Mlp.HIDDEN2);
  private out = new Float32Array(ACTION_COUNT);
  private dh1 = new Float32Array(Mlp.HIDDEN1);
  private dh2 = new Float32Array(Mlp.HIDDEN2);
  private currentInput = new Float32Array(OBSERVATION_SIZE);
  private t = 0;

  constructor(rng: Mulberry32) {
    this.w1 = initNormalWeights(Mlp.HIDDEN1 * OBSERVATION_SIZE, OBSERVATION_SIZE, rng, 2);
    this.b1 = new Float32Array(Mlp.HIDDEN1);
    this.w2 = initNormalWeights(Mlp.HIDDEN2 * Mlp.HIDDEN1, Mlp.HIDDEN1, rng, 2);
    this.b2 = new Float32Array(Mlp.HIDDEN2);
    this.w3 = initNormalWeights(ACTION_COUNT * Mlp.HIDDEN2, Mlp.HIDDEN2, rng, 2);
    this.b3 = new Float32Array(ACTION_COUNT);
    this.gw1 = new Float32Array(this.w1.length);
    this.gb1 = new Float32Array(this.b1.length);
    this.gw2 = new Float32Array(this.w2.length);
    this.gb2 = new Float32Array(this.b2.length);
    this.gw3 = new Float32Array(this.w3.length);
    this.gb3 = new Float32Array(this.b3.length);
    this.mw1 = new Float32Array(this.w1.length);
    this.mb1 = new Float32Array(this.b1.length);
    this.mw2 = new Float32Array(this.w2.length);
    this.mb2 = new Float32Array(this.b2.length);
    this.mw3 = new Float32Array(this.w3.length);
    this.mb3 = new Float32Array(this.b3.length);
    this.vw1 = new Float32Array(this.w1.length);
    this.vb1 = new Float32Array(this.b1.length);
    this.vw2 = new Float32Array(this.w2.length);
    this.vb2 = new Float32Array(this.b2.length);
    this.vw3 = new Float32Array(this.w3.length);
    this.vb3 = new Float32Array(this.b3.length);
  }

  copyFrom(other: Mlp): void {
    this.w1.set(other.w1);
    this.b1.set(other.b1);
    this.w2.set(other.w2);
    this.b2.set(other.b2);
    this.w3.set(other.w3);
    this.b3.set(other.b3);
  }

  predict(input: Float32Array, output: Float32Array): void {
    denseRelu(input, this.w1, this.b1, this.h1, Mlp.HIDDEN1, OBSERVATION_SIZE);
    denseRelu(this.h1, this.w2, this.b2, this.h2, Mlp.HIDDEN2, Mlp.HIDDEN1);
    denseLinear(this.h2, this.w3, this.b3, output, ACTION_COUNT, Mlp.HIDDEN2);
  }

  forward(input: Float32Array): void {
    this.currentInput.set(input);
    denseReluCached(input, this.w1, this.b1, this.z1, this.h1, Mlp.HIDDEN1, OBSERVATION_SIZE);
    denseReluCached(this.h1, this.w2, this.b2, this.z2, this.h2, Mlp.HIDDEN2, Mlp.HIDDEN1);
    denseLinear(this.h2, this.w3, this.b3, this.out, ACTION_COUNT, Mlp.HIDDEN2);
  }

  output(action: Action): number {
    return this.out[action];
  }

  zeroGrad(): void {
    this.gw1.fill(0);
    this.gb1.fill(0);
    this.gw2.fill(0);
    this.gb2.fill(0);
    this.gw3.fill(0);
    this.gb3.fill(0);
  }

  addGrad(action: Action, grad: number): void {
    this.dh2.fill(0);
    this.dh1.fill(0);
    this.gb3[action] += grad;
    const w3Offset = action * Mlp.HIDDEN2;
    for (let j = 0; j < Mlp.HIDDEN2; j += 1) {
      this.gw3[w3Offset + j] += grad * this.h2[j];
      this.dh2[j] += grad * this.w3[w3Offset + j];
    }
    for (let j = 0; j < Mlp.HIDDEN2; j += 1) {
      const delta2 = this.z2[j] > 0 ? this.dh2[j] : 0;
      this.gb2[j] += delta2;
      const w2Offset = j * Mlp.HIDDEN1;
      for (let k = 0; k < Mlp.HIDDEN1; k += 1) {
        this.gw2[w2Offset + k] += delta2 * this.h1[k];
        this.dh1[k] += delta2 * this.w2[w2Offset + k];
      }
    }
    for (let j = 0; j < Mlp.HIDDEN1; j += 1) {
      const delta1 = this.z1[j] > 0 ? this.dh1[j] : 0;
      this.gb1[j] += delta1;
      const w1Offset = j * OBSERVATION_SIZE;
      for (let k = 0; k < OBSERVATION_SIZE; k += 1) {
        this.gw1[w1Offset + k] += delta1 * this.currentInput[k];
      }
    }
  }

  applyGrad(learningRate: number, batchSize: number): void {
    this.t += 1;
    const scale = 1 / batchSize;
    adamStep(this.w1, this.gw1, this.mw1, this.vw1, learningRate, scale, this.t);
    adamStep(this.b1, this.gb1, this.mb1, this.vb1, learningRate, scale, this.t);
    adamStep(this.w2, this.gw2, this.mw2, this.vw2, learningRate, scale, this.t);
    adamStep(this.b2, this.gb2, this.mb2, this.vb2, learningRate, scale, this.t);
    adamStep(this.w3, this.gw3, this.mw3, this.vw3, learningRate, scale, this.t);
    adamStep(this.b3, this.gb3, this.mb3, this.vb3, learningRate, scale, this.t);
  }
}

export function discretize(
  observation: Float32Array,
  environment: TrainingConfig["environment"] = "flappy"
): number {
  if (environment === "gomoku") {
    return discretizeGomoku(observation);
  }

  const yBins = 16;
  const vyBins = 9;
  const dxBins = 16;
  const offBins = 17;
  const y = Math.min(yBins - 1, Math.max(0, Math.floor(observation[0] * yBins)));
  const vy = Math.min(
    vyBins - 1,
    Math.max(0, Math.floor(((observation[1] + 1) / 2) * vyBins))
  );
  const dx = Math.min(dxBins - 1, Math.max(0, Math.floor(observation[2] * dxBins)));
  const off = Math.min(
    offBins - 1,
    Math.max(0, Math.floor(((observation[4] + 1) / 2) * offBins))
  );
  return (((y * vyBins + vy) * dxBins + dx) * offBins + off) * ACTION_COUNT;
}

function discretizeGomoku(observation: Float32Array): number {
  let ownStones = 0;
  let opponentStones = 0;
  for (let i = 0; i < GOMOKU_CELLS; i += 1) {
    if (observation[i] > 0.5) {
      ownStones += 1;
    } else if (observation[i] < -0.5) {
      opponentStones += 1;
    }
  }

  const ownBin = Math.min(9, Math.floor(ownStones / 5));
  const opponentBin = Math.min(9, Math.floor(opponentStones / 5));
  const ownLine = Math.min(4, longestGomokuObservationLine(observation, 1));
  const opponentLine = Math.min(4, longestGomokuObservationLine(observation, -1));
  const center = gomokuObservationCenterControl(observation);
  return ((((ownBin * 10 + opponentBin) * 5 + ownLine) * 5 + opponentLine) * 3 + center) *
    ACTION_COUNT;
}

export function epsilonAt(step: number, config: TrainingConfig): number {
  const decay = Math.exp(-step / Math.max(1, config.epsilonDecaySteps));
  return config.epsilonMin + (config.epsilonStart - config.epsilonMin) * decay;
}

export function exponentialProgress(step: number, scale: number): number {
  return clamp(1 - Math.exp(-step / Math.max(1, scale)), 0, 1);
}

export function maxQ(
  values: Float32Array,
  stateIndex: number,
  availableActions: number,
  observation?: Float32Array,
  environment?: TrainingConfig["environment"]
): number {
  let best = Number.NEGATIVE_INFINITY;
  for (let action = 0; action < availableActions; action += 1) {
    if (!canUseAction(action, availableActions, observation, environment)) {
      continue;
    }
    best = Math.max(best, values[stateIndex + action]);
  }
  return best === Number.NEGATIVE_INFINITY ? values[stateIndex] : best;
}

export function argmaxQ(
  values: Float32Array,
  stateIndex: number,
  availableActions: number,
  observation?: Float32Array,
  environment?: TrainingConfig["environment"]
): Action {
  let bestAction = 0;
  let best = Number.NEGATIVE_INFINITY;
  for (let action = 0; action < availableActions; action += 1) {
    if (!canUseAction(action, availableActions, observation, environment)) {
      continue;
    }
    const value = values[stateIndex + action];
    if (value > best) {
      best = value;
      bestAction = action;
    }
  }
  return bestAction as Action;
}

export function argmaxValues(
  values: Float32Array,
  availableActions: number,
  observation?: Float32Array,
  environment?: TrainingConfig["environment"]
): Action {
  let bestAction = 0;
  let best = Number.NEGATIVE_INFINITY;
  for (let action = 0; action < availableActions; action += 1) {
    if (!canUseAction(action, availableActions, observation, environment)) {
      continue;
    }
    if (values[action] > best) {
      best = values[action];
      bestAction = action;
    }
  }
  return bestAction as Action;
}

export function softmaxPolicy(
  weights: Float32Array,
  observation: Float32Array,
  probabilities: Float32Array,
  availableActions: number,
  environment: TrainingConfig["environment"] = "flappy"
): void {
  let maxScore = Number.NEGATIVE_INFINITY;
  let legalCount = 0;
  for (let action = 0; action < availableActions; action += 1) {
    if (!canUseAction(action, availableActions, observation, environment)) {
      probabilities[action] = 0;
      continue;
    }
    const score = linearPolicyScore(weights, observation, action);
    probabilities[action] = score;
    maxScore = Math.max(maxScore, score);
    legalCount += 1;
  }
  for (let action = availableActions; action < ACTION_COUNT; action += 1) {
    probabilities[action] = 0;
  }
  if (legalCount === 0) {
    probabilities.fill(0);
    probabilities[0] = 1;
    return;
  }

  let normalizer = 0;
  for (let action = 0; action < availableActions; action += 1) {
    if (!canUseAction(action, availableActions, observation, environment)) {
      probabilities[action] = 0;
      continue;
    }
    const value = Math.exp(clamp(probabilities[action] - maxScore, -30, 30));
    probabilities[action] = value;
    normalizer += value;
  }

  for (let action = 0; action < availableActions; action += 1) {
    probabilities[action] = normalizer > 0 ? probabilities[action] / normalizer : 0;
  }
}

export function sampleSoftmaxPolicy(
  weights: Float32Array,
  observation: Float32Array,
  probabilities: Float32Array,
  rng: Mulberry32,
  availableActions: number,
  environment: TrainingConfig["environment"] = "flappy"
): Action {
  softmaxPolicy(weights, observation, probabilities, availableActions, environment);
  let sample = rng.next();
  let fallbackAction = 0;
  for (let action = 0; action < availableActions; action += 1) {
    if (probabilities[action] <= 0) {
      continue;
    }
    fallbackAction = action;
    sample -= probabilities[action];
    if (sample <= 0) {
      return action as Action;
    }
  }
  return fallbackAction as Action;
}

export function argmaxPolicy(
  weights: Float32Array,
  observation: Float32Array,
  availableActions: number,
  environment: TrainingConfig["environment"] = "flappy"
): Action {
  let bestAction = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let action = 0; action < availableActions; action += 1) {
    if (!canUseAction(action, availableActions, observation, environment)) {
      continue;
    }
    const score = linearPolicyScore(weights, observation, action);
    if (score > bestScore) {
      bestScore = score;
      bestAction = action;
    }
  }
  return bestAction as Action;
}

export function sampleRandomAction(
  rng: Mulberry32,
  observation: Float32Array,
  availableActions: number,
  environment: TrainingConfig["environment"]
): Action {
  let legalCount = 0;
  for (let action = 0; action < availableActions; action += 1) {
    if (canUseAction(action, availableActions, observation, environment)) {
      legalCount += 1;
    }
  }
  if (legalCount === 0) {
    return 0;
  }

  let selected = rng.int(legalCount);
  for (let action = 0; action < availableActions; action += 1) {
    if (!canUseAction(action, availableActions, observation, environment)) {
      continue;
    }
    if (selected === 0) {
      return action as Action;
    }
    selected -= 1;
  }
  return 0;
}

export function evaluateLinearPolicy(
  environment: TrainingConfig["environment"],
  weights: Float32Array,
  seed: number,
  maxEpisodeSteps: number,
  observation: Float32Array
): PolicyEvaluation {
  const env = createEnvironment(environment, seed);
  env.writeObservation(observation);
  let steps = 0;
  let done = false;
  while (!done && steps < maxEpisodeSteps) {
    done = env.step(
      argmaxPolicy(weights, observation, actionCountForEnvironment(environment), environment)
    );
    env.writeObservation(observation);
    steps += 1;
  }

  return {
    fitness: env.distance() + env.currentScore() * 1000,
    distance: env.distance(),
    steps
  };
}

export function pushEval(history: EvalPoint[], step: number, distance: number): void {
  history.push({ step, distance });
  if (history.length > 160) {
    history.shift();
  }
}

export function adamStep(
  param: Float32Array,
  grad: Float32Array,
  firstMoment: Float32Array,
  secondMoment: Float32Array,
  learningRate: number,
  scale: number,
  step: number
): void {
  const beta1 = 0.9;
  const beta2 = 0.999;
  const eps = 1e-8;
  const bias1 = 1 - beta1 ** step;
  const bias2 = 1 - beta2 ** step;
  for (let i = 0; i < param.length; i += 1) {
    const g = grad[i] * scale;
    firstMoment[i] = beta1 * firstMoment[i] + (1 - beta1) * g;
    secondMoment[i] = beta2 * secondMoment[i] + (1 - beta2) * g * g;
    param[i] -=
      (learningRate * (firstMoment[i] / bias1)) / (Math.sqrt(secondMoment[i] / bias2) + eps);
  }
}

export function huberLoss(error: number): number {
  const abs = Math.abs(error);
  return abs <= 1 ? 0.5 * error * error : abs - 0.5;
}

export function huberGrad(error: number): number {
  return clamp(error, -1, 1);
}

function linearPolicyScore(
  weights: Float32Array,
  observation: Float32Array,
  action: number
): number {
  const offset = action * (OBSERVATION_SIZE + 1);
  let score = weights[offset];
  for (let i = 0; i < OBSERVATION_SIZE; i += 1) {
    score += weights[offset + i + 1] * observation[i];
  }
  return score;
}

function canUseAction(
  action: number,
  availableActions: number,
  observation?: Float32Array,
  environment?: TrainingConfig["environment"]
): boolean {
  if (action < 0 || action >= availableActions) {
    return false;
  }
  return !observation || !environment || isActionLegal(environment, observation, action);
}

export function initNormalWeights(
  size: number,
  fanIn: number,
  rng: Mulberry32,
  varianceScale: number
): Float32Array {
  const weights = new Float32Array(size);
  const scale = Math.sqrt(varianceScale / fanIn);
  for (let i = 0; i < size; i += 1) {
    weights[i] = rng.normal() * scale;
  }
  return weights;
}

function denseRelu(
  input: Float32Array,
  weights: Float32Array,
  bias: Float32Array,
  output: Float32Array,
  rows: number,
  cols: number
): void {
  for (let row = 0; row < rows; row += 1) {
    let sum = bias[row];
    const offset = row * cols;
    for (let col = 0; col < cols; col += 1) {
      sum += weights[offset + col] * input[col];
    }
    output[row] = sum > 0 ? sum : 0;
  }
}

function denseReluCached(
  input: Float32Array,
  weights: Float32Array,
  bias: Float32Array,
  z: Float32Array,
  output: Float32Array,
  rows: number,
  cols: number
): void {
  for (let row = 0; row < rows; row += 1) {
    let sum = bias[row];
    const offset = row * cols;
    for (let col = 0; col < cols; col += 1) {
      sum += weights[offset + col] * input[col];
    }
    z[row] = sum;
    output[row] = sum > 0 ? sum : 0;
  }
}

function denseLinear(
  input: Float32Array,
  weights: Float32Array,
  bias: Float32Array,
  output: Float32Array,
  rows: number,
  cols: number
): void {
  for (let row = 0; row < rows; row += 1) {
    let sum = bias[row];
    const offset = row * cols;
    for (let col = 0; col < cols; col += 1) {
      sum += weights[offset + col] * input[col];
    }
    output[row] = sum;
  }
}
