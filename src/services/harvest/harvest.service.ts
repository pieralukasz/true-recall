/**
 * Harvest Service
 * Manages harvest readiness detection and workflow for temporary cards
 *
 * Part of the Seeding → Incubation → Harvest workflow:
 * - SEEDING: Create temporary flashcards from Literature Notes
 * - INCUBATION: Review cards to build neural pathways
 * - HARVEST: When cards mature (interval ≥ threshold), move to permanent notes
 */

import type { FSRSFlashcardItem } from "../../types";
import { HARVEST_CONFIG } from "../../constants";

/**
 * A temporary card with maturity information
 */
export interface HarvestableCard {
	/** The original flashcard item */
	card: FSRSFlashcardItem;
	/** Maturity percentage (0-100, where 100 = ready to harvest) */
	maturityPercentage: number;
	/** Days until harvest threshold (negative if ready) */
	daysUntilHarvest: number;
	/** Whether the card is ready to harvest */
	isReady: boolean;
}

/**
 * Statistics about harvestable cards
 */
export interface HarvestStats {
	/** Total number of temporary cards */
	totalTemporary: number;
	/** Cards ready to harvest (interval >= threshold) */
	readyToHarvest: number;
	/** Cards still incubating */
	incubating: number;
	/** Average maturity percentage across all temporary cards */
	averageMaturity: number;
}

/**
 * Service for managing the harvest workflow
 */
export class HarvestService {
	private harvestThreshold: number;

	constructor(harvestThreshold: number = HARVEST_CONFIG.harvestThresholdDays) {
		this.harvestThreshold = harvestThreshold;
	}

	/**
	 * Check if a temporary card is ready to harvest
	 * A card is ready when its scheduled interval >= harvest threshold
	 */
	isReadyToHarvest(card: FSRSFlashcardItem): boolean {
		if (!card.isTemporary) return false;
		return card.fsrs.scheduledDays >= this.harvestThreshold;
	}

	/**
	 * Calculate maturity percentage for a card
	 * Uses scheduledDays (interval) as the maturity metric
	 * @returns 0-100 percentage, capped at 100
	 */
	getMaturityPercentage(card: FSRSFlashcardItem): number {
		if (!card.isTemporary) return 100;
		const interval = card.fsrs.scheduledDays;
		return Math.min(100, Math.round((interval / this.harvestThreshold) * 100));
	}

	/**
	 * Get days until harvest threshold
	 * @returns Negative number if ready, positive if still incubating
	 */
	getDaysUntilHarvest(card: FSRSFlashcardItem): number {
		return this.harvestThreshold - card.fsrs.scheduledDays;
	}

	/**
	 * Get all harvestable cards from a list, sorted by maturity (highest first)
	 */
	getHarvestableCards(cards: FSRSFlashcardItem[]): HarvestableCard[] {
		return cards
			.filter((c) => c.isTemporary)
			.map((card) => ({
				card,
				maturityPercentage: this.getMaturityPercentage(card),
				daysUntilHarvest: this.getDaysUntilHarvest(card),
				isReady: this.isReadyToHarvest(card),
			}))
			.sort((a, b) => b.maturityPercentage - a.maturityPercentage);
	}

	/**
	 * Get only cards that are ready to harvest
	 */
	getReadyForHarvest(cards: FSRSFlashcardItem[]): FSRSFlashcardItem[] {
		return cards.filter((c) => this.isReadyToHarvest(c));
	}

	/**
	 * Get harvest statistics for a collection of cards
	 */
	getHarvestStats(cards: FSRSFlashcardItem[]): HarvestStats {
		const temporary = cards.filter((c) => c.isTemporary);
		const ready = temporary.filter((c) => this.isReadyToHarvest(c));

		const avgMaturity =
			temporary.length > 0
				? temporary.reduce((sum, c) => sum + this.getMaturityPercentage(c), 0) /
					temporary.length
				: 0;

		return {
			totalTemporary: temporary.length,
			readyToHarvest: ready.length,
			incubating: temporary.length - ready.length,
			averageMaturity: Math.round(avgMaturity),
		};
	}

	/**
	 * Get the harvest threshold in days
	 */
	getThreshold(): number {
		return this.harvestThreshold;
	}
}
