export const SCREEN_WIDTH = 800;
export const SCREEN_HEIGHT = 600;
export const GROUND_HEIGHT = 100;
export const BIRD_WIDTH = 30;
export const BIRD_HEIGHT = 30;
export const BIRD_SPEED = 200;
export const BIRD_JUMP_SPEED = 300;
export const MAX_SPEED = BIRD_JUMP_SPEED;
export const GRAVITY = 400;
export const GAP_HEIGHT = 160;
export const GAP_PADDING = 50;
export const INITIAL_BLOCK_POS = 500;
export const BLOCK_SPACING = 300;
export const BLOCK_WIDTH = 60;
export const DELTA = 0.02;

export const PONG_PADDLE_X = 36;
export const PONG_PADDLE_WIDTH = 16;
export const PONG_PADDLE_HEIGHT = 92;
export const PONG_PADDLE_SPEED = 380;
export const PONG_BALL_RADIUS = 10;
export const PONG_BALL_SPEED = 310;

export const OBSERVATION_SIZE = 6;
export const ACTION_COUNT = 3;
export const POLICY_SIZE = ACTION_COUNT * (OBSERVATION_SIZE + 1);

export type Action = 0 | 1 | 2;
export type AlgorithmId =
  | "cem"
  | "genetic"
  | "hill-climb"
  | "random-search"
  | "double-dqn"
  | "q-learning"
  | "sarsa"
  | "reinforce";
export type EnvironmentId = "flappy" | "pong";

export interface PipeSnapshot {
  x: number;
  gapY: number;
}

export interface FlappySnapshot {
  kind: "flappy";
  x: number;
  y: number;
  vy: number;
  score: number;
  lastReward: number;
  pipes: PipeSnapshot[];
}

export interface PongSnapshot {
  kind: "pong";
  paddleY: number;
  paddleVy: number;
  ballX: number;
  ballY: number;
  ballVx: number;
  ballVy: number;
  score: number;
  lastReward: number;
}

export type EnvironmentSnapshot = FlappySnapshot | PongSnapshot;

export interface LearningEnvironment {
  reset(seed: number): void;
  step(action: Action): boolean;
  writeObservation(target: Float32Array): void;
  reward(): number;
  distance(): number;
  currentScore(): number;
  snapshot(): EnvironmentSnapshot;
}

export interface TrainingConfig {
  environment: EnvironmentId;
  algorithm: AlgorithmId;
  populationSize: number;
  eliteSize: number;
  initialStd: number;
  minStd: number;
  stdDecay: number;
  maxEpisodeSteps: number;
  evalRuns: number;
  candidatesPerBurst: number;
  trainBudgetMs: number;
  replayCapacity: number;
  batchSize: number;
  warmupSteps: number;
  gamma: number;
  learningRate: number;
  epsilonStart: number;
  epsilonMin: number;
  epsilonDecaySteps: number;
  targetUpdateSteps: number;
  trainEverySteps: number;
}

export interface EvalPoint {
  step: number;
  distance: number;
}

export interface TrainerStats {
  environment: EnvironmentId;
  algorithm: AlgorithmId;
  steps: number;
  episodes: number;
  updates: number;
  workItem: number;
  bestDistance: number;
  bestEvalDistance: number;
  objective: number;
  exploration: number;
  replaySize: number;
  sps: number;
}

export interface TrainerUpdate {
  type: "state";
  running: boolean;
  demoRunning: boolean;
  stats: TrainerStats;
  render: EnvironmentSnapshot;
  evalHistory: EvalPoint[];
}

export interface CemGenerationResult {
  generation: number;
  eliteMeanDistance: number;
  bestDistance: number;
  bestEvalDistance: number;
}

