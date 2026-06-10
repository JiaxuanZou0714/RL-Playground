import "./styles.css";
import {
  type EnvironmentId,
  type EnvironmentSnapshot,
  type TrainerStats,
  type TrainerUpdate,
  type TrainingConfig,
  defaultAlgorithmForEnvironment,
  defaultTrainingConfig
} from "./rl.ts";
import {
  bindRange,
  formatInt,
  getButton,
  getCanvas,
  getSvg,
  mustGetContext,
  setRangeValue,
  setText
} from "./dom.ts";
import { drawChart, drawGame } from "./rendering.ts";
import {
  algorithmDescriptions,
  appTemplate,
  batchControlLabels,
  controlTitles,
  environmentDetails,
  objectiveLabels,
  populationControlLabels,
  workLabels
} from "./uiContent.ts";

type UiState = {
  running: boolean;
  demoRunning: boolean;
  stats: TrainerStats;
  render: EnvironmentSnapshot | null;
  evalHistory: TrainerUpdate["evalHistory"];
};

type AlgorithmId = TrainingConfig["algorithm"];
type StatMetricBinding = {
  id: string;
  format: (stats: TrainerStats) => string;
};

const STAT_METRIC_BINDINGS: readonly StatMetricBinding[] = [
  { id: "steps", format: (stats) => formatInt(stats.steps) },
  { id: "episodes", format: (stats) => formatInt(stats.episodes) },
  { id: "updates", format: (stats) => formatInt(stats.updates) },
  { id: "work-item", format: (stats) => formatInt(stats.workItem) },
  { id: "best-distance", format: (stats) => stats.bestDistance.toFixed(0) },
  { id: "best-eval", format: (stats) => stats.bestEvalDistance.toFixed(0) },
  { id: "eval-win-rate", format: (stats) => formatPercent(stats.evalWinRate ?? 0) },
  { id: "eval-draw-rate", format: (stats) => formatPercent(stats.evalDrawRate ?? 0) },
  { id: "eval-loss-rate", format: (stats) => formatPercent(stats.evalLossRate ?? 0) },
  { id: "eval-random-win", format: (stats) => formatPercent(stats.evalRandomWinRate ?? 0) },
  { id: "eval-random-loss", format: (stats) => formatPercent(stats.evalRandomLossRate ?? 0) },
  { id: "eval-heuristic-win", format: (stats) => formatPercent(stats.evalHeuristicWinRate ?? 0) },
  { id: "eval-heuristic-loss", format: (stats) => formatPercent(stats.evalHeuristicLossRate ?? 0) },
  { id: "eval-black-score", format: (stats) => (stats.evalBlackScore ?? 0).toFixed(3) },
  { id: "eval-white-score", format: (stats) => (stats.evalWhiteScore ?? 0).toFixed(3) },
  { id: "eval-champion-win", format: (stats) => formatPercent(stats.evalChampionWinRate ?? 0) },
  { id: "eval-champion-draw", format: (stats) => formatPercent(stats.evalChampionDrawRate ?? 0) },
  { id: "eval-champion-loss", format: (stats) => formatPercent(stats.evalChampionLossRate ?? 0) },
  { id: "eval-champion-score", format: (stats) => (stats.evalChampionScore ?? 0).toFixed(3) },
  { id: "eval-champion-games", format: (stats) => formatInt(stats.evalChampionGames ?? 0) },
  { id: "champion-promotions", format: (stats) => formatInt(stats.championPromotions ?? 0) },
  {
    id: "eval-average-moves",
    format: (stats) => (stats.evalAverageMoves ? stats.evalAverageMoves.toFixed(1) : "0")
  },
  { id: "objective", format: (stats) => stats.objective.toFixed(3) },
  { id: "policy-loss", format: (stats) => (stats.policyLoss ?? 0).toFixed(3) },
  { id: "value-loss", format: (stats) => (stats.valueLoss ?? 0).toFixed(3) },
  { id: "eval-value-mse", format: (stats) => (stats.evalValueMse ?? 0).toFixed(3) },
  { id: "eval-value-sign", format: (stats) => formatPercent(stats.evalValueSignAccuracy ?? 0) },
  { id: "policy-entropy", format: (stats) => (stats.policyEntropy ?? 0).toFixed(3) },
  { id: "search-value", format: (stats) => (stats.searchValue ?? 0).toFixed(3) },
  { id: "sps", format: (stats) => stats.sps.toFixed(0) }
];

