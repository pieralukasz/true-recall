import { type App, normalizePath, type TFile } from "obsidian";
import type {
	AnkiCard,
	AnkiImportOptions,
	AnkiImportResult,
	AnkiRevlogEntry,
	ConvertedCard,
	FSRSCardData,
} from "shared/types";
import type { FSRSService } from "@features/core/services/fsrs.service";
import { notifyCardChange } from "@shared/services/signals";
import type { SqliteStoreService } from "@features/core/persistence/sqlite/SqliteStoreService";
import { generateUUID } from "@features/core/persistence/sqlite/sqlite.types";
import { AnkiConverterService } from "@features/integration/services/anki/anki-converter.service";
import { AnkiMediaService } from "@features/integration/services/anki/anki-media.service";
import { AnkiSchedulingService } from "@features/integration/services/anki/anki-scheduling.service";
import { ApkgParserService } from "@features/integration/services/anki/apkg-parser.service";

const IMPORT_FOLDER = "Anki Import";

export class AnkiImportService {
	constructor(
		private app: App,
		private store: SqliteStoreService,
		private fsrsService: FSRSService,
	) {}

	async importApkg(
		fileData: ArrayBuffer,
		options: AnkiImportOptions,
	): Promise<AnkiImportResult> {
		const result: AnkiImportResult = {
			imported: 0,
			skipped: 0,
			duplicates: 0,
			errors: [],
			projects: [],
		};

		// 1. Parse the .apkg file
		const parser = new ApkgParserService(this.app);
		const apkgData = await parser.parseApkg(fileData);

		// 2. Convert Anki notes to cards
		const converter = new AnkiConverterService();
		const convertedCards = converter.convert(apkgData);

		if (convertedCards.length === 0) {
			result.errors.push("No cards found in the .apkg file");
			return result;
		}

		// 3. Import media files (if enabled)
		let mediaPathMapping = new Map<string, string>();
		if (options.importMedia && apkgData.media.size > 0) {
			const mediaService = new AnkiMediaService(this.app);
			mediaPathMapping = await mediaService.importMedia(
				apkgData.media,
				apkgData.mediaMap,
				options.mediaFolder,
			);
		}

		// 4. Build revlog lookup: ankiCardId → revlog entries
		const revlogByCard = new Map<number, AnkiRevlogEntry[]>();
		for (const entry of apkgData.revlog) {
			const list = revlogByCard.get(entry.cid) ?? [];
			list.push(entry);
			revlogByCard.set(entry.cid, list);
		}

		// 5. Build AnkiCard lookup for scheduling
		const ankiCardMap = new Map<number, AnkiCard>();
		for (const card of apkgData.cards) {
			ankiCardMap.set(card.id, card);
		}

		// 6. Prepare services
		const schedulingService = new AnkiSchedulingService(this.fsrsService);
		const mediaService = new AnkiMediaService(this.app);

		// 7. Track unique projects from deck names
		const projectSet = new Set<string>();

		// 8. Process each converted card
		const importedCardIds: string[] = [];
		const deckToCardIds = new Map<string, string[]>();

		this.store.transaction(() => {
			const ankiToTrCardId = new Map<number, string>();

			for (const converted of convertedCards) {
				try {
					const importResult = this.importSingleCard(
						converted,
						ankiCardMap,
						revlogByCard,
						schedulingService,
						mediaService,
						mediaPathMapping,
						options,
						ankiToTrCardId,
					);

					if (importResult.status === "imported") {
						importedCardIds.push(importResult.cardId);
						result.imported++;
						projectSet.add(converted.deckName);

						const list = deckToCardIds.get(converted.deckName) ?? [];
						list.push(importResult.cardId);
						deckToCardIds.set(converted.deckName, list);
					} else if (importResult.status === "duplicate") {
						result.duplicates++;
					} else {
						result.skipped++;
					}
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					result.errors.push(`Card ${converted.ankiCardId}: ${msg}`);
					result.skipped++;
				}
			}

			if (options.importScheduling) {
				this.importReviewLogs(
					convertedCards,
					revlogByCard,
					importedCardIds,
					ankiToTrCardId,
				);
			}
		});

		result.projects = [...projectSet];

		await this.store.flush();

		// Create source notes per deck so imported cards appear in panel/projects
		if (deckToCardIds.size > 0) {
			await this.createSourceNotesForDecks(deckToCardIds);
			await this.store.flush();
		}

		if (importedCardIds.length > 0) {
			notifyCardChange({
				type: "bulk",
				cardIds: importedCardIds,
				action: "added",
			});
		}

		return result;
	}

