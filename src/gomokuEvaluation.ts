import {
  type GomokuPlayer,
  type GomokuWinner,
  gomokuPlayerForWinner
} from "./gomoku.ts";
import {
  type OutcomeCounts,
  type OutcomeLabel,
  type OutcomeSummary,
  type ValuePredictionStats,
  newOutcomeCounts,
  newValuePredictionStats,
  recordOutcome,
  recordValuePredictions,
  summarizeOutcomeCounts,
  summarizeValuePredictionStats
} from "./learningCore.ts";

export const GOMOKU_EVALUATION_SCORE_MAX = 2000;
export const GOMOKU_EVALUATION_SCORE_TARGET = 1400;
export const GOMOKU_SELF_PLAY_WIN_SCORE = 2000;
export const GOMOKU_SELF_PLAY_DRAW_SCORE = 1400;
export const GOMOKU_IN_PROGRESS_SCORE_BASE = 900;
export const GOMOKU_IN_PROGRESS_SCORE_SPAN = 700;

export const GOMOKU_RANDOM_WIN_RATE_TARGET = 0.95;
export const GOMOKU_TOTAL_WIN_RATE_TARGET = 0.5;
export const GOMOKU_CHAMPION_PROMOTION_SCORE = 0.55;
export const GOMOKU_CHAMPION_PROMOTION_MAX_LOSS_RATE = 0.25;
export const GOMOKU_CHAMPION_ARENA_SCORE_TARGET = 0.5;
export const GOMOKU_CHAMPION_ARENA_MAX_LOSS_RATE = 0.25;
export const GOMOKU_CHAMPION_PROMOTION_MINIMUM = 1;

const GOMOKU_EVALUATION_SCORE_WEIGHTS = {
  winRate: 1400,
  drawRate: 500,
  randomWinRate: 200,
  heuristicWinRate: 350,
  speedAdjustedWinRate: 50
} as const;

export type GomokuEvaluationScoreInputs = {
  winRate: number;
  drawRate: number;
  randomWinRate: number;
  heuristicWinRate: number;
  speedBonus: number;
};

export type GomokuAlphaZeroStabilityStats = {
  evalLossRate?: number;
  evalRandomWinRate?: number;
  evalWinRate?: number;
  evalChampionScore?: number;
  evalChampionLossRate?: number;
  championPromotions?: number;
};

export type GomokuChampionPromotionStats = {
  arenaScore: number;
  arenaLossRate: number;
};

export const GOMOKU_EVALUATION_OPPONENTS = ["random", "heuristic"] as const;
export const GOMOKU_EVALUATION_PLAYERS = [1, -1] as const satisfies readonly GomokuPlayer[];
export type GomokuEvaluationOpponent = (typeof GOMOKU_EVALUATION_OPPONENTS)[number];
export type GomokuEvaluationOutcome = OutcomeLabel;

export type GomokuEvaluationGameResult = {
  outcome: GomokuEvaluationOutcome;
  moves: number;
  valuePredictions?: readonly number[];
};

export type GomokuArenaEvaluation = OutcomeSummary & {
  black: OutcomeSummary;
  white: OutcomeSummary;
};

export type AlphaZeroEvaluation = {
  score: number;
  games: number;
  winRate: number;
  drawRate: number;
  lossRate: number;
  averageMoves: number;
  randomWinRate: number;
  randomDrawRate: number;
  randomLossRate: number;
  heuristicWinRate: number;
  heuristicDrawRate: number;
  heuristicLossRate: number;
  blackWinRate: number;
  blackDrawRate: number;
  blackLossRate: number;
  blackScore: number;
  whiteWinRate: number;
  whiteDrawRate: number;
  whiteLossRate: number;
  whiteScore: number;
  valueMse: number;
  valueSignAccuracy: number;
  valueSamples: number;
  arenaWinRate: number;
  arenaDrawRate: number;
  arenaLossRate: number;
  arenaScore: number;
  arenaGames: number;
  arenaBlackWinRate: number;
  arenaBlackDrawRate: number;
  arenaBlackLossRate: number;
  arenaBlackScore: number;
  arenaWhiteWinRate: number;
  arenaWhiteDrawRate: number;
  arenaWhiteLossRate: number;
  arenaWhiteScore: number;
};

