import {
  type AlgorithmId,
  type EnvironmentId,
  type TrainingConfig,
  defaultTrainingConfig
} from "../src/rl.ts";
import { createRuntimeTrainer } from "../src/standardAlgorithms.ts";

const targetSteps = Number(process.argv[2] ?? 30000);
const algorithm = (process.argv[3] ?? "cem") as AlgorithmId;
const environmentArg = process.argv[4] ?? "flappy";
if (environmentArg !== "flappy" && environmentArg !== "pong") {
  throw new Error(`Unsupported environment "${environmentArg}". Expected "flappy" or "pong".`);
}
const environment = environmentArg as EnvironmentId;
const config: TrainingConfig = {
  ...defaultTrainingConfig(),
  algorithm,
  environment
};
const trainer = createRuntimeTrainer(config);
const startedAt = performance.now();

while (trainer.stats(0).steps < targetSteps) {
  trainer.trainForSteps(targetSteps - trainer.stats(0).steps);
}

const elapsedMs = performance.now() - startedAt;
const finalStats = trainer.stats(0);
const memory =
  typeof process !== "undefined" && process.memoryUsage
    ? process.memoryUsage()
    : { heapUsed: 0, rss: 0 };

const teachingTargets: Record<EnvironmentId, number> = {
  flappy: 560,
  pong: 1000
};
const passedTeachingTarget = finalStats.bestEvalDistance >= teachingTargets[environment];

console.log(
  JSON.stringify(
    {
      environment,
      algorithm,
      targetSteps,
      actualSteps: finalStats.steps,
      elapsedMs: Math.round(elapsedMs),
      stepsPerSecond: Math.round((finalStats.steps * 1000) / elapsedMs),
      episodes: finalStats.episodes,
      updates: finalStats.updates,
      bestTrainingDistance: Math.round(finalStats.bestDistance),
      evalDistance: Math.round(finalStats.bestEvalDistance),
      passedTeachingTarget,
      objective: Number(finalStats.objective.toFixed(4)),
      exploration: Number(finalStats.exploration.toFixed(4)),
      replaySize: finalStats.replaySize,
      heapUsedMB: Number((memory.heapUsed / 1024 / 1024).toFixed(1)),
      rssMB: Number((memory.rss / 1024 / 1024).toFixed(1))
    },
    null,
    2
  )
);
