export const GOMOKU_SIZE = 10;
export const GOMOKU_CELLS = GOMOKU_SIZE * GOMOKU_SIZE;
export const GOMOKU_SYMMETRY_COUNT = 8;

export type GomokuPlayer = 1 | -1;
export type GomokuWinner = "black" | "white" | "draw" | null;

export interface MutableGomokuState {
  board: Int8Array;
  player: GomokuPlayer;
  moves: number;
  lastMove: number | null;
  winner: GomokuWinner;
}

export const GOMOKU_DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1]
] as const;

export function oppositePlayer(player: GomokuPlayer): GomokuPlayer {
  return player === 1 ? -1 : 1;
}

export function gomokuWinnerForPlayer(player: GomokuPlayer): Exclude<GomokuWinner, "draw" | null> {
  return player === 1 ? "black" : "white";
}

export function gomokuPlayerForWinner(
  winner: GomokuWinner
): GomokuPlayer | null {
  if (winner === "black") {
    return 1;
  }
  if (winner === "white") {
    return -1;
  }
  return null;
}

export function normalizeGomokuAction(action: number): number {
  const value = Number.isFinite(action) ? Math.trunc(action) : 0;
  return ((value % GOMOKU_CELLS) + GOMOKU_CELLS) % GOMOKU_CELLS;
}

export function gomokuIndex(row: number, col: number): number {
  return row * GOMOKU_SIZE + col;
}

export const GOMOKU_ARENA_OPENINGS: readonly (readonly number[])[] = [
  [],
  [gomokuIndex(4, 8), gomokuIndex(7, 5)]
];

export const GOMOKU_ARENA_OPENING_COUNT = GOMOKU_ARENA_OPENINGS.length;

export function isInsideGomoku(row: number, col: number): boolean {
  return row >= 0 && row < GOMOKU_SIZE && col >= 0 && col < GOMOKU_SIZE;
}

export function countGomokuDirection(
  board: Int8Array,
  row: number,
  col: number,
  dx: number,
  dy: number,
  player: GomokuPlayer
): { count: number; open: boolean } {
  let count = 0;
  let nextRow = row + dy;
  let nextCol = col + dx;
  while (
    isInsideGomoku(nextRow, nextCol) &&
    board[gomokuIndex(nextRow, nextCol)] === player
  ) {
    count += 1;
    nextRow += dy;
    nextCol += dx;
  }
  return {
    count,
    open: isInsideGomoku(nextRow, nextCol) && board[gomokuIndex(nextRow, nextCol)] === 0
  };
}

export function hasGomokuFive(
  board: Int8Array,
  action: number,
  player: GomokuPlayer
): boolean {
  const row = Math.floor(action / GOMOKU_SIZE);
  const col = action % GOMOKU_SIZE;
  for (const [dx, dy] of GOMOKU_DIRECTIONS) {
    const run =
      1 +
      countGomokuDirection(board, row, col, dx, dy, player).count +
      countGomokuDirection(board, row, col, -dx, -dy, player).count;
    if (run >= 5) {
      return true;
    }
  }
  return false;
}

export function gomokuPatternScore(board: Int8Array, player: GomokuPlayer): number {
  let score = 0;
  for (let cell = 0; cell < GOMOKU_CELLS; cell += 1) {
    if (board[cell] !== player) {
      continue;
    }
    const row = Math.floor(cell / GOMOKU_SIZE);
    const col = cell % GOMOKU_SIZE;
    for (const [dx, dy] of GOMOKU_DIRECTIONS) {
      const prevRow = row - dy;
      const prevCol = col - dx;
      if (
        isInsideGomoku(prevRow, prevCol) &&
        board[gomokuIndex(prevRow, prevCol)] === player
      ) {
        continue;
      }

      let run = 0;
      let nextRow = row;
      let nextCol = col;
      while (
        isInsideGomoku(nextRow, nextCol) &&
        board[gomokuIndex(nextRow, nextCol)] === player
      ) {
        run += 1;
        nextRow += dy;
        nextCol += dx;
      }

      const openBefore =
        isInsideGomoku(prevRow, prevCol) && board[gomokuIndex(prevRow, prevCol)] === 0
          ? 1
          : 0;
      const openAfter =
        isInsideGomoku(nextRow, nextCol) && board[gomokuIndex(nextRow, nextCol)] === 0
          ? 1
          : 0;
      score += gomokuLineScore(run, openBefore + openAfter);
    }
  }
  return score;
}

