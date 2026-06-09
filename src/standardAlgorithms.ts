import {
  type Action,
  type EnvironmentSnapshot,
  type EvalPoint,
  type LearningEnvironment,
  type TrainerStats,
  type TrainingConfig,
  ACTION_COUNT,
  Mulberry32,
  OBSERVATION_SIZE,
  POLICY_SIZE,
  actionCountForEnvironment,
  createEnvironment
} from "./rl.ts";
import { CemTrainer } from "./cem.ts";
import {
  Mlp,
  ReplayBuffer,
  adamStep,
  argmaxPolicy,
  argmaxQ,
  argmaxValues,
  discretize,
  epsilonAt,
  evaluateLinearPolicy,
  huberGrad,
  huberLoss,
  maxQ,
  pushEval,
  sampleSoftmaxPolicy,
  softmaxPolicy
} from "./learningCore.ts";

export interface RuntimeTrainer {
  readonly evalHistory: EvalPoint[];
  updateConfig(config: TrainingConfig): void;
  trainForBudget(budgetMs: number): void;
  trainForSteps(stepBudget: number): void;
  preview(): EnvironmentSnapshot;
  resetDemo(seed: number): void;
  demoStep(): EnvironmentSnapshot;
  demoSnapshot(): EnvironmentSnapshot;
  stats(sps: number): TrainerStats;
}

export function createRuntimeTrainer(config: TrainingConfig): RuntimeTrainer {
  if (config.algorithm === "genetic") {
    return new LinearPolicySearchRuntime(config, "genetic");
  }
  if (config.algorithm === "hill-climb") {
    return new LinearPolicySearchRuntime(config, "hill-climb");
  }
  if (config.algorithm === "random-search") {
    return new LinearPolicySearchRuntime(config, "random-search");
  }
  if (config.algorithm === "double-dqn") {
    return new DoubleDqnRuntime(config);
  }
  if (config.algorithm === "q-learning") {
    return new QLearningRuntime(config);
  }
  if (config.algorithm === "sarsa") {
    return new SarsaRuntime(config);
  }
  if (config.algorithm === "reinforce") {
    return new ReinforceRuntime(config);
  }
  return new CemRuntime(config);
}

let runtimeSeedCounter = 0;

function nextRuntimeSeedOffset(): number {
  runtimeSeedCounter += 997;
  return runtimeSeedCounter;
}

type PolicySearchAlgorithm = "genetic" | "hill-climb" | "random-search";

class LinearPolicySearchRuntime implements RuntimeTrainer {
  readonly evalHistory: EvalPoint[] = [];
  private rng = new Mulberry32(101);
  private population = new Float32Array(0);
  private nextPopulation = new Float32Array(0);
  private fitness = new Float64Array(0);
  private distances = new Float64Array(0);
  private order: number[] = [];
  private candidateWeights = new Float32Array(POLICY_SIZE);
  private bestWeights = new Float32Array(POLICY_SIZE);
  private observation = new Float32Array(OBSERVATION_SIZE);
  private demoEnv: LearningEnvironment;
  private demoObservation = new Float32Array(OBSERVATION_SIZE);
  private steps = 0;
  private episodes = 0;
  private generation = 0;
  private acceptedMutations = 0;
  private candidateIndex = 0;
  private bestFitness = Number.NEGATIVE_INFINITY;
  private bestDistance = 0;
  private bestEvalDistance = 0;
  private objective = 0;
  private exploration: number;
  private previewSeed = 9000;
  private demoSeed = 7000;

  constructor(
    private config: TrainingConfig,
    private readonly algorithm: PolicySearchAlgorithm
  ) {
    const seedOffset = nextRuntimeSeedOffset();
    this.previewSeed += seedOffset;
    this.demoSeed += seedOffset;
    this.exploration = config.initialStd;
    this.demoEnv = createEnvironment(config.environment, this.demoSeed);
    this.demoEnv.writeObservation(this.demoObservation);
    this.initializePopulation(false);
  }

  updateConfig(config: TrainingConfig): void {
    const shouldResize = config.populationSize !== this.config.populationSize;
    this.config = config;
    if (shouldResize) {
      this.initializePopulation(this.bestFitness > Number.NEGATIVE_INFINITY);
    }
  }

  trainForBudget(budgetMs: number): void {
    const startedAt = performance.now();
    let candidates = 0;
    while (
      candidates < this.config.candidatesPerBurst &&
      performance.now() - startedAt < budgetMs
    ) {
      this.trainCandidate();
      candidates += 1;
    }
  }

  trainForSteps(stepBudget: number): void {
    const targetSteps = this.steps + stepBudget;
    while (this.steps < targetSteps) {
      this.trainCandidate();
    }
  }

  preview(): EnvironmentSnapshot {
    this.previewSeed += 1;
    return this.rollout(this.bestWeights, this.previewSeed, 140);
  }

