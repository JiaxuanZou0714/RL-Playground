import {
  type Action,
  type EvalPoint,
  type GomokuSnapshot,
  type TrainerStats,
  type TrainingConfig,
  Mulberry32,
  clamp
} from "./rl.ts";
import {
  GOMOKU_CELLS,
  GOMOKU_SIZE,
  GOMOKU_SYMMETRY_COUNT,
  type GomokuPlayer,
  type GomokuWinner,
  type MutableGomokuState,
  GOMOKU_ARENA_OPENING_COUNT,
  applyGomokuArenaOpening,
  applyGomokuMove,
  evaluateGomokuBoard as evaluateBoard,
  firstLegalGomokuAction as firstLegalAction,
  gomokuImmediateTacticalAction as immediateTacticalAction,
  heuristicGomokuAction as heuristicAction,
  gomokuPlayerForWinner as playerForWinner,
  randomLegalGomokuAction as randomLegalAction,
  resetGomokuState,
  transformGomokuBoardAndPolicy,
  writeGomokuHeuristicPolicy as writeHeuristicPolicy
} from "./gomoku.ts";
import {
  adamStep,
  exponentialProgress,
  initNormalWeights,
  normalizedDistributionEntropy,
  pushEval
} from "./learningCore.ts";
import {
  type AlphaZeroEvaluation,
  GOMOKU_IN_PROGRESS_SCORE_BASE,
  GOMOKU_IN_PROGRESS_SCORE_SPAN,
  GOMOKU_EVALUATION_OPPONENTS,
  GOMOKU_EVALUATION_PLAYERS,
  GOMOKU_SELF_PLAY_DRAW_SCORE,
  GOMOKU_SELF_PLAY_WIN_SCORE,
  type GomokuArenaEvaluation,
  type GomokuEvaluationGameResult,
  type GomokuEvaluationOpponent,
  type GomokuEvaluationOutcome,
  alphaZeroEvaluationGameCount,
  alphaZeroEvaluationStats,
  emptyAlphaZeroEvaluation,
  gomokuEvaluationGameResult,
  newAlphaZeroEvaluationAccumulator,
  newGomokuArenaEvaluationAccumulator,
  passesGomokuChampionPromotion,
  recordAlphaZeroEvaluationGame,
  recordGomokuArenaEvaluationGame,
  summarizeAlphaZeroEvaluation,
  summarizeGomokuArenaEvaluation
} from "./gomokuEvaluation.ts";
import type { RuntimeTrainer } from "./standardAlgorithms.ts";

type Player = GomokuPlayer;

const ALPHA_ZERO_SETTINGS = {
  networkHiddenUnits: 96,
  rootDirichletAlpha: 0.3,
  rootExplorationFraction: 0.25,
  puctExploration: 1.4,
  selfPlayTemperatureMoves: 28,
  minPolicyProbability: 1e-6,
  valueHeuristicBias: 0.34,
  minPriorProbability: 0.0001,
  previewMoveLimit: 30,
  priorNetworkWeight: {
    initial: 0.3,
    span: 0.3,
    scaleSamples: 20000
  },
  valueNetworkWeight: {
    initial: 0.2,
    span: 0.35,
    scaleSamples: 20000
  }
} as const;

type SearchResult = {
  action: Action;
  policy: Float32Array;
  entropy: number;
  rootValue: number;
};

type SearchRecord = {
  board: Int8Array;
  player: Player;
  policy: Float32Array;
};

type MoveRecord = SearchRecord & {
  valueTarget: number;
};

type AlphaZeroTrainableParameter = {
  value: Float32Array;
  grad: Float32Array;
  moment1: Float32Array;
  moment2: Float32Array;
};

class AlphaZeroNetwork {
  private static readonly HIDDEN = ALPHA_ZERO_SETTINGS.networkHiddenUnits;
  private w1: Float32Array;
  private b1 = new Float32Array(AlphaZeroNetwork.HIDDEN);
  private policyW: Float32Array;
  private policyB = new Float32Array(GOMOKU_CELLS);
  private valueW: Float32Array;
  private valueB = new Float32Array(1);
  private gw1: Float32Array;
  private gb1 = new Float32Array(AlphaZeroNetwork.HIDDEN);
  private gPolicyW: Float32Array;
  private gPolicyB = new Float32Array(GOMOKU_CELLS);
  private gValueW: Float32Array;
  private gValueB = new Float32Array(1);
  private mw1: Float32Array;
  private mb1 = new Float32Array(AlphaZeroNetwork.HIDDEN);
  private mPolicyW: Float32Array;
  private mPolicyB = new Float32Array(GOMOKU_CELLS);
  private mValueW: Float32Array;
  private mValueB = new Float32Array(1);
  private vw1: Float32Array;
  private vb1 = new Float32Array(AlphaZeroNetwork.HIDDEN);
  private vPolicyW: Float32Array;
  private vPolicyB = new Float32Array(GOMOKU_CELLS);
  private vValueW: Float32Array;
  private vValueB = new Float32Array(1);
  private features = new Float32Array(GOMOKU_CELLS);
  private hidden = new Float32Array(AlphaZeroNetwork.HIDDEN);
  private policyLogits = new Float32Array(GOMOKU_CELLS);
  private policyProbs = new Float32Array(GOMOKU_CELLS);
  private hiddenGrad = new Float32Array(AlphaZeroNetwork.HIDDEN);
  private readonly trainableParameters: AlphaZeroTrainableParameter[];
  private valueInput = 0;
  private t = 0;

