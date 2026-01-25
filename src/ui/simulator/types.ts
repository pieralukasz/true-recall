/**
 * FSRS Simulator Types
 */

/** Grade values for FSRS (1=Again, 2=Hard, 3=Good, 4=Easy) */
export type Grade = 1 | 2 | 3 | 4;

/** Review data at a specific point in a sequence */
export interface SequenceReview {
	reviewNumber: number;
	grade: Grade | 0; // 0 for initial state (no grade yet)
	interval: number; // days
	stability: number;
	difficulty: number; // 0-10 scale
	cumulativeInterval: number;
}

/** Complete simulation data for a review sequence */
export interface SequenceSimulation {
	sequence: string; // e.g., "3333"
	color: string; // hex color for chart
	reviews: SequenceReview[];
}

/** Metric types for chart Y-axis */
export type MetricType = "interval" | "stability" | "difficulty" | "cumulative";

/** Simulator state */
export interface SimulatorState {
	// Input
	sequences: string[];
	parameters: number[]; // 21 FSRS v6 weights
	desiredRetention: number;

	// View options
	metricType: MetricType;
	useAnimation: boolean;
	useLogarithmic: boolean;

	// Undo/Redo
	parameterHistory: number[][];
	historyIndex: number;

	// Results
	simulations: SequenceSimulation[];
}

/** Slider configuration for parameter input */
export interface SliderConfig {
	index: number; // Index in weights array (-1 for retention)
	name: string;
	description: string;
	min: number;
	max: number;
	step: number;
	defaultValue: number;
}
