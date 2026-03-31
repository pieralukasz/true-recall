/**
 * FSRS Simulator Service
 * Simulates FSRS v6 scheduling for visualization.
 * Platform-agnostic: colors are injected by the caller.
 */
import { createEmptyCard, FSRS } from "ts-fsrs";
const DEFAULT_COLOR = "#3b82f6";
/**
 * Service for simulating FSRS review sequences
 */
export class FSRSSimulatorService {
    /**
     * Simulate review sequences with given parameters.
     * @param sequences  Rating strings, e.g. ["3333", "3332"]
     * @param weights    FSRS v6 weight array (21 values)
     * @param desiredRetention  Target recall probability (0-1)
     * @param colors     Optional color palette for chart lines
     */
    simulate(sequences, weights, desiredRetention, colors = []) {
        return sequences.map((seq, i) => {
            var _a;
            return ({
                sequence: seq,
                color: (_a = colors[i % (colors.length || 1)]) !== null && _a !== void 0 ? _a : DEFAULT_COLOR,
                reviews: this.simulateSequence(seq, weights, desiredRetention),
            });
        });
    }
    /**
     * Simulate a single review sequence
     */
    simulateSequence(sequence, weights, desiredRetention) {
        const fsrs = new FSRS({
            w: weights,
            request_retention: desiredRetention,
            enable_fuzz: false, // Disable fuzzing for consistent simulation
            enable_short_term: true,
        });
        const reviews = [];
        let card = createEmptyCard();
        let cumulativeInterval = 0;
        let currentDate = new Date();
        // Initial state (review 0)
        reviews.push({
            reviewNumber: 0,
            grade: 0, // No grade yet
            interval: 0,
            stability: card.stability,
            difficulty: card.difficulty,
            cumulativeInterval: 0,
        });
        // Process each rating in sequence
        for (let i = 0; i < sequence.length; i++) {
            const char = sequence[i];
            if (!char)
                continue;
            const gradeNum = parseInt(char, 10);
            if (gradeNum < 1 || gradeNum > 4)
                continue; // Skip invalid grades
            const grade = gradeNum;
            const result = fsrs.next(card, currentDate, grade);
            card = result.card;
            const interval = card.scheduled_days;
            cumulativeInterval += interval;
            // Advance time by the interval
            currentDate = new Date(card.due);
            reviews.push({
                reviewNumber: i + 1,
                grade,
                interval,
                stability: card.stability,
                difficulty: card.difficulty,
                cumulativeInterval,
            });
        }
        return reviews;
    }
    /**
     * Get default FSRS v6 weights
     */
    getDefaultWeights() {
        return [
            0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722,
            0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425,
            0.0912, 0.0658, 0.1542,
        ];
    }
}
