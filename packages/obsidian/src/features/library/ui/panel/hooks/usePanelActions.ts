import { useCallback } from "preact/hooks";

import type { FlashcardItem } from "@true-recall/core/types";
import type { FSRSFlashcardItem } from "@true-recall/core/types/fsrs/card.types";

import { BatchCreateCommand } from "@true-recall/obsidian/commands/commands/card-create.cmd";
import { DeleteCardCommand } from "@true-recall/obsidian/commands/commands/card-delete.cmd";
import { ForgetCommand } from "@true-recall/obsidian/commands/commands/card-forget.cmd";
import { getHighlightColor } from "@true-recall/obsidian/features/library/ui/panel/utils/card-status.utils";
import { extractHighlights } from "@true-recall/obsidian/features/library/ui/panel/utils/highlight-extractor";
import { cardsToBlockText } from "@true-recall/obsidian/features/library/ui/panel/utils/panel-helpers";
import { fetchExistingCardsForFile } from "@true-recall/obsidian/plugin/existing-cards-fetcher";
import { runPresetPostProcessing } from "@true-recall/obsidian/plugin/generation-post-processing";
import { useApp, usePlugin } from "@true-recall/obsidian/preact";

import { usePanelStore } from "./usePanelStore";

export function usePanelActions() {
	const plugin = usePlugin();
	const app = useApp();
	const { currentFile, flashcardInfo, cardsWithFsrs, panel } = usePanelStore();

	// ── AI generation ──

	const handleGenerateFromNote = useCallback(async () => {
		if (!currentFile) return;
		const { notify } = await import(
			"@true-recall/obsidian/services/notification.service"
		);

		if (!plugin.settings.proKey && !plugin.settings.openRouterApiKey) {
			notify().aiNotConfigured();
			return;
		}

		const content = await app.vault.read(currentFile);
		if (!content.trim()) {
			notify().warning("Note is empty");
			return;
		}

		const { ChunkedGenerationService } = await import(
			"@true-recall/core/ai/generation/chunked-generation.service"
		);

		const { ObsidianHttpClient } = await import(
			"@true-recall/obsidian/adapters/ObsidianHttpClient"
		);
		const chunkedService = new ChunkedGenerationService(
			() => plugin.settings,
			plugin.flashcardManager as any,
			new ObsidianHttpClient(),
		);

		try {
			const existingCards = await fetchExistingCardsForFile(plugin, currentFile);
			const result = await chunkedService.generateFromNote(
				content,
				currentFile,
				plugin.settings.defaultGenerationPresetId,
				{ existingCards },
			);

			if (result.created === 0 && result.duplicates === 0) {
				notify().warning("No flashcards generated from this note");
			} else if (result.duplicates > 0) {
				notify().cardsCreatedWithDuplicates(
					result.created,
					result.duplicates,
					currentFile.basename,
				);
			} else {
				notify().cardsCreated(result.created, currentFile.basename);
			}

			if (result.failedChunks > 0) {
				notify().warning(
					`${result.failedChunks} of ${result.totalChunks} sections failed: ${result.errors.join("; ")}`,
				);
			}

			// Register undo for created cards
			if (result.createdCardIds && result.createdCardIds.length > 0) {
				const cmd = new BatchCreateCommand(result.createdCardIds);
				await plugin.commandService?.execute(cmd);
				runPresetPostProcessing(plugin, result.preset, result.createdCardIds);
			}
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") return;
			const msg = error instanceof Error ? error.message : String(error);
			notify().error(`Flashcard generation failed: ${msg}`);
		}
	}, [currentFile, app, plugin]);

	const handleGenerateFromHighlights = useCallback(async () => {
		if (!currentFile) return;
		const { notify } = await import(
			"@true-recall/obsidian/services/notification.service"
		);

		if (!plugin.settings.proKey && !plugin.settings.openRouterApiKey) {
			notify().aiNotConfigured();
			return;
		}

		const content = await app.vault.read(currentFile);
		const highlights = extractHighlights(content);

		if (highlights.length === 0) {
			notify().warning("No highlights found in note");
			return;
		}

		const frontmatterService = plugin.flashcardManager.getFrontmatterService();
		const sourceUid = await frontmatterService.getSourceNoteUid(
			currentFile.path,
		);

		const existingSourceTexts = sourceUid
			? ((plugin.cardStore?.getCardsBySourceUid(sourceUid) ?? [])
					.map((c) => c.sourceText?.trim().toLowerCase())
					.filter(Boolean) as string[])
			: [];

		const newHighlights =
			existingSourceTexts.length > 0
				? highlights.filter((h) => {
						const normalized = h.trim().toLowerCase();
						return !existingSourceTexts.some(
							(st) => st.includes(normalized) || normalized.includes(st),
						);
					})
				: highlights;

		if (newHighlights.length === 0) {
			notify().warning("All highlights already have flashcards");
			return;
		}

		const joinedHighlights = newHighlights.join("\n\n");

		const { StreamingGenerationService } = await import(
			"@true-recall/core/ai/generation/streaming-generation.service"
		);

		const { ObsidianHttpClient: HttpClient } = await import(
			"@true-recall/obsidian/adapters/ObsidianHttpClient"
		);
		const streamingService = new StreamingGenerationService(
			() => plugin.settings,
			plugin.flashcardManager as any,
			new HttpClient(),
		);

		try {
			const result = await streamingService.generate(
				joinedHighlights,
				currentFile,
				plugin.settings.defaultGenerationPresetId,
			);

			if (result.created === 0 && result.duplicates === 0) {
				notify().warning("No flashcards generated from highlights");
			} else if (result.duplicates > 0) {
				notify().cardsCreatedWithDuplicates(
					result.created,
					result.duplicates,
					currentFile.basename,
				);
			} else {
				notify().cardsCreated(result.created, currentFile.basename);
			}

			// Register undo for created cards
			if (result.createdCardIds && result.createdCardIds.length > 0) {
				const cmd = new BatchCreateCommand(result.createdCardIds);
				await plugin.commandService?.execute(cmd);
				runPresetPostProcessing(plugin, result.preset, result.createdCardIds);
			}
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") return;
			const msg = error instanceof Error ? error.message : String(error);
			notify().error(`Flashcard generation failed: ${msg}`);
		}
	}, [currentFile, app, plugin]);

	// ── Collection ──

	const handleCollect = useCallback(async () => {
		if (!currentFile) return;
		const { notify } = await import(
			"@true-recall/obsidian/services/notification.service"
		);
		const { CollectService } = await import(
			"@true-recall/core/flashcard/lifecycle/collect.service"
		);

		if (!plugin.flashcardManager.hasStore()) {
			notify().error("Flashcard store not ready. Please restart Obsidian.");
			return;
		}

		try {
			const getNoteType = (slug: string) =>
				plugin.noteTypeService.getBySlug(slug);
			const collectService = new CollectService(getNoteType);
			const content = await app.vault.read(currentFile);
			const collectResult = collectService.collect(content);

			if (collectResult.collectedCount === 0) {
				notify().info("No flashcards to collect");
				return;
			}

			const frontmatterService =
				plugin.flashcardManager.getFrontmatterService();
			const sourceUid = await frontmatterService.getSourceNoteUid(
				currentFile.path,
			);

			const contentToSave = plugin.settings.removeFlashcardContentAfterCollect
				? collectResult.newContentWithoutFlashcards
				: collectResult.newContent;
			await app.vault.process(currentFile, () => contentToSave);

			const { cards } = plugin.flashcardManager.createNoteBatch(
				collectResult.parsedBlocks.map((block) => ({
					noteTypeId: block.noteTypeId,
					fields: block.fields,
					sourceUid: sourceUid ?? undefined,
					sourceText: block.sourceText,
					alwaysTypeIn: block.alwaysTypeIn,
					createdVia: "collect",
				})),
			);

			if (cards.length === 0) {
				notify().info("No new flashcards collected");
			} else {
				// Register undo for collected cards
				const cardIds = cards.map((c) => c.id);
				const cmd = new BatchCreateCommand(cardIds);
				await plugin.commandService?.execute(cmd);
				notify().success(
					`Collected ${collectResult.parsedBlocks.length} note(s) → ${cards.length} card(s)`,
				);
			}
		} catch (error) {
			notify().operationFailed("collect flashcards", error);
		}
	}, [currentFile, app, plugin]);

	// ── Export ──

	const handleExportCsv = useCallback(async () => {
		const { notify } = await import(
			"@true-recall/obsidian/services/notification.service"
		);
		if (!flashcardInfo?.flashcards || flashcardInfo.flashcards.length === 0) {
			notify().warning("No flashcards to export");
			return;
		}

		const escapeCSV = (str: string): string => {
			if (str.includes(",") || str.includes("\n") || str.includes('"')) {
				return `"${str.replace(/"/g, '""')}"`;
			}
			return str;
		};

		const header = "Question,Answer";
		const rows = flashcardInfo.flashcards.map(
			(card) => `${escapeCSV(card.question)},${escapeCSV(card.answer)}`,
		);
		const csvContent = [header, ...rows].join("\n");

		const filename = currentFile
			? `${currentFile.basename}-flashcards.csv`
			: "flashcards.csv";

		const blob = new Blob([csvContent], {
			type: "text/csv;charset=utf-8;",
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);

		notify().success(
			`Exported ${flashcardInfo.flashcards.length} flashcard(s) to CSV`,
		);
	}, [flashcardInfo, currentFile]);

	const handleCopyAllToClipboard = useCallback(async () => {
		const { notify } = await import(
			"@true-recall/obsidian/services/notification.service"
		);
		if (!flashcardInfo?.flashcards || flashcardInfo.flashcards.length === 0) {
			notify().warning("No flashcards to copy");
			return;
		}

		const text = cardsToBlockText(flashcardInfo.flashcards, plugin);

		await navigator.clipboard.writeText(text);
		notify().success(
			`Copied ${flashcardInfo.flashcards.length} flashcard(s) to clipboard`,
		);
	}, [flashcardInfo, plugin]);

	// ── Navigation ──

	const handleReview = useCallback(async () => {
		if (!currentFile) return;
		await plugin.reviewNoteFlashcards(currentFile);
	}, [currentFile, plugin]);

	const handleOpenSourceNote = useCallback(() => {
		if (!currentFile) return;
		void app.workspace.getLeaf("tab").openFile(currentFile);
	}, [currentFile, app]);

	// ── Source highlighting ──

	const handleJumpToSource = useCallback(
		async (card: FlashcardItem) => {
			if (!card.sourceText || !currentFile) return;
			const { requestSourceHighlight } = await import(
				"@true-recall/obsidian/services/signals"
			);

			const filePath = currentFile.path;
			const fsrsCard = cardsWithFsrs.find(
				(c: FSRSFlashcardItem) => c.id === card.id,
			);
			const colorHint = getHighlightColor(fsrsCard);

			const activeFile = app.workspace.getActiveFile();
			if (!activeFile || activeFile.path !== filePath) {
				const leaf = app.workspace.getLeaf(false);
				await leaf.openFile(currentFile);
			}

			requestSourceHighlight(filePath, card.sourceText, "jump", colorHint);
		},
		[currentFile, app, cardsWithFsrs],
	);

	const handleHoverSource = useCallback(
		(card: FlashcardItem) => {
			if (!card.sourceText || !currentFile) return;
			const sourceText = card.sourceText;
			const fsrsCard = cardsWithFsrs.find(
				(c: FSRSFlashcardItem) => c.id === card.id,
			);
			const colorHint = getHighlightColor(fsrsCard);
			void import("@true-recall/obsidian/services/signals").then(
				({ requestSourceHighlight }) => {
					requestSourceHighlight(
						currentFile?.path,
						sourceText,
						"hover",
						colorHint,
					);
				},
			);
		},
		[currentFile, cardsWithFsrs],
	);

	const handleLeaveSource = useCallback(() => {
		void import("@true-recall/obsidian/services/signals").then(
			({ clearSourceHighlight }) => {
				clearSourceHighlight();
			},
		);
	}, []);

	// ── Search ──

	const handleSearchChange = useCallback(
		(query: string) => {
			panel.setSearchQuery(query);
		},
		[panel],
	);

	const handleBrowseDeck = useCallback(async () => {
		if (!flashcardInfo?.sourceUid) return;
		await plugin.openCardBrowser({ sourceUid: flashcardInfo.sourceUid });
	}, [flashcardInfo, plugin]);

	// ── Bulk operations (all cards) ──

	const handleForgetAll = useCallback(async () => {
		if (!flashcardInfo || flashcardInfo.flashcards.length === 0) return;
		const { notify } = await import(
			"@true-recall/obsidian/services/notification.service"
		);
		const { confirm } = await import(
			"@true-recall/obsidian/modals/shared/ConfirmModal"
		);

		const count = flashcardInfo.flashcards.length;
		const confirmed = await confirm(app, {
			message: `Forget all ${count} flashcard(s) for this note? This resets scheduling and clears review history.`,
		});
		if (!confirmed) return;

		const cardIds = flashcardInfo.flashcards.map((card) => card.id);
		const cmd = new ForgetCommand(cardIds);
		await plugin.commandService?.execute(cmd);
		notify().cardsForgotten(count);
	}, [flashcardInfo, plugin]);

	const handleDeleteAll = useCallback(async () => {
		const { notify } = await import(
			"@true-recall/obsidian/services/notification.service"
		);
		if (!flashcardInfo || flashcardInfo.flashcards.length === 0) return;

		const { confirm } = await import(
			"@true-recall/obsidian/modals/shared/ConfirmModal"
		);
		const count = flashcardInfo.flashcards.length;
		const confirmed = await confirm(app, {
			message: `Delete all ${count} flashcard(s) for this note?`,
		});
		if (!confirmed) return;

		const cardIds = flashcardInfo.flashcards.map((card) => card.id);
		const cmd = new DeleteCardCommand(cardIds);
		await plugin.commandService?.execute(cmd);
		notify().cardsDeletedWithUndo(cmd.deletedCount, () => {
			void plugin.commandService?.undo();
		});
	}, [flashcardInfo, plugin]);

	const handleDeleteNoteAndCards = useCallback(async () => {
		const { notify } = await import(
			"@true-recall/obsidian/services/notification.service"
		);
		if (!currentFile) return;

		const { confirm } = await import(
			"@true-recall/obsidian/modals/shared/ConfirmModal"
		);
		const count = flashcardInfo?.flashcards.length ?? 0;
		const confirmed = await confirm(app, {
			message: `Delete "${currentFile.basename}" and its ${count} flashcard(s)? This cannot be undone.`,
		});
		if (!confirmed) return;

		try {
			if (count > 0 && flashcardInfo) {
				const cardIds = flashcardInfo.flashcards.map((card) => card.id);
				plugin.flashcardManager.removeFlashcardsByIdsWithDetails(cardIds);
			}

			await app.vault.trash(currentFile, true);
			notify().success(`Deleted note and ${count} flashcard(s)`);
			await plugin.openDashboard();
		} catch (error) {
			console.error("[True Recall] Failed to delete note and cards:", error);
			notify().error(
				"Failed to delete note. Some flashcards may have been removed.",
			);
		}
	}, [currentFile, flashcardInfo, plugin, app]);

	return {
		handleGenerateFromNote,
		handleGenerateFromHighlights,
		handleCollect,
		handleExportCsv,
		handleCopyAllToClipboard,
		handleReview,
		handleOpenSourceNote,
		handleBrowseDeck,
		handleJumpToSource,
		handleHoverSource,
		handleLeaveSource,
		handleSearchChange,
		handleForgetAll,
		handleDeleteAll,
		handleDeleteNoteAndCards,
	};
}