  resetDemo(seed: number): void {
    this.demoSeed = seed;
    this.demoEnv = createEnvironment(this.config.environment, this.demoSeed);
    this.demoEnv.writeObservation(this.demoObservation);
  }

  demoStep(): EnvironmentSnapshot {
    const done = this.demoEnv.step(
      argmaxPolicy(
        this.bestWeights,
        this.demoObservation,
        actionCountForEnvironment(this.config.environment)
      )
    );
    this.demoEnv.writeObservation(this.demoObservation);
    const snapshot = this.demoEnv.snapshot();
    if (done) {
      this.resetDemo(this.demoSeed + 1);
    }
    return snapshot;
  }

  demoSnapshot(): EnvironmentSnapshot {
    return this.demoEnv.snapshot();
  }

  stats(sps: number): TrainerStats {
    return {
      algorithm: this.algorithm,
      environment: this.config.environment,
      steps: this.steps,
      episodes: this.episodes,
      updates: this.algorithm === "hill-climb" ? this.acceptedMutations : this.generation,
      workItem: this.candidateIndex,
      bestDistance: this.bestDistance,
      bestEvalDistance: this.bestEvalDistance,
      objective: this.objective,
      exploration: this.exploration,
      replaySize: 0,
      sps
    };
  }

  private initializePopulation(preserveBest: boolean): void {
    const populationSize = this.config.populationSize;
    this.population = new Float32Array(populationSize * POLICY_SIZE);
    this.nextPopulation = new Float32Array(populationSize * POLICY_SIZE);
    this.fitness = new Float64Array(populationSize);
    this.distances = new Float64Array(populationSize);
    this.order = Array.from({ length: populationSize }, (_, index) => index);
    for (let i = 0; i < this.population.length; i += 1) {
      this.population[i] = this.rng.normal() * this.config.initialStd;
    }
    if (preserveBest) {
      this.population.set(this.bestWeights, 0);
    }
    this.candidateIndex = 0;
  }

  private trainCandidate(): void {
    if (this.algorithm === "genetic") {
      this.candidateWeights.set(
        this.population.subarray(
          this.candidateIndex * POLICY_SIZE,
          (this.candidateIndex + 1) * POLICY_SIZE
        )
      );
    } else if (this.algorithm === "random-search" || this.bestFitness === Number.NEGATIVE_INFINITY) {
      this.sampleIndependent(this.candidateWeights);
    } else {
      this.sampleHillCandidate(this.candidateWeights);
    }

    const result = evaluateLinearPolicy(
      this.config.environment,
      this.candidateWeights,
      10000 + this.episodes,
      this.config.maxEpisodeSteps,
      this.observation
    );
    const previousBest = this.bestFitness;
    if (result.fitness > this.bestFitness) {
      this.bestFitness = result.fitness;
      this.bestDistance = Math.max(this.bestDistance, result.distance);
      this.bestWeights.set(this.candidateWeights);
      if (this.algorithm === "hill-climb" && previousBest > Number.NEGATIVE_INFINITY) {
        this.acceptedMutations += 1;
      }
    }

    if (this.algorithm === "genetic") {
      this.fitness[this.candidateIndex] = result.fitness;
      this.distances[this.candidateIndex] = result.distance;
    }
    this.objective = result.distance;
    this.steps += result.steps;
    this.episodes += 1;
    this.candidateIndex += 1;

    if (this.candidateIndex >= this.config.populationSize) {
      this.finishGeneration();
    }
  }

  private finishGeneration(): void {
    if (this.algorithm === "genetic") {
      this.order.sort((a, b) => this.fitness[b] - this.fitness[a]);
      const eliteCount = Math.min(this.config.eliteSize, this.config.populationSize);
      let eliteDistance = 0;
      for (let i = 0; i < eliteCount; i += 1) {
        const source = this.order[i] * POLICY_SIZE;
        this.nextPopulation.set(
          this.population.subarray(source, source + POLICY_SIZE),
          i * POLICY_SIZE
        );
        eliteDistance += this.distances[this.order[i]];
      }
      this.objective = eliteDistance / eliteCount;

      for (let child = eliteCount; child < this.config.populationSize; child += 1) {
        const parentA = this.order[this.rng.int(eliteCount)] * POLICY_SIZE;
        const parentB = this.order[this.rng.int(eliteCount)] * POLICY_SIZE;
        const target = child * POLICY_SIZE;
        for (let weight = 0; weight < POLICY_SIZE; weight += 1) {
          const blend = this.rng.next();
          let value =
            this.population[parentA + weight] * blend +
            this.population[parentB + weight] * (1 - blend);
          if (this.rng.next() < 0.2) {
            value += this.exploration * this.rng.normal();
          }
          this.nextPopulation[target + weight] = value;
        }
      }

      const previousPopulation = this.population;
      this.population = this.nextPopulation;
      this.nextPopulation = previousPopulation;
    } else if (this.algorithm === "hill-climb") {
      this.exploration = Math.max(this.config.minStd, this.exploration * this.config.stdDecay);
      this.objective = this.bestDistance;
    } else {
      this.objective = this.bestDistance;
    }

    this.generation += 1;
    this.candidateIndex = 0;
    const evalDistance = this.evaluateBest(60000 + this.generation * 97);
    pushEval(this.evalHistory, this.steps, evalDistance);
  }

