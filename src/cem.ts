import {
  type Action,
  type EnvironmentSnapshot,
  type TrainerStats,
  type TrainingConfig,
  ACTION_COUNT,
  OBSERVATION_SIZE,
  POLICY_SIZE,
  Mulberry32,
  actionCountForEnvironment,
  createEnvironment
} from "./rl.ts";

export class LinearPolicy {
  readonly weights = new Float32Array(POLICY_SIZE);

  copyFrom(source: Float32Array): void {
    this.weights.set(source);
  }

  act(observation: Float32Array, availableActions = ACTION_COUNT): Action {
    return policyAction(this.weights, observation, availableActions);
  }
}

export class CemTrainer {
  readonly mean = new Float32Array(POLICY_SIZE);
  readonly std = new Float32Array(POLICY_SIZE);
  readonly bestPolicy = new LinearPolicy();

  private rng: Mulberry32;
  private candidates: CandidateResult[] = [];
  private candidatePolicy = new Float32Array(POLICY_SIZE);
  private observation = new Float32Array(OBSERVATION_SIZE);
  private bestFitness = Number.NEGATIVE_INFINITY;
  private generation = 0;
  private candidateIndex = 0;
  private bestDistance = 0;
  private bestEvalDistance = 0;
  private eliteMeanDistance = 0;

  constructor(
    private config: TrainingConfig,
    seed = 42
  ) {
    this.rng = new Mulberry32(seed);
    this.std.fill(config.initialStd);
  }

  updateConfig(config: TrainingConfig): void {
    this.config = config;
  }

  trainCandidate(seed: number): CemStepResult {
    this.samplePolicy(this.candidatePolicy);
    const result = this.evaluatePolicy(this.candidatePolicy, seed, this.config.maxEpisodeSteps);
    this.candidates.push(result);
    this.candidateIndex += 1;

    if (result.fitness > this.bestFitness) {
      this.bestFitness = result.fitness;
      this.bestDistance = Math.max(this.bestDistance, result.distance);
      this.bestPolicy.copyFrom(this.candidatePolicy);
    }

    if (this.candidates.length >= this.config.populationSize) {
      return {
        candidate: result,
        generationBest: this.finishGeneration(),
        generationComplete: true
      };
    }
    return {
      candidate: result,
      generationBest: null,
      generationComplete: false
    };
  }

  evaluateBest(seedBase: number): number {
    let total = 0;
    for (let i = 0; i < this.config.evalRuns; i += 1) {
      total += this.evaluatePolicy(
        this.bestPolicy.weights,
        seedBase + i,
        Math.max(this.config.maxEpisodeSteps, 5000)
      ).distance;
    }
    this.bestEvalDistance = Math.max(this.bestEvalDistance, total / this.config.evalRuns);
    return total / this.config.evalRuns;
  }

  preview(seed: number, maxSteps: number): EnvironmentSnapshot {
    const env = createEnvironment(this.config.environment, seed);
    env.writeObservation(this.observation);
    for (let i = 0; i < maxSteps; i += 1) {
      const done = env.step(
        this.bestPolicy.act(this.observation, actionCountForEnvironment(this.config.environment))
      );
      env.writeObservation(this.observation);
      if (done) {
        break;
      }
    }
    return env.snapshot();
  }

  stats(totalSteps: number, totalEpisodes: number, sps: number): TrainerStats {
    return {
      environment: this.config.environment,
      algorithm: "cem",
      steps: totalSteps,
      episodes: totalEpisodes,
      updates: this.generation,
      workItem: this.candidateIndex,
      bestDistance: this.bestDistance,
      bestEvalDistance: this.bestEvalDistance,
      objective: this.eliteMeanDistance,
      exploration: meanValue(this.std),
      replaySize: 0,
      sps
    };
  }

  private finishGeneration(): CandidateResult {
    this.candidates.sort((a, b) => b.fitness - a.fitness);
    const eliteCount = Math.min(this.config.eliteSize, this.candidates.length);
    const elites = this.candidates.slice(0, eliteCount);
    const top = elites[0];

    this.eliteMeanDistance =
      elites.reduce((sum, candidate) => sum + candidate.distance, 0) / eliteCount;

    for (let weight = 0; weight < POLICY_SIZE; weight += 1) {
      let average = 0;
      for (const candidate of elites) {
        average += candidate.weights[weight];
      }
      average /= eliteCount;
      this.mean[weight] = average;

      let variance = 0;
      for (const candidate of elites) {
        const diff = candidate.weights[weight] - average;
        variance += diff * diff;
      }
      this.std[weight] = Math.max(
        this.config.minStd,
        Math.sqrt(variance / eliteCount) * this.config.stdDecay
      );
    }

    this.generation += 1;
    this.candidateIndex = 0;
    this.candidates = [];
    return top;
  }

  private samplePolicy(target: Float32Array): void {
    for (let i = 0; i < POLICY_SIZE; i += 1) {
      target[i] = this.mean[i] + this.std[i] * this.rng.normal();
    }
  }

  private evaluatePolicy(
    weights: Float32Array,
    seed: number,
    maxEpisodeSteps: number
  ): CandidateResult {
    const env = createEnvironment(this.config.environment, seed);
    env.writeObservation(this.observation);

    let steps = 0;
    let done = false;
    while (!done && steps < maxEpisodeSteps) {
      done = env.step(
        policyAction(weights, this.observation, actionCountForEnvironment(this.config.environment))
      );
      env.writeObservation(this.observation);
      steps += 1;
    }

    return {
      weights: new Float32Array(weights),
      fitness: env.distance() + env.currentScore() * 1000,
      distance: env.distance(),
      steps
    };
  }
}

export interface CandidateResult {
  weights: Float32Array;
  fitness: number;
  distance: number;
  steps: number;
}

export interface CemStepResult {
  candidate: CandidateResult;
  generationBest: CandidateResult | null;
  generationComplete: boolean;
}

function policyAction(
  weights: Float32Array,
  observation: Float32Array,
  availableActions: number
): Action {
  let bestAction = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let action = 0; action < availableActions; action += 1) {
    const offset = action * (OBSERVATION_SIZE + 1);
    let score = weights[offset];
    for (let i = 0; i < OBSERVATION_SIZE; i += 1) {
      score += weights[offset + i + 1] * observation[i];
    }
    if (score > bestScore) {
      bestScore = score;
      bestAction = action;
    }
  }
  return bestAction as Action;
}

function meanValue(values: Float32Array): number {
  let total = 0;
  for (let i = 0; i < values.length; i += 1) {
    total += values[i];
  }
  return total / values.length;
}
