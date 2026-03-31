/**
 * FSRS Parameter Optimizer Service
 */
import type { OptimizationInput, OptimizationOutput, OptimizerOptions } from "./optimizer.types";
export declare class ParameterOptimizerService {
    optimize(input: OptimizationInput, options?: OptimizerOptions): OptimizationOutput;
    private prepareTrainingData;
    private calculateLossAndGradients;
    private calculateLoss;
    private calculateMetrics;
    private clipWeight;
    validateWeights(weights: number[]): boolean;
}
