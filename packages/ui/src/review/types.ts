/**
 * Review component types.
 *
 * These mirror the store's ReviewApi interface but are defined locally
 * so the UI package doesn't depend on the store (which has Obsidian deps).
 * The obsidian adapter maps the real ReviewApi to these types.
 */

import type { ReviewSessionStats } from "@true-recall/core";

export interface BadgeCounts {
	new: number;
	learning: number;
	due: number;
}

export interface ReviewApi {
	isActive: boolean;
	getBadgeCounts: () => BadgeCounts;
	getStats: () => ReviewSessionStats;
	getTimeUntilNextDue: () => number;
	getPendingLearningCards: () => { id: string }[];
	endSession: () => void;
}

export type TypeInMode = "off" | "ai" | "diff";