  private evaluateBest(seedBase: number): number {
    let total = 0;
    for (let run = 0; run < this.config.evalRuns; run += 1) {
      total += evaluateLinearPolicy(
        this.config.environment,
        this.bestWeights,
        seedBase + run,
        Math.max(this.config.maxEpisodeSteps, 5000),
        this.observation
      ).distance;
    }
    const distance = total / this.config.evalRuns;
    this.bestEvalDistance = Math.max(this.bestEvalDistance, distance);
    return distance;
  }

  private sampleIndependent(target: Float32Array): void {
    for (let weight = 0; weight < POLICY_SIZE; weight += 1) {
      target[weight] = this.rng.normal() * this.config.initialStd;
    }
  }

  private sampleHillCandidate(target: Float32Array): void {
    for (let weight = 0; weight < POLICY_SIZE; weight += 1) {
      target[weight] = this.bestWeights[weight] + this.exploration * this.rng.normal();
    }
  }

  private rollout(weights: Float32Array, seed: number, maxSteps: number): EnvironmentSnapshot {
    const env = createEnvironment(this.config.environment, seed);
    env.writeObservation(this.observation);
    for (let step = 0; step < maxSteps; step += 1) {
      const done = env.step(
        argmaxPolicy(weights, this.observation, actionCountForEnvironment(this.config.environment))
      );
      env.writeObservation(this.observation);
      if (done) {
        break;
      }
    }
    return env.snapshot();
  }
}

class CemRuntime implements RuntimeTrainer {
  readonly evalHistory: EvalPoint[] = [];
  private trainer: CemTrainer;
  private demoEnv: LearningEnvironment;
  private demoObservation = new Float32Array(OBSERVATION_SIZE);
  private steps = 0;
  private episodes = 0;
  private previewSeed = 9000;
  private demoSeed = 7000;

  constructor(private config: TrainingConfig) {
    const seedOffset = nextRuntimeSeedOffset();
    this.previewSeed += seedOffset;
    this.demoSeed += seedOffset;
    this.trainer = new CemTrainer(config);
    this.demoEnv = createEnvironment(config.environment, this.demoSeed);
    this.demoEnv.writeObservation(this.demoObservation);
  }

  updateConfig(config: TrainingConfig): void {
    this.config = config;
    this.trainer.updateConfig(config);
  }

  trainForBudget(budgetMs: number): void {
    const startedAt = performance.now();
    let candidates = 0;
    while (
      candidates < this.config.candidatesPerBurst &&
      performance.now() - startedAt < budgetMs
    ) {
      this.trainCandidate();
      candidates += 1;
    }
  }

  trainForSteps(stepBudget: number): void {
    const targetSteps = this.steps + stepBudget;
    while (this.steps < targetSteps) {
      this.trainCandidate();
    }
  }

  preview(): EnvironmentSnapshot {
    this.previewSeed += 1;
    return this.trainer.preview(this.previewSeed, 140);
  }

  resetDemo(seed: number): void {
    this.demoSeed = seed;
    this.demoEnv = createEnvironment(this.config.environment, this.demoSeed);
    this.demoEnv.writeObservation(this.demoObservation);
  }

  demoStep(): EnvironmentSnapshot {
    const done = this.demoEnv.step(
      this.trainer.bestPolicy.act(
        this.demoObservation,
        actionCountForEnvironment(this.config.environment)
      )
    );
    this.demoEnv.writeObservation(this.demoObservation);
    const snapshot = this.demoEnv.snapshot();
    if (done) {
      this.resetDemo(this.demoSeed + 1);
    }
    return snapshot;
  }

  demoSnapshot(): EnvironmentSnapshot {
    return this.demoEnv.snapshot();
  }

  stats(sps: number): TrainerStats {
    return this.trainer.stats(this.steps, this.episodes, sps);
  }

  private trainCandidate(): void {
    const result = this.trainer.trainCandidate(10000 + this.episodes);
    this.steps += result.candidate.steps;
    this.episodes += 1;

    if (result.generationComplete) {
      const evalDistance = this.trainer.evaluateBest(20000 + this.stats(0).updates * 97);
      pushEval(this.evalHistory, this.steps, evalDistance);
    }
  }
}

class QLearningRuntime implements RuntimeTrainer {
  readonly evalHistory: EvalPoint[] = [];
  private env: LearningEnvironment;
  private demoEnv: LearningEnvironment;
  private rng = new Mulberry32(7);
  private observation = new Float32Array(OBSERVATION_SIZE);
  private nextObservation = new Float32Array(OBSERVATION_SIZE);
  private demoObservation = new Float32Array(OBSERVATION_SIZE);
  private q = new Float32Array(16 * 9 * 16 * 17 * ACTION_COUNT);
  private steps = 0;
  private episodes = 0;
  private updates = 0;
  private bestDistance = 0;
  private bestEvalDistance = 0;
  private lastAbsTd = 0;
  private demoSeed = 7000;

