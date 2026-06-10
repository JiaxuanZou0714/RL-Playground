import {
  type EnvironmentId,
  type EnvironmentSnapshot,
  type FlappySnapshot,
  type GomokuSnapshot,
  type PongSnapshot,
  type TrainerUpdate,
  BIRD_HEIGHT,
  BIRD_WIDTH,
  BLOCK_WIDTH,
  GAP_HEIGHT,
  GOMOKU_SIZE,
  GROUND_HEIGHT,
  PONG_BALL_RADIUS,
  PONG_PADDLE_HEIGHT,
  PONG_PADDLE_WIDTH,
  PONG_PADDLE_X,
  SCREEN_HEIGHT,
  SCREEN_WIDTH
} from "./rl.ts";
import { environmentDetails } from "./uiContent.ts";

export function drawGame(
  context: CanvasRenderingContext2D,
  targetCanvas: HTMLCanvasElement,
  snapshot: EnvironmentSnapshot | null,
  environment: EnvironmentId
): void {
  if (snapshot?.kind === "gomoku" || (!snapshot && environment === "gomoku")) {
    drawGomoku(context, targetCanvas, snapshot?.kind === "gomoku" ? snapshot : null);
  } else if (snapshot?.kind === "pong" || (!snapshot && environment === "pong")) {
    drawPong(context, targetCanvas, snapshot?.kind === "pong" ? snapshot : null);
  } else {
    drawFlappy(context, targetCanvas, snapshot?.kind === "flappy" ? snapshot : null);
  }
}