type AlphaZeroArenaEvaluationFields = Pick<
  AlphaZeroEvaluation,
  | "arenaWinRate"
  | "arenaDrawRate"
  | "arenaLossRate"
  | "arenaScore"
  | "arenaGames"
  | "arenaBlackWinRate"
  | "arenaBlackDrawRate"
  | "arenaBlackLossRate"
  | "arenaBlackScore"
  | "arenaWhiteWinRate"
  | "arenaWhiteDrawRate"
  | "arenaWhiteLossRate"
  | "arenaWhiteScore"
>;

type AlphaZeroOutcomeEvaluationFields = Pick<
  AlphaZeroEvaluation,
  | "games"
  | "winRate"
  | "drawRate"
  | "lossRate"
  | "randomWinRate"
  | "randomDrawRate"
  | "randomLossRate"
  | "heuristicWinRate"
  | "heuristicDrawRate"
  | "heuristicLossRate"
  | "blackWinRate"
  | "blackDrawRate"
  | "blackLossRate"
  | "blackScore"
  | "whiteWinRate"
  | "whiteDrawRate"
  | "whiteLossRate"
  | "whiteScore"
>;

type GomokuEvaluationOutcomeSummaries = {
  overall: OutcomeSummary;
  random: OutcomeSummary;
  heuristic: OutcomeSummary;
  black: OutcomeSummary;
  white: OutcomeSummary;
};

type AlphaZeroEvaluationStatKey =
  | "evalWinRate"
  | "evalDrawRate"
  | "evalLossRate"
  | "evalAverageMoves"
  | "evalGames"
  | "evalHeuristicWinRate"
  | "evalHeuristicDrawRate"
  | "evalHeuristicLossRate"
  | "evalBlackWinRate"
  | "evalBlackDrawRate"
  | "evalBlackLossRate"
  | "evalBlackScore"
  | "evalWhiteWinRate"
  | "evalWhiteDrawRate"
  | "evalWhiteLossRate"
  | "evalWhiteScore"
  | "evalValueMse"
  | "evalValueSignAccuracy"
  | "evalValueSamples"
  | "evalRandomWinRate"
  | "evalRandomDrawRate"
  | "evalRandomLossRate"
  | "evalChampionWinRate"
  | "evalChampionDrawRate"
  | "evalChampionLossRate"
  | "evalChampionScore"
  | "evalChampionGames"
  | "evalChampionBlackWinRate"
  | "evalChampionBlackDrawRate"
  | "evalChampionBlackLossRate"
  | "evalChampionBlackScore"
  | "evalChampionWhiteWinRate"
  | "evalChampionWhiteDrawRate"
  | "evalChampionWhiteLossRate"
  | "evalChampionWhiteScore";

type AlphaZeroEvaluationStatBinding = {
  statsKey: AlphaZeroEvaluationStatKey;
  evaluationKey: keyof AlphaZeroEvaluation;
};