  constructor(private config: TrainingConfig) {
    const seedOffset = nextRuntimeSeedOffset();
    this.demoSeed += seedOffset;
    this.env = createEnvironment(config.environment, 1 + seedOffset);
    this.demoEnv = createEnvironment(config.environment, this.demoSeed);
    this.env.writeObservation(this.observation);
    this.demoEnv.writeObservation(this.demoObservation);
  }

  updateConfig(config: TrainingConfig): void {
    this.config = config;
  }

  trainForBudget(budgetMs: number): void {
    const startedAt = performance.now();
    do {
      for (let i = 0; i < 64; i += 1) {
        this.trainStep();
      }
    } while (performance.now() - startedAt < budgetMs);
  }

  trainForSteps(stepBudget: number): void {
    const targetSteps = this.steps + stepBudget;
    while (this.steps < targetSteps) {
      this.trainStep();
    }
  }

  preview(): EnvironmentSnapshot {
    return this.env.snapshot();
  }

  resetDemo(seed: number): void {
    this.demoSeed = seed;
    this.demoEnv = createEnvironment(this.config.environment, this.demoSeed);
    this.demoEnv.writeObservation(this.demoObservation);
  }

  demoStep(): EnvironmentSnapshot {
    const state = discretize(this.demoObservation);
    const done = this.demoEnv.step(
      argmaxQ(this.q, state, actionCountForEnvironment(this.config.environment))
    );
    this.demoEnv.writeObservation(this.demoObservation);
    const snapshot = this.demoEnv.snapshot();
    if (done) {
      this.resetDemo(this.demoSeed + 1);
    }
    return snapshot;
  }

  demoSnapshot(): EnvironmentSnapshot {
    return this.demoEnv.snapshot();
  }

  stats(sps: number): TrainerStats {
    const epsilon = epsilonAt(this.steps, this.config);
    return {
      algorithm: "q-learning",
      environment: this.config.environment,
      steps: this.steps,
      episodes: this.episodes,
      updates: this.updates,
      workItem: Math.round(epsilon * 1000),
      bestDistance: this.bestDistance,
      bestEvalDistance: this.bestEvalDistance,
      objective: this.lastAbsTd,
      exploration: epsilon,
      replaySize: 0,
      sps
    };
  }

  private trainStep(): void {
    const stateIndex = discretize(this.observation);
    const action = this.selectAction(stateIndex, epsilonAt(this.steps, this.config));
    const done = this.env.step(action);
    this.env.writeObservation(this.nextObservation);
    const nextIndex = discretize(this.nextObservation);
    const reward = this.env.reward();
    const target =
      reward +
      (done
        ? 0
        : this.config.gamma *
          maxQ(this.q, nextIndex, actionCountForEnvironment(this.config.environment)));
    const qIndex = stateIndex + action;
    const error = target - this.q[qIndex];
    const alpha = this.config.learningRate * 120;
    this.q[qIndex] += alpha * error;
    this.lastAbsTd = Math.abs(error);
    this.steps += 1;
    this.updates += 1;

    if (done) {
      this.bestDistance = Math.max(this.bestDistance, this.env.distance());
      this.episodes += 1;
      this.env.reset(this.episodes + 1);
      this.env.writeObservation(this.observation);
    } else {
      this.observation.set(this.nextObservation);
    }

    if (this.steps % 2000 === 0) {
      const distance = this.evaluate(30000 + this.steps);
      this.bestEvalDistance = Math.max(this.bestEvalDistance, distance);
      pushEval(this.evalHistory, this.steps, distance);
    }
  }

  private selectAction(stateIndex: number, epsilon: number): Action {
    const availableActions = actionCountForEnvironment(this.config.environment);
    if (this.rng.next() < epsilon) {
      return this.rng.int(availableActions) as Action;
    }
    return argmaxQ(this.q, stateIndex, availableActions);
  }

  private evaluate(seed: number): number {
    let total = 0;
    const evalObservation = new Float32Array(OBSERVATION_SIZE);
    for (let run = 0; run < this.config.evalRuns; run += 1) {
      const evalEnv = createEnvironment(this.config.environment, seed + run);
      evalEnv.writeObservation(evalObservation);
      let done = false;
      let guard = 0;
      while (!done && guard < 5000) {
        const state = discretize(evalObservation);
        done = evalEnv.step(
          argmaxQ(this.q, state, actionCountForEnvironment(this.config.environment))
        );
        evalEnv.writeObservation(evalObservation);
        guard += 1;
      }
      total += evalEnv.distance();
    }
    return total / this.config.evalRuns;
  }
}

