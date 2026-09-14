import { TFile } from "obsidian";

import {
	extractKeywords,
	selectRelevantSections,
} from "@true-recall/core/helpers/context-excerpt";
import type { FSRSFlashcardItem } from "@true-recall/core/types";

import { notify } from "@true-recall/obsidian/services/notification.service";
import type { ReviewApi } from "@true-recall/obsidian/store";

import type TrueRecallPlugin from "../../main";

export class ReviewSourceNavigator {
	constructor(
		private plugin: TrueRecallPlugin,
		private getReview: () => ReviewApi,
	) {}
	private get review(): ReviewApi {
		return this.getReview();
	}

	async resolveGradingContext(card: FSRSFlashcardItem): Promise<{
		sourceContext?: string;
		sourceNotePath?: string;
		relatedCards?: Array<{
			fields: Record<string, string>;
			noteType: string;
		}>;
	}> {
		const MAX_CONTEXT_CHARS = 10000;
		const MAX_RELATED_CARDS = 10;

		// Prefer the sections of the note that actually talk about this card
		// over a blind head slice.
		const keywords = extractKeywords(`${card.question} ${card.answer ?? ""}`);
		let sourceContext: string | undefined = card.sourceText
			? selectRelevantSections(card.sourceText, keywords, MAX_CONTEXT_CHARS)
			: undefined;
		let sourceNotePath: string | undefined;

		const file = this.resolveSourceFile(card);
		if (file) {
			sourceNotePath = file.path;
			if (!sourceContext) {
				try {
					const content = await this.plugin.app.vault.cachedRead(file);
					sourceContext = selectRelevantSections(
						content,
						keywords,
						MAX_CONTEXT_CHARS,
					);
				} catch {
					// Source file unreadable: fall back to no context.
				}
			}
		}

		const store = this.plugin.cardStore;
		let relatedCards:
			| Array<{ fields: Record<string, string>; noteType: string }>
			| undefined;
		if (store && card.sourceUid) {
			const siblings = store.cards.getCardsBySourceUid(card.sourceUid) ?? [];
			const collected: Array<{
				fields: Record<string, string>;
				noteType: string;
			}> = [];
			for (const sibling of siblings) {
				if (sibling.id === card.id) continue;
				if (!sibling.noteTypeId || !sibling.noteId) continue;
				const noteType = store.noteTypes?.getById(sibling.noteTypeId);
				if (!noteType) continue;
				const note = store.notes.getById(sibling.noteId);
				if (!note) continue;
				const fields: Record<string, string> = {};
				for (const fieldName of noteType.fields) {
					fields[fieldName] = note.fields?.[fieldName] ?? "";
				}
				collected.push({ fields, noteType: noteType.name });
				if (collected.length >= MAX_RELATED_CARDS) break;
			}
			if (collected.length > 0) relatedCards = collected;
		}

		return { sourceContext, sourceNotePath, relatedCards };
	}

	// ─── Navigation ──────────────────────────────────────────────────────

	resolveSourceFile(card: FSRSFlashcardItem): TFile | null {
		if (card.sourceUid && this.plugin.frontmatterIndex) {
			const filePath = this.plugin.frontmatterIndex.getFileByValue(
				"flashcard_uid",
				card.sourceUid,
			);
			if (filePath) {
				const abstractFile =
					this.plugin.app.vault.getAbstractFileByPath(filePath);
				if (abstractFile instanceof TFile) return abstractFile;
			}
		}

		if (card.sourceNotePath) {
			const abstractFile = this.plugin.app.vault.getAbstractFileByPath(
				card.sourceNotePath,
			);
			if (abstractFile instanceof TFile) {
				return abstractFile;
			}
		}

		return null;
	}

	handleOpenSourceNote(): void {
		const card = this.review.getCurrentCard();
		if (!card || !card.sourceNoteName) {
			notify().warning("Source note not found");
			return;
		}

		const sourceFile = this.resolveSourceFile(card);
		if (sourceFile) {
			void this.plugin.app.workspace.openLinkText(sourceFile.path, "", false);
		} else {
			notify().warning(`Source note "${card.sourceNoteName}" not found`);
		}
	}

	handleOpenNote(): void {
		const card = this.review.getCurrentCard();
		if (!card) return;

		if (card.sourceNoteName) {
			this.handleOpenSourceNote();
		} else {
			notify().info("This card has no associated source note");
		}
	}
}
