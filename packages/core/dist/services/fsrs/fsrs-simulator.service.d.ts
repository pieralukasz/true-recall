/**
 * FSRS Simulator Service
 * Simulates FSRS v6 scheduling for visualization.
 * Platform-agnostic: colors are injected by the caller.
 */
import { type Grade } from "ts-fsrs";
/** Review data at a specific point in a sequence */
export interface SequenceReview {
    reviewNumber: number;
    grade: Grade | 0;
    interval: number;
    stability: number;
    difficulty: number;
    cumulativeInterval: number;
}
/** Complete simulation data for a review sequence */
export interface SequenceSimulation {
    sequence: string;
    color: string;
    reviews: SequenceReview[];
}
/**
 * Service for simulating FSRS review sequences
 */
export declare class FSRSSimulatorService {
    /**
     * Simulate review sequences with given parameters.
     * @param sequences  Rating strings, e.g. ["3333", "3332"]
     * @param weights    FSRS v6 weight array (21 values)
     * @param desiredRetention  Target recall probability (0-1)
     * @param colors     Optional color palette for chart lines
     */
    simulate(sequences: string[], weights: number[], desiredRetention: number, colors?: string[]): SequenceSimulation[];
    /**
     * Simulate a single review sequence
     */
    private simulateSequence;
    /**
     * Get default FSRS v6 weights
     */
    getDefaultWeights(): number[];
}