const ALPHA_ZERO_EVALUATION_STAT_BINDINGS: readonly AlphaZeroEvaluationStatBinding[] = [
  { statsKey: "evalWinRate", evaluationKey: "winRate" },
  { statsKey: "evalDrawRate", evaluationKey: "drawRate" },
  { statsKey: "evalLossRate", evaluationKey: "lossRate" },
  { statsKey: "evalAverageMoves", evaluationKey: "averageMoves" },
  { statsKey: "evalGames", evaluationKey: "games" },
  { statsKey: "evalHeuristicWinRate", evaluationKey: "heuristicWinRate" },
  { statsKey: "evalHeuristicDrawRate", evaluationKey: "heuristicDrawRate" },
  { statsKey: "evalHeuristicLossRate", evaluationKey: "heuristicLossRate" },
  { statsKey: "evalBlackWinRate", evaluationKey: "blackWinRate" },
  { statsKey: "evalBlackDrawRate", evaluationKey: "blackDrawRate" },
  { statsKey: "evalBlackLossRate", evaluationKey: "blackLossRate" },
  { statsKey: "evalBlackScore", evaluationKey: "blackScore" },
  { statsKey: "evalWhiteWinRate", evaluationKey: "whiteWinRate" },
  { statsKey: "evalWhiteDrawRate", evaluationKey: "whiteDrawRate" },
  { statsKey: "evalWhiteLossRate", evaluationKey: "whiteLossRate" },
  { statsKey: "evalWhiteScore", evaluationKey: "whiteScore" },
  { statsKey: "evalValueMse", evaluationKey: "valueMse" },
  { statsKey: "evalValueSignAccuracy", evaluationKey: "valueSignAccuracy" },
  { statsKey: "evalValueSamples", evaluationKey: "valueSamples" },
  { statsKey: "evalRandomWinRate", evaluationKey: "randomWinRate" },
  { statsKey: "evalRandomDrawRate", evaluationKey: "randomDrawRate" },
  { statsKey: "evalRandomLossRate", evaluationKey: "randomLossRate" },
  { statsKey: "evalChampionWinRate", evaluationKey: "arenaWinRate" },
  { statsKey: "evalChampionDrawRate", evaluationKey: "arenaDrawRate" },
  { statsKey: "evalChampionLossRate", evaluationKey: "arenaLossRate" },
  { statsKey: "evalChampionScore", evaluationKey: "arenaScore" },
  { statsKey: "evalChampionGames", evaluationKey: "arenaGames" },
  { statsKey: "evalChampionBlackWinRate", evaluationKey: "arenaBlackWinRate" },
  { statsKey: "evalChampionBlackDrawRate", evaluationKey: "arenaBlackDrawRate" },
  { statsKey: "evalChampionBlackLossRate", evaluationKey: "arenaBlackLossRate" },
  { statsKey: "evalChampionBlackScore", evaluationKey: "arenaBlackScore" },
  { statsKey: "evalChampionWhiteWinRate", evaluationKey: "arenaWhiteWinRate" },
  { statsKey: "evalChampionWhiteDrawRate", evaluationKey: "arenaWhiteDrawRate" },
  { statsKey: "evalChampionWhiteLossRate", evaluationKey: "arenaWhiteLossRate" },
  { statsKey: "evalChampionWhiteScore", evaluationKey: "arenaWhiteScore" }
];

type GomokuEvaluationSide = "black" | "white";
type GomokuSideOutcomeCounts = Record<GomokuEvaluationSide, OutcomeCounts>;
type GomokuOpponentOutcomeCounts = Record<GomokuEvaluationOpponent, OutcomeCounts>;

type AlphaZeroEvaluationAccumulator = {
  counts: OutcomeCounts;
  opponentCounts: GomokuOpponentOutcomeCounts;
  sideCounts: GomokuSideOutcomeCounts;
  valueStats: ValuePredictionStats;
  totalMoves: number;
};

type GomokuArenaEvaluationAccumulator = {
  counts: OutcomeCounts;
  sideCounts: GomokuSideOutcomeCounts;
};

function newGomokuSideOutcomeCounts(): GomokuSideOutcomeCounts {
  return {
    black: newOutcomeCounts(),
    white: newOutcomeCounts()
  };
}

function gomokuSideForPlayer(player: GomokuPlayer): GomokuEvaluationSide {
  return player === 1 ? "black" : "white";
}

export function newAlphaZeroEvaluationAccumulator(): AlphaZeroEvaluationAccumulator {
  return {
    counts: newOutcomeCounts(),
    opponentCounts: {
      random: newOutcomeCounts(),
      heuristic: newOutcomeCounts()
    },
    sideCounts: newGomokuSideOutcomeCounts(),
    valueStats: newValuePredictionStats(),
    totalMoves: 0
  };
}

export function alphaZeroEvaluationGameCount(
  accumulator: AlphaZeroEvaluationAccumulator
): number {
  return accumulator.counts.games;
}

export function recordAlphaZeroEvaluationGame(
  accumulator: AlphaZeroEvaluationAccumulator,
  opponent: GomokuEvaluationOpponent,
  alphaPlayer: GomokuPlayer,
  result: GomokuEvaluationGameResult
): void {
  recordOutcome(accumulator.counts, result.outcome);
  recordOutcome(accumulator.opponentCounts[opponent], result.outcome);
  recordOutcome(accumulator.sideCounts[gomokuSideForPlayer(alphaPlayer)], result.outcome);
  recordValuePredictions(
    accumulator.valueStats,
    result.valuePredictions ?? [],
    result.outcome
  );
  accumulator.totalMoves += result.moves;
}