export function defaultTrainingConfig(): TrainingConfig {
  return {
    environment: "flappy",
    algorithm: "cem",
    populationSize: 48,
    eliteSize: 8,
    initialStd: 1.2,
    minStd: 0.05,
    stdDecay: 0.9,
    maxEpisodeSteps: 1200,
    evalRuns: 10,
    candidatesPerBurst: 4,
    trainBudgetMs: 12,
    replayCapacity: 20000,
    batchSize: 16,
    warmupSteps: 500,
    gamma: 0.99,
    learningRate: 0.001,
    epsilonStart: 1,
    epsilonMin: 0.03,
    epsilonDecaySteps: 12000,
    targetUpdateSteps: 600,
    trainEverySteps: 2
  };
}

export function createEnvironment(environment: EnvironmentId, seed: number): LearningEnvironment {
  if (environment === "pong") {
    return new PongEnv(seed);
  }
  return new FlappyEnv(seed);
}

export function actionCountForEnvironment(environment: EnvironmentId): number {
  if (environment === "flappy") {
    return 2;
  }
  return 3;
}

export class Mulberry32 {
  private state: number;
  private spare: number | null = null;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  normal(): number {
    if (this.spare !== null) {
      const value = this.spare;
      this.spare = null;
      return value;
    }

    const u = Math.max(this.next(), Number.EPSILON);
    const v = this.next();
    const mag = Math.sqrt(-2.0 * Math.log(u));
    this.spare = mag * Math.sin(2.0 * Math.PI * v);
    return mag * Math.cos(2.0 * Math.PI * v);
  }
}

export class FlappyEnv implements LearningEnvironment {
  private rng = new Mulberry32(0);
  private x = 0;
  private y = 0;
  private vy = 0;
  private score = 0;
  private lastReward = 0;
  private pipes: PipeSnapshot[] = [];

  constructor(seed = 0) {
    this.reset(seed);
  }

  reset(seed: number): void {
    this.rng = new Mulberry32(seed);
    this.x = 0;
    this.y = (SCREEN_HEIGHT - GROUND_HEIGHT - BIRD_HEIGHT) / 2;
    this.vy = 0;
    this.score = 0;
    this.lastReward = 0;
    this.pipes.length = 0;
    this.pipes.push({ x: INITIAL_BLOCK_POS, gapY: this.generateGapY() });
  }

  step(action: Action): boolean {
    const previousX = this.x;
    if (action === 1) {
      this.vy = -BIRD_JUMP_SPEED;
    }

    this.vy = clamp(this.vy + GRAVITY * DELTA, -MAX_SPEED, MAX_SPEED);
    this.y += this.vy * DELTA;
    this.x += BIRD_SPEED * DELTA;

    let passedPipe = false;
    for (let i = 0; i < this.pipes.length; i += 1) {
      const pipeEnd = this.pipes[i].x + BLOCK_WIDTH;
      if (previousX < pipeEnd && this.x >= pipeEnd) {
        passedPipe = true;
      }
    }
    if (passedPipe) {
      this.score += 1;
    }

    let furthestX = this.pipes[0]?.x ?? INITIAL_BLOCK_POS;
    for (let i = 1; i < this.pipes.length; i += 1) {
      furthestX = Math.max(furthestX, this.pipes[i].x);
    }
    if (furthestX < this.x + SCREEN_WIDTH) {
      this.pipes.push({
        x: furthestX + BLOCK_SPACING + BLOCK_WIDTH,
        gapY: this.generateGapY()
      });
    }

    while (this.pipes.length > 0 && this.pipes[0].x < this.x - SCREEN_WIDTH) {
      this.pipes.shift();
    }

    const collision = this.hasCollision();
    const gapMid = this.nextGapMid();
    const birdMid = this.y + BIRD_HEIGHT / 2;
    const gapError = Math.abs(birdMid - gapMid);
    const alignmentReward =
      0.02 * (1.0 - Math.min(1.0, gapError / (SCREEN_HEIGHT - GROUND_HEIGHT)));

    this.lastReward = collision
      ? -1.0
      : 0.01 + alignmentReward + (passedPipe ? 1.0 : 0.0);

    return collision;
  }

