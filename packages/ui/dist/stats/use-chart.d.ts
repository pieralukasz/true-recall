import { type ChartConfiguration, type ChartTypeRegistry } from "chart.js";
import type { RefObject } from "preact";
/**
 * Manages Chart.js lifecycle: create -> update -> destroy.
 * Rebuilds chart when deps change or theme changes.
 */
export declare function useChart<T extends keyof ChartTypeRegistry>(canvasRef: RefObject<HTMLCanvasElement | null>, configFactory: () => ChartConfiguration<T> | null, deps: unknown[]): void;
