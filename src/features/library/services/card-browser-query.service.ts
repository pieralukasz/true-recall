import type { SqliteStoreService } from "@features/core/persistence/sqlite";
import { sqlPlaceholders } from "@features/core/persistence/sqlite/sql-utils";
import type { FrontmatterIndexService } from "@features/core/services/frontmatter-index.service";
import type { HierarchyService } from "@features/core/services/hierarchy.service";
import type { FSRSCardData } from "@shared/types";
import { buildBrowserQuery } from "../ui/browser/helpers/query-builder";
import type {
	BrowserCard,
	BrowserResult,
	FilterState,
	SortConfig,
} from "../ui/browser/types";

export class CardBrowserQueryService {
	constructor(
		private cardStore: SqliteStoreService,
		private frontmatterIndex: FrontmatterIndexService,
		private hierarchyService?: HierarchyService,
	) {}

	query(
		filter: FilterState,
		sort: SortConfig,
		limit: number,
		offset: number,
	): BrowserResult {
		// Resolve note: filters from note names to source UIDs
		const resolvedFilter = this.resolveNoteFilters(filter);

		// Don't pass orphaned UIDs via sourceUids — we build the clause manually
		const fts5Available = this.cardStore.notes.isFts5Available();
		const sqlQuery = buildBrowserQuery(resolvedFilter, sort, limit, offset, {
			fts5Available,
		});

		if (resolvedFilter.orphanedOnly) {
			const orphanedUids = this.getOrphanedSourceUids();
			const conditions: string[] = ["c.source_uid IS NULL"];
			if (orphanedUids.length > 0) {
				conditions.push(`c.source_uid IN (${sqlPlaceholders(orphanedUids.length)})`);
				sqlQuery.params.push(...orphanedUids);
			}
			sqlQuery.where += ` AND (${conditions.join(" OR ")})`;
		}

		const archivedUids = this.getArchivedSourceUids(
			!!resolvedFilter.showArchived,
		);
		const sqlWithArchiveFilter = this.applyArchivedFilter(
			sqlQuery.where,
			sqlQuery.params,
			archivedUids,
		);

		const rawCards = this.cardStore.cards.browserQuery(
			sqlWithArchiveFilter.where,
			sqlWithArchiveFilter.params,
			sqlQuery.orderBy,
			sqlQuery.limit,
			sqlQuery.offset,
		);

		const totalCount = this.cardStore.cards.browserCount(
			sqlWithArchiveFilter.where,
			sqlWithArchiveFilter.params,
		);

		const cards = rawCards.map((card) => this.toBrowserCard(card));
		return { cards, totalCount };
	}

	/** Get sidebar facet counts (states, types, sources, etc.) */
	getFacetCounts(showArchived = false): {
		states: Record<string, number>;
		cardTypes: Record<string, number>;
		createdVia: Record<string, number>;
		sourceNotes: { uid: string; name: string; count: number }[];
	} {
		const allCards = this.cardStore.cards.getAll();
		const archivedUids = this.getArchivedSourceUids(showArchived);
		const states: Record<string, number> = {};
		const cardTypes: Record<string, number> = {};
		const createdVia: Record<string, number> = {};
		const sourceMap = new Map<string, number>();

		const now = new Date();
		for (const card of allCards) {
			if (archivedUids.has(card.sourceUid ?? "")) continue;

			// State counts (including virtual states)
			if (card.suspended) {
				states.suspended = (states.suspended ?? 0) + 1;
			} else if (card.buriedUntil && new Date(card.buriedUntil) > now) {
				states.buried = (states.buried ?? 0) + 1;
			} else {
				const stateKey = ["new", "learning", "review", "relearning"][
					card.state
				];
				if (stateKey) states[stateKey] = (states[stateKey] ?? 0) + 1;
			}

			// Card type counts
			const ct = card.cardType ?? "basic";
			cardTypes[ct] = (cardTypes[ct] ?? 0) + 1;

			// Created via counts
			const cv = card.createdVia ?? "manual";
			createdVia[cv] = (createdVia[cv] ?? 0) + 1;

			// Source note counts
			if (card.sourceUid) {
				sourceMap.set(card.sourceUid, (sourceMap.get(card.sourceUid) ?? 0) + 1);
			}
		}

		const sourceNotes = Array.from(sourceMap.entries())
			.map(([uid, count]) => {
				const file = this.frontmatterIndex.getFileByValue("flashcard_uid", uid);
				return {
					uid,
					name: file?.basename ?? "(orphaned)",
					count,
				};
			})
			.sort((a, b) => a.name.localeCompare(b.name));

		return { states, cardTypes, createdVia, sourceNotes };
	}