  constructor(rng: Mulberry32) {
    this.w1 = initNormalWeights(
      AlphaZeroNetwork.HIDDEN * GOMOKU_CELLS,
      GOMOKU_CELLS,
      rng,
      1
    );
    this.policyW = initNormalWeights(
      GOMOKU_CELLS * AlphaZeroNetwork.HIDDEN,
      AlphaZeroNetwork.HIDDEN,
      rng,
      1
    );
    this.valueW = initNormalWeights(AlphaZeroNetwork.HIDDEN, AlphaZeroNetwork.HIDDEN, rng, 1);
    this.gw1 = new Float32Array(this.w1.length);
    this.gPolicyW = new Float32Array(this.policyW.length);
    this.gValueW = new Float32Array(this.valueW.length);
    this.mw1 = new Float32Array(this.w1.length);
    this.mPolicyW = new Float32Array(this.policyW.length);
    this.mValueW = new Float32Array(this.valueW.length);
    this.vw1 = new Float32Array(this.w1.length);
    this.vPolicyW = new Float32Array(this.policyW.length);
    this.vValueW = new Float32Array(this.valueW.length);
    this.trainableParameters = [
      { value: this.w1, grad: this.gw1, moment1: this.mw1, moment2: this.vw1 },
      { value: this.b1, grad: this.gb1, moment1: this.mb1, moment2: this.vb1 },
      {
        value: this.policyW,
        grad: this.gPolicyW,
        moment1: this.mPolicyW,
        moment2: this.vPolicyW
      },
      {
        value: this.policyB,
        grad: this.gPolicyB,
        moment1: this.mPolicyB,
        moment2: this.vPolicyB
      },
      {
        value: this.valueW,
        grad: this.gValueW,
        moment1: this.mValueW,
        moment2: this.vValueW
      },
      {
        value: this.valueB,
        grad: this.gValueB,
        moment1: this.mValueB,
        moment2: this.vValueB
      }
    ];
  }

  predictPolicy(board: Int8Array, player: Player, target: Float32Array): void {
    this.forward(board, player);
    this.writePolicy(board, target);
  }

  predictValue(board: Int8Array, player: Player): number {
    this.forward(board, player);
    return Math.tanh(this.valueInput);
  }

  copyWeightsFrom(source: AlphaZeroNetwork): void {
    for (let i = 0; i < this.trainableParameters.length; i += 1) {
      this.trainableParameters[i].value.set(source.trainableParameters[i].value);
    }
  }

  trainBatch(
    records: readonly MoveRecord[],
    learningRate: number
  ): { policyLoss: number; valueLoss: number } {
    if (records.length === 0) {
      return { policyLoss: 0, valueLoss: 0 };
    }

    this.zeroGrad();
    let policyLoss = 0;
    let valueLoss = 0;
    for (const record of records) {
      const losses = this.accumulateGrad(
        record.board,
        record.player,
        record.policy,
        record.valueTarget
      );
      policyLoss += losses.policyLoss;
      valueLoss += losses.valueLoss;
    }
    this.applyGrad(learningRate, 1 / records.length);
    return {
      policyLoss: policyLoss / records.length,
      valueLoss: valueLoss / records.length
    };
  }

