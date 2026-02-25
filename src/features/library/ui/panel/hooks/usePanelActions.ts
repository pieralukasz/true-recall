import { getHighlightColor } from "@features/library/ui/panel/utils/card-status.utils";
import { extractHighlights } from "@features/library/ui/panel/utils/highlight-extractor";
import { showDuplicateNotifications } from "@features/library/ui/panel/utils/panel-helpers";
import type { PanelApi } from "@shared/store";
import type { FlashcardInfo, FlashcardItem } from "@shared/types";
import type { FSRSFlashcardItem } from "@shared/types/fsrs/card.types";
import { useApp, usePlugin } from "@shared/ui/preact";
import type { TFile } from "obsidian";
import { useCallback } from "preact/hooks";

export interface UsePanelActionsParams {
	currentFile: TFile | null;
	flashcardInfo: FlashcardInfo | null;
	cardsWithFsrs: FSRSFlashcardItem[];
	panel: PanelApi;
}

export function usePanelActions({
	currentFile,
	flashcardInfo,
	cardsWithFsrs,
	panel,
}: UsePanelActionsParams) {
	const plugin = usePlugin();
	const app = useApp();

	// ── AI generation ──

	const handleGenerateFromNote = useCallback(async () => {
		if (!currentFile) return;
		const { notify } = await import("@shared/services/notification.service");

		if (!plugin.settings.openRouterApiKey) {
			notify().aiNotConfigured();
			return;
		}

		const content = await app.vault.read(currentFile);
		if (!content.trim()) {
			notify().warning("Note is empty");
			return;
		}

		const { StreamingGenerationService } = await import(
			"@features/ai/services/streaming-generation.service"
		);

		const streamingService = new StreamingGenerationService(
			() => plugin.settings,
			plugin.flashcardManager,
		);

		try {
			const result = await streamingService.generateStreaming(
				content,
				"basic",
				currentFile,
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
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError")
				return;
			const msg =
				error instanceof Error ? error.message : String(error);
			notify().error(`Flashcard generation failed: ${msg}`);
		}
	}, [currentFile, app, plugin]);

	const handleGenerateFromHighlights = useCallback(async () => {
		if (!currentFile) return;
		const { notify } = await import("@shared/services/notification.service");

		if (!plugin.settings.openRouterApiKey) {
			notify().aiNotConfigured();
			return;
		}

		const content = await app.vault.read(currentFile);
		const highlights = extractHighlights(content);

		if (highlights.length === 0) {
			notify().warning("No highlights found in note");
			return;
		}

		const frontmatterService =
			plugin.flashcardManager.getFrontmatterService();
		const sourceUid =
			await frontmatterService.getSourceNoteUid(currentFile);

		const existingSourceTexts = sourceUid
			? (plugin.cardStore?.getCardsBySourceUid(sourceUid) ?? [])
					.map((c) => c.sourceText?.trim().toLowerCase())
					.filter(Boolean) as string[]
			: [];

		const newHighlights =
			existingSourceTexts.length > 0
				? highlights.filter((h) => {
						const normalized = h.trim().toLowerCase();
						return !existingSourceTexts.some(
							(st) =>
								st.includes(normalized) ||
								normalized.includes(st),
						);
					})
				: highlights;

		if (newHighlights.length === 0) {
			notify().warning("All highlights already have flashcards");
			return;
		}

		const joinedHighlights = newHighlights.join("\n\n");

		const { StreamingGenerationService } = await import(
			"@features/ai/services/streaming-generation.service"
		);

		const streamingService = new StreamingGenerationService(
			() => plugin.settings,
			plugin.flashcardManager,
		);

		try {
			const result = await streamingService.generateStreaming(
				joinedHighlights,
				"basic",
				currentFile,
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
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError")
				return;
			const msg =
				error instanceof Error ? error.message : String(error);
			notify().error(`Flashcard generation failed: ${msg}`);
		}
	}, [currentFile, app, plugin]);

	// ── Collection ──

	const handleCollect = useCallback(async () => {
		if (!currentFile) return;
		const { notify } = await import("@shared/services/notification.service");
		const { CollectService } = await import(
			"@features/study/services/flashcard/collect.service"
		);

		if (!plugin.flashcardManager.hasStore()) {
			notify().error(
				"Flashcard store not ready. Please restart Obsidian.",
			);
			return;
		}

		try {
			const collectService = new CollectService();
			const content = await app.vault.read(currentFile);
			const collectResult = collectService.collect(content);

			if (collectResult.collectedCount === 0) {
				notify().info("No flashcards to collect");
				return;
			}

			const existingQuestions = new Set(
				flashcardInfo?.flashcards?.map((f) => f.question) ?? [],
			);
			const newFlashcards = collectResult.flashcards.filter(
				(f) => !existingQuestions.has(f.question),
			);
			const skippedCount =
				collectResult.flashcards.length - newFlashcards.length;

			const contentToSave =
				plugin.settings.removeFlashcardContentAfterCollect
					? collectResult.newContentWithoutFlashcards
					: collectResult.newContent;
			await app.vault.process(currentFile, () => contentToSave);

			if (newFlashcards.length === 0) {
				notify().info(
					`All ${collectResult.flashcards.length} flashcard(s) already collected`,
				);
				return;
			}

			const saveResult =
				await plugin.flashcardManager.saveFlashcardsToSql(
					currentFile,
					newFlashcards.map((f) => ({
						id: f.id || crypto.randomUUID(),
						question: f.question,
						answer: f.answer,
					})),
				);

			const created = saveResult.created.length;
			const dups = saveResult.duplicates.length;

			if (skippedCount > 0 && created > 0) {
				notify().success(
					`Collected ${created} flashcard(s), skipped ${skippedCount} (already exist)`,
				);
			} else if (dups > 0 && created > 0) {
				notify().success(`Collected ${created} flashcard(s)`);
				showDuplicateNotifications(plugin, saveResult.duplicates);
			} else if (dups > 0) {
				showDuplicateNotifications(plugin, saveResult.duplicates);
			} else {
				notify().success(`Collected ${created} flashcard(s)`);
			}
		} catch (error) {
			notify().operationFailed("collect flashcards", error);
		}
	}, [currentFile, flashcardInfo, app, plugin]);

	// ── Export ──

	const handleExportCsv = useCallback(async () => {
		const { notify } = await import("@shared/services/notification.service");
		if (
			!flashcardInfo?.flashcards ||
			flashcardInfo.flashcards.length === 0
		) {
			notify().warning("No flashcards to export");
			return;
		}

		const escapeCSV = (str: string): string => {
			if (
				str.includes(",") ||
				str.includes("\n") ||
				str.includes('"')
			) {
				return `"${str.replace(/"/g, '""')}"`;
			}
			return str;
		};

		const header = "Question,Answer";
		const rows = flashcardInfo.flashcards.map(
			(card) =>
				`${escapeCSV(card.question)},${escapeCSV(card.answer)}`,
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
		const { notify } = await import("@shared/services/notification.service");
		if (
			!flashcardInfo?.flashcards ||
			flashcardInfo.flashcards.length === 0
		) {
			notify().warning("No flashcards to copy");
			return;
		}

		const text = flashcardInfo.flashcards
			.map(
				(card, i) =>
					`${i + 1}. Q: ${card.question}\n   A: ${card.answer}`,
			)
			.join("\n\n");

		await navigator.clipboard.writeText(text);
		notify().success(
			`Copied ${flashcardInfo.flashcards.length} flashcard(s) to clipboard`,
		);
	}, [flashcardInfo]);

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
				"@shared/services/signals"
			);

			const filePath = currentFile.path;
			const fsrsCard = cardsWithFsrs.find((c) => c.id === card.id);
			const colorHint = getHighlightColor(fsrsCard);

			const activeFile = app.workspace.getActiveFile();
			if (!activeFile || activeFile.path !== filePath) {
				const leaf = app.workspace.getLeaf(false);
				await leaf.openFile(currentFile);
			}

			requestSourceHighlight(
				filePath,
				card.sourceText,
				"jump",
				colorHint,
			);
		},
		[currentFile, app, cardsWithFsrs],
	);

	const handleHoverSource = useCallback(
		(card: FlashcardItem) => {
			if (!card.sourceText || !currentFile) return;
			const fsrsCard = cardsWithFsrs.find((c) => c.id === card.id);
			const colorHint = getHighlightColor(fsrsCard);
			void import("@shared/services/signals").then(
				({ requestSourceHighlight }) => {
					requestSourceHighlight(
						currentFile!.path,
						card.sourceText!,
						"hover",
						colorHint,
					);
				},
			);
		},
		[currentFile, cardsWithFsrs],
	);

	const handleLeaveSource = useCallback(() => {
		void import("@shared/services/signals").then(
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

	return {
		handleGenerateFromNote,
		handleGenerateFromHighlights,
		handleCollect,
		handleExportCsv,
		handleCopyAllToClipboard,
		handleReview,
		handleOpenSourceNote,
		handleJumpToSource,
		handleHoverSource,
		handleLeaveSource,
		handleSearchChange,
	};
}
