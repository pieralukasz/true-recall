/**
 * FSRS Parameter Optimizer Service
 */
import { forgetting_curve } from "ts-fsrs";
import { DEFAULT_FSRS_WEIGHTS } from "../../../constants";
const MIN_REVIEWS_FOR_OPTIMIZATION = 400;
const MAX_ITERATIONS = 1000;
const LEARNING_RATE = 0.01;
const CONVERGENCE_THRESHOLD = 1e-6;
export class ParameterOptimizerService {
    optimize(input, options) {
        var _a, _b, _c, _d;
        const minReviews = (_a = input.minReviews) !== null && _a !== void 0 ? _a : MIN_REVIEWS_FOR_OPTIMIZATION;
        if (input.reviews.length < minReviews) {
            return {
                weights: (_b = input.currentWeights) !== null && _b !== void 0 ? _b : [...DEFAULT_FSRS_WEIGHTS],
                metrics: {
                    rmse: 0,
                    logLoss: 0,
                    reviewCount: input.reviews.length,
                    convergenceStatus: "insufficient_data",
                },
            };
        }
        const trainingData = this.prepareTrainingData(input.reviews);
        let weights = input.currentWeights
            ? [...input.currentWeights]
            : [...DEFAULT_FSRS_WEIGHTS];
        let previousLoss = Infinity;
        let convergenceStatus = "max_iterations";
        for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
            if ((_c = options === null || options === void 0 ? void 0 : options.abortSignal) === null || _c === void 0 ? void 0 : _c.aborted) {
                break;
            }
            const { loss, gradients } = this.calculateLossAndGradients(weights, trainingData);
            (_d = options === null || options === void 0 ? void 0 : options.onProgress) === null || _d === void 0 ? void 0 : _d.call(options, {
                iteration,
                totalIterations: MAX_ITERATIONS,
                currentLoss: loss,
            });
            if (Math.abs(previousLoss - loss) < CONVERGENCE_THRESHOLD) {
                convergenceStatus = "converged";
                break;
            }
            weights = weights.map((w, i) => {
                var _a;
                const grad = (_a = gradients[i]) !== null && _a !== void 0 ? _a : 0;
                const newW = w - LEARNING_RATE * grad;
                return this.clipWeight(newW, i);
            });
            previousLoss = loss;
        }
        const finalMetrics = this.calculateMetrics(weights, trainingData);
        let improvement;
        if (input.currentWeights) {
            const currentMetrics = this.calculateMetrics(input.currentWeights, trainingData);
            if (currentMetrics.logLoss > 0) {
                improvement =
                    ((currentMetrics.logLoss - finalMetrics.logLoss) /
                        currentMetrics.logLoss) *
                        100;
            }
        }
        return {
            weights,
            metrics: Object.assign(Object.assign({}, finalMetrics), { reviewCount: input.reviews.length, convergenceStatus }),
            improvement,
        };
    }
    prepareTrainingData(reviews) {
        var _a;
        const dataPoints = [];
        const cardReviews = new Map();
        for (const review of reviews) {
            const existing = (_a = cardReviews.get(review.cardId)) !== null && _a !== void 0 ? _a : [];
            existing.push(review);
            cardReviews.set(review.cardId, existing);
        }
        for (const cardRevs of cardReviews.values()) {
            cardRevs.sort((a, b) => a.reviewedAt - b.reviewedAt);
            for (let i = 1; i < cardRevs.length; i++) {
                const prev = cardRevs[i - 1];
                const curr = cardRevs[i];
                if (!prev || !curr)
                    continue;
                if (curr.elapsedDays > 0) {
                    dataPoints.push({
                        elapsedDays: curr.elapsedDays,
                        stability: prev.stability,
                        difficulty: prev.difficulty,
                        state: prev.state,
                        rating: curr.rating,
                        wasRecalled: curr.rating >= 3,
                    });
                }
            }
        }
        return dataPoints;
    }
    calculateLossAndGradients(weights, data) {
        var _a, _b;
        const avgLoss = this.calculateLoss(weights, data);
        const gradients = new Array(weights.length).fill(0);
        const epsilon = 1e-4;
        for (let i = 0; i < weights.length; i++) {
            const weightsPlus = [...weights];
            const weightsMinus = [...weights];
            weightsPlus[i] = ((_a = weightsPlus[i]) !== null && _a !== void 0 ? _a : 0) + epsilon;
            weightsMinus[i] = ((_b = weightsMinus[i]) !== null && _b !== void 0 ? _b : 0) - epsilon;
            const lossPlus = this.calculateLoss(weightsPlus, data);
            const lossMinus = this.calculateLoss(weightsMinus, data);
            gradients[i] = (lossPlus - lossMinus) / (2 * epsilon);
        }
        return { loss: avgLoss, gradients };
    }
    calculateLoss(weights, data) {
        let totalLoss = 0;
        for (const point of data) {
            const retrievability = forgetting_curve(weights, point.elapsedDays, Math.max(point.stability, 0.1));
            const clippedR = Math.max(0.001, Math.min(0.999, retrievability));
            if (point.wasRecalled) {
                totalLoss -= Math.log(clippedR);
            }
            else {
                totalLoss -= Math.log(1 - clippedR);
            }
        }
        return totalLoss / Math.max(data.length, 1);
    }
    calculateMetrics(weights, data) {
        let totalLoss = 0;
        let totalSquaredError = 0;
        for (const point of data) {
            const retrievability = forgetting_curve(weights, point.elapsedDays, Math.max(point.stability, 0.1));
            const clippedR = Math.max(0.001, Math.min(0.999, retrievability));
            if (point.wasRecalled) {
                totalLoss -= Math.log(clippedR);
            }
            else {
                totalLoss -= Math.log(1 - clippedR);
            }
            const actual = point.wasRecalled ? 1 : 0;
            totalSquaredError += Math.pow((retrievability - actual), 2);
        }
        const n = Math.max(data.length, 1);
        return {
            logLoss: totalLoss / n,
            rmse: Math.sqrt(totalSquaredError / n),
        };
    }
    clipWeight(value, index) {
        var _a;
        const ranges = [
            [0.01, 1.0],
            [0.5, 5.0],
            [1.0, 10.0],
            [2.0, 20.0],
            [1.0, 15.0],
            [0.1, 2.0],
            [0.5, 5.0],
            [0.0001, 0.1],
            [1.0, 5.0],
            [0.01, 0.5],
            [0.3, 2.0],
            [0.5, 3.0],
            [0.01, 0.3],
            [0.1, 0.5],
            [0.5, 3.0],
            [0.3, 1.0],
            [1.0, 3.0],
            [0.1, 1.0],
            [0.01, 0.3],
            [0.01, 0.2],
            [0.05, 0.5],
        ];
        const range = (_a = ranges[index]) !== null && _a !== void 0 ? _a : [0.001, 10.0];
        return Math.max(range[0], Math.min(range[1], value));
    }
    validateWeights(weights) {
        if (!Array.isArray(weights))
            return false;
        if (weights.length !== 21)
            return false;
        return weights.every((w) => typeof w === "number" && Number.isFinite(w) && w > 0);
    }
}