  private accumulateGrad(
    board: Int8Array,
    player: Player,
    policyTarget: Float32Array,
    valueTarget: number
  ): { policyLoss: number; valueLoss: number } {
    this.forward(board, player);
    this.writePolicy(board, this.policyProbs);

    let policyLoss = 0;
    this.hiddenGrad.fill(0);
    for (let action = 0; action < GOMOKU_CELLS; action += 1) {
      if (board[action] !== 0) {
        continue;
      }
      const target = policyTarget[action];
      if (target > 0) {
        policyLoss -=
          target *
          Math.log(
            Math.max(this.policyProbs[action], ALPHA_ZERO_SETTINGS.minPolicyProbability)
          );
      }
      const grad = this.policyProbs[action] - target;
      this.gPolicyB[action] += grad;
      const offset = action * AlphaZeroNetwork.HIDDEN;
      for (let hidden = 0; hidden < AlphaZeroNetwork.HIDDEN; hidden += 1) {
        this.gPolicyW[offset + hidden] += grad * this.hidden[hidden];
        this.hiddenGrad[hidden] += grad * this.policyW[offset + hidden];
      }
    }

    const value = Math.tanh(this.valueInput);
    const valueError = value - valueTarget;
    const valueLoss = valueError * valueError;
    const valueGrad = 2 * valueError * (1 - value * value);
    this.gValueB[0] += valueGrad;
    for (let hidden = 0; hidden < AlphaZeroNetwork.HIDDEN; hidden += 1) {
      this.gValueW[hidden] += valueGrad * this.hidden[hidden];
      this.hiddenGrad[hidden] += valueGrad * this.valueW[hidden];
    }

    for (let hidden = 0; hidden < AlphaZeroNetwork.HIDDEN; hidden += 1) {
      const hiddenValue = this.hidden[hidden];
      const grad = this.hiddenGrad[hidden] * (1 - hiddenValue * hiddenValue);
      this.gb1[hidden] += grad;
      const offset = hidden * GOMOKU_CELLS;
      for (let cell = 0; cell < GOMOKU_CELLS; cell += 1) {
        if (this.features[cell] !== 0) {
          this.gw1[offset + cell] += grad * this.features[cell];
        }
      }
    }

    return { policyLoss, valueLoss };
  }

  private forward(board: Int8Array, player: Player): void {
    for (let cell = 0; cell < GOMOKU_CELLS; cell += 1) {
      this.features[cell] = perspectiveCell(board[cell], player);
    }

    for (let hidden = 0; hidden < AlphaZeroNetwork.HIDDEN; hidden += 1) {
      const offset = hidden * GOMOKU_CELLS;
      let sum = this.b1[hidden];
      for (let cell = 0; cell < GOMOKU_CELLS; cell += 1) {
        if (this.features[cell] !== 0) {
          sum += this.w1[offset + cell] * this.features[cell];
        }
      }
      this.hidden[hidden] = Math.tanh(sum);
    }

    for (let action = 0; action < GOMOKU_CELLS; action += 1) {
      const offset = action * AlphaZeroNetwork.HIDDEN;
      let sum = this.policyB[action];
      for (let hidden = 0; hidden < AlphaZeroNetwork.HIDDEN; hidden += 1) {
        sum += this.policyW[offset + hidden] * this.hidden[hidden];
      }
      this.policyLogits[action] = sum;
    }

    let value =
      this.valueB[0] + evaluateBoard(board, player) * ALPHA_ZERO_SETTINGS.valueHeuristicBias;
    for (let hidden = 0; hidden < AlphaZeroNetwork.HIDDEN; hidden += 1) {
      value += this.valueW[hidden] * this.hidden[hidden];
    }
    this.valueInput = value;
  }

  private writePolicy(board: Int8Array, target: Float32Array): void {
    let maxLogit = Number.NEGATIVE_INFINITY;
    let legalCount = 0;
    for (let action = 0; action < GOMOKU_CELLS; action += 1) {
      if (board[action] !== 0) {
        target[action] = 0;
        continue;
      }
      maxLogit = Math.max(maxLogit, this.policyLogits[action]);
      legalCount += 1;
    }
    if (legalCount === 0) {
      target.fill(0);
      target[0] = 1;
      return;
    }

    let normalizer = 0;
    for (let action = 0; action < GOMOKU_CELLS; action += 1) {
      if (board[action] !== 0) {
        target[action] = 0;
        continue;
      }
      const value = Math.exp(clamp(this.policyLogits[action] - maxLogit, -30, 30));
      target[action] = value;
      normalizer += value;
    }
    for (let action = 0; action < GOMOKU_CELLS; action += 1) {
      target[action] = normalizer > 0 ? target[action] / normalizer : 0;
    }
  }

  private zeroGrad(): void {
    for (const parameter of this.trainableParameters) {
      parameter.grad.fill(0);
    }
  }

  private applyGrad(learningRate: number, scale: number): void {
    this.t += 1;
    for (const parameter of this.trainableParameters) {
      adamStep(
        parameter.value,
        parameter.grad,
        parameter.moment1,
        parameter.moment2,
        learningRate,
        scale,
        this.t
      );
    }
  }
}

class SearchNode {
  readonly children = new Map<number, SearchNode>();
  readonly priors = new Float32Array(GOMOKU_CELLS);
  readonly visits = new Uint16Array(GOMOKU_CELLS);
  readonly valueSums = new Float32Array(GOMOKU_CELLS);

