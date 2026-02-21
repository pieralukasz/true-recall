import {
	type ContentHandlers,
	PanelContent,
	PanelFooter,
	PanelHeader,
} from "@features/library/ui/panel/components";
import {
	getSourceNoteNameFromFile,
	notifyDuplicateError,
	showDuplicateNotifications,
} from "@features/library/ui/panel/utils/panel-helpers";
import { effect } from "@preact/signals";
import { dataVersion, settingsVersion, track } from "@shared/services/signals";
import type {
	PanelApi,
	ProcessingStatus,
	SelectionMode,
	ViewMode,
} from "@shared/store";
import type { FlashcardInfo, FlashcardItem } from "@shared/types";
import type { FSRSFlashcardItem } from "@shared/types/fsrs/card.types";
import { Panel } from "@shared/ui/components";
import { useApp, usePlugin } from "@shared/ui/preact";
import { Platform, type TFile } from "obsidian";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks";

// ── Hooks ──────────────────────────────────────────────────────

function usePanelApi(): PanelApi {
	const store = usePlugin().store;
	if (!store) throw new Error("Store not initialized");
	return store.getState().panel;
}

function usePanelState() {
	const plugin = usePlugin();
	const [state, setState] = useState(() => {
		const p = plugin.store?.getState().panel;
		if (!p) {
			return {
				currentFile: null as TFile | null,
				flashcardInfo: null as FlashcardInfo | null,
				status: "idle" as ProcessingStatus,
				viewMode: "list" as ViewMode,
				uncollectedCount: 0,
				isFollowingReview: false,
				isAddCardExpanded: false,
				selectionMode: "idle" as SelectionMode,
				selectedCardIds: new Set<string>(),
				expandedCardIds: new Set<string>(),
				searchQuery: "",
			};
		}
		return {
			currentFile: p.currentFile,
			flashcardInfo: p.flashcardInfo,
			status: p.status,
			viewMode: p.viewMode,
			uncollectedCount: p.uncollectedCount,
			isFollowingReview: p.isFollowingReview,
			isAddCardExpanded: p.isAddCardExpanded,
			selectionMode: p.selectionMode as SelectionMode,
			selectedCardIds: p.selectedCardIds,
			expandedCardIds: p.expandedCardIds,
			searchQuery: p.searchQuery,
		};
	});

	useEffect(() => {
		if (!plugin.store) return;
		const unsub = plugin.store.subscribe(
			(s) => s.panel,
			() => {
				const p = plugin.store?.getState().panel;
				if (!p) return;
				setState({
					currentFile: p.currentFile,
					flashcardInfo: p.flashcardInfo,
					status: p.status,
					viewMode: p.viewMode,
					uncollectedCount: p.uncollectedCount,
					isFollowingReview: p.isFollowingReview,
					isAddCardExpanded: p.isAddCardExpanded,
					selectionMode: p.selectionMode as SelectionMode,
					selectedCardIds: p.selectedCardIds,
					expandedCardIds: p.expandedCardIds,
					searchQuery: p.searchQuery,
				});
			},
		);
		return unsub;
	}, [plugin]);

	return state;
}

function useCardsWithFsrs(
	flashcardInfo: FlashcardInfo | null,
): FSRSFlashcardItem[] {
	const plugin = usePlugin();
	const [dataVer, setDataVer] = useState(0);

	useEffect(() => {
		const dispose = effect(() => {
			track(dataVersion, settingsVersion);
			setDataVer((v) => v + 1);
		});
		return dispose;
	}, []);

	return useMemo(() => {
		// dataVer used for reactivity
		void dataVer;
		if (!flashcardInfo?.flashcards) return [];
		if (!plugin.flashcardManager.hasStore()) return [];
		const cardIds = flashcardInfo.flashcards.map((c) => c.id);
		return plugin.flashcardManager.getCardsByIds(cardIds);
	}, [flashcardInfo, plugin, dataVer]);
}

// ── FlashcardPanelApp (Root) ────────────────────────────────────