export function gomokuMovePatternScore(
  board: Int8Array,
  action: number,
  player: GomokuPlayer
): number {
  const row = Math.floor(action / GOMOKU_SIZE);
  const col = action % GOMOKU_SIZE;
  let score = 0;
  for (const [dx, dy] of GOMOKU_DIRECTIONS) {
    const forward = countGomokuDirection(board, row, col, dx, dy, player);
    const backward = countGomokuDirection(board, row, col, -dx, -dy, player);
    const run = 1 + forward.count + backward.count;
    const openEnds = (forward.open ? 1 : 0) + (backward.open ? 1 : 0);
    score += gomokuLineScore(run, openEnds);
  }
  return score;
}

export function gomokuMoveThreatLevel(
  board: Int8Array,
  action: number,
  player: GomokuPlayer
): number {
  if (board[action] !== 0) {
    return 0;
  }

  const row = Math.floor(action / GOMOKU_SIZE);
  const col = action % GOMOKU_SIZE;
  let best = 0;
  let fourThreats = 0;
  let openThrees = 0;

  for (const [dx, dy] of GOMOKU_DIRECTIONS) {
    const forward = countGomokuDirection(board, row, col, dx, dy, player);
    const backward = countGomokuDirection(board, row, col, -dx, -dy, player);
    const run = 1 + forward.count + backward.count;
    const openEnds = (forward.open ? 1 : 0) + (backward.open ? 1 : 0);

    if (run >= 5) {
      return 5;
    }
    if (run === 4 && openEnds > 0) {
      fourThreats += 1;
      best = Math.max(best, openEnds === 2 ? 4 : 3);
    } else if (run === 3 && openEnds === 2) {
      openThrees += 1;
      best = Math.max(best, 2);
    }
  }

  if (fourThreats >= 2 || (fourThreats >= 1 && openThrees >= 1)) {
    return 4;
  }
  if (openThrees >= 2) {
    return 3;
  }
  return best;
}

export function evaluateGomokuBoard(board: Int8Array, player: GomokuPlayer): number {
  const own = gomokuPatternScore(board, player);
  const opponent = gomokuPatternScore(board, oppositePlayer(player));
  return clampGomoku((own - opponent) / 1600, -1, 1);
}

export function gomokuHeuristicPrior(
  board: Int8Array,
  player: GomokuPlayer,
  action: number
): number {
  if (board[action] !== 0) {
    return 0;
  }
  const own = gomokuMovePatternScore(board, action, player);
  const block = gomokuMovePatternScore(board, action, oppositePlayer(player));
  const ownThreat = gomokuMoveThreatLevel(board, action, player);
  const blockThreat = gomokuMoveThreatLevel(board, action, oppositePlayer(player));
  const row = Math.floor(action / GOMOKU_SIZE);
  const col = action % GOMOKU_SIZE;
  const centerDistance = Math.abs(row - 4.5) + Math.abs(col - 4.5);
  const center = Math.max(0, 9 - centerDistance) * 2;
  return (
    1 +
    center +
    own * 1.2 +
    block * 1.25 +
    gomokuThreatBonus(ownThreat) * 1.05 +
    gomokuThreatBonus(blockThreat)
  );
}

export function gomokuImmediateTacticalAction(board: Int8Array, player: GomokuPlayer): number | null {
  const win = gomokuWinningAction(board, player);
  if (win !== null) {
    return win;
  }
  const blockWin = gomokuWinningAction(board, oppositePlayer(player));
  if (blockWin !== null) {
    return blockWin;
  }
  const blockForcingThreat = gomokuThreatAction(board, oppositePlayer(player), 4);
  if (blockForcingThreat !== null) {
    return blockForcingThreat;
  }
  const forcingThreat = gomokuThreatAction(board, player, 4);
  if (forcingThreat !== null) {
    return forcingThreat;
  }
  return null;
}

export function gomokuWinningAction(board: Int8Array, player: GomokuPlayer): number | null {
  for (let action = 0; action < GOMOKU_CELLS; action += 1) {
    if (gomokuMoveThreatLevel(board, action, player) >= 5) {
      return action;
    }
  }
  return null;
}