  constructor(
    readonly board: Int8Array,
    readonly player: Player,
    readonly lastMove: number | null,
    readonly moves: number,
    readonly winner: GomokuWinner,
    readonly terminalValue: number
  ) {}
}

export class AlphaZeroRuntime implements RuntimeTrainer {
  readonly evalHistory: EvalPoint[] = [];

  private trainRng = new Mulberry32(73);
  private network = new AlphaZeroNetwork(this.trainRng);
  private championNetwork = new AlphaZeroNetwork(new Mulberry32(1907));
  private trainState = newGomokuState();
  private demoState = newGomokuState();
  private previewState = newGomokuState();
  private replay: MoveRecord[] = [];
  private episodeRecords: SearchRecord[] = [];
  private targetScratch = new Float32Array(GOMOKU_CELLS);
  private heuristicScratch = new Float32Array(GOMOKU_CELLS);
  private steps = 0;
  private episodes = 0;
  private updates = 0;
  private trainedSamples = 0;
  private bestDistance = 0;
  private bestEvalDistance = 0;
  private lastPolicyLoss = 0;
  private lastValueLoss = 0;
  private lastCombinedLoss = 0;
  private lastRootValue = 0;
  private policyEntropyEma = 0;
  private policyEntropySamples = 0;
  private lastEvaluation: AlphaZeroEvaluation = emptyAlphaZeroEvaluation();
  private championPromotions = 0;
  private championUpdate = 0;
  private demoSeed = 7000;

  constructor(private config: TrainingConfig) {
    this.championNetwork.copyWeightsFrom(this.network);
    this.resetState(this.trainState);
    this.resetState(this.demoState);
    this.resetState(this.previewState);
  }

  updateConfig(config: TrainingConfig): void {
    this.config = config;
  }

  trainForBudget(budgetMs: number): void {
    const startedAt = performance.now();
    do {
      this.trainMove();
    } while (performance.now() - startedAt < budgetMs);
  }

  trainForSteps(stepBudget: number): void {
    const targetSteps = this.steps + stepBudget;
    while (this.steps < targetSteps) {
      this.trainMove();
    }
  }

  preview(): GomokuSnapshot {
    if (
      this.previewState.winner !== null ||
      this.previewState.moves >=
        Math.min(ALPHA_ZERO_SETTINGS.previewMoveLimit, this.config.maxEpisodeSteps)
    ) {
      this.resetState(this.previewState);
    }
    this.playSearchMove(this.previewState, false);
    return snapshotFromState(this.previewState);
  }

  resetDemo(seed: number): void {
    this.demoSeed = seed;
    this.resetState(this.demoState);
  }

  demoStep(): GomokuSnapshot {
    if (this.demoState.winner !== null || this.demoState.moves >= this.searchMoveLimit()) {
      this.resetDemo(this.demoSeed + 1);
    } else {
      this.playSearchMove(this.demoState, false);
    }
    return snapshotFromState(this.demoState);
  }

  demoSnapshot(): GomokuSnapshot {
    return snapshotFromState(this.demoState);
  }

  stats(sps: number): TrainerStats {
    return {
      algorithm: "alpha-zero",
      environment: "gomoku",
      steps: this.steps,
      episodes: this.episodes,
      updates: this.updates,
      workItem: Math.max(1, Math.trunc(this.config.populationSize)),
      bestDistance: this.bestDistance,
      bestEvalDistance: this.bestEvalDistance,
      objective: this.lastCombinedLoss,
      exploration: clamp((this.lastRootValue + 1) / 2, 0, 1),
      replaySize: this.replay.length,
      policyLoss: this.lastPolicyLoss,
      valueLoss: this.lastValueLoss,
      policyEntropy: this.policyEntropyEma,
      searchValue: this.lastRootValue,
      ...alphaZeroEvaluationStats(this.lastEvaluation),
      championPromotions: this.championPromotions,
      sps
    };
  }

  private trainMove(): void {
    if (this.trainState.winner !== null || this.trainState.moves >= this.config.maxEpisodeSteps) {
      this.finishEpisode();
    }

    const search = this.search(this.trainState, true, this.network);
    this.episodeRecords.push({
      board: new Int8Array(this.trainState.board),
      player: this.trainState.player,
      policy: search.policy
    });
    applyMove(this.trainState, search.action);
    this.steps += 1;
    this.lastRootValue = search.rootValue;
    this.updatePolicyEntropy(search.entropy);

    if (this.trainState.winner !== null || this.trainState.moves >= this.config.maxEpisodeSteps) {
      this.finishEpisode();
    }

    if (this.steps % 2000 === 0) {
      const evaluation = this.evaluate(50000 + this.steps);
      this.lastEvaluation = evaluation;
      this.maybePromoteChampion(evaluation);
      this.bestEvalDistance = Math.max(this.bestEvalDistance, evaluation.score);
      pushEval(this.evalHistory, this.steps, evaluation.score);
    }
  }