export function gomokuEvaluationGameResult(
  winner: GomokuWinner,
  scoredPlayer: GomokuPlayer,
  moves: number,
  valuePredictions?: readonly number[]
): GomokuEvaluationGameResult {
  if (winner === "draw" || winner === null) {
    return { outcome: "draw", moves, valuePredictions };
  }
  return {
    outcome: gomokuPlayerForWinner(winner) === scoredPlayer ? "win" : "loss",
    moves,
    valuePredictions
  };
}

export function summarizeAlphaZeroEvaluation(
  accumulator: AlphaZeroEvaluationAccumulator,
  arena: GomokuArenaEvaluation,
  maxEpisodeSteps: number
): AlphaZeroEvaluation {
  const summary = summarizeOutcomeCounts(accumulator.counts);
  const averageMoves =
    accumulator.counts.games > 0 ? accumulator.totalMoves / accumulator.counts.games : 0;
  const speedBonus = clampGomokuEvaluation(
    1 - averageMoves / Math.max(1, maxEpisodeSteps),
    0,
    1
  );
  const randomSummary = summarizeOutcomeCounts(accumulator.opponentCounts.random);
  const heuristicSummary = summarizeOutcomeCounts(accumulator.opponentCounts.heuristic);
  const blackSummary = summarizeOutcomeCounts(accumulator.sideCounts.black);
  const whiteSummary = summarizeOutcomeCounts(accumulator.sideCounts.white);
  const valueSummary = summarizeValuePredictionStats(accumulator.valueStats);

  return {
    ...alphaZeroOutcomeEvaluationFields({
      overall: summary,
      random: randomSummary,
      heuristic: heuristicSummary,
      black: blackSummary,
      white: whiteSummary
    }),
    averageMoves,
    valueMse: valueSummary.mse,
    valueSignAccuracy: valueSummary.signAccuracy,
    valueSamples: valueSummary.samples,
    ...alphaZeroArenaEvaluationFields(arena),
    score: scoreGomokuEvaluation({
      winRate: summary.winRate,
      drawRate: summary.drawRate,
      randomWinRate: randomSummary.winRate,
      heuristicWinRate: heuristicSummary.winRate,
      speedBonus
    })
  };
}

export function newGomokuArenaEvaluationAccumulator(): GomokuArenaEvaluationAccumulator {
  return {
    counts: newOutcomeCounts(),
    sideCounts: newGomokuSideOutcomeCounts()
  };
}

export function recordGomokuArenaEvaluationGame(
  accumulator: GomokuArenaEvaluationAccumulator,
  candidatePlayer: GomokuPlayer,
  outcome: GomokuEvaluationOutcome
): void {
  recordOutcome(accumulator.counts, outcome);
  recordOutcome(accumulator.sideCounts[gomokuSideForPlayer(candidatePlayer)], outcome);
}

export function summarizeGomokuArenaEvaluation(
  accumulator: GomokuArenaEvaluationAccumulator
): GomokuArenaEvaluation {
  return {
    ...summarizeOutcomeCounts(accumulator.counts),
    black: summarizeOutcomeCounts(accumulator.sideCounts.black),
    white: summarizeOutcomeCounts(accumulator.sideCounts.white)
  };
}

export function alphaZeroEvaluationStats(
  evaluation: AlphaZeroEvaluation
): Partial<Record<AlphaZeroEvaluationStatKey, number>> {
  const stats: Partial<Record<AlphaZeroEvaluationStatKey, number>> = {};
  for (const binding of ALPHA_ZERO_EVALUATION_STAT_BINDINGS) {
    stats[binding.statsKey] = evaluation[binding.evaluationKey];
  }
  return stats;
}

function alphaZeroArenaEvaluationFields(
  arena: GomokuArenaEvaluation
): AlphaZeroArenaEvaluationFields {
  return {
    arenaWinRate: arena.winRate,
    arenaDrawRate: arena.drawRate,
    arenaLossRate: arena.lossRate,
    arenaScore: arena.score,
    arenaGames: arena.games,
    arenaBlackWinRate: arena.black.winRate,
    arenaBlackDrawRate: arena.black.drawRate,
    arenaBlackLossRate: arena.black.lossRate,
    arenaBlackScore: arena.black.score,
    arenaWhiteWinRate: arena.white.winRate,
    arenaWhiteDrawRate: arena.white.drawRate,
    arenaWhiteLossRate: arena.white.lossRate,
    arenaWhiteScore: arena.white.score
  };
}

