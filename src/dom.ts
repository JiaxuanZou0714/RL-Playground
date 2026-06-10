export function bindRange(
  inputId: string,
  outputId: string,
  suffix: string,
  onChange: (value: number) => void
): void {
  const input = document.getElementById(inputId);
  const output = document.getElementById(outputId);
  if (!(input instanceof HTMLInputElement) || !(output instanceof HTMLOutputElement)) {
    throw new Error(`Missing range control ${inputId}`);
  }

  const sync = () => {
    const value = Number(input.value);
    syncRangeValue(input, output, suffix, value);
    onChange(value);
  };

  input.addEventListener("input", sync);
  sync();
}

export function setRangeValue(
  inputId: string,
  outputId: string,
  suffix: string,
  value: number
): void {
  const input = document.getElementById(inputId);
  const output = document.getElementById(outputId);
  if (!(input instanceof HTMLInputElement) || !(output instanceof HTMLOutputElement)) {
    throw new Error(`Missing range control ${inputId}`);
  }
  input.value = String(value);
  syncRangeValue(input, output, suffix, value);
}

export function getCanvas(id: string): HTMLCanvasElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLCanvasElement)) {
    throw new Error(`Missing canvas ${id}`);
  }
  return element;
}

export function getSvg(id: string): SVGSVGElement {
  const element = document.getElementById(id);
  if (!(element instanceof SVGSVGElement)) {
    throw new Error(`Missing svg ${id}`);
  }
  return element;
}

export function getButton(id: string): HTMLButtonElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`Missing button ${id}`);
  }
  return element;
}

export function mustGetContext(canvasElement: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvasElement.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is unavailable");
  }
  return context;
}

export function setText(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

export function formatInt(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatRangeValue(input: HTMLInputElement, value: number): string {
  if (input.step.includes(".")) {
    const decimals = input.step.split(".")[1]?.length ?? 0;
    return value
      .toFixed(decimals)
      .replace(/0+$/, "")
      .replace(/\.$/, "");
  }
  return String(value);
}

function syncRangeValue(
  input: HTMLInputElement,
  output: HTMLOutputElement,
  suffix: string,
  value: number
): void {
  const displayValue = formatRangeValue(input, value);
  output.textContent = `${displayValue}${suffix}`;
  input.setAttribute("aria-valuenow", displayValue);
  input.setAttribute("aria-valuetext", `${displayValue}${suffix}`);
}