  private finishEpisode(): void {
    const winner = this.trainState.winner;
    const distance = scoreState(this.trainState);
    this.bestDistance = Math.max(this.bestDistance, distance);

    for (let i = 0; i < this.episodeRecords.length; i += 1) {
      const record = this.episodeRecords[i];
      const valueTarget = valueTargetForWinner(winner, record.player);
      this.pushRecordWithSymmetry({ ...record, valueTarget });
    }

    const capacity = Math.max(1, Math.trunc(this.config.replayCapacity));
    if (this.replay.length > capacity) {
      this.replay.splice(0, this.replay.length - capacity);
    }

    const batch = this.sampleTrainingBatch();
    const batchSize = batch.length;
    if (batchSize > 0) {
      const losses = this.network.trainBatch(batch, this.config.learningRate);
      this.updates += 1;
      this.trainedSamples += batchSize;
      this.lastPolicyLoss = losses.policyLoss;
      this.lastValueLoss = losses.valueLoss;
      this.lastCombinedLoss = this.lastPolicyLoss + this.lastValueLoss;
    }

    this.episodeRecords.length = 0;
    this.episodes += 1;
    this.resetState(this.trainState);
  }

  private sampleTrainingBatch(): MoveRecord[] {
    const batchSize = Math.min(Math.max(1, Math.trunc(this.config.batchSize)), this.replay.length);
    const batch: MoveRecord[] = [];
    for (let i = 0; i < batchSize; i += 1) {
      batch.push(this.replay[this.trainRng.int(this.replay.length)]);
    }
    return batch;
  }

  private playSearchMove(state: GomokuState, stochastic: boolean): void {
    const search = this.search(state, stochastic, this.network);
    applyMove(state, search.action);
  }

  private search(
    state: GomokuState,
    stochastic: boolean,
    network: AlphaZeroNetwork
  ): SearchResult {
    const root = nodeFromState(state);
    this.expand(root, network);
    if (stochastic) {
      this.addRootDirichletNoise(root);
    }

    const simulations = Math.max(1, Math.trunc(this.config.populationSize));
    for (let i = 0; i < simulations; i += 1) {
      this.simulate(root, network);
    }

    const policy = new Float32Array(GOMOKU_CELLS);
    const useTemperature =
      stochastic && state.moves < ALPHA_ZERO_SETTINGS.selfPlayTemperatureMoves;
    const temperature = useTemperature ? 1 : 0;
    writeVisitPolicy(root, policy, temperature);
    const action = useTemperature ? samplePolicy(this.trainRng, policy) : bestPolicyAction(policy);
    return {
      action,
      policy,
      entropy: normalizedDistributionEntropy(root.visits),
      rootValue: searchRootValue(root)
    };
  }

  private addRootDirichletNoise(node: SearchNode): void {
    const legalActions: number[] = [];
    for (let action = 0; action < GOMOKU_CELLS; action += 1) {
      if (node.board[action] === 0) {
        legalActions.push(action);
      }
    }
    if (legalActions.length <= 1) {
      return;
    }

    const noise = new Float32Array(legalActions.length);
    let noiseTotal = 0;
    for (let i = 0; i < legalActions.length; i += 1) {
      const value = sampleGamma(this.trainRng, ALPHA_ZERO_SETTINGS.rootDirichletAlpha);
      noise[i] = value;
      noiseTotal += value;
    }
    if (noiseTotal <= 0) {
      return;
    }

    let priorTotal = 0;
    for (let i = 0; i < legalActions.length; i += 1) {
      const action = legalActions[i];
      node.priors[action] =
        node.priors[action] * (1 - ALPHA_ZERO_SETTINGS.rootExplorationFraction) +
        (noise[i] / noiseTotal) * ALPHA_ZERO_SETTINGS.rootExplorationFraction;
      priorTotal += node.priors[action];
    }
    if (priorTotal <= 0) {
      return;
    }
    for (const action of legalActions) {
      node.priors[action] /= priorTotal;
    }
  }