function alphaZeroOutcomeEvaluationFields(
  summaries: GomokuEvaluationOutcomeSummaries
): AlphaZeroOutcomeEvaluationFields {
  return {
    games: summaries.overall.games,
    winRate: summaries.overall.winRate,
    drawRate: summaries.overall.drawRate,
    lossRate: summaries.overall.lossRate,
    randomWinRate: summaries.random.winRate,
    randomDrawRate: summaries.random.drawRate,
    randomLossRate: summaries.random.lossRate,
    heuristicWinRate: summaries.heuristic.winRate,
    heuristicDrawRate: summaries.heuristic.drawRate,
    heuristicLossRate: summaries.heuristic.lossRate,
    blackWinRate: summaries.black.winRate,
    blackDrawRate: summaries.black.drawRate,
    blackLossRate: summaries.black.lossRate,
    blackScore: summaries.black.score,
    whiteWinRate: summaries.white.winRate,
    whiteDrawRate: summaries.white.drawRate,
    whiteLossRate: summaries.white.lossRate,
    whiteScore: summaries.white.score
  };
}

export function emptyAlphaZeroEvaluation(): AlphaZeroEvaluation {
  const emptySummary: OutcomeSummary = {
    games: 0,
    winRate: 0,
    drawRate: 0,
    lossRate: 0,
    score: 0
  };

  return {
    score: 0,
    ...alphaZeroOutcomeEvaluationFields({
      overall: emptySummary,
      random: emptySummary,
      heuristic: emptySummary,
      black: emptySummary,
      white: emptySummary
    }),
    averageMoves: 0,
    valueMse: 0,
    valueSignAccuracy: 0,
    valueSamples: 0,
    arenaWinRate: 0,
    arenaDrawRate: 0,
    arenaLossRate: 0,
    arenaScore: 0,
    arenaGames: 0,
    arenaBlackWinRate: 0,
    arenaBlackDrawRate: 0,
    arenaBlackLossRate: 0,
    arenaBlackScore: 0,
    arenaWhiteWinRate: 0,
    arenaWhiteDrawRate: 0,
    arenaWhiteLossRate: 0,
    arenaWhiteScore: 0
  };
}

export function scoreGomokuEvaluation(inputs: GomokuEvaluationScoreInputs): number {
  return clampGomokuEvaluation(
    inputs.winRate * GOMOKU_EVALUATION_SCORE_WEIGHTS.winRate +
      inputs.drawRate * GOMOKU_EVALUATION_SCORE_WEIGHTS.drawRate +
      inputs.randomWinRate * GOMOKU_EVALUATION_SCORE_WEIGHTS.randomWinRate +
      inputs.heuristicWinRate * GOMOKU_EVALUATION_SCORE_WEIGHTS.heuristicWinRate +
      inputs.winRate * inputs.speedBonus * GOMOKU_EVALUATION_SCORE_WEIGHTS.speedAdjustedWinRate,
    0,
    GOMOKU_EVALUATION_SCORE_MAX
  );
}

export function passesGomokuAlphaZeroStability(stats: GomokuAlphaZeroStabilityStats): boolean {
  return (
    (stats.evalLossRate ?? 1) === 0 &&
    (stats.evalRandomWinRate ?? 0) >= GOMOKU_RANDOM_WIN_RATE_TARGET &&
    (stats.evalWinRate ?? 0) >= GOMOKU_TOTAL_WIN_RATE_TARGET &&
    (stats.evalChampionScore ?? 0) >= GOMOKU_CHAMPION_ARENA_SCORE_TARGET &&
    (stats.evalChampionLossRate ?? 1) <= GOMOKU_CHAMPION_ARENA_MAX_LOSS_RATE &&
    (stats.championPromotions ?? 0) >= GOMOKU_CHAMPION_PROMOTION_MINIMUM
  );
}

export function passesGomokuChampionPromotion(stats: GomokuChampionPromotionStats): boolean {
  return (
    stats.arenaScore >= GOMOKU_CHAMPION_PROMOTION_SCORE &&
    stats.arenaLossRate <= GOMOKU_CHAMPION_PROMOTION_MAX_LOSS_RATE
  );
}

function clampGomokuEvaluation(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
