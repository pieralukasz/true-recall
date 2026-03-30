/**
 * Invalidation Map — single source of truth for which query groups
 * need to reload after each mutation type.
 *
 * Rule: after a mutation, we invalidate query GROUPS, not individual keys.
 * Each view registers its queries into groups. This map connects
 * mutation semantics to the right groups.
 *
 * This file is the ONLY place that defines what to invalidate.
 * No feature code should call queryRuntime.invalidateGroup() directly.
 * Instead, features call reconcileMutation() which uses this map.
 */

import type { QueryRuntime, QueryGroup } from "./query-runtime";

// ── Query Groups ────────────────────────────────────────────

export const QG = {
	/** All-cards cache (allCards, globalCounts, cardsBySourceUid, noteStatus) */
	CARDS: "cards",
	/** Browser results (filtered list, facets, orphaned) */
	BROWSER: "browser",
	/** Dashboard aggregation (note list, stats, progress) */
	DASHBOARD: "dashboard",
	/** Active review session queue/header */
	REVIEW: "review",
	/** Stats charts and distributions */
	STATS: "stats",
	/** Panel cards for active note */
	PANEL: "panel",
} as const;

// ── Mutation Types ──────────────────────────────────────────

export type MutationType =
	| "card:created"
	| "card:updated"
	| "card:deleted"
	| "card:suspended"
	| "card:unsuspended"
	| "card:buried"
	| "card:unburied"
	| "card:reviewed"
	| "card:reset"
	| "card:rescheduled"
	| "cards:bulk-deleted"
	| "cards:bulk-suspended"
	| "cards:bulk-reset"
	| "cards:imported"
	| "note:archived"
	| "note:unarchived"
	| "note:type-changed"
	| "note:deleted"
	| "hierarchy:changed"
	| "settings:changed";

// ── The Map ─────────────────────────────────────────────────

const INVALIDATION_MAP: Record<MutationType, QueryGroup[]> = {
	// Single card mutations
	"card:created": [QG.CARDS, QG.BROWSER, QG.DASHBOARD, QG.PANEL, QG.STATS],
	"card:updated": [QG.CARDS, QG.BROWSER, QG.DASHBOARD, QG.PANEL],
	"card:deleted": [QG.CARDS, QG.BROWSER, QG.DASHBOARD, QG.PANEL, QG.STATS],
	"card:suspended": [QG.CARDS, QG.BROWSER, QG.DASHBOARD, QG.PANEL, QG.REVIEW],
	"card:unsuspended": [QG.CARDS, QG.BROWSER, QG.DASHBOARD, QG.PANEL, QG.REVIEW],
	"card:buried": [QG.CARDS, QG.BROWSER, QG.DASHBOARD, QG.REVIEW],
	"card:unburied": [QG.CARDS, QG.BROWSER, QG.DASHBOARD, QG.REVIEW],
	"card:reset": [QG.CARDS, QG.BROWSER, QG.DASHBOARD, QG.REVIEW, QG.STATS],
	"card:rescheduled": [QG.CARDS, QG.BROWSER, QG.DASHBOARD, QG.REVIEW, QG.STATS],

	// Review grade — HOT PATH, special handling
	// Only invalidates stats/dashboard, card cache is PATCHED not reloaded
	"card:reviewed": [QG.DASHBOARD, QG.STATS],

	// Bulk mutations
	"cards:bulk-deleted": [QG.CARDS, QG.BROWSER, QG.DASHBOARD, QG.PANEL, QG.REVIEW, QG.STATS],
	"cards:bulk-suspended": [QG.CARDS, QG.BROWSER, QG.DASHBOARD, QG.PANEL, QG.REVIEW, QG.STATS],
	"cards:bulk-reset": [QG.CARDS, QG.BROWSER, QG.DASHBOARD, QG.REVIEW, QG.STATS],
	"cards:imported": [QG.CARDS, QG.BROWSER, QG.DASHBOARD, QG.PANEL, QG.STATS],

	// Note-level mutations
	"note:archived": [QG.CARDS, QG.BROWSER, QG.DASHBOARD, QG.REVIEW],
	"note:unarchived": [QG.CARDS, QG.BROWSER, QG.DASHBOARD, QG.REVIEW],
	"note:type-changed": [QG.CARDS, QG.BROWSER, QG.DASHBOARD, QG.PANEL],
	"note:deleted": [QG.CARDS, QG.BROWSER, QG.DASHBOARD, QG.PANEL, QG.REVIEW, QG.STATS],

	// Global mutations
	"hierarchy:changed": [QG.CARDS, QG.DASHBOARD, QG.REVIEW],
	"settings:changed": [QG.CARDS, QG.BROWSER, QG.DASHBOARD, QG.REVIEW, QG.STATS],
};

// ── Reconciliation ──────────────────────────────────────────

export interface MutationContext {
	/** The mutation that occurred */
	type: MutationType;
	/** Affected card ID (for patch-first on hot paths) */
	cardId?: string;
	/** Affected card IDs (for bulk) */
	cardIds?: string[];
}

/**
 * Reconcile a mutation: invalidate the right query groups.
 *
 * For "card:reviewed", this does NOT invalidate QG.CARDS — the caller
 * should use queryRuntime.patch() to update the single reviewed card
 * in the allCards cache. This avoids refetching 30k cards on every grade.
 */
export function reconcileMutation(
	runtime: QueryRuntime,
	ctx: MutationContext,
): void {
	const groups = INVALIDATION_MAP[ctx.type];
	if (!groups || groups.length === 0) return;

	runtime.invalidateGroups(groups);
}

// ── Bridge: map old CardMutation → MutationContext ──────────
// Used during migration to forward old signal-based mutations
// into the new QueryRuntime invalidation system.

interface OldCardMutation {
	type: "added" | "updated" | "removed" | "reviewed" | "bulk";
	cardId?: string;
	cardIds?: string[];
	action?: string;
}

export function mapOldMutationType(
	m: OldCardMutation,
): MutationContext | null {
	switch (m.type) {
		case "added":
			return { type: "card:created", cardId: m.cardId };
		case "updated": {
			const action = m.action;
			if (action === "suspend")
				return { type: "card:suspended", cardId: m.cardId };
			if (action === "unsuspend")
				return { type: "card:unsuspended", cardId: m.cardId };
			if (action === "reset")
				return { type: "card:reset", cardId: m.cardId };
			if (action === "reschedule")
				return { type: "card:rescheduled", cardId: m.cardId };
			return { type: "card:updated", cardId: m.cardId };
		}
		case "removed":
			return { type: "card:deleted", cardId: m.cardId };
		case "reviewed":
			return { type: "card:reviewed", cardId: m.cardId };
		case "bulk": {
			const action = m.action;
			if (action === "removed" || action === "delete")
				return { type: "cards:bulk-deleted", cardIds: m.cardIds };
			if (action === "suspend")
				return { type: "cards:bulk-suspended", cardIds: m.cardIds };
			if (action === "reset")
				return { type: "cards:bulk-reset", cardIds: m.cardIds };
			// Default bulk → treat as bulk delete (safest — invalidates everything)
			return { type: "cards:bulk-deleted", cardIds: m.cardIds };
		}
		default:
			return null;
	}
}