export function gomokuThreatAction(
  board: Int8Array,
  player: GomokuPlayer,
  minimumLevel: number
): number | null {
  let bestAction: number | null = null;
  let bestLevel = minimumLevel - 1;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let action = 0; action < GOMOKU_CELLS; action += 1) {
    if (board[action] !== 0) {
      continue;
    }
    const level = gomokuMoveThreatLevel(board, action, player);
    if (level < minimumLevel) {
      continue;
    }
    const score = gomokuMovePatternScore(board, action, player);
    if (level > bestLevel || (level === bestLevel && score > bestScore)) {
      bestLevel = level;
      bestScore = score;
      bestAction = action;
    }
  }
  return bestAction;
}

export function firstLegalGomokuAction(board: Int8Array): number {
  for (let action = 0; action < GOMOKU_CELLS; action += 1) {
    if (board[action] === 0) {
      return action;
    }
  }
  return 0;
}

export function writeGomokuHeuristicPolicy(
  board: Int8Array,
  player: GomokuPlayer,
  target: Float32Array
): void {
  let total = 0;
  for (let action = 0; action < GOMOKU_CELLS; action += 1) {
    const value = gomokuHeuristicPrior(board, player, action);
    target[action] = value;
    total += value;
  }
  if (total <= 0) {
    const action = firstLegalGomokuAction(board);
    target.fill(0);
    target[action] = 1;
    return;
  }
  for (let action = 0; action < GOMOKU_CELLS; action += 1) {
    target[action] /= total;
  }
}

export function randomLegalGomokuAction(
  board: Int8Array,
  randomIndex: (legalCount: number) => number
): number {
  let legalCount = 0;
  for (let action = 0; action < GOMOKU_CELLS; action += 1) {
    if (board[action] === 0) {
      legalCount += 1;
    }
  }
  if (legalCount === 0) {
    return 0;
  }

  let pick = randomIndex(legalCount);
  for (let action = 0; action < GOMOKU_CELLS; action += 1) {
    if (board[action] !== 0) {
      continue;
    }
    if (pick === 0) {
      return action;
    }
    pick -= 1;
  }
  return firstLegalGomokuAction(board);
}

export function heuristicGomokuAction(
  board: Int8Array,
  player: GomokuPlayer,
  random: () => number
): number {
  const tactical = gomokuImmediateTacticalAction(board, player);
  if (tactical !== null) {
    return tactical;
  }

  let bestAction = firstLegalGomokuAction(board);
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let action = 0; action < GOMOKU_CELLS; action += 1) {
    if (board[action] !== 0) {
      continue;
    }
    const score =
      gomokuHeuristicPrior(board, player, action) +
      gomokuMovePatternScore(board, action, oppositePlayer(player)) * 0.15 +
      random() * 0.01;
    if (score > bestScore) {
      bestScore = score;
      bestAction = action;
    }
  }
  return bestAction;
}

export function nearestLegalGomokuAction(
  board: Int8Array,
  requested: number,
  tieBreak: () => number = () => 0
): number {
  if (board[requested] === 0) {
    return requested;
  }

  let bestCell = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  const row = Math.floor(requested / GOMOKU_SIZE);
  const col = requested % GOMOKU_SIZE;

  for (let cell = 0; cell < GOMOKU_CELLS; cell += 1) {
    if (board[cell] !== 0) {
      continue;
    }
    const cellRow = Math.floor(cell / GOMOKU_SIZE);
    const cellCol = cell % GOMOKU_SIZE;
    const distance = Math.abs(cellRow - row) + Math.abs(cellCol - col);
    if (distance < bestDistance || (distance === bestDistance && tieBreak() < 0.5)) {
      bestDistance = distance;
      bestCell = cell;
    }
  }

  return bestCell >= 0 ? bestCell : requested;
}

export function applyGomokuMove(state: MutableGomokuState, action: number): number {
  const legalAction =
    state.board[action] === 0 ? action : firstLegalGomokuAction(state.board);
  const player = state.player;
  state.board[legalAction] = player;
  state.lastMove = legalAction;
  state.moves += 1;
  state.player = oppositePlayer(player);
  if (hasGomokuFive(state.board, legalAction, player)) {
    state.winner = gomokuWinnerForPlayer(player);
  } else if (state.moves >= GOMOKU_CELLS) {
    state.winner = "draw";
  }
  return legalAction;
}

