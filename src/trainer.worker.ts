import { type TrainerUpdate, type TrainingConfig, defaultTrainingConfig } from "./rl.ts";
import { type RuntimeTrainer, createRuntimeTrainer } from "./standardAlgorithms.ts";

type WorkerCommand =
  | { type: "start" }
  | { type: "pause" }
  | { type: "start-demo" }
  | { type: "pause-demo" }
  | { type: "reset"; config?: Partial<TrainingConfig> }
  | { type: "config"; config: Partial<TrainingConfig> };

type WorkerScope = {
  onmessage: ((event: MessageEvent<WorkerCommand>) => void) | null;
  postMessage(message: TrainerUpdate): void;
};

const scope = globalThis as unknown as WorkerScope;

let config = defaultTrainingConfig();
let trainer: RuntimeTrainer = createRuntimeTrainer(config);
let running = false;
let demoRunning = false;
let loopScheduled = false;
let demoLoopScheduled = false;
let lastReport = performance.now();
let lastReportStep = 0;
let sps = 0;
let demoSeed = 7000;

scope.onmessage = (event) => {
  const command = event.data;
  if (command.type === "start") {
    running = true;
    scheduleLoop();
  } else if (command.type === "pause") {
    running = false;
    postState();
  } else if (command.type === "start-demo") {
    demoRunning = true;
    trainer.resetDemo(demoSeed);
    scheduleDemoLoop();
    postState(trainer.demoSnapshot());
  } else if (command.type === "pause-demo") {
    demoRunning = false;
    postState();
  } else if (command.type === "reset") {
    config = normalizeConfig({ ...config, ...command.config });
    resetTrainer();
    postState();
  } else if (command.type === "config") {
    const previousAlgorithm = config.algorithm;
    const previousEnvironment = config.environment;
    config = normalizeConfig({ ...config, ...command.config });
    if (config.algorithm !== previousAlgorithm || config.environment !== previousEnvironment) {
      resetTrainer();
    } else {
      trainer.updateConfig(config);
    }
    postState();
  }
};

function resetTrainer(): void {
  trainer = createRuntimeTrainer(config);
  running = false;
  demoRunning = false;
  loopScheduled = false;
  demoLoopScheduled = false;
  demoSeed += 101;
  lastReport = performance.now();
  lastReportStep = 0;
  sps = 0;
}

function scheduleLoop(): void {
  if (!loopScheduled) {
    loopScheduled = true;
    setTimeout(trainLoop, 0);
  }
}

function scheduleDemoLoop(): void {
  if (!demoLoopScheduled) {
    demoLoopScheduled = true;
    setTimeout(demoLoop, 20);
  }
}

function trainLoop(): void {
  loopScheduled = false;
  if (!running) {
    return;
  }

  trainer.trainForBudget(config.trainBudgetMs);
  const now = performance.now();
  const stats = trainer.stats(sps);
  if (now - lastReport > 120) {
    const elapsed = Math.max(1, now - lastReport);
    sps = ((stats.steps - lastReportStep) * 1000) / elapsed;
    lastReport = now;
    lastReportStep = stats.steps;
    postState();
  }

  scheduleLoop();
}

function demoLoop(): void {
  demoLoopScheduled = false;
  if (!demoRunning) {
    return;
  }

  postState(trainer.demoStep());
  scheduleDemoLoop();
}

function postState(render = demoRunning ? trainer.demoSnapshot() : trainer.preview()): void {
  scope.postMessage({
    type: "state",
    running,
    demoRunning,
    stats: trainer.stats(sps),
    render,
    evalHistory: trainer.evalHistory
  });
}

function normalizeConfig(next: TrainingConfig): TrainingConfig {
  return {
    environment: next.environment,
    algorithm: next.algorithm,
    populationSize: clampInt(next.populationSize, 8, 256),
    eliteSize: clampInt(next.eliteSize, 2, Math.max(2, next.populationSize)),
    initialStd: clampNumber(next.initialStd, 0.05, 5),
    minStd: clampNumber(next.minStd, 0.001, 1),
    stdDecay: clampNumber(next.stdDecay, 0.5, 1),
    maxEpisodeSteps: clampInt(next.maxEpisodeSteps, 200, 10000),
    evalRuns: clampInt(next.evalRuns, 1, 50),
    candidatesPerBurst: clampInt(next.candidatesPerBurst, 1, 32),
    trainBudgetMs: clampNumber(next.trainBudgetMs, 2, 32),
    replayCapacity: clampInt(next.replayCapacity, 1000, 100000),
    batchSize: clampInt(next.batchSize, 8, 256),
    warmupSteps: clampInt(next.warmupSteps, 100, 20000),
    gamma: clampNumber(next.gamma, 0.8, 0.999),
    learningRate: clampNumber(next.learningRate, 0.00005, 0.01),
    epsilonStart: clampNumber(next.epsilonStart, 0.05, 1),
    epsilonMin: clampNumber(next.epsilonMin, 0, 0.5),
    epsilonDecaySteps: clampInt(next.epsilonDecaySteps, 1000, 200000),
    targetUpdateSteps: clampInt(next.targetUpdateSteps, 50, 10000),
    trainEverySteps: clampInt(next.trainEverySteps, 1, 32)
  };
}

function clampInt(value: number, min: number, max: number): number {
  return Math.trunc(clampNumber(value, min, max));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