const worker = new Worker(new URL("./trainer.worker.ts", import.meta.url), {
  type: "module"
});

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("Missing #app container");
}
app.innerHTML = appTemplate;

const canvas = getCanvas("game-canvas");
const chartSvg = getSvg("chart-svg");
const ctx = mustGetContext(canvas);
const toggleButton = getButton("toggle-run");
const demoButton = getButton("toggle-demo");
const resetButton = getButton("reset-run");
const environmentButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-environment]")
);

const config = defaultTrainingConfig();
const uiState: UiState = {
  running: false,
  demoRunning: false,
  stats: {
    environment: config.environment,
    algorithm: config.algorithm,
    steps: 0,
    episodes: 0,
    updates: 0,
    workItem: 0,
    bestDistance: 0,
    bestEvalDistance: 0,
    objective: 0,
    exploration: config.initialStd,
    replaySize: 0,
    sps: 0
  },
  render: null,
  evalHistory: []
};

bindRange("population-size", "population-size-output", "", (value) => {
  updateConfig({ populationSize: value });
});
bindRange("elite-size", "elite-size-output", "", (value) => {
  updateConfig({ eliteSize: value });
});
bindRange("max-episode-steps", "max-episode-steps-output", "", (value) => {
  updateConfig({ maxEpisodeSteps: value });
});
bindRange("learning-rate", "learning-rate-output", "", (value) => {
  updateConfig({ learningRate: value });
});
bindRange("epsilon-decay", "epsilon-decay-output", "", (value) => {
  updateConfig({ epsilonDecaySteps: value });
});
bindRange("batch-size", "batch-size-output", "", (value) => {
  updateConfig({ batchSize: value });
});
bindRange("train-budget", "train-budget-output", " ms", (value) => {
  updateConfig({ trainBudgetMs: value });
});

for (const button of environmentButtons) {
  button.addEventListener("click", () => {
    const environment = parseEnvironment(button.dataset.environment);
    if (!environment || environment === config.environment) {
      return;
    }
    applyDefaultConfig(environment, defaultAlgorithmForEnvironment(environment));
  });
}

const algorithmSelectElement = document.getElementById("algorithm-select");
if (!(algorithmSelectElement instanceof HTMLSelectElement)) {
  throw new Error("Missing algorithm select");
}
const algorithmSelect = algorithmSelectElement;
algorithmSelect.addEventListener("change", () => {
  applyDefaultConfig(config.environment, algorithmSelect.value as AlgorithmId);
});

toggleButton.addEventListener("click", () => {
  worker.postMessage({ type: uiState.running ? "pause" : "start" });
});

demoButton.addEventListener("click", () => {
  worker.postMessage({ type: uiState.demoRunning ? "pause-demo" : "start-demo" });
});

resetButton.addEventListener("click", () => {
  worker.postMessage({ type: "reset", config });
});

worker.onmessage = (event: MessageEvent<TrainerUpdate>) => {
  const message = event.data;
  if (message.type !== "state") {
    return;
  }

  uiState.running = message.running;
  uiState.demoRunning = message.demoRunning;
  uiState.stats = message.stats;
  uiState.render = message.render;
  uiState.evalHistory = message.evalHistory;
  renderStats();
  drawChart(chartSvg, uiState.evalHistory, uiState.stats.environment);
};

syncControlsFromConfig();
setAlgorithmLabels(config.algorithm);
setEnvironmentLabels(config.environment);
worker.postMessage({ type: "reset", config });
requestAnimationFrame(drawFrame);

function updateConfig(partial: Partial<TrainingConfig>): void {
  Object.assign(config, partial);
  worker.postMessage({ type: "config", config: partial });
}

function applyDefaultConfig(environment: EnvironmentId, algorithm: AlgorithmId): void {
  const nextConfig = defaultTrainingConfig(environment, algorithm);
  Object.assign(config, nextConfig);
  algorithmSelect.value = nextConfig.algorithm;
  syncControlsFromConfig();
  setAlgorithmLabels(nextConfig.algorithm);
  setEnvironmentLabels(environment);
  worker.postMessage({ type: "config", config: nextConfig });
}