export function applyGomokuArenaOpening(
  state: MutableGomokuState,
  openingIndex: number,
  maxMoves: number = GOMOKU_CELLS
): void {
  const opening = GOMOKU_ARENA_OPENINGS[openingIndex] ?? GOMOKU_ARENA_OPENINGS[0];
  for (const action of opening) {
    if (state.winner !== null || state.moves >= maxMoves) {
      break;
    }
    applyGomokuMove(state, action);
  }
}

export function resetGomokuState(state: MutableGomokuState): void {
  state.board.fill(0);
  state.player = 1;
  state.moves = 0;
  state.lastMove = null;
  state.winner = null;
}

export function transformGomokuAction(action: number, symmetry: number): number {
  const row = Math.floor(action / GOMOKU_SIZE);
  const col = action % GOMOKU_SIZE;
  const max = GOMOKU_SIZE - 1;
  switch (symmetry % GOMOKU_SYMMETRY_COUNT) {
    case 1:
      return gomokuIndex(col, max - row);
    case 2:
      return gomokuIndex(max - row, max - col);
    case 3:
      return gomokuIndex(max - col, row);
    case 4:
      return gomokuIndex(row, max - col);
    case 5:
      return gomokuIndex(max - row, col);
    case 6:
      return gomokuIndex(col, row);
    case 7:
      return gomokuIndex(max - col, max - row);
    default:
      return action;
  }
}

export function transformGomokuBoardAndPolicy(
  board: Int8Array,
  policy: Float32Array,
  symmetry: number
): { board: Int8Array; policy: Float32Array } {
  const transformedBoard = new Int8Array(GOMOKU_CELLS);
  const transformedPolicy = new Float32Array(GOMOKU_CELLS);
  for (let action = 0; action < GOMOKU_CELLS; action += 1) {
    const transformed = transformGomokuAction(action, symmetry);
    transformedBoard[transformed] = board[action];
    transformedPolicy[transformed] = policy[action];
  }
  return { board: transformedBoard, policy: transformedPolicy };
}

export function longestGomokuObservationLine(
  observation: Float32Array,
  stone: GomokuPlayer
): number {
  let best = 0;

  for (let index = 0; index < GOMOKU_CELLS; index += 1) {
    if (!sameGomokuObservationStone(observation[index], stone)) {
      continue;
    }
    const row = Math.floor(index / GOMOKU_SIZE);
    const col = index % GOMOKU_SIZE;
    for (const [dx, dy] of GOMOKU_DIRECTIONS) {
      const prevRow = row - dy;
      const prevCol = col - dx;
      if (isInsideGomoku(prevRow, prevCol)) {
        const previous = observation[gomokuIndex(prevRow, prevCol)];
        if (sameGomokuObservationStone(previous, stone)) {
          continue;
        }
      }

      let run = 0;
      let nextRow = row;
      let nextCol = col;
      while (
        isInsideGomoku(nextRow, nextCol) &&
        sameGomokuObservationStone(observation[gomokuIndex(nextRow, nextCol)], stone)
      ) {
        run += 1;
        nextRow += dy;
        nextCol += dx;
      }
      best = Math.max(best, run);
    }
  }

  return best;
}

export function gomokuObservationCenterControl(observation: Float32Array): number {
  const centers = [44, 45, 54, 55];
  let control = 0;
  for (const index of centers) {
    if (observation[index] > 0.5) {
      control += 1;
    } else if (observation[index] < -0.5) {
      control -= 1;
    }
  }
  if (control > 0) return 2;
  if (control < 0) return 0;
  return 1;
}

function sameGomokuObservationStone(value: number, stone: GomokuPlayer): boolean {
  return stone === 1 ? value > 0.5 : value < -0.5;
}

function gomokuLineScore(run: number, openEnds: number): number {
  if (run >= 5) return 1600;
  if (run === 4) return openEnds === 2 ? 1100 : openEnds === 1 ? 640 : 80;
  if (run === 3) return openEnds === 2 ? 340 : openEnds === 1 ? 130 : 18;
  if (run === 2) return openEnds === 2 ? 70 : openEnds === 1 ? 32 : 6;
  return openEnds === 2 ? 10 : 2;
}

function gomokuThreatBonus(level: number): number {
  if (level >= 5) return 6000;
  if (level === 4) return 1800;
  if (level === 3) return 700;
  if (level === 2) return 240;
  return 0;
}

function clampGomoku(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