class SarsaRuntime implements RuntimeTrainer {
  readonly evalHistory: EvalPoint[] = [];
  private env: LearningEnvironment;
  private demoEnv: LearningEnvironment;
  private rng = new Mulberry32(17);
  private observation = new Float32Array(OBSERVATION_SIZE);
  private nextObservation = new Float32Array(OBSERVATION_SIZE);
  private demoObservation = new Float32Array(OBSERVATION_SIZE);
  private q = new Float32Array(16 * 9 * 16 * 17 * ACTION_COUNT);
  private currentAction: Action | null = null;
  private steps = 0;
  private episodes = 0;
  private updates = 0;
  private bestDistance = 0;
  private bestEvalDistance = 0;
  private lastAbsTd = 0;
  private demoSeed = 7000;

  constructor(private config: TrainingConfig) {
    const seedOffset = nextRuntimeSeedOffset();
    this.demoSeed += seedOffset;
    this.env = createEnvironment(config.environment, 1 + seedOffset);
    this.demoEnv = createEnvironment(config.environment, this.demoSeed);
    this.env.writeObservation(this.observation);
    this.demoEnv.writeObservation(this.demoObservation);
  }

  updateConfig(config: TrainingConfig): void {
    this.config = config;
  }

  trainForBudget(budgetMs: number): void {
    const startedAt = performance.now();
    do {
      for (let i = 0; i < 64; i += 1) {
        this.trainStep();
      }
    } while (performance.now() - startedAt < budgetMs);
  }

  trainForSteps(stepBudget: number): void {
    const targetSteps = this.steps + stepBudget;
    while (this.steps < targetSteps) {
      this.trainStep();
    }
  }

  preview(): EnvironmentSnapshot {
    return this.env.snapshot();
  }

  resetDemo(seed: number): void {
    this.demoSeed = seed;
    this.demoEnv = createEnvironment(this.config.environment, this.demoSeed);
    this.demoEnv.writeObservation(this.demoObservation);
  }

  demoStep(): EnvironmentSnapshot {
    const state = discretize(this.demoObservation);
    const done = this.demoEnv.step(
      argmaxQ(this.q, state, actionCountForEnvironment(this.config.environment))
    );
    this.demoEnv.writeObservation(this.demoObservation);
    const snapshot = this.demoEnv.snapshot();
    if (done) {
      this.resetDemo(this.demoSeed + 1);
    }
    return snapshot;
  }

  demoSnapshot(): EnvironmentSnapshot {
    return this.demoEnv.snapshot();
  }

  stats(sps: number): TrainerStats {
    const epsilon = epsilonAt(this.steps, this.config);
    return {
      algorithm: "sarsa",
      environment: this.config.environment,
      steps: this.steps,
      episodes: this.episodes,
      updates: this.updates,
      workItem: Math.round(epsilon * 1000),
      bestDistance: this.bestDistance,
      bestEvalDistance: this.bestEvalDistance,
      objective: this.lastAbsTd,
      exploration: epsilon,
      replaySize: 0,
      sps
    };
  }

  private trainStep(): void {
    const stateIndex = discretize(this.observation);
    const action =
      this.currentAction ?? this.selectAction(stateIndex, epsilonAt(this.steps, this.config));
    const done = this.env.step(action);
    this.env.writeObservation(this.nextObservation);
    const nextIndex = discretize(this.nextObservation);
    let nextAction: Action = 0;
    let target = this.env.reward();
    if (!done) {
      nextAction = this.selectAction(nextIndex, epsilonAt(this.steps + 1, this.config));
      target += this.config.gamma * this.q[nextIndex + nextAction];
    }

    const qIndex = stateIndex + action;
    const error = target - this.q[qIndex];
    const alpha = this.config.learningRate * 120;
    this.q[qIndex] += alpha * error;
    this.lastAbsTd = Math.abs(error);
    this.steps += 1;
    this.updates += 1;

    if (done) {
      this.bestDistance = Math.max(this.bestDistance, this.env.distance());
      this.episodes += 1;
      this.currentAction = null;
      this.env.reset(this.episodes + 1);
      this.env.writeObservation(this.observation);
    } else {
      this.currentAction = nextAction;
      this.observation.set(this.nextObservation);
    }

    if (this.steps % 2000 === 0) {
      const distance = this.evaluate(70000 + this.steps);
      this.bestEvalDistance = Math.max(this.bestEvalDistance, distance);
      pushEval(this.evalHistory, this.steps, distance);
    }
  }

  private selectAction(stateIndex: number, epsilon: number): Action {
    const availableActions = actionCountForEnvironment(this.config.environment);
    if (this.rng.next() < epsilon) {
      return this.rng.int(availableActions) as Action;
    }
    return argmaxQ(this.q, stateIndex, availableActions);
  }