  writeObservation(target: Float32Array): void {
    target.fill(0);
    const pipe = this.nextPipe();
    const gapMid = pipe.gapY + GAP_HEIGHT / 2;
    const birdMid = this.y + BIRD_HEIGHT / 2;
    const usableHeight = SCREEN_HEIGHT - GROUND_HEIGHT;
    const gapRange = usableHeight - 2 * GAP_PADDING - GAP_HEIGHT;

    target[0] = clamp01(this.y / (usableHeight - BIRD_HEIGHT));
    target[1] = clamp(this.vy / MAX_SPEED, -1, 1);
    target[2] = clamp01((pipe.x + BLOCK_WIDTH - this.x) / (BLOCK_SPACING + BLOCK_WIDTH));
    target[3] = clamp01(gapMid / usableHeight);
    target[4] = clamp((birdMid - gapMid) / usableHeight, -1, 1);
    target[5] = clamp01((pipe.gapY - GAP_PADDING) / gapRange);
  }

  reward(): number {
    return this.lastReward;
  }

  distance(): number {
    return this.x;
  }

  currentScore(): number {
    return this.score;
  }

  snapshot(): FlappySnapshot {
    return {
      kind: "flappy",
      x: this.x,
      y: this.y,
      vy: this.vy,
      score: this.score,
      lastReward: this.lastReward,
      pipes: this.pipes.map((pipe) => ({ x: pipe.x, gapY: pipe.gapY }))
    };
  }

  private generateGapY(): number {
    const range = SCREEN_HEIGHT - GROUND_HEIGHT - 2 * GAP_PADDING - GAP_HEIGHT;
    return GAP_PADDING + this.rng.next() * range;
  }

  private nextPipe(): PipeSnapshot {
    let best = this.pipes[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this.pipes.length; i += 1) {
      const distance = this.pipes[i].x + BLOCK_WIDTH - this.x;
      if (distance > 0 && distance < bestDistance) {
        bestDistance = distance;
        best = this.pipes[i];
      }
    }
    return best;
  }

  private nextGapMid(): number {
    const pipe = this.nextPipe();
    return pipe.gapY + GAP_HEIGHT / 2;
  }

  private hasCollision(): boolean {
    if (this.y < 0 || this.y + BIRD_HEIGHT >= SCREEN_HEIGHT - GROUND_HEIGHT) {
      return true;
    }

    for (let i = 0; i < this.pipes.length; i += 1) {
      const pipe = this.pipes[i];
      const withinX = this.x + BIRD_WIDTH >= pipe.x && this.x <= pipe.x + BLOCK_WIDTH;
      const hitsTop = this.y < pipe.gapY;
      const hitsBottom = this.y + BIRD_HEIGHT > pipe.gapY + GAP_HEIGHT;
      if (withinX && (hitsTop || hitsBottom)) {
        return true;
      }
    }

    return false;
  }
}

export class PongEnv implements LearningEnvironment {
  private rng = new Mulberry32(0);
  private paddleY = 0;
  private paddleVy = 0;
  private ballX = 0;
  private ballY = 0;
  private ballVx = 0;
  private ballVy = 0;
  private score = 0;
  private steps = 0;
  private lastReward = 0;

  constructor(seed = 0) {
    this.reset(seed);
  }

  reset(seed: number): void {
    this.rng = new Mulberry32(seed);
    this.paddleY = (SCREEN_HEIGHT - PONG_PADDLE_HEIGHT) / 2;
    this.paddleVy = 0;
    this.ballX = SCREEN_WIDTH * 0.58;
    this.ballY = 80 + this.rng.next() * (SCREEN_HEIGHT - 160);
    this.score = 0;
    this.steps = 0;
    this.lastReward = 0;

    const angle = (-0.36 + this.rng.next() * 0.72) * Math.PI;
    this.ballVx = -Math.cos(angle) * PONG_BALL_SPEED;
    this.ballVy = Math.sin(angle) * PONG_BALL_SPEED;
  }

