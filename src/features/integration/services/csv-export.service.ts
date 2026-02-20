import type { App } from "obsidian";
import type { FSRSCardData } from "shared/types";
import { stripWikiLinkSyntax } from "../../../shared/utils";
import type { SqliteStoreService } from "../../../features/core/persistence/sqlite/SqliteStoreService";

export type CsvSeparator = "," | "\t" | ";";

export interface CsvExportOptions {
	projects?: string[];
	sourceUids?: string[];
	includeScheduling: boolean;
	separator: CsvSeparator;
}

const STATE_LABELS = ["New", "Learning", "Review", "Relearning"] as const;

export class CsvExportService {
	constructor(
		private app: App,
		private store: SqliteStoreService,
	) {}

	export(options: CsvExportOptions): { content: string; filename: string } {
		const allCards = this.store.getAll();
		const sourceUidToInfo = this.buildSourceUidMap();
		const cards = this.filterAndEnrich(
			allCards,
			sourceUidToInfo,
			options.projects,
			options.sourceUids,
		);

		if (cards.length === 0) {
			throw new Error("No cards to export");
		}

		const sep = options.separator;
		const rows: string[] = [];

		// Header
		const headers = ["Question", "Answer", "Tags", "Source Note"];
		if (options.includeScheduling) {
			headers.push("State", "Due", "Interval", "Lapses");
		}
		rows.push(headers.map((h) => this.escapeField(h, sep)).join(sep));

		// Data rows
		for (const card of cards) {
			const fields = [
				card.question ?? "",
				card.answer ?? "",
				(card.projects ?? []).join(", "),
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
		sourceUidToInfo: Map<string, { name: string; projects: string[] }>,
		projectFilter?: string[],
		sourceUidFilter?: string[],
	): FSRSCardData[] {
		const enriched = allCards.map((card) => {
			if (card.sourceUid) {
				const info = sourceUidToInfo.get(card.sourceUid);
				if (info) {
					return {
						...card,
						sourceNoteName: info.name,
						projects: info.projects.length > 0 ? info.projects : card.projects,
					};
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

		if (projectFilter && projectFilter.length > 0) {
			const filterSet = new Set(projectFilter);
			return enriched.filter((card) => {
				if (!card.projects || card.projects.length === 0) return false;
				return card.projects.some((p) => filterSet.has(p));
			});
		}

		return enriched;
	}

	private buildSourceUidMap(): Map<
		string,
		{ name: string; projects: string[] }
	> {
		const map = new Map<string, { name: string; projects: string[] }>();
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const cache = this.app.metadataCache.getFileCache(file);
			if (!cache?.frontmatter) continue;

			const uid = cache.frontmatter.flashcard_uid as string | undefined;
			if (!uid) continue;

			const projects = this.extractProjects(cache.frontmatter);
			map.set(uid, { name: file.basename, projects });
		}

		return map;
	}

	private extractProjects(frontmatter: Record<string, unknown>): string[] {
		const raw = frontmatter.projects;
		if (!Array.isArray(raw)) return [];

		return raw
			.filter((p): p is string => typeof p === "string")
			.map((p) => stripWikiLinkSyntax(p))
			.filter((p) => p.length > 0);
	}
}