  private evaluate(seed: number): number {
    let total = 0;
    const evalObservation = new Float32Array(OBSERVATION_SIZE);
    for (let run = 0; run < this.config.evalRuns; run += 1) {
      const evalEnv = createEnvironment(this.config.environment, seed + run);
      evalEnv.writeObservation(evalObservation);
      let done = false;
      let guard = 0;
      while (!done && guard < 5000) {
        const state = discretize(evalObservation);
        done = evalEnv.step(
          argmaxQ(this.q, state, actionCountForEnvironment(this.config.environment))
        );
        evalEnv.writeObservation(evalObservation);
        guard += 1;
      }
      total += evalEnv.distance();
    }
    return total / this.config.evalRuns;
  }
}

class DoubleDqnRuntime implements RuntimeTrainer {
  readonly evalHistory: EvalPoint[] = [];
  private rng = new Mulberry32(42);
  private env: LearningEnvironment;
  private demoEnv: LearningEnvironment;
  private online = new Mlp(this.rng);
  private target = new Mlp(this.rng);
  private replay: ReplayBuffer;
  private observation = new Float32Array(OBSERVATION_SIZE);
  private nextObservation = new Float32Array(OBSERVATION_SIZE);
  private demoObservation = new Float32Array(OBSERVATION_SIZE);
  private q = new Float32Array(ACTION_COUNT);
  private demoQ = new Float32Array(ACTION_COUNT);
  private nextOnline = new Float32Array(ACTION_COUNT);
  private nextTarget = new Float32Array(ACTION_COUNT);
  private batchState = new Float32Array(OBSERVATION_SIZE);
  private batchNextState = new Float32Array(OBSERVATION_SIZE);
  private steps = 0;
  private episodes = 0;
  private updates = 0;
  private bestDistance = 0;
  private bestEvalDistance = 0;
  private lastLoss = 0;
  private demoSeed = 7000;

  constructor(private config: TrainingConfig) {
    const seedOffset = nextRuntimeSeedOffset();
    this.demoSeed += seedOffset;
    this.env = createEnvironment(config.environment, 1 + seedOffset);
    this.demoEnv = createEnvironment(config.environment, this.demoSeed);
    this.replay = new ReplayBuffer(config.replayCapacity);
    this.target.copyFrom(this.online);
    this.env.writeObservation(this.observation);
    this.demoEnv.writeObservation(this.demoObservation);
  }

  updateConfig(config: TrainingConfig): void {
    this.config = config;
  }

  trainForBudget(budgetMs: number): void {
    const startedAt = performance.now();
    do {
      for (let i = 0; i < 4; i += 1) {
        this.trainStep();
      }
    } while (performance.now() - startedAt < budgetMs);
  }

  trainForSteps(stepBudget: number): void {
    const targetSteps = this.steps + stepBudget;
    while (this.steps < targetSteps) {
      this.trainStep();
    }
  }

  preview(): EnvironmentSnapshot {
    return this.env.snapshot();
  }

  resetDemo(seed: number): void {
    this.demoSeed = seed;
    this.demoEnv = createEnvironment(this.config.environment, this.demoSeed);
    this.demoEnv.writeObservation(this.demoObservation);
  }

  demoStep(): EnvironmentSnapshot {
    this.online.predict(this.demoObservation, this.demoQ);
    const done = this.demoEnv.step(
      argmaxValues(this.demoQ, actionCountForEnvironment(this.config.environment))
    );
    this.demoEnv.writeObservation(this.demoObservation);
    const snapshot = this.demoEnv.snapshot();
    if (done) {
      this.resetDemo(this.demoSeed + 1);
    }
    return snapshot;
  }

  demoSnapshot(): EnvironmentSnapshot {
    return this.demoEnv.snapshot();
  }

  stats(sps: number): TrainerStats {
    return {
      algorithm: "double-dqn",
      environment: this.config.environment,
      steps: this.steps,
      episodes: this.episodes,
      updates: this.updates,
      workItem: this.replay.size,
      bestDistance: this.bestDistance,
      bestEvalDistance: this.bestEvalDistance,
      objective: this.lastLoss,
      exploration: epsilonAt(this.steps, this.config),
      replaySize: this.replay.size,
      sps
    };
  }

  private trainStep(): void {
    const action = this.selectAction(this.observation, epsilonAt(this.steps, this.config));
    const done = this.env.step(action);
    this.env.writeObservation(this.nextObservation);
    this.replay.add(this.observation, action, this.env.reward(), this.nextObservation, done);
    this.steps += 1;

    if (
      this.replay.size >= this.config.warmupSteps &&
      this.steps % this.config.trainEverySteps === 0
    ) {
      this.lastLoss = this.trainBatch();
      this.updates += 1;
    }
    if (this.steps % this.config.targetUpdateSteps === 0) {
      this.target.copyFrom(this.online);
    }

    if (done) {
      this.bestDistance = Math.max(this.bestDistance, this.env.distance());
      this.episodes += 1;
      this.env.reset(this.episodes + 1);
      this.env.writeObservation(this.observation);
    } else {
      this.observation.set(this.nextObservation);
    }

    if (this.steps % 2000 === 0 && this.replay.size >= this.config.warmupSteps) {
      const distance = this.evaluate(40000 + this.steps);
      this.bestEvalDistance = Math.max(this.bestEvalDistance, distance);
      pushEval(this.evalHistory, this.steps, distance);
    }
  }