  step(action: Action): boolean {
    this.steps += 1;
    const direction = action === 1 ? -1 : action === 2 ? 1 : 0;
    this.paddleVy = direction * PONG_PADDLE_SPEED;
    this.paddleY = clamp(
      this.paddleY + this.paddleVy * DELTA,
      0,
      SCREEN_HEIGHT - PONG_PADDLE_HEIGHT
    );

    this.ballX += this.ballVx * DELTA;
    this.ballY += this.ballVy * DELTA;

    if (this.ballY <= PONG_BALL_RADIUS) {
      this.ballY = PONG_BALL_RADIUS;
      this.ballVy = Math.abs(this.ballVy);
    } else if (this.ballY >= SCREEN_HEIGHT - PONG_BALL_RADIUS) {
      this.ballY = SCREEN_HEIGHT - PONG_BALL_RADIUS;
      this.ballVy = -Math.abs(this.ballVy);
    }

    if (this.ballX >= SCREEN_WIDTH - PONG_BALL_RADIUS) {
      this.ballX = SCREEN_WIDTH - PONG_BALL_RADIUS;
      this.ballVx = -Math.abs(this.ballVx);
    }

    const paddleRight = PONG_PADDLE_X + PONG_PADDLE_WIDTH;
    const paddleBottom = this.paddleY + PONG_PADDLE_HEIGHT;
    const hitsPaddle =
      this.ballVx < 0 &&
      this.ballX - PONG_BALL_RADIUS <= paddleRight &&
      this.ballX + PONG_BALL_RADIUS >= PONG_PADDLE_X &&
      this.ballY + PONG_BALL_RADIUS >= this.paddleY &&
      this.ballY - PONG_BALL_RADIUS <= paddleBottom;

    if (hitsPaddle) {
      const paddleCenter = this.paddleY + PONG_PADDLE_HEIGHT / 2;
      const normalizedImpact = clamp(
        (this.ballY - paddleCenter) / (PONG_PADDLE_HEIGHT / 2),
        -1,
        1
      );
      const speed = PONG_BALL_SPEED * (1 + Math.min(0.35, this.score * 0.015));
      this.ballX = paddleRight + PONG_BALL_RADIUS;
      this.ballVx = Math.abs(Math.cos(normalizedImpact * 0.85) * speed);
      this.ballVy = Math.sin(normalizedImpact * 0.85) * speed;
      this.score += 1;
      this.lastReward = 1.0;
      return false;
    }

    const missed = this.ballX < -PONG_BALL_RADIUS;
    if (missed) {
      this.lastReward = -1.0;
      return true;
    }

    const paddleCenter = this.paddleY + PONG_PADDLE_HEIGHT / 2;
    const alignment = 1 - Math.min(1, Math.abs(paddleCenter - this.ballY) / SCREEN_HEIGHT);
    const approach = this.ballVx < 0 ? 1 - clamp01(this.ballX / SCREEN_WIDTH) : 0.1;
    this.lastReward = 0.004 + 0.012 * alignment * approach;
    return false;
  }

  writeObservation(target: Float32Array): void {
    target.fill(0);
    const paddleCenter = this.paddleY + PONG_PADDLE_HEIGHT / 2;
    target[0] = clamp01(paddleCenter / SCREEN_HEIGHT);
    target[1] = clamp(this.ballVy / (PONG_BALL_SPEED * 1.4), -1, 1);
    target[2] = clamp01(this.ballX / SCREEN_WIDTH);
    target[3] = clamp01(this.ballY / SCREEN_HEIGHT);
    target[4] = clamp((paddleCenter - this.ballY) / SCREEN_HEIGHT, -1, 1);
    target[5] = clamp(this.ballVx / (PONG_BALL_SPEED * 1.4), -1, 1);
  }

  reward(): number {
    return this.lastReward;
  }

  distance(): number {
    return this.steps + this.score * 600;
  }

  currentScore(): number {
    return this.score;
  }

  snapshot(): PongSnapshot {
    return {
      kind: "pong",
      paddleY: this.paddleY,
      paddleVy: this.paddleVy,
      ballX: this.ballX,
      ballY: this.ballY,
      ballVx: this.ballVx,
      ballVy: this.ballVy,
      score: this.score,
      lastReward: this.lastReward
    };
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}
