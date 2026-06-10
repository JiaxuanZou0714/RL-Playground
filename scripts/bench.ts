import {
  type AlgorithmId,
  type EnvironmentId,
  type TrainerStats,
  type TrainingConfig,
  defaultTrainingConfig
} from "../src/rl.ts";
import {
  GOMOKU_EVALUATION_SCORE_TARGET,
  passesGomokuAlphaZeroStability
} from "../src/gomokuEvaluation.ts";
import { createRuntimeTrainer } from "../src/standardAlgorithms.ts";

type NumericTrainerStat = {
  [Key in keyof TrainerStats]: TrainerStats[Key] extends number | undefined ? Key : never;
}[keyof TrainerStats];

type BenchStatBinding = {
  statKey: NumericTrainerStat;
  format: (value: number | undefined) => number | null;
};

const BENCH_STAT_BINDINGS: readonly BenchStatBinding[] = [
  { statKey: "objective", format: fixed(4, 0) },
  { statKey: "policyLoss", format: fixed(4) },
  { statKey: "valueLoss", format: fixed(4) },
  { statKey: "policyEntropy", format: fixed(4) },
  { statKey: "searchValue", format: fixed(4) },
  { statKey: "exploration", format: fixed(4, 0) },
  { statKey: "replaySize", format: integer(0) },
  { statKey: "evalWinRate", format: rate },
  { statKey: "evalDrawRate", format: rate },
  { statKey: "evalLossRate", format: rate },
  { statKey: "evalRandomWinRate", format: rate },
  { statKey: "evalRandomDrawRate", format: rate },
  { statKey: "evalRandomLossRate", format: rate },
  { statKey: "evalHeuristicWinRate", format: rate },
  { statKey: "evalHeuristicDrawRate", format: rate },
  { statKey: "evalHeuristicLossRate", format: rate },
  { statKey: "evalBlackWinRate", format: rate },
  { statKey: "evalBlackDrawRate", format: rate },
  { statKey: "evalBlackLossRate", format: rate },
  { statKey: "evalBlackScore", format: rate },
  { statKey: "evalWhiteWinRate", format: rate },
  { statKey: "evalWhiteDrawRate", format: rate },
  { statKey: "evalWhiteLossRate", format: rate },
  { statKey: "evalWhiteScore", format: rate },
  { statKey: "evalValueMse", format: fixed(4) },
  { statKey: "evalValueSignAccuracy", format: rate },
  { statKey: "evalValueSamples", format: integer() },
  { statKey: "evalChampionWinRate", format: rate },
  { statKey: "evalChampionDrawRate", format: rate },
  { statKey: "evalChampionLossRate", format: rate },
  { statKey: "evalChampionScore", format: rate },
  { statKey: "evalChampionGames", format: integer() },
  { statKey: "evalChampionBlackWinRate", format: rate },
  { statKey: "evalChampionBlackDrawRate", format: rate },
  { statKey: "evalChampionBlackLossRate", format: rate },
  { statKey: "evalChampionBlackScore", format: rate },
  { statKey: "evalChampionWhiteWinRate", format: rate },
  { statKey: "evalChampionWhiteDrawRate", format: rate },
  { statKey: "evalChampionWhiteLossRate", format: rate },
  { statKey: "evalChampionWhiteScore", format: rate },
  { statKey: "championPromotions", format: integer() },
  { statKey: "evalAverageMoves", format: fixed(1) },
  { statKey: "evalGames", format: integer() }
];

const targetSteps = Number(process.argv[2] ?? 30000);
const algorithm = (process.argv[3] ?? "cem") as AlgorithmId;
const environmentArg = process.argv[4] ?? "flappy";
if (environmentArg !== "flappy" && environmentArg !== "pong" && environmentArg !== "gomoku") {
  throw new Error(
    `Unsupported environment "${environmentArg}". Expected "flappy", "pong", or "gomoku".`
  );
}
const environment = environmentArg as EnvironmentId;
const config: TrainingConfig = defaultTrainingConfig(environment, algorithm);
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
  pong: 1000,
  gomoku: GOMOKU_EVALUATION_SCORE_TARGET
};
const passedScoreTarget = finalStats.bestEvalDistance >= teachingTargets[environment];
const passedGomokuStability =
  environment !== "gomoku" ||
  algorithm !== "alpha-zero" ||
  passesGomokuAlphaZeroStability(finalStats);
const passedTeachingTarget = passedScoreTarget && passedGomokuStability;

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
      passedScoreTarget,
      passedGomokuStability,
      passedTeachingTarget,
      ...formatBenchStats(finalStats),
      heapUsedMB: Number((memory.heapUsed / 1024 / 1024).toFixed(1)),
      rssMB: Number((memory.rss / 1024 / 1024).toFixed(1))
    },
    null,
    2
  )
);

function rate(value: number | undefined): number | null {
  return fixed(3)(value);
}

function formatBenchStats(stats: TrainerStats): Record<string, number | null> {
  const output: Record<string, number | null> = {};
  for (const binding of BENCH_STAT_BINDINGS) {
    output[binding.statKey] = binding.format(stats[binding.statKey]);
  }
  return output;
}

function fixed(digits: number, fallback: number | null = null): (value: number | undefined) => number | null {
  return (value) => (value === undefined ? fallback : Number(value.toFixed(digits)));
}

function integer(fallback: number | null = null): (value: number | undefined) => number | null {
  return (value) => (value === undefined ? fallback : Math.round(value));
}
