import "./styles.css";
import {
  type EnvironmentId,
  type EnvironmentSnapshot,
  type TrainerStats,
  type TrainerUpdate,
  type TrainingConfig,
  defaultTrainingConfig
} from "./rl.ts";
import { bindRange, formatInt, getButton, getCanvas, getSvg, mustGetContext, setText } from "./dom.ts";
import { drawChart, drawGame } from "./rendering.ts";
import {
  algorithmDescriptions,
  appTemplate,
  controlTitles,
  environmentDetails,
  objectiveLabels,
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
    updateConfig({ environment });
  });
}

const algorithmSelect = document.getElementById("algorithm-select");
if (!(algorithmSelect instanceof HTMLSelectElement)) {
  throw new Error("Missing algorithm select");
}
algorithmSelect.addEventListener("change", () => {
  updateConfig({ algorithm: algorithmSelect.value as AlgorithmId });
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

setEnvironmentLabels(config.environment);
worker.postMessage({ type: "reset", config });
requestAnimationFrame(drawFrame);

function updateConfig(partial: Partial<TrainingConfig>): void {
  Object.assign(config, partial);
  worker.postMessage({ type: "config", config: partial });
}

function renderStats(): void {
  toggleButton.textContent = uiState.running ? "暂停训练" : "训练";
  demoButton.textContent = uiState.demoRunning ? "停止演示" : "演示";
  demoButton.classList.toggle("secondary-active", uiState.demoRunning);
  setText("steps", formatInt(uiState.stats.steps));
  setText("episodes", formatInt(uiState.stats.episodes));
  setText("updates", formatInt(uiState.stats.updates));
  setText("work-item", formatInt(uiState.stats.workItem));
  setText("best-distance", uiState.stats.bestDistance.toFixed(0));
  setText("best-eval", uiState.stats.bestEvalDistance.toFixed(0));
  setText("objective", uiState.stats.objective.toFixed(3));
  setText("sps", uiState.stats.sps.toFixed(0));
  setAlgorithmLabels(uiState.stats.algorithm);
  setEnvironmentLabels(uiState.stats.environment);
}

function setEnvironmentLabels(environment: EnvironmentId): void {
  const details = environmentDetails[environment];
  setText("environment-title", details.title);
  setText("environment-description", details.description);
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
  setControlVisibility(algorithm);
}

function setControlVisibility(algorithm: AlgorithmId): void {
  const showPopulation =
    algorithm === "cem" ||
    algorithm === "genetic" ||
    algorithm === "hill-climb" ||
    algorithm === "random-search";
  const showElite = algorithm === "cem" || algorithm === "genetic";
  const showValue = algorithm === "double-dqn" || algorithm === "q-learning" || algorithm === "sarsa";
  const showGradient = algorithm === "double-dqn" || algorithm === "reinforce";
  const showDqn = algorithm === "double-dqn";

  setHidden(".population-control", !showPopulation);
  setHidden(".elite-control", !showElite);
  setHidden(".value-control", !showValue);
  setHidden(".gradient-control", !showGradient);
  setHidden(".dqn-control", !showDqn);
}

function setHidden(selector: string, hidden: boolean): void {
  for (const element of document.querySelectorAll<HTMLElement>(selector)) {
    element.hidden = hidden;
  }
}

function drawFrame(): void {
  drawGame(ctx, canvas, uiState.render, config.environment);
  requestAnimationFrame(drawFrame);
}

function parseEnvironment(value: string | undefined): EnvironmentId | null {
  if (value === "flappy" || value === "pong") {
    return value;
  }
  return null;
}