  private simulate(root: SearchNode, network: AlphaZeroNetwork): number {
    const path: Array<{ node: SearchNode; action: number }> = [];
    let node = root;

    while (!this.isSearchTerminal(node)) {
      if (node.children.size === 0) {
        this.expand(node, network);
      }
      const action = this.selectAction(node);
      path.push({ node, action });
      const existing = node.children.get(action);
      if (existing) {
        node = existing;
        continue;
      }

      const childState = stateFromNode(node);
      applyMove(childState, action);
      const child = nodeFromState(childState);
      node.children.set(action, child);
      node = child;
      break;
    }

    let value = terminalValueForNode(node);
    if (!this.isSearchTerminal(node)) {
      this.expand(node, network);
      const networkWeight = this.networkValueWeight();
      value =
        evaluateBoard(node.board, node.player) * (1 - networkWeight) +
        network.predictValue(node.board, node.player) * networkWeight;
    }

    for (let i = path.length - 1; i >= 0; i -= 1) {
      const { node: visitedNode, action } = path[i];
      visitedNode.visits[action] += 1;
      visitedNode.valueSums[action] += value;
      value = -value;
    }

    return value;
  }

  private isSearchTerminal(node: SearchNode): boolean {
    return node.winner !== null || node.moves >= this.searchMoveLimit();
  }

  private searchMoveLimit(): number {
    return Math.max(1, Math.min(GOMOKU_CELLS, Math.trunc(this.config.maxEpisodeSteps)));
  }

  private expand(node: SearchNode, network: AlphaZeroNetwork): void {
    if (node.winner !== null) {
      return;
    }
    network.predictPolicy(node.board, node.player, this.targetScratch);
    writeHeuristicPolicy(node.board, node.player, this.heuristicScratch);
    const networkWeight = this.networkPriorWeight();
    let total = 0;
    for (let action = 0; action < GOMOKU_CELLS; action += 1) {
      if (node.board[action] === 0) {
        const prior =
          networkWeight * this.targetScratch[action] +
          (1 - networkWeight) * this.heuristicScratch[action];
        node.priors[action] = Math.max(ALPHA_ZERO_SETTINGS.minPriorProbability, prior);
        total += node.priors[action];
      } else {
        node.priors[action] = 0;
      }
    }
    if (total <= 0) {
      writeHeuristicPolicy(node.board, node.player, node.priors);
      return;
    }
    for (let action = 0; action < GOMOKU_CELLS; action += 1) {
      node.priors[action] /= total;
    }
  }

  private networkPriorWeight(): number {
    const { initial, scaleSamples, span } = ALPHA_ZERO_SETTINGS.priorNetworkWeight;
    return initial + exponentialProgress(this.trainedSamples, scaleSamples) * span;
  }

  private networkValueWeight(): number {
    const { initial, scaleSamples, span } = ALPHA_ZERO_SETTINGS.valueNetworkWeight;
    return initial + exponentialProgress(this.trainedSamples, scaleSamples) * span;
  }

  private selectAction(node: SearchNode): number {
    const tacticalAction = immediateTacticalAction(node.board, node.player);
    if (tacticalAction !== null) {
      return tacticalAction;
    }

    let parentVisits = 1;
    for (let action = 0; action < GOMOKU_CELLS; action += 1) {
      parentVisits += node.visits[action];
    }

    let bestAction = firstLegalAction(node.board);
    let bestScore = Number.NEGATIVE_INFINITY;
    const parentSqrt = Math.sqrt(parentVisits);
    for (let action = 0; action < GOMOKU_CELLS; action += 1) {
      if (node.board[action] !== 0) {
        continue;
      }
      const visits = node.visits[action];
      const q = visits > 0 ? -node.valueSums[action] / visits : 0;
      const u =
        ALPHA_ZERO_SETTINGS.puctExploration * node.priors[action] * parentSqrt / (1 + visits);
      const score = q + u;
      if (score > bestScore) {
        bestScore = score;
        bestAction = action;
      }
    }
    return bestAction;
  }

  private evaluate(seed: number): AlphaZeroEvaluation {
    const gamesPerSide = Math.max(1, Math.trunc(this.config.evalRuns / 4));
    const arena = this.evaluateArena();
    const accumulator = newAlphaZeroEvaluationAccumulator();

    for (const opponent of GOMOKU_EVALUATION_OPPONENTS) {
      for (const alphaPlayer of GOMOKU_EVALUATION_PLAYERS) {
        for (let run = 0; run < gamesPerSide; run += 1) {
          const result = this.evaluateGame(
            seed + alphaZeroEvaluationGameCount(accumulator) * 997 + run,
            alphaPlayer,
            opponent
          );
          recordAlphaZeroEvaluationGame(accumulator, opponent, alphaPlayer, result);
        }
      }
    }

    return summarizeAlphaZeroEvaluation(accumulator, arena, this.config.maxEpisodeSteps);
  }

