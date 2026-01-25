/**
 * FSRS Simulator Service
 * Simulates FSRS v6 scheduling for visualization
 */
import { FSRS, createEmptyCard, Rating, type Grade } from "ts-fsrs";
import type { SequenceSimulation, SequenceReview } from "../../ui/simulator/types";
import { SEQUENCE_COLORS } from "../../ui/simulator/constants";

/**
 * Service for simulating FSRS review sequences
 */
export class FSRSSimulatorService {
	/**
	 * Simulate review sequences with given parameters
	 */
	simulate(
		sequences: string[],
		weights: number[],
		desiredRetention: number
	): SequenceSimulation[] {
		return sequences.map((seq, i) => ({
			sequence: seq,
			color: SEQUENCE_COLORS[i % SEQUENCE_COLORS.length] ?? "#3b82f6",
			reviews: this.simulateSequence(seq, weights, desiredRetention),
		}));
	}

	/**
	 * Simulate a single review sequence
	 */
	private simulateSequence(
		sequence: string,
		weights: number[],
		desiredRetention: number
	): SequenceReview[] {
		// Create FSRS instance with custom weights
		const fsrs = new FSRS({
			w: weights,
			request_retention: desiredRetention,
			enable_fuzz: false, // Disable fuzzing for consistent simulation
			enable_short_term: true,
		});

		const reviews: SequenceReview[] = [];
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
			if (!char) continue;
			const gradeNum = parseInt(char, 10);
			if (gradeNum < 1 || gradeNum > 4) continue; // Skip invalid grades

			const grade = gradeNum as Grade;
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
	 * Generate colors for sequences
	 */
	private getColor(index: number): string {
		return SEQUENCE_COLORS[index % SEQUENCE_COLORS.length] ?? "#3b82f6";
	}

	/**
	 * Get default FSRS v6 weights
	 */
	getDefaultWeights(): number[] {
		return [
			0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001,
			1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014,
			1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
		];
	}
}