export function FlashcardPanelApp({
	onActions,
}: {
	onActions?: (actions: PanelAppActions) => void;
}) {
	const plugin = usePlugin();
	const app = useApp();
	const state = usePanelState();
	const cardsWithFsrs = useCardsWithFsrs(state.flashcardInfo);
	const panel = usePanelApi();
	const contentRef = useRef<HTMLDivElement>(null);

	const reviewedToday = plugin.sessionPersistence?.getReviewedToday();
	const dayStartHour = plugin.settings.dayStartHour;

	// ── Handlers (stable references) ──────────────────────────────

	const handleAddFlashcard = useCallback(
		async (prefillFlashcards?: Array<{ question: string; answer: string }>) => {
			if (!state.currentFile) return;
			const { SimpleFlashcardEditorModal } = await import(
				"../../../../shared/ui/modals/SimpleFlashcardEditorModal"
			);
			const { cardsToMarkdown } = await import(
				"@features/study/services/flashcard/flashcard-format.util"
			);
			const { notify } = await import("@shared/services/notification.service");

			const modal = new SimpleFlashcardEditorModal(app, {
				mode: "add",
				currentFilePath: state.currentFile.path,
				prefillContent: prefillFlashcards
					? cardsToMarkdown(prefillFlashcards)
					: undefined,
			});

			const result = await modal.openAndWait();
			if (result.cancelled || result.flashcards.length === 0) return;

			try {
				const flashcardsWithIds = result.flashcards.map((f) => ({
					id: f.id || crypto.randomUUID(),
					question: f.question,
					answer: f.answer,
					cardType: f.cardType,
					clozeTemplate: f.clozeTemplate,
					clozeIndex: f.clozeIndex,
					reverseOfBatchId: f.reverseOfBatchId,
				}));

				const saveResult = await plugin.flashcardManager.saveFlashcardsToSql(
					state.currentFile,
					flashcardsWithIds,
				);

				if (saveResult.duplicates.length > 0) {
					if (saveResult.created.length > 0) {
						notify().cardsCreated(
							saveResult.created.length,
							state.currentFile.basename,
						);
					}
					showDuplicateNotifications(plugin, saveResult.duplicates);

					const duplicateFlashcards = saveResult.duplicates.map((d) => ({
						question: d.flashcard.question,
						answer: d.flashcard.answer,
					}));
					await handleAddFlashcard(duplicateFlashcards);
				} else {
					notify().cardsCreated(
						saveResult.created.length,
						state.currentFile.basename,
					);
				}
			} catch (error) {
				console.error("Error adding flashcards:", error);
				(await import("@shared/services/notification.service"))
					.notify()
					.operationFailed("add flashcards", error);
			}
		},
		[state.currentFile, app, plugin],
	);

	const handleEditButton = useCallback(
		async (card: FlashcardItem) => {
			if (!state.currentFile) return;
			const { SimpleFlashcardEditorModal } = await import(
				"../../../../shared/ui/modals/SimpleFlashcardEditorModal"
			);
			const { cardToMarkdown } = await import(
				"@features/study/services/flashcard/flashcard-format.util"
			);
			const { notify } = await import("@shared/services/notification.service");
			const { DuplicateQuestionError } = await import(
				"@features/study/services/flashcard/card-repository.service"
			);

			const scrollPosition = contentRef.current?.scrollTop ?? 0;

			const modal = new SimpleFlashcardEditorModal(app, {
				mode: "edit",
				currentFilePath: state.currentFile.path,
				prefillContent: cardToMarkdown(card),
				editCardId: card.id,
			});

			const result = await modal.openAndWait();
			if (result.cancelled || result.flashcards.length === 0) return;

			try {
				const firstFlashcard = result.flashcards[0];
				if (firstFlashcard) {
					plugin.flashcardManager.updateCardContent(
						card.id,
						firstFlashcard.question,
						firstFlashcard.answer,
					);
				}

				if (result.flashcards.length > 1) {
					const frontmatterService =
						plugin.flashcardManager.getFrontmatterService();
					let sourceUid = await frontmatterService.getSourceNoteUid(
						state.currentFile,
					);
					if (!sourceUid) {
						sourceUid = frontmatterService.generateUid();
						await frontmatterService.setSourceNoteUid(
							state.currentFile,
							sourceUid,
						);
					}

					for (let i = 1; i < result.flashcards.length; i++) {
						const flashcard = result.flashcards[i];
						if (flashcard) {
							await plugin.flashcardManager.addSingleFlashcard(
								flashcard.question,
								flashcard.answer,
								sourceUid,
							);
						}
					}
					notify().success(
						`Updated card and created ${result.flashcards.length - 1} new cards`,
					);
				} else {
					notify().cardUpdated();
				}

				// Restore scroll position after re-render
				requestAnimationFrame(() => {
					if (contentRef.current) contentRef.current.scrollTop = scrollPosition;
				});
			} catch (error) {
				if (error instanceof DuplicateQuestionError) {
					const question = result.flashcards[0]?.question ?? "";
					notifyDuplicateError(plugin, error, question);
				} else {
					notify().operationFailed("update flashcard", error);
				}
			}
		},
		[state.currentFile, app, plugin],
	);

	const handleDeleteCard = useCallback(
		async (card: FlashcardItem) => {
			if (!state.currentFile) return;
			const { notify } = await import("@shared/services/notification.service");
			const scrollPosition = contentRef.current?.scrollTop ?? 0;

			const removed = await plugin.flashcardManager.removeFlashcardById(
				card.id,
			);
			if (removed) {
				notify().cardsDeleted(1);
				requestAnimationFrame(() => {
					if (contentRef.current) contentRef.current.scrollTop = scrollPosition;
				});
			} else {
				notify().error("Failed to remove flashcard from file");
			}
		},
		[state.currentFile, plugin],
	);

	const handleCopyCard = useCallback(async (card: FlashcardItem) => {
		const { notify } = await import("@shared/services/notification.service");
		const text = `Q: ${card.question}\nA: ${card.answer}`;
		await navigator.clipboard.writeText(text);
		notify().success("Copied to clipboard");
	}, []);

	const handleMoveCard = useCallback(
		async (card: FlashcardItem) => {
			if (!state.flashcardInfo) return;
			if (!card.id) {
				(await import("@shared/services/notification.service"))
					.notify()
					.error(
						"Cannot move card without UUID. Please regenerate flashcards.",
					);
				return;
			}
			const { MoveCardModal } = await import("@shared/ui/modals/MoveCardModal");
			const { notify } = await import("@shared/services/notification.service");

			const sourceNoteName = await getSourceNoteNameFromFile(
				app,
				state.currentFile,
				state.flashcardInfo,
			);

			const modal = new MoveCardModal(app, {
				cardCount: 1,
				sourceNoteName,
				cardQuestion: card.question,
				cardAnswer: card.answer,
			});

			const result = await modal.openAndWait();
			if (result.cancelled || !result.targetNotePath) return;

			try {
				await plugin.flashcardManager.moveCard(card.id, result.targetNotePath);
				notify().cardsMoved(1, result.targetNotePath);
			} catch (error) {
				notify().operationFailed("move card", error);
			}
		},
		[state.currentFile, state.flashcardInfo, app, plugin],
	);

	const handleToggleExpand = useCallback(
		(cardId: string) => {
			const scrollPosition = contentRef.current?.scrollTop ?? 0;
			panel.toggleCardExpanded(cardId);
			requestAnimationFrame(() => {
				if (contentRef.current) contentRef.current.scrollTop = scrollPosition;
			});
		},
		[panel],
	);

	const handleToggleSelect = useCallback(
		(cardId: string) => {
			const scrollPosition = contentRef.current?.scrollTop ?? 0;
			panel.toggleCardSelection(cardId);
			requestAnimationFrame(() => {
				if (contentRef.current) contentRef.current.scrollTop = scrollPosition;
			});
		},
		[panel],
	);

	const handleEnterSelectionMode = useCallback(
		(cardId: string) => {
			panel.enterSelectionMode(cardId);
		},
		[panel],
	);

	const handleEditGroup = useCallback(
		async (cards: FlashcardItem[], clozeTemplate?: string) => {
			if (!state.currentFile) return;
			const { SimpleFlashcardEditorModal } = await import(
				"../../../../shared/ui/modals/SimpleFlashcardEditorModal"
			);
			const { cardToMarkdown } = await import(
				"@features/study/services/flashcard/flashcard-format.util"
			);
			const { notify } = await import("@shared/services/notification.service");

			const scrollPosition = contentRef.current?.scrollTop ?? 0;

			if (clozeTemplate) {
				const modal = new SimpleFlashcardEditorModal(app, {
					mode: "edit",
					currentFilePath: state.currentFile.path,
					prefillContent: cards[0] ? cardToMarkdown(cards[0]) : "",
					editCardId: cards[0]?.id,
				});

				const result = await modal.openAndWait();
				if (result.cancelled || result.flashcards.length === 0) return;

				try {
					const firstFlashcard = result.flashcards[0];
					if (!firstFlashcard) return;

					const frontmatterService =
						plugin.flashcardManager.getFrontmatterService();
					const sourceUid = await frontmatterService.getSourceNoteUid(
						state.currentFile,
					);
					if (!sourceUid) return;

					const { hasClozeContent } = await import(
						"@features/study/services/flashcard/cloze-parser.service"
					);
					if (hasClozeContent(firstFlashcard.question)) {
						plugin.flashcardManager.updateClozeTemplate(
							sourceUid,
							clozeTemplate,
							firstFlashcard.question,
							state.currentFile.basename,
						);
						notify().success("Updated cloze group");
					} else {
						const cardId = cards[0]?.id;
						if (cardId) {
							plugin.flashcardManager.updateCardContent(
								cardId,
								firstFlashcard.question,
								firstFlashcard.answer,
							);
							notify().cardUpdated();
						}
					}

					requestAnimationFrame(() => {
						if (contentRef.current)
							contentRef.current.scrollTop = scrollPosition;
					});
				} catch (error) {
					notify().operationFailed("update cloze group", error);
				}
			} else {
				const originalCard = cards[0];
				if (!originalCard) return;
				await handleEditButton(originalCard);
			}
		},
		[state.currentFile, app, plugin, handleEditButton],
	);

	const handleDeleteGroup = useCallback(
		async (cards: FlashcardItem[]) => {
			if (cards.length === 0) return;
			const cardId = cards[0]?.id;
			if (!cardId) return;
			const { notify } = await import("@shared/services/notification.service");
			const scrollPosition = contentRef.current?.scrollTop ?? 0;

			const removed = await plugin.flashcardManager.removeFlashcardById(cardId);
			if (removed) {
				notify().cardsDeleted(cards.length);
				requestAnimationFrame(() => {
					if (contentRef.current) contentRef.current.scrollTop = scrollPosition;
				});
			} else {
				notify().error("Failed to remove card group");
			}
		},
		[plugin],
	);

	const handleCopyGroup = useCallback(async (cards: FlashcardItem[]) => {
		if (cards.length === 0) return;
		const { notify } = await import("@shared/services/notification.service");
		const firstCard = cards[0];
		if (!firstCard) return;
		let text: string;
		if (firstCard.clozeTemplate) {
			text = firstCard.clozeTemplate;
		} else {
			text = cards.map((c) => `Q: ${c.question}\nA: ${c.answer}`).join("\n\n");
		}
		await navigator.clipboard.writeText(text);
		notify().success("Copied to clipboard");
	}, []);

	const handleMoveGroup = useCallback(
		async (cards: FlashcardItem[]) => {
			if (cards.length === 0) return;
			const { MoveCardModal } = await import("@shared/ui/modals/MoveCardModal");
			const { notify } = await import("@shared/services/notification.service");

			const firstCard = cards[0];
			if (!firstCard) return;
			const sourceNoteName = await getSourceNoteNameFromFile(
				app,
				state.currentFile,
				state.flashcardInfo,
			);

			const modal = new MoveCardModal(app, {
				cardCount: cards.length,
				sourceNoteName,
				cardQuestion: firstCard.question,
				cardAnswer: firstCard.answer,
			});

			const result = await modal.openAndWait();
			if (result.cancelled || !result.targetNotePath) return;

			const targetPath = result.targetNotePath;
			const results = await Promise.allSettled(
				cards.map((card) =>
					plugin.flashcardManager.moveCard(card.id, targetPath),
				),
			);

			const successCount = results.filter(
				(r) => r.status === "fulfilled",
			).length;
			notify().success(`Moved ${successCount} of ${cards.length} cards`);
		},
		[state.currentFile, state.flashcardInfo, app, plugin],
	);

	const handleCollect = useCallback(async () => {
		if (!state.currentFile) return;
		const { notify } = await import("@shared/services/notification.service");
		const { CollectService } = await import(
			"@features/study/services/flashcard/collect.service"
		);

		if (!plugin.flashcardManager.hasStore()) {
			notify().error("Flashcard store not ready. Please restart Obsidian.");
			return;
		}

		try {
			const collectService = new CollectService();
			const content = await app.vault.read(state.currentFile);
			const collectResult = collectService.collect(content);

			if (collectResult.collectedCount === 0) {
				notify().info("No flashcards to collect");
				return;
			}

			const saveResult = await plugin.flashcardManager.saveFlashcardsToSql(
				state.currentFile,
				collectResult.flashcards.map((f) => ({
					id: f.id || crypto.randomUUID(),
					question: f.question,
					answer: f.answer,
				})),
			);

			const contentToSave = plugin.settings.removeFlashcardContentAfterCollect
				? collectResult.newContentWithoutFlashcards
				: collectResult.newContent;
			await app.vault.process(state.currentFile, () => contentToSave);

			if (saveResult.duplicates.length > 0) {
				if (saveResult.created.length > 0) {
					notify().success(
						`Collected ${saveResult.created.length} flashcard(s)`,
					);
				}
				showDuplicateNotifications(plugin, saveResult.duplicates);
			} else {
				notify().success(`Collected ${saveResult.created.length} flashcard(s)`);
			}
		} catch (error) {
			notify().operationFailed("collect flashcards", error);
		}
	}, [state.currentFile, app, plugin]);

	const handleReview = useCallback(async () => {
		if (!state.currentFile) return;
		await plugin.reviewNoteFlashcards(state.currentFile);
	}, [state.currentFile, plugin]);

	const handleOpenSourceNote = useCallback(() => {
		if (!state.currentFile) return;
		void app.workspace.getLeaf("tab").openFile(state.currentFile);
	}, [state.currentFile, app]);

	const handleExportCsv = useCallback(async () => {
		const { notify } = await import("@shared/services/notification.service");
		if (
			!state.flashcardInfo?.flashcards ||
			state.flashcardInfo.flashcards.length === 0
		) {
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
		const rows = state.flashcardInfo.flashcards.map(
			(card) => `${escapeCSV(card.question)},${escapeCSV(card.answer)}`,
		);
		const csvContent = [header, ...rows].join("\n");

		const filename = state.currentFile
			? `${state.currentFile.basename}-flashcards.csv`
			: "flashcards.csv";

		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);

		notify().success(
			`Exported ${state.flashcardInfo.flashcards.length} flashcard(s) to CSV`,
		);
	}, [state.flashcardInfo, state.currentFile]);

	const handleCopyAllToClipboard = useCallback(async () => {
		const { notify } = await import("@shared/services/notification.service");
		if (
			!state.flashcardInfo?.flashcards ||
			state.flashcardInfo.flashcards.length === 0
		) {
			notify().warning("No flashcards to copy");
			return;
		}

		const text = state.flashcardInfo.flashcards
			.map((card, i) => `${i + 1}. Q: ${card.question}\n   A: ${card.answer}`)
			.join("\n\n");

		await navigator.clipboard.writeText(text);
		notify().success(
			`Copied ${state.flashcardInfo.flashcards.length} flashcard(s) to clipboard`,
		);
	}, [state.flashcardInfo]);

	const handleDeleteAll = useCallback(async () => {
		const { notify } = await import("@shared/services/notification.service");
		if (!state.flashcardInfo || state.flashcardInfo.flashcards.length === 0)
			return;

		const count = state.flashcardInfo.flashcards.length;
		const confirmed = window.confirm(
			`Delete all ${count} flashcard(s) for this note?`,
		);
		if (!confirmed) return;

		const cardIds = state.flashcardInfo.flashcards.map((card) => card.id);
		const successCount = plugin.flashcardManager.removeFlashcardsByIds(cardIds);
		notify().cardsDeleted(successCount);
	}, [state.flashcardInfo, plugin]);

	const handleMoveSelected = useCallback(async () => {
		if (!state.flashcardInfo || state.selectedCardIds.size === 0) return;
		const { MoveCardModal } = await import("@shared/ui/modals/MoveCardModal");
		const { notify } = await import("@shared/services/notification.service");

		const selectedCards = state.flashcardInfo.flashcards.filter((card) =>
			state.selectedCardIds.has(card.id),
		);

		if (selectedCards.length === 0) {
			notify().error(
				"No cards with valid UUIDs selected. Please regenerate flashcards.",
			);
			return;
		}

		const firstCard = selectedCards[0];
		if (!firstCard) return;

		const sourceNoteName = await getSourceNoteNameFromFile(
			app,
			state.currentFile,
			state.flashcardInfo,
		);

		const modal = new MoveCardModal(app, {
			cardCount: selectedCards.length,
			sourceNoteName,
			cardQuestion: firstCard.question,
			cardAnswer: firstCard.answer,
		});

		const result = await modal.openAndWait();
		if (result.cancelled || !result.targetNotePath) return;

		const targetPath = result.targetNotePath;
		const results = await Promise.allSettled(
			selectedCards.map((card) =>
				plugin.flashcardManager.moveCard(card.id, targetPath),
			),
		);

		const successCount = results.filter((r) => r.status === "fulfilled").length;
		results.forEach((r, i) => {
			if (r.status === "rejected") {
				console.error(`Failed to move card ${selectedCards[i]?.id}:`, r.reason);
			}
		});

		panel.exitSelectionMode();
		notify().success(`Moved ${successCount} of ${selectedCards.length} cards`);
	}, [
		state.flashcardInfo,
		state.selectedCardIds,
		state.currentFile,
		app,
		plugin,
		panel,
	]);

	const handleDeleteSelected = useCallback(async () => {
		if (
			!state.flashcardInfo ||
			!state.currentFile ||
			state.selectedCardIds.size === 0
		)
			return;
		const { notify } = await import("@shared/services/notification.service");

		const selectedCards = state.flashcardInfo.flashcards.filter((card) =>
			state.selectedCardIds.has(card.id),
		);
		if (selectedCards.length === 0) return;

		const confirmed = window.confirm(
			`Delete ${selectedCards.length} selected card(s)?`,
		);
		if (!confirmed) return;

		const cardIds = selectedCards.map((card) => card.id);
		const successCount = plugin.flashcardManager.removeFlashcardsByIds(cardIds);

		panel.exitSelectionMode();
		notify().cardsDeleted(successCount);
	}, [
		state.flashcardInfo,
		state.currentFile,
		state.selectedCardIds,
		plugin,
		panel,
	]);

	const handleExitSelectionMode = useCallback(() => {
		panel.exitSelectionMode();
	}, [panel]);

	const handleSearchChange = useCallback(
		(query: string) => {
			panel.setSearchQuery(query);
		},
		[panel],
	);

	const handleJumpToSource = useCallback(
		async (card: FlashcardItem) => {
			if (!card.sourceText || !state.currentFile) return;
			const { requestSourceHighlight } = await import(
				"@shared/services/signals"
			);

			const filePath = state.currentFile.path;

			// Ensure the source file is open in the editor
			const activeFile = app.workspace.getActiveFile();
			if (!activeFile || activeFile.path !== filePath) {
				const leaf = app.workspace.getLeaf(false);
				await leaf.openFile(state.currentFile);
			}

			requestSourceHighlight(filePath, card.sourceText);
		},
		[state.currentFile, app],
	);

	const contentHandlers: ContentHandlers = useMemo(
		() => ({
			onEditButton: handleEditButton,
			onDeleteCard: handleDeleteCard,
			onCopyCard: handleCopyCard,
			onMoveCard: handleMoveCard,
			onToggleExpand: handleToggleExpand,
			onToggleSelect: handleToggleSelect,
			onEnterSelectionMode: handleEnterSelectionMode,
			onAdd: handleAddFlashcard,
			onEditGroup: handleEditGroup,
			onDeleteGroup: handleDeleteGroup,
			onCopyGroup: handleCopyGroup,
			onMoveGroup: handleMoveGroup,
			onJumpToSource: handleJumpToSource,
		}),
		[
			handleEditButton,
			handleDeleteCard,
			handleCopyCard,
			handleMoveCard,
			handleToggleExpand,
			handleToggleSelect,
			handleEnterSelectionMode,
			handleAddFlashcard,
			handleEditGroup,
			handleDeleteGroup,
			handleCopyGroup,
			handleMoveGroup,
			handleJumpToSource,
		],
	);

	// Mobile renders without header (uses native Obsidian header actions)
	const showHeader = !Platform.isMobile;

	const footer = (
		<PanelFooter
			selectionMode={state.selectionMode}
			selectedCount={state.selectedCardIds.size}
			onMoveSelected={handleMoveSelected}
			onDeleteSelected={handleDeleteSelected}
		/>
	);

	return (
		<Panel showFooter footer={footer} disableScroll>
			<div class="ep:flex ep:flex-col ep:gap-2 ep:h-full">
				{showHeader && (
					<div class="ep:shrink-0">
						<PanelHeader
							flashcardInfo={state.flashcardInfo}
							cardsWithFsrs={cardsWithFsrs}
							hasUncollectedFlashcards={state.uncollectedCount > 0}
							uncollectedCount={state.uncollectedCount}
							selectionMode={state.selectionMode}
							selectedCount={state.selectedCardIds.size}
							searchQuery={state.searchQuery}
							isFollowingReview={state.isFollowingReview}
							reviewedToday={reviewedToday}
							dayStartHour={dayStartHour}
							onAdd={handleAddFlashcard}
							onCollect={handleCollect}
							onRefresh={() => onActions?.({ type: "refresh" })}
							onReview={handleReview}
							onExitSelectionMode={handleExitSelectionMode}
							onSearchChange={handleSearchChange}
							onExportCsv={handleExportCsv}
							onCopyToClipboard={handleCopyAllToClipboard}
							onDeleteAll={handleDeleteAll}
							onOpenSourceNote={handleOpenSourceNote}
						/>
					</div>
				)}

				<div ref={contentRef} class="ep:flex-1 ep:overflow-y-auto ep:min-h-0">
					<PanelContent
						flashcardInfo={state.flashcardInfo}
						currentFile={state.currentFile}
						status={state.status}
						selectionMode={state.selectionMode}
						selectedCardIds={state.selectedCardIds}
						expandedCardIds={state.expandedCardIds}
						cardsWithFsrs={cardsWithFsrs}
						searchQuery={state.searchQuery}
						handlers={contentHandlers}
					/>
				</div>
			</div>
		</Panel>
	);
}

// ── Action types for parent communication ───────────────────────

export type PanelAppActions = { type: "refresh" };
