import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";
import type { FSRSCardData } from "@true-recall/core/types";

export type CsvSeparator = "," | "\t" | ";";

export interface CsvExportOptions {
	sourceUids?: string[];
	includeScheduling: boolean;
	separator: CsvSeparator;
}

/**
 * Resolves flashcard_uid → note name mapping from the vault/frontmatter.
 * Obsidian: implemented by scanning app.vault + metadataCache.
 */
export interface ISourceUidResolver {
	resolveSourceUids(): Map<string, { name: string }>;
}

const STATE_LABELS = ["New", "Learning", "Review", "Relearning"] as const;

export class CsvExportService {
	constructor(
		private store: SqliteStoreService,
		private sourceUidResolver: ISourceUidResolver,
	) {}

	export(options: CsvExportOptions): { content: string; filename: string } {
		const allCards = this.store.getAll();
		const sourceUidToInfo = this.sourceUidResolver.resolveSourceUids();
		const cards = this.filterAndEnrich(
			allCards,
			sourceUidToInfo,
			options.sourceUids,
		);

		if (cards.length === 0) {
			throw new Error("No cards to export");
		}

		const sep = options.separator;
		const rows: string[] = [];

		// Header
		const headers = ["Question", "Answer", "Source Note"];
		if (options.includeScheduling) {
			headers.push("State", "Due", "Interval", "Lapses");
		}
		rows.push(headers.map((h) => this.escapeField(h, sep)).join(sep));

		// Data rows
		for (const card of cards) {
			const fields = [
				card.question ?? "",
				card.answer ?? "",
				card.sourceNoteName ?? "",
			];

			if (options.includeScheduling) {
				fields.push(
					STATE_LABELS[card.state] ?? String(card.state),
					card.due ? new Date(card.due).toISOString().slice(0, 10) : "",
					String(card.scheduledDays),
					String(card.lapses),
				);
			}

			rows.push(fields.map((f) => this.escapeField(f, sep)).join(sep));
		}

		const ext = sep === "\t" ? "tsv" : "csv";
		const date = new Date().toISOString().slice(0, 10);
		const filename = `true-recall-export-${date}.${ext}`;

		return { content: rows.join("\n"), filename };
	}

	private escapeField(value: string, separator: CsvSeparator): string {
		// Replace newlines with spaces for CSV compatibility
		const cleaned = value.replace(/\r?\n/g, " ").replace(/\r/g, " ");

		// Quote if contains separator, quotes, or leading/trailing whitespace
		if (
			cleaned.includes(separator) ||
			cleaned.includes('"') ||
			cleaned !== cleaned.trim()
		) {
			return `"${cleaned.replace(/"/g, '""')}"`;
		}

		return cleaned;
	}

	private filterAndEnrich(
		allCards: FSRSCardData[],
		sourceUidToInfo: Map<string, { name: string }>,
		sourceUidFilter?: string[],
	): FSRSCardData[] {
		const enriched = allCards.map((card) => {
			if (card.sourceUid) {
				const info = sourceUidToInfo.get(card.sourceUid);
				if (info) {
					return { ...card, sourceNoteName: info.name };
				}
			}
			return card;
		});

		if (sourceUidFilter && sourceUidFilter.length > 0) {
			const uidSet = new Set(sourceUidFilter);
			return enriched.filter(
				(card) => card.sourceUid && uidSet.has(card.sourceUid),
			);
		}

		return enriched;
	}
}