export function drawChart(
  svg: SVGSVGElement,
  points: TrainerUpdate["evalHistory"],
  environment: EnvironmentId
): void {
  const width = 1200;
  const height = 320;
  const left = 48;
  const right = 16;
  const top = 16;
  const bottom = 28;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const dataMax = points.length > 0 ? Math.max(...points.map((point) => point.distance)) : 0;
  const yMax = niceMax(Math.max(dataMax, 500), environment);
  const minStep = points.length > 0 ? points[0].step : 0;
  const maxStep = points.length > 0 ? points[points.length - 1].step : 200_000;
  const stepRange = maxStep - minStep || 1;

  const toX = (step: number) => left + ((step - minStep) / stepRange) * plotWidth;
  const toY = (distance: number) =>
    top + plotHeight - Math.min(distance / yMax, 1) * plotHeight;

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.innerHTML = "";

  const defs = svgEl("defs");
  const grad = svgEl("linearGradient", { id: "cg", x1: "0", y1: "0", x2: "0", y2: "1" });
  grad.append(
    svgEl("stop", { offset: "0%", "stop-color": "rgba(62,160,100,0.12)" }),
    svgEl("stop", { offset: "100%", "stop-color": "rgba(62,160,100,0)" })
  );
  defs.append(grad);
  svg.append(defs);

  svg.append(
    svgEl("rect", {
      x: String(left),
      y: String(top),
      width: String(plotWidth),
      height: String(plotHeight),
      fill: "none",
      stroke: "rgba(0,0,0,0.08)",
      "stroke-width": "1"
    })
  );

  for (let i = 0; i <= 4; i += 1) {
    const value = (yMax * i) / 4;
    const y = top + plotHeight - (plotHeight * i) / 4;
    if (i > 0) {
      svg.append(
        svgEl("line", {
          x1: String(left),
          y1: String(y),
          x2: String(left + plotWidth),
          y2: String(y),
          stroke: "rgba(0,0,0,0.05)",
          "stroke-width": "1"
        })
      );
    }
    const label = svgEl("text", {
      x: String(left - 5),
      y: String(y),
      "text-anchor": "end",
      "dominant-baseline": "middle",
      "font-size": "11",
      fill: "rgba(0,0,0,0.40)"
    });
    label.textContent =
      value >= 1000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k` : String(value);
    svg.append(label);
  }

  for (let i = 0; i <= 4; i += 1) {
    const step = minStep + (stepRange * i) / 4;
    const x = left + (plotWidth * i) / 4;
    const label = svgEl("text", {
      x: String(x),
      y: String(top + plotHeight + 16),
      "text-anchor": "middle",
      "font-size": "11",
      fill: "rgba(0,0,0,0.40)"
    });
    label.textContent = fmtStep(step);
    svg.append(label);
  }

  const axisLabel = svgEl("text", {
    x: String(left + 4),
    y: String(top + 11),
    "font-size": "11",
    fill: "rgba(0,0,0,0.30)"
  });
  axisLabel.textContent = environmentDetails[environment].chartLabel;
  svg.append(axisLabel);

  if (points.length < 2) {
    const empty = svgEl("text", {
      x: String(left + plotWidth / 2),
      y: String(top + plotHeight / 2),
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      "font-size": "13",
      fill: "rgba(0,0,0,0.20)"
    });
    empty.textContent = "等待评估数据…";
    svg.append(empty);
    return;
  }

  const smoothed = smoothEvalPoints(points);
  const rawPoints = points.map((point) => `${toX(point.step)},${toY(point.distance)}`).join(" ");
  const smoothPoints = smoothed
    .map((point) => `${toX(point.step)},${toY(point.distance)}`)
    .join(" ");

  svg.append(
    svgEl("polyline", {
      points: rawPoints,
      fill: "none",
      stroke: "rgba(62,160,100,0.22)",
      "stroke-width": "1"
    })
  );

  const firstX = toX(smoothed[0].step);
  const last = smoothed[smoothed.length - 1];
  svg.append(
    svgEl("polygon", {
      points: `${smoothPoints} ${toX(last.step)},${top + plotHeight} ${firstX},${top + plotHeight}`,
      fill: "url(#cg)"
    })
  );
  svg.append(
    svgEl("polyline", {
      points: smoothPoints,
      fill: "none",
      stroke: "#3ea064",
      "stroke-width": "2"
    })
  );

  const lastValue = points[points.length - 1].distance;
  const lastX = toX(points[points.length - 1].step);
  const lastY = toY(lastValue);
  svg.append(svgEl("circle", { cx: String(lastX), cy: String(lastY), r: "3", fill: "#3ea064" }));
  const anchor = lastX > left + plotWidth - 40 ? "end" : "start";
  const dx = lastX > left + plotWidth - 40 ? -6 : 6;
  const valueLabel = svgEl("text", {
    x: String(lastX + dx),
    y: String(lastY - 4),
    "text-anchor": anchor,
    "font-size": "11",
    fill: "rgba(0,0,0,0.55)"
  });
  valueLabel.textContent = lastValue.toFixed(0);
  svg.append(valueLabel);
}

function drawFlappy(
  context: CanvasRenderingContext2D,
  targetCanvas: HTMLCanvasElement,
  snapshot: FlappySnapshot | null
): void {
  const width = targetCanvas.width;
  const height = targetCanvas.height;
  context.clearRect(0, 0, width, height);
  context.save();
  context.scale(width / SCREEN_WIDTH, height / SCREEN_HEIGHT);

  context.fillStyle = "#111822";
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  context.fillStyle = "#1a2430";
  context.fillRect(0, SCREEN_HEIGHT - GROUND_HEIGHT, SCREEN_WIDTH, GROUND_HEIGHT);
  context.fillStyle = "#243040";
  context.fillRect(0, SCREEN_HEIGHT - GROUND_HEIGHT, SCREEN_WIDTH, 6);

  if (snapshot) {
    const cameraX = 280 - snapshot.x;
    context.save();
    context.translate(cameraX, 0);
    context.fillStyle = "#2a6b5a";
    for (const pipe of snapshot.pipes) {
      roundedRect(context, pipe.x, 0, BLOCK_WIDTH, pipe.gapY, 4);
      context.fill();
      roundedRect(
        context,
        pipe.x,
        pipe.gapY + GAP_HEIGHT,
        BLOCK_WIDTH,
        SCREEN_HEIGHT - GROUND_HEIGHT - pipe.gapY - GAP_HEIGHT,
        4
      );
      context.fill();
      context.fillStyle = "#1e5244";
      context.fillRect(pipe.x - 4, pipe.gapY - 14, BLOCK_WIDTH + 8, 14);
      context.fillRect(pipe.x - 4, pipe.gapY + GAP_HEIGHT, BLOCK_WIDTH + 8, 14);
      context.fillStyle = "#2a6b5a";
    }

    context.fillStyle = "#5ed29c";
    roundedRect(context, snapshot.x, snapshot.y, BIRD_WIDTH, BIRD_HEIGHT, 6);
    context.fill();
    context.fillStyle = "rgba(255,255,255,0.4)";
    context.fillRect(snapshot.x + 19, snapshot.y + 8, 5, 4);
    context.restore();

    context.fillStyle = "rgba(94, 210, 156, 0.6)";
    context.font = "600 13px Inter, system-ui, sans-serif";
    context.fillText(`得分 ${snapshot.score}`, 18, 28);
    context.fillText(`奖励 ${snapshot.lastReward.toFixed(3)}`, 18, 48);
  }

  context.restore();
}

function drawPong(
  context: CanvasRenderingContext2D,
  targetCanvas: HTMLCanvasElement,
  snapshot: PongSnapshot | null
): void {
  const width = targetCanvas.width;
  const height = targetCanvas.height;
  context.clearRect(0, 0, width, height);
  context.save();
  context.scale(width / SCREEN_WIDTH, height / SCREEN_HEIGHT);

  context.fillStyle = "#15202a";
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  context.fillStyle = "#dce6ed";
  context.globalAlpha = 0.28;
  for (let y = 18; y < SCREEN_HEIGHT; y += 36) {
    context.fillRect(SCREEN_WIDTH / 2 - 2, y, 4, 18);
  }
  context.globalAlpha = 1;
  context.strokeStyle = "#314350";
  context.lineWidth = 8;
  context.strokeRect(4, 4, SCREEN_WIDTH - 8, SCREEN_HEIGHT - 8);

  const paddleY = snapshot?.paddleY ?? (SCREEN_HEIGHT - PONG_PADDLE_HEIGHT) / 2;
  const ballX = snapshot?.ballX ?? SCREEN_WIDTH * 0.58;
  const ballY = snapshot?.ballY ?? SCREEN_HEIGHT / 2;
  const score = snapshot?.score ?? 0;
  const reward = snapshot?.lastReward ?? 0;

  context.fillStyle = "#5ed29c";
  roundedRect(context, PONG_PADDLE_X, paddleY, PONG_PADDLE_WIDTH, PONG_PADDLE_HEIGHT, 5);
  context.fill();
  context.fillStyle = "rgba(255, 255, 255, 0.75)";
  roundedRect(
    context,
    ballX - PONG_BALL_RADIUS,
    ballY - PONG_BALL_RADIUS,
    PONG_BALL_RADIUS * 2,
    PONG_BALL_RADIUS * 2,
    PONG_BALL_RADIUS
  );
  context.fill();

  context.fillStyle = "rgba(247, 251, 255, 0.86)";
  context.font = "600 15px Inter, system-ui, sans-serif";
  context.fillText(`得分 ${score}`, 24, 34);
  context.fillText(`奖励 ${reward.toFixed(3)}`, 24, 58);

  context.restore();
}

function drawGomoku(
  context: CanvasRenderingContext2D,
  targetCanvas: HTMLCanvasElement,
  snapshot: GomokuSnapshot | null
): void {
  const width = targetCanvas.width;
  const height = targetCanvas.height;
  context.clearRect(0, 0, width, height);
  context.save();
  context.scale(width / SCREEN_WIDTH, height / SCREEN_HEIGHT);

  context.fillStyle = "#101713";
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  const boardSize = 500;
  const cellSize = boardSize / GOMOKU_SIZE;
  const boardLeft = 58;
  const boardTop = 52;
  const boardRight = boardLeft + boardSize;
  const panelLeft = boardRight + 42;

  context.fillStyle = "#d4ba78";
  roundedRect(context, boardLeft - 12, boardTop - 12, boardSize + 24, boardSize + 24, 10);
  context.fill();
  context.fillStyle = "#e5cb86";
  roundedRect(context, boardLeft, boardTop, boardSize, boardSize, 6);
  context.fill();

  context.strokeStyle = "rgba(40, 31, 18, 0.42)";
  context.lineWidth = 1;
  for (let i = 0; i <= GOMOKU_SIZE; i += 1) {
    const x = boardLeft + i * cellSize;
    const y = boardTop + i * cellSize;
    context.beginPath();
    context.moveTo(x, boardTop);
    context.lineTo(x, boardTop + boardSize);
    context.stroke();
    context.beginPath();
    context.moveTo(boardLeft, y);
    context.lineTo(boardLeft + boardSize, y);
    context.stroke();
  }

  const board = snapshot?.board ?? [];
  for (let index = 0; index < board.length; index += 1) {
    const stone = board[index];
    if (stone === 0) {
      continue;
    }
    const row = Math.floor(index / GOMOKU_SIZE);
    const col = index % GOMOKU_SIZE;
    const cx = boardLeft + col * cellSize + cellSize / 2;
    const cy = boardTop + row * cellSize + cellSize / 2;
    const radius = cellSize * 0.34;

    context.beginPath();
    context.arc(cx + 2, cy + 3, radius, 0, Math.PI * 2);
    context.fillStyle = "rgba(0, 0, 0, 0.18)";
    context.fill();

    const gradient = context.createRadialGradient(
      cx - radius * 0.35,
      cy - radius * 0.45,
      radius * 0.15,
      cx,
      cy,
      radius
    );
    if (stone === 1) {
      gradient.addColorStop(0, "#55615b");
      gradient.addColorStop(1, "#101312");
    } else {
      gradient.addColorStop(0, "#ffffff");
      gradient.addColorStop(1, "#cbd5d7");
    }
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.fill();
  }

  if (snapshot?.lastMove !== null && snapshot?.lastMove !== undefined) {
    const row = Math.floor(snapshot.lastMove / GOMOKU_SIZE);
    const col = snapshot.lastMove % GOMOKU_SIZE;
    const cx = boardLeft + col * cellSize + cellSize / 2;
    const cy = boardTop + row * cellSize + cellSize / 2;
    context.strokeStyle = "#5ed29c";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(cx, cy, cellSize * 0.42, 0, Math.PI * 2);
    context.stroke();
  }

  context.fillStyle = "rgba(247, 251, 255, 0.92)";
  context.font = "700 18px Inter, system-ui, sans-serif";
  context.fillText("五子棋自对弈", panelLeft, 86);
  context.font = "600 14px Inter, system-ui, sans-serif";
  const winnerText = snapshot?.winner
    ? snapshot.winner === "draw"
      ? "结果 平局"
      : `结果 ${snapshot.winner === "black" ? "黑方" : "白方"}胜`
    : `轮到 ${snapshot?.currentPlayer === -1 ? "白方" : "黑方"}`;
  context.fillText(winnerText, panelLeft, 126);
  context.fillStyle = "rgba(247, 251, 255, 0.68)";
  context.font = "500 13px Inter, system-ui, sans-serif";
  context.fillText(`棋盘 ${GOMOKU_SIZE} × ${GOMOKU_SIZE}`, panelLeft, 164);
  context.fillText(`落子 ${snapshot?.moves ?? 0}`, panelLeft, 188);
  context.fillText(`奖励 ${(snapshot?.lastReward ?? 0).toFixed(3)}`, panelLeft, 212);
  context.fillText("同一策略轮流执黑白", panelLeft, 266);
  context.fillText("观察按当前方视角编码", panelLeft, 290);

  context.restore();
}

function smoothEvalPoints(points: TrainerUpdate["evalHistory"]): TrainerUpdate["evalHistory"] {
  const alpha = 0.12;
  let ema = points[0].distance;
  return points.map((point) => {
    ema = ema * (1 - alpha) + point.distance * alpha;
    return { step: point.step, distance: ema };
  });
}

const ns = "http://www.w3.org/2000/svg";
const yMaxState: Record<string, number> = {};

function niceMax(dataMax: number, environment: string): number {
  const current = yMaxState[environment] ?? 0;
  if (dataMax <= current) return current;
  const step = dataMax > 10_000 ? 1_000 : 500;
  yMaxState[environment] = Math.ceil(dataMax / step) * step;
  return yMaxState[environment];
}

function fmtStep(value: number): string {
  if (value === 0) return "0";
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
  }
  return String(value);
}

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {}
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attrs)) {
    element.setAttribute(key, value);
  }
  return element;
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}