	/** Card IDs with no linked source note (null sourceUid or unresolved) */
	getOrphanedCardIds(): string[] {
		const allCards = this.cardStore.cards.getAll();
		const orphanedIds: string[] = [];

		for (const card of allCards) {
			if (!card.sourceUid) {
				orphanedIds.push(card.id);
				continue;
			}
			const file = this.frontmatterIndex.getFileByValue(
				"flashcard_uid",
				card.sourceUid,
			);
			if (!file) orphanedIds.push(card.id);
		}

		return orphanedIds;
	}

	/** Unique source UIDs that no longer resolve to a vault note */
	private getOrphanedSourceUids(): string[] {
		const allCards = this.cardStore.cards.getAll();
		const orphanedUids = new Set<string>();

		for (const card of allCards) {
			if (!card.sourceUid) continue;
			if (orphanedUids.has(card.sourceUid)) continue;
			const file = this.frontmatterIndex.getFileByValue(
				"flashcard_uid",
				card.sourceUid,
			);
			if (!file) orphanedUids.add(card.sourceUid);
		}

		return [...orphanedUids];
	}

	private getArchivedSourceUids(showArchived: boolean): Set<string> {
		if (showArchived || !this.hierarchyService) return new Set<string>();
		return this.hierarchyService.getArchivedSourceUids();
	}

	private applyArchivedFilter(
		where: string,
		params: (string | number)[],
		archivedUids: Set<string>,
	): { where: string; params: (string | number)[] } {
		if (archivedUids.size === 0) {
			return { where, params };
		}

		const ids = [...archivedUids];
		return {
			where: `(${where}) AND (c.source_uid IS NULL OR c.source_uid NOT IN (${sqlPlaceholders(ids.length)}))`,
			params: [...params, ...ids],
		};
	}

	private resolveNoteFilters(filter: FilterState): FilterState {
		if (filter.sourceUids.length === 0) return filter;

		// sourceUids may contain note names (from "note:Biology")
		// Build a basename→uid lookup from all known flashcard_uid values
		const allUids = this.frontmatterIndex.getAllValues("flashcard_uid");
		const basenameToUid = new Map<string, string>();
		for (const uid of allUids) {
			const file = this.frontmatterIndex.getFileByValue("flashcard_uid", uid);
			if (file) {
				basenameToUid.set(file.basename.toLowerCase(), uid);
			}
		}

		const resolvedUids: string[] = [];
		for (const nameOrUid of filter.sourceUids) {
			const matchedUid = basenameToUid.get(nameOrUid.toLowerCase());
			if (matchedUid) {
				resolvedUids.push(matchedUid);
			} else {
				// Not a note name — assume it's already a UID
				resolvedUids.push(nameOrUid);
			}
		}

		return { ...filter, sourceUids: resolvedUids };
	}

	private toBrowserCard(card: FSRSCardData): BrowserCard {
		const file = card.sourceUid
			? this.frontmatterIndex.getFileByValue("flashcard_uid", card.sourceUid)
			: null;

		let presetName: string | null = null;
		if (file) {
			const vals = this.frontmatterIndex.getValues("fsrs_preset", file.path);
			if (vals.length > 0 && vals[0]) presetName = vals[0];
		}

		let projects: string[] = [];
		if (file) {
			const vals = this.frontmatterIndex.getValues("parents", file.path);
			projects = vals.filter(Boolean);
		}

		return {
			id: card.id,
			question: card.question ?? "",
			answer: card.answer ?? "",
			state: card.state,
			due: card.due,
			stability: card.stability,
			difficulty: card.difficulty,
			reps: card.reps,
			lapses: card.lapses,
			scheduledDays: card.scheduledDays,
			lastReview: card.lastReview,
			createdAt: card.createdAt ?? null,
			suspended: card.suspended ?? false,
			buriedUntil: card.buriedUntil ?? null,
			sourceUid: card.sourceUid ?? null,
			sourceNoteName: file?.basename ?? null,
			sourceNotePath: file?.path ?? null,
			cardType: card.cardType ?? "basic",
			createdVia: card.createdVia ?? null,
			presetName,
			projects,
			ioImagePath: card.ioImagePath,
			ioRegionsJson: card.ioRegionsJson,
			templateOrd: card.templateOrd,
		};
	}
}