  private evaluateGame(
    seed: number,
    alphaPlayer: Player,
    opponent: GomokuEvaluationOpponent
  ): GomokuEvaluationGameResult {
    const baselineRng = new Mulberry32(seed + 12007);
    const valuePredictions: number[] = [];
    return this.playEvaluationGame(
      alphaPlayer,
      (state) => {
        if (state.player === alphaPlayer) {
          valuePredictions.push(this.network.predictValue(state.board, state.player));
          return this.search(state, false, this.network).action;
        }
        return baselineAction(state.board, state.player, opponent, baselineRng);
      },
      undefined,
      valuePredictions
    );
  }

  private evaluateArena(): GomokuArenaEvaluation {
    const accumulator = newGomokuArenaEvaluationAccumulator();

    for (let openingIndex = 0; openingIndex < GOMOKU_ARENA_OPENING_COUNT; openingIndex += 1) {
      for (const candidatePlayer of GOMOKU_EVALUATION_PLAYERS) {
        const outcome = this.evaluateArenaGame(candidatePlayer, openingIndex);
        recordGomokuArenaEvaluationGame(accumulator, candidatePlayer, outcome);
      }
    }

    return summarizeGomokuArenaEvaluation(accumulator);
  }

  private evaluateArenaGame(
    candidatePlayer: Player,
    openingIndex: number
  ): GomokuEvaluationOutcome {
    return this.playEvaluationGame(
      candidatePlayer,
      (state) => {
        const network = state.player === candidatePlayer ? this.network : this.championNetwork;
        return this.search(state, false, network).action;
      },
      (state) => applyGomokuArenaOpening(state, openingIndex, this.config.maxEpisodeSteps)
    ).outcome;
  }

  private playEvaluationGame(
    scoredPlayer: Player,
    selectAction: (state: GomokuState) => number,
    setup: (state: GomokuState) => void = () => {},
    valuePredictions: number[] = []
  ): GomokuEvaluationGameResult {
    const state = newGomokuState();
    this.resetState(state);
    setup(state);

    while (state.winner === null && state.moves < this.config.maxEpisodeSteps) {
      applyMove(state, selectAction(state));
    }

    return gomokuEvaluationGameResult(
      state.winner,
      scoredPlayer,
      state.moves,
      valuePredictions
    );
  }

  private maybePromoteChampion(evaluation: AlphaZeroEvaluation): void {
    if (this.updates <= this.championUpdate) {
      return;
    }
    if (
      !passesGomokuChampionPromotion({
        arenaScore: evaluation.arenaScore,
        arenaLossRate: evaluation.arenaLossRate
      })
    ) {
      return;
    }
    this.championNetwork.copyWeightsFrom(this.network);
    this.championUpdate = this.updates;
    this.championPromotions += 1;
  }

  private updatePolicyEntropy(entropy: number): void {
    const value = clamp(entropy, 0, 1);
    this.policyEntropyEma =
      this.policyEntropySamples === 0 ? value : this.policyEntropyEma * 0.95 + value * 0.05;
    this.policyEntropySamples += 1;
  }

  private pushRecordWithSymmetry(record: MoveRecord): void {
    for (let symmetry = 0; symmetry < GOMOKU_SYMMETRY_COUNT; symmetry += 1) {
      const transformed = transformGomokuBoardAndPolicy(record.board, record.policy, symmetry);
      this.replay.push({
        board: transformed.board,
        player: record.player,
        policy: transformed.policy,
        valueTarget: record.valueTarget
      });
    }
  }

  private resetState(state: GomokuState): void {
    resetGomokuState(state);
    state.lastReward = 0;
  }
}

type GomokuState = MutableGomokuState & {
  lastReward: number;
};

function newGomokuState(): GomokuState {
  return {
    board: new Int8Array(GOMOKU_CELLS),
    player: 1,
    moves: 0,
    lastMove: null,
    winner: null,
    lastReward: 0
  };
}

function applyMove(state: GomokuState, action: number): void {
  const player = state.player;
  applyGomokuMove(state, action);
  if (state.winner === null) {
    state.lastReward = clamp((evaluateBoard(state.board, player) + 1) * 0.5, 0, 1) * 0.2;
  } else {
    state.lastReward = state.winner === "draw" ? 0 : 1;
  }
}

function snapshotFromState(state: GomokuState): GomokuSnapshot {
  return {
    kind: "gomoku",
    size: GOMOKU_SIZE,
    board: Array.from(state.board),
    currentPlayer: state.player,
    lastMove: state.lastMove,
    winner: state.winner,
    moves: state.moves,
    score: state.winner === "draw" ? 0.5 : state.winner === null ? 0 : 1,
    lastReward: state.lastReward
  };
}

function nodeFromState(state: GomokuState): SearchNode {
  return new SearchNode(
    new Int8Array(state.board),
    state.player,
    state.lastMove,
    state.moves,
    state.winner,
    valueTargetForWinner(state.winner, state.player)
  );
}