  private selectAction(observation: Float32Array, epsilon: number): Action {
    const availableActions = actionCountForEnvironment(this.config.environment);
    if (this.rng.next() < epsilon) {
      return this.rng.int(availableActions) as Action;
    }
    this.online.predict(observation, this.q);
    return argmaxValues(this.q, availableActions);
  }

  private trainBatch(): number {
    this.online.zeroGrad();
    let totalLoss = 0;
    const batchSize = Math.min(this.config.batchSize, this.replay.size);

    for (let i = 0; i < batchSize; i += 1) {
      const sample = this.replay.read(
        this.rng.int(this.replay.size),
        this.batchState,
        this.batchNextState
      );
      this.online.predict(this.batchNextState, this.nextOnline);
      this.target.predict(this.batchNextState, this.nextTarget);
      const bestNext = argmaxValues(
        this.nextOnline,
        actionCountForEnvironment(this.config.environment)
      );
      const targetValue =
        sample.reward + (sample.done ? 0 : this.config.gamma * this.nextTarget[bestNext]);
      this.online.forward(this.batchState);
      const prediction = this.online.output(sample.action);
      const error = prediction - targetValue;
      totalLoss += huberLoss(error);
      this.online.addGrad(sample.action, huberGrad(error));
    }

    this.online.applyGrad(this.config.learningRate, batchSize);
    return totalLoss / batchSize;
  }

  private evaluate(seed: number): number {
    let total = 0;
    const evalObservation = new Float32Array(OBSERVATION_SIZE);
    for (let run = 0; run < this.config.evalRuns; run += 1) {
      const evalEnv = createEnvironment(this.config.environment, seed + run);
      evalEnv.writeObservation(evalObservation);
      let done = false;
      let guard = 0;
      while (!done && guard < 5000) {
        this.online.predict(evalObservation, this.q);
        done = evalEnv.step(
          argmaxValues(this.q, actionCountForEnvironment(this.config.environment))
        );
        evalEnv.writeObservation(evalObservation);
        guard += 1;
      }
      total += evalEnv.distance();
    }
    return total / this.config.evalRuns;
  }
}

class ReinforceRuntime implements RuntimeTrainer {
  readonly evalHistory: EvalPoint[] = [];
  private rng = new Mulberry32(11);
  private env: LearningEnvironment;
  private demoEnv: LearningEnvironment;
  private weights = new Float32Array(POLICY_SIZE);
  private grad = new Float32Array(POLICY_SIZE);
  private m = new Float32Array(POLICY_SIZE);
  private v = new Float32Array(POLICY_SIZE);
  private observation = new Float32Array(OBSERVATION_SIZE);
  private demoObservation = new Float32Array(OBSERVATION_SIZE);
  private episodeStates: Float32Array;
  private episodeActions: Uint8Array;
  private episodeRewards: Float32Array;
  private episodeReturns: Float32Array;
  private stateScratch = new Float32Array(OBSERVATION_SIZE);
  private actionProbabilities = new Float32Array(ACTION_COUNT);
  private episodeLength = 0;
  private steps = 0;
  private episodes = 0;
  private updates = 0;
  private bestDistance = 0;
  private bestEvalDistance = 0;
  private lastReturn = 0;
  private demoSeed = 7000;

  constructor(private config: TrainingConfig) {
    const seedOffset = nextRuntimeSeedOffset();
    this.demoSeed += seedOffset;
    this.env = createEnvironment(config.environment, 1 + seedOffset);
    this.demoEnv = createEnvironment(config.environment, this.demoSeed);
    this.episodeStates = new Float32Array(config.maxEpisodeSteps * OBSERVATION_SIZE);
    this.episodeActions = new Uint8Array(config.maxEpisodeSteps);
    this.episodeRewards = new Float32Array(config.maxEpisodeSteps);
    this.episodeReturns = new Float32Array(config.maxEpisodeSteps);
    this.env.writeObservation(this.observation);
    this.demoEnv.writeObservation(this.demoObservation);
  }

  updateConfig(config: TrainingConfig): void {
    if (config.maxEpisodeSteps !== this.config.maxEpisodeSteps) {
      this.episodeStates = new Float32Array(config.maxEpisodeSteps * OBSERVATION_SIZE);
      this.episodeActions = new Uint8Array(config.maxEpisodeSteps);
      this.episodeRewards = new Float32Array(config.maxEpisodeSteps);
      this.episodeReturns = new Float32Array(config.maxEpisodeSteps);
      this.episodeLength = 0;
    }
    this.config = config;
  }

  trainForBudget(budgetMs: number): void {
    const startedAt = performance.now();
    do {
      for (let i = 0; i < 64; i += 1) {
        this.trainStep();
      }
    } while (performance.now() - startedAt < budgetMs);
  }