	private importSingleCard(
		converted: ConvertedCard,
		ankiCardMap: Map<number, AnkiCard>,
		revlogByCard: Map<number, AnkiRevlogEntry[]>,
		schedulingService: AnkiSchedulingService,
		mediaService: AnkiMediaService,
		mediaPathMapping: Map<string, string>,
		options: AnkiImportOptions,
		ankiToTrCardId: Map<number, string>,
	):
		| { status: "imported"; cardId: string }
		| { status: "duplicate" | "skipped" } {
		let question = converted.question;
		let answer = converted.answer;

		if (mediaPathMapping.size > 0) {
			question = mediaService.updateImportedContent(question, mediaPathMapping);
			answer = mediaService.updateImportedContent(answer, mediaPathMapping);
		}

		if (!question.trim()) {
			return { status: "skipped" };
		}

		const existingId =
			converted.cardType === "cloze" && converted.clozeIndex !== undefined
				? this.store.cards.getCardIdByQuestionAndClozeIndex(
						question,
						converted.clozeIndex,
					)
				: this.store.cards.getCardIdByQuestion(question);
		if (existingId) {
			ankiToTrCardId.set(converted.ankiCardId, existingId);
			return { status: "duplicate" };
		}

		const cardId = generateUUID();
		ankiToTrCardId.set(converted.ankiCardId, cardId);

		let cardData: FSRSCardData;

		if (options.importScheduling) {
			const ankiCard =
				ankiCardMap.get(converted.ankiCardId) ??
				this.buildMinimalAnkiCard(converted);
			const revlogs = revlogByCard.get(converted.ankiCardId) ?? [];
			cardData = schedulingService.convert(cardId, ankiCard, revlogs);
		} else {
			cardData = this.fsrsService.createNewCard(cardId);
		}

		cardData.question = question;
		cardData.answer = answer;
		cardData.cardType = converted.cardType;

		if (converted.cardType === "cloze") {
			let clozeTemplate = converted.clozeTemplate ?? question;
			if (mediaPathMapping.size > 0) {
				clozeTemplate = mediaService.updateImportedContent(
					clozeTemplate,
					mediaPathMapping,
				);
			}
			cardData.clozeTemplate = clozeTemplate;
			cardData.clozeIndex = converted.clozeIndex;
		}

		if (
			converted.cardType === "reversed" &&
			converted.reverseOfAnkiCardId !== undefined
		) {
			const originalTrId = ankiToTrCardId.get(converted.reverseOfAnkiCardId);
			if (originalTrId) {
				cardData.reverseOf = originalTrId;
			}
		}

		this.store.set(cardId, cardData);

		return { status: "imported", cardId };
	}

	private importReviewLogs(
		convertedCards: ConvertedCard[],
		revlogByCard: Map<number, AnkiRevlogEntry[]>,
		importedCardIds: string[],
		ankiToTrCardId: Map<number, string>,
	): void {
		const importedSet = new Set(importedCardIds);

		for (const converted of convertedCards) {
			const trCardId = ankiToTrCardId.get(converted.ankiCardId);
			if (!trCardId || !importedSet.has(trCardId)) continue;

			const revlogs = revlogByCard.get(converted.ankiCardId) ?? [];
			const sorted = [...revlogs].sort((a, b) => a.id - b.id);

			for (const entry of sorted) {
				this.store.stats.upsertReviewLogFromRemote({
					id: generateUUID(),
					cardId: trCardId,
					reviewedAt: new Date(entry.id).toISOString(),
					rating: Math.max(1, Math.min(4, entry.ease)),
					scheduledDays: Math.max(0, entry.ivl),
					elapsedDays: Math.max(0, entry.lastIvl),
					state: Math.max(0, Math.min(3, entry.type)),
					timeSpentMs: Math.max(0, entry.time),
					updatedAt: Date.now(),
					deletedAt: null,
					presetName: null,
				});
			}
		}
	}