function stateFromNode(node: SearchNode): GomokuState {
  return {
    board: new Int8Array(node.board),
    player: node.player,
    moves: node.moves,
    lastMove: node.lastMove,
    winner: node.winner,
    lastReward: 0
  };
}

function searchRootValue(root: SearchNode): number {
  let rootValue = 0;
  let totalVisits = 0;
  for (let action = 0; action < GOMOKU_CELLS; action += 1) {
    const visits = root.visits[action];
    if (visits > 0) {
      rootValue += -root.valueSums[action];
      totalVisits += visits;
    }
  }
  return totalVisits > 0 ? rootValue / totalVisits : evaluateBoard(root.board, root.player);
}

function terminalValueForNode(node: SearchNode): number {
  return node.winner === null ? 0 : node.terminalValue;
}

function valueTargetForWinner(winner: GomokuWinner, player: Player): number {
  if (winner === "draw" || winner === null) {
    return 0;
  }
  return playerForWinner(winner) === player ? 1 : -1;
}

function scoreState(state: GomokuState): number {
  if (state.winner === "draw") {
    return GOMOKU_SELF_PLAY_DRAW_SCORE;
  }
  if (state.winner !== null) {
    return GOMOKU_SELF_PLAY_WIN_SCORE;
  }
  return GOMOKU_IN_PROGRESS_SCORE_BASE + Math.abs(evaluateBoard(state.board, 1)) * GOMOKU_IN_PROGRESS_SCORE_SPAN;
}

function baselineAction(
  board: Int8Array,
  player: Player,
  opponent: GomokuEvaluationOpponent,
  rng: Mulberry32
): number {
  if (opponent === "random") {
    return randomLegalAction(board, (legalCount) => rng.int(legalCount));
  }
  return heuristicAction(board, player, () => rng.next());
}

function writeVisitPolicy(node: SearchNode, target: Float32Array, temperature: number): void {
  target.fill(0);

  let totalVisits = 0;
  let bestAction = firstLegalAction(node.board);
  let bestVisits = -1;
  for (let action = 0; action < GOMOKU_CELLS; action += 1) {
    const visits = node.visits[action];
    totalVisits += visits;
    if (node.board[action] === 0 && visits > bestVisits) {
      bestVisits = visits;
      bestAction = action;
    }
  }

  if (totalVisits <= 0) {
    writeHeuristicPolicy(node.board, node.player, target);
    return;
  }

  if (temperature <= 0) {
    target[bestAction] = 1;
    return;
  }

  const exponent = 1 / temperature;
  let normalizer = 0;
  for (let action = 0; action < GOMOKU_CELLS; action += 1) {
    if (node.board[action] !== 0 || node.visits[action] <= 0) {
      continue;
    }
    const value = Math.pow(node.visits[action], exponent);
    target[action] = value;
    normalizer += value;
  }

  if (normalizer <= 0) {
    target[bestAction] = 1;
    return;
  }

  for (let action = 0; action < GOMOKU_CELLS; action += 1) {
    target[action] /= normalizer;
  }
}

function bestPolicyAction(policy: Float32Array): Action {
  let bestAction = 0;
  let best = Number.NEGATIVE_INFINITY;
  for (let action = 0; action < GOMOKU_CELLS; action += 1) {
    if (policy[action] > best) {
      best = policy[action];
      bestAction = action;
    }
  }
  return bestAction;
}

function samplePolicy(rng: Mulberry32, policy: Float32Array): Action {
  let sample = rng.next();
  let fallback = bestPolicyAction(policy);
  for (let action = 0; action < GOMOKU_CELLS; action += 1) {
    if (policy[action] <= 0) {
      continue;
    }
    fallback = action;
    sample -= policy[action];
    if (sample <= 0) {
      return action;
    }
  }
  return fallback;
}

function sampleGamma(rng: Mulberry32, alpha: number): number {
  if (alpha <= 0) {
    return 0;
  }

  if (alpha < 1) {
    const boosted = sampleGamma(rng, alpha + 1);
    return boosted * Math.pow(Math.max(rng.next(), Number.EPSILON), 1 / alpha);
  }

  const d = alpha - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    const x = rng.normal();
    const v = Math.pow(1 + c * x, 3);
    if (v <= 0) {
      continue;
    }
    const u = rng.next();
    if (u < 1 - 0.0331 * x ** 4) {
      return d * v;
    }
    if (Math.log(Math.max(u, Number.EPSILON)) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

function perspectiveCell(value: number, player: Player): number {
  if (value === 0) {
    return 0;
  }
  return value === player ? 1 : -1;
}