  trainForSteps(stepBudget: number): void {
    const targetSteps = this.steps + stepBudget;
    while (this.steps < targetSteps) {
      this.trainStep();
    }
  }

  preview(): EnvironmentSnapshot {
    return this.env.snapshot();
  }

  resetDemo(seed: number): void {
    this.demoSeed = seed;
    this.demoEnv = createEnvironment(this.config.environment, this.demoSeed);
    this.demoEnv.writeObservation(this.demoObservation);
  }

  demoStep(): EnvironmentSnapshot {
    const done = this.demoEnv.step(
      argmaxPolicy(
        this.weights,
        this.demoObservation,
        actionCountForEnvironment(this.config.environment)
      )
    );
    this.demoEnv.writeObservation(this.demoObservation);
    const snapshot = this.demoEnv.snapshot();
    if (done) {
      this.resetDemo(this.demoSeed + 1);
    }
    return snapshot;
  }

  demoSnapshot(): EnvironmentSnapshot {
    return this.demoEnv.snapshot();
  }

  stats(sps: number): TrainerStats {
    return {
      algorithm: "reinforce",
      environment: this.config.environment,
      steps: this.steps,
      episodes: this.episodes,
      updates: this.updates,
      workItem: this.episodeLength,
      bestDistance: this.bestDistance,
      bestEvalDistance: this.bestEvalDistance,
      objective: this.lastReturn,
      exploration: 0,
      replaySize: 0,
      sps
    };
  }

  private trainStep(): void {
    const stateOffset = this.episodeLength * OBSERVATION_SIZE;
    this.episodeStates.set(this.observation, stateOffset);
    const action = sampleSoftmaxPolicy(
      this.weights,
      this.observation,
      this.actionProbabilities,
      this.rng,
      actionCountForEnvironment(this.config.environment)
    );
    this.episodeActions[this.episodeLength] = action;
    const done = this.env.step(action);
    this.episodeRewards[this.episodeLength] = this.env.reward();
    this.episodeLength += 1;
    this.env.writeObservation(this.observation);
    this.steps += 1;

    if (done || this.episodeLength >= this.config.maxEpisodeSteps) {
      this.bestDistance = Math.max(this.bestDistance, this.env.distance());
      this.finishEpisode();
      this.episodes += 1;
      this.env.reset(this.episodes + 1);
      this.env.writeObservation(this.observation);

      if (this.episodes % 20 === 0) {
        const distance = this.evaluate(50000 + this.episodes);
        this.bestEvalDistance = Math.max(this.bestEvalDistance, distance);
        pushEval(this.evalHistory, this.steps, distance);
      }
    }
  }

  private finishEpisode(): void {
    this.grad.fill(0);
    let returnValue = 0;
    for (let i = this.episodeLength - 1; i >= 0; i -= 1) {
      returnValue = this.episodeRewards[i] + this.config.gamma * returnValue;
      this.episodeReturns[i] = returnValue;
    }
    this.lastReturn = this.episodeReturns[0] ?? 0;

    for (let i = 0; i < this.episodeLength; i += 1) {
      const stateOffset = i * OBSERVATION_SIZE;
      this.stateScratch.set(
        this.episodeStates.subarray(stateOffset, stateOffset + OBSERVATION_SIZE)
      );
      const action = this.episodeActions[i];
      const availableActions = actionCountForEnvironment(this.config.environment);
      softmaxPolicy(this.weights, this.stateScratch, this.actionProbabilities, availableActions);
      for (let candidateAction = 0; candidateAction < availableActions; candidateAction += 1) {
        const coefficient =
          (this.actionProbabilities[candidateAction] - (candidateAction === action ? 1 : 0)) *
          this.episodeReturns[i];
        const offset = candidateAction * (OBSERVATION_SIZE + 1);
        this.grad[offset] += coefficient;
        for (let j = 0; j < OBSERVATION_SIZE; j += 1) {
          this.grad[offset + j + 1] += coefficient * this.stateScratch[j];
        }
      }
    }

    adamStep(
      this.weights,
      this.grad,
      this.m,
      this.v,
      this.config.learningRate,
      1 / Math.max(1, this.episodeLength),
      this.updates + 1
    );
    this.updates += 1;
    this.episodeLength = 0;
  }

  private evaluate(seed: number): number {
    let total = 0;
    const evalObservation = new Float32Array(OBSERVATION_SIZE);
    for (let run = 0; run < this.config.evalRuns; run += 1) {
      const evalEnv = createEnvironment(this.config.environment, seed + run);
      evalEnv.writeObservation(evalObservation);
      let done = false;
      let guard = 0;
      while (!done && guard < 5000) {
        done = evalEnv.step(
          argmaxPolicy(this.weights, evalObservation, actionCountForEnvironment(this.config.environment))
        );
        evalEnv.writeObservation(evalObservation);
        guard += 1;
      }
      total += evalEnv.distance();
    }
    return total / this.config.evalRuns;
  }
}