	/**
	 * Creates a hierarchical note structure matching the Anki deck hierarchy.
	 *
	 * For deck "Math::Calculus::Integrals":
	 *   Anki Import/Math.md             (MOC, tag: Math)
	 *   Anki Import/Math/Calculus.md    (MOC, tag: Math/Calculus)
	 *   Anki Import/Math/Calculus/Integrals.md  (leaf, tag: Math/Calculus/Integrals)
	 *
	 * Only leaf decks (those with actual cards) get cards linked via source_uid.
	 * Parent-only decks become MOC notes with [[child]] links.
	 */
	private async createSourceNotesForDecks(
		deckToCardIds: Map<string, string[]>,
	): Promise<void> {
		const basePath = normalizePath(IMPORT_FOLDER);
		if (!this.app.vault.getAbstractFileByPath(basePath)) {
			await this.app.vault.createFolder(basePath);
		}

		// Collect all hierarchy levels needed
		// Key: full deck path (e.g. "Math::Calculus"), Value: direct children names
		const parentToChildren = new Map<string, Set<string>>();
		const allSegmentPaths = new Set<string>();

		for (const deckName of deckToCardIds.keys()) {
			const segments = deckName.split("::");

			// Register every prefix level
			for (let i = 0; i < segments.length; i++) {
				const path = segments.slice(0, i + 1).join("::");
				allSegmentPaths.add(path);

				// Track parent→child relationships
				if (i > 0) {
					const parentPath = segments.slice(0, i).join("::");
					if (!parentToChildren.has(parentPath)) {
						parentToChildren.set(parentPath, new Set());
					}
					const segmentName = segments[i];
					if (segmentName) {
						parentToChildren.get(parentPath)?.add(segmentName);
					}
				}
			}
		}

		// Create notes for each hierarchy level (sorted so parents are created before children)
		const sortedPaths = [...allSegmentPaths].sort(
			(a, b) => a.split("::").length - b.split("::").length,
		);

		for (const deckPath of sortedPaths) {
			const segments = deckPath.split("::");
			const name = segments[segments.length - 1] ?? "Default";
			const safeName = name.replace(/[\\/:*?"<>|]/g, " - ").trim() || "Default";

			// Build hierarchical tag: Math/Calculus/Integrals
			const tagPath = segments
				.map((s) => s.replace(/[\\/:*?"<>|]/g, " - ").trim())
				.join("/");

			// Build filesystem path
			const folderSegments = segments
				.slice(0, -1)
				.map((s) => s.replace(/[\\/:*?"<>|]/g, " - ").trim());
			const folderPath =
				folderSegments.length > 0
					? normalizePath(`${IMPORT_FOLDER}/${folderSegments.join("/")}`)
					: basePath;

			// Ensure folder exists
			if (
				folderPath !== basePath &&
				!this.app.vault.getAbstractFileByPath(folderPath)
			) {
				await this.ensureFolderRecursive(folderPath);
			}

			const notePath = normalizePath(`${folderPath}/${safeName}.md`);
			const cardIds = deckToCardIds.get(deckPath);
			const children = parentToChildren.get(deckPath);
			const isLeaf = !children || children.size === 0;

			const uid = await this.createOrUpdateNote(
				notePath,
				name,
				tagPath,
				isLeaf ? undefined : children,
			);

			// Link cards to this note (only if this deck level has cards)
			if (cardIds) {
				for (const cardId of cardIds) {
					this.store.cards.updateCardSourceUid(cardId, uid);
				}
			}
		}
	}

	private async createOrUpdateNote(
		notePath: string,
		title: string,
		tagPath: string,
		children?: Set<string>,
	): Promise<string> {
		const existingFile = this.app.vault.getAbstractFileByPath(
			notePath,
		) as TFile | null;

		if (existingFile) {
			const cache = this.app.metadataCache.getFileCache(existingFile);
			const existingUid = cache?.frontmatter?.flashcard_uid as
				| string
				| undefined;

			if (existingUid) {
				// Update child links if this is a parent note
				if (children && children.size > 0) {
					await this.updateChildLinks(existingFile, children);
				}
				return existingUid;
			}

			// No UID: prepend frontmatter
			const uid = this.generateUid();
			const frontmatter = this.buildFrontmatter(uid, tagPath);
			await this.app.vault.process(
				existingFile,
				(content) => `${frontmatter}\n\n${content}`,
			);
			return uid;
		}

		// Create new note
		const uid = this.generateUid();
		const frontmatter = this.buildFrontmatter(uid, tagPath);

		const bodyParts = [`# ${title}`, ""];

		if (children && children.size > 0) {
			for (const child of [...children].sort()) {
				bodyParts.push(`- [[${child}]]`);
			}
			bodyParts.push("");
		} else {
			bodyParts.push("Imported from Anki.", "");
		}

		await this.app.vault.create(
			notePath,
			`${frontmatter}\n\n${bodyParts.join("\n")}`,
		);
		return uid;
	}

	private buildFrontmatter(uid: string, tagPath: string): string {
		return [
			"---",
			`flashcard_uid: ${uid}`,
			"tags:",
			`  - ${tagPath}`,
			"---",
		].join("\n");
	}

	private async updateChildLinks(
		file: TFile,
		children: Set<string>,
	): Promise<void> {
		await this.app.vault.process(file, (content) => {
			const missingChildren = [...children].filter(
				(child) => !content.includes(`[[${child}]]`),
			);
			if (missingChildren.length === 0) return content;
			const newLinks = missingChildren
				.map((child) => `- [[${child}]]`)
				.join("\n");
			return `${content}\n${newLinks}\n`;
		});
	}

	private async ensureFolderRecursive(folderPath: string): Promise<void> {
		const parts = folderPath.split("/");
		let current = "";

		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			const normalized = normalizePath(current);
			if (!this.app.vault.getAbstractFileByPath(normalized)) {
				await this.app.vault.createFolder(normalized);
			}
		}
	}

	private generateUid(): string {
		return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
	}

	private buildMinimalAnkiCard(converted: ConvertedCard) {
		return {
			id: converted.ankiCardId,
			nid: converted.ankiNoteId,
			did: 0,
			ord: 0,
			type: 0,
			queue: 0,
			due: 0,
			ivl: 0,
			factor: 0,
			reps: 0,
			lapses: 0,
		};
	}
}
