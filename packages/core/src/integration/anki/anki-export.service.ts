import type { ISourceUidResolver } from "@true-recall/core/integration/csv/csv-export.service";
import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";
import type { FSRSService } from "@true-recall/core/services/fsrs/fsrs.service";
import type { AnkiExportOptions, FSRSCardData } from "@true-recall/core/types";

import { ApkgBuilderService } from "./apkg/apkg-builder.service";

/**
 * Reads binary file data from the vault by filename.
 * Obsidian: wraps app.vault.getFiles() + readBinary().
 */
export interface IVaultMediaReader {
	/** Find a file by name (or path suffix) and return its binary data. Returns null if not found. */
	readBinaryByName(filename: string): Promise<ArrayBuffer | null>;
}

interface DeckInfo {
	id: number;
	name: string;
}

export class AnkiExportService {
	constructor(
		private store: SqliteStoreService,
		_fsrsService: FSRSService,
		private sourceUidResolver: ISourceUidResolver,
		private mediaReader?: IVaultMediaReader,
	) {}

	async exportApkg(
		options: AnkiExportOptions,
	): Promise<{ data: ArrayBuffer; filename: string }> {
		const allCards = this.store.getAll();
		const mode = options.exportMode ?? "all";

		const cards = this.resolveAndFilter(allCards, mode, options);

		if (cards.length === 0) {
			throw new Error("No cards to export");
		}

		const reviewLogs = options.includeScheduling
			? this.getReviewLogsForCards(cards)
			: [];

		const media = options.includeMedia
			? await this.collectMedia(cards)
			: new Map<string, ArrayBuffer>();

		const deckMap = this.buildDeckMap(cards);
		const collectionCreatedAt = this.getCollectionCreatedAt(cards);

		const builder = new ApkgBuilderService();
		const data = await builder.build({
			cards,
			reviewLogs,
			deckMap,
			collectionCreatedAt,
			includeScheduling: options.includeScheduling,
			media,
		});

		const date = new Date().toISOString().slice(0, 10);
		const filename = `true-recall-export-${date}.apkg`;

		return { data, filename };
	}

	private resolveAndFilter(
		allCards: FSRSCardData[],
		mode: "all" | "notes",
		options: AnkiExportOptions,
	): FSRSCardData[] {
		const sourceUidMap = this.sourceUidResolver.resolveSourceUids();

		const enriched = allCards.map((card) => {
			const info = card.sourceUid
				? sourceUidMap.get(card.sourceUid)
				: undefined;
			const sourceNoteName = info?.name ?? card.sourceNoteName;
			return { ...card, sourceNoteName };
		});

		if (mode === "notes" && options.sourceUids?.length) {
			const uidSet = new Set(options.sourceUids);
			return enriched.filter(
				(card) => card.sourceUid && uidSet.has(card.sourceUid),
			);
		}

		return enriched;
	}

	private buildDeckMap(cards: FSRSCardData[]): Map<string, DeckInfo> {
		const deckMap = new Map<string, DeckInfo>();
		deckMap.set("Default", { id: 1, name: "Default" });

		for (const card of cards) {
			const key = card.sourceNoteName ?? "Default";
			if (key === "Default" || deckMap.has(key)) continue;

			const id = deckIdFromName(key);
			deckMap.set(key, { id, name: key });
		}

		return deckMap;
	}

	private getReviewLogsForCards(cards: FSRSCardData[]) {
		const allLogs = this.store.stats.getModifiedReviewLogSince(0);
		const cardIdSet = new Set(cards.map((c) => c.id));
		return allLogs.filter((log) => cardIdSet.has(log.cardId));
	}

	private async collectMedia(
		cards: FSRSCardData[],
	): Promise<Map<string, ArrayBuffer>> {
		const media = new Map<string, ArrayBuffer>();
		if (!this.mediaReader) return media;

		const filenames = new Set<string>();

		const mediaRegex = /!\[\[([^\]]+)\]\]/g;
		for (const card of cards) {
			const content = (card.question ?? "") + (card.answer ?? "");
			for (
				let match = mediaRegex.exec(content);
				match !== null;
				match = mediaRegex.exec(content)
			) {
				if (match[1]) filenames.add(match[1]);
			}
		}

		for (const filename of filenames) {
			try {
				const data = await this.mediaReader.readBinaryByName(filename);
				if (data) {
					media.set(filename, data);
				}
			} catch {
				console.error(`[True Recall] Could not read media file: ${filename}`);
			}
		}

		return media;
	}

	private getCollectionCreatedAt(cards: FSRSCardData[]): number {
		let earliest = Date.now();
		for (const card of cards) {
			if (card.createdAt && card.createdAt < earliest) {
				earliest = card.createdAt;
			}
		}
		return Math.floor(earliest / 1000);
	}
}

function deckIdFromName(name: string): number {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		const char = name.charCodeAt(i);
		hash = ((hash << 5) - hash + char) | 0;
	}
	return Math.abs(hash) + 2000000000;
}