function syncControlsFromConfig(): void {
  setRangeValue("population-size", "population-size-output", "", config.populationSize);
  setRangeValue("elite-size", "elite-size-output", "", config.eliteSize);
  setRangeValue("max-episode-steps", "max-episode-steps-output", "", config.maxEpisodeSteps);
  setRangeValue("learning-rate", "learning-rate-output", "", config.learningRate);
  setRangeValue("epsilon-decay", "epsilon-decay-output", "", config.epsilonDecaySteps);
  setRangeValue("batch-size", "batch-size-output", "", config.batchSize);
  setRangeValue("train-budget", "train-budget-output", " ms", config.trainBudgetMs);
}

function renderStats(): void {
  toggleButton.textContent = uiState.running ? "暂停训练" : "训练";
  demoButton.textContent = uiState.demoRunning ? "停止演示" : "演示";
  demoButton.classList.toggle("secondary-active", uiState.demoRunning);
  for (const metric of STAT_METRIC_BINDINGS) {
    setText(metric.id, metric.format(uiState.stats));
  }
  setAlgorithmLabels(uiState.stats.algorithm);
  setEnvironmentLabels(uiState.stats.environment);
  setEvaluationMetricVisibility(uiState.stats.algorithm);
}

function setEnvironmentLabels(environment: EnvironmentId): void {
  const details = environmentDetails[environment];
  setText("environment-title", details.title);
  setText("environment-description", details.description);
  setText("chart-subtitle", details.chartSubtitle);
  canvas.setAttribute("aria-label", details.canvasLabel);
  chartSvg.setAttribute("aria-label", `训练过程中的评估${details.chartLabel}`);

  for (const button of environmentButtons) {
    const isActive = button.dataset.environment === environment;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function setAlgorithmLabels(algorithm: AlgorithmId): void {
  setText("algorithm-note", algorithmDescriptions[algorithm]);
  setText("work-label", workLabels[algorithm]);
  setText("objective-label", objectiveLabels[algorithm]);
  setText("control-title", controlTitles[algorithm]);
  setText("population-control-label", populationControlLabels[algorithm]);
  setText("batch-size-label", batchControlLabels[algorithm]);
  setControlVisibility(algorithm);
  setEvaluationMetricVisibility(algorithm);
}

function setControlVisibility(algorithm: AlgorithmId): void {
  const showPopulation =
    algorithm === "alpha-zero" ||
    algorithm === "cem" ||
    algorithm === "genetic" ||
    algorithm === "hill-climb" ||
    algorithm === "random-search";
  const showElite = algorithm === "cem" || algorithm === "genetic";
  const showValue = algorithm === "double-dqn" || algorithm === "q-learning" || algorithm === "sarsa";
  const showGradient =
    algorithm === "alpha-zero" || algorithm === "double-dqn" || algorithm === "reinforce";
  const showDqn = algorithm === "alpha-zero" || algorithm === "double-dqn";

  setHidden(".population-control", !showPopulation);
  setHidden(".elite-control", !showElite);
  setHidden(".value-control", !showValue);
  setHidden(".gradient-control", !showGradient);
  setHidden(".dqn-control", !showDqn);
}

function setEvaluationMetricVisibility(algorithm: AlgorithmId): void {
  setHidden(".gomoku-eval-metric", algorithm !== "alpha-zero");
  setHidden(".alpha-zero-diagnostic-metric", algorithm !== "alpha-zero");
  setText("best-eval-label", algorithm === "alpha-zero" ? "基准评分" : "评估最优");
}

function setHidden(selector: string, hidden: boolean): void {
  for (const element of document.querySelectorAll<HTMLElement>(selector)) {
    element.hidden = hidden;
  }
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function drawFrame(): void {
  drawGame(ctx, canvas, uiState.render, config.environment);
  requestAnimationFrame(drawFrame);
}

function parseEnvironment(value: string | undefined): EnvironmentId | null {
  if (value === "flappy" || value === "pong" || value === "gomoku") {
    return value;
  }
  return null;
}
