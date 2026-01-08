import { Plugin, TFile, Notice, Platform, normalizePath } from "obsidian";
import {
	VIEW_TYPE_FLASHCARD_PANEL,
	VIEW_TYPE_REVIEW,
	VIEW_TYPE_STATS,
	FLASHCARD_CONFIG,
} from "./constants";
import {
	FlashcardManager,
	OpenRouterService,
	FSRSService,
	StatsService,
	SessionPersistenceService,
	BacklinksFilterService,
	ShardedStoreService,
	DayBoundaryService,
	HarvestService,
} from "./services";
import { extractFSRSSettings } from "./types";
import {
	FlashcardPanelView,
	ReviewView,
	EpistemeSettingTab,
	CustomSessionModal,
	MissingFlashcardsModal,
	type EpistemeSettings,
	DEFAULT_SETTINGS,
} from "./ui";
import { HarvestDashboardModal } from "./ui/modals/HarvestDashboardModal";
import { MoveCardModal } from "./ui/modals/MoveCardModal";
import { CommandDashboardModal } from "./ui/modals";
import { StatsView } from "./ui/stats";

export default class EpistemePlugin extends Plugin {
	settings!: EpistemeSettings;
	flashcardManager!: FlashcardManager;
	openRouterService!: OpenRouterService;
	fsrsService!: FSRSService;
	statsService!: StatsService;
	sessionPersistence!: SessionPersistenceService;
	backlinksFilter!: BacklinksFilterService;
	shardedStore!: ShardedStoreService;
	dayBoundaryService!: DayBoundaryService;
	harvestService!: HarvestService;

	async onload(): Promise<void> {
		await this.loadSettings();

		// Initialize services
		this.flashcardManager = new FlashcardManager(this.app, this.settings);
		this.openRouterService = new OpenRouterService(
			this.settings.openRouterApiKey,
			this.settings.aiModel
		);

		// Initialize FSRS and Stats services
		const fsrsSettings = extractFSRSSettings(this.settings);
		this.fsrsService = new FSRSService(fsrsSettings);
		this.statsService = new StatsService(
			this.flashcardManager,
			this.fsrsService
		);

		// Initialize session persistence service
		this.sessionPersistence = new SessionPersistenceService(this.app);
		// Note: We no longer clean up old stats - they're kept for the statistics panel

		// Initialize sharded store for FSRS data
		this.shardedStore = new ShardedStoreService(this.app);
		// Load store data in background (non-blocking)
		void this.shardedStore.load().then(() => {
			// Connect store to flashcard manager after loading
			this.flashcardManager.setStore(this.shardedStore);
		});

		// Initialize day boundary service (Anki-style day scheduling)
		this.dayBoundaryService = new DayBoundaryService(
			this.settings.dayStartHour
		);

		// Initialize harvest service (Seeding → Incubation → Harvest workflow)
		this.harvestService = new HarvestService();

		// Initialize backlinks filter service
		this.backlinksFilter = new BacklinksFilterService();
		this.backlinksFilter.setUpdateCount(this.settings.updateLinkedMentionsCount);
		if (this.settings.hideFlashcardsFromBacklinks) {
			this.backlinksFilter.enable();
		}

		// Register the sidebar view
		this.registerView(
			VIEW_TYPE_FLASHCARD_PANEL,
			(leaf) => new FlashcardPanelView(leaf, this)
		);

		// Register the review view
		this.registerView(
			VIEW_TYPE_REVIEW,
			(leaf) => new ReviewView(leaf, this)
		);

		// Register the statistics view
		this.registerView(VIEW_TYPE_STATS, (leaf) => new StatsView(leaf, this));

		// Add ribbon icon to start review
		this.addRibbonIcon("brain", "Episteme - Study", () => {
			void this.startReviewSession();
		});

		// Add ribbon icon to open statistics
		this.addRibbonIcon("bar-chart-2", "Episteme - Statistics", () => {
			void this.openStatsView();
		});

		// Add ribbon icon for command dashboard
		this.addRibbonIcon("blocks", "Episteme - Command Dashboard", () => {
			this.openCommandDashboard();
		});

		// Register commands
		this.addCommand({
			id: "open-flashcard-panel",
			name: "Open flashcard panel",
			callback: () => void this.activateView(),
		});

		this.addCommand({
			id: "generate-flashcards",
			name: "Generate flashcards for current note",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (file && file.extension === "md") {
					if (!checking) {
						void this.activateView();
					}
					return true;
				}
				return false;
			},
		});

		// Review session command (defaults to Knowledge deck)
		this.addCommand({
			id: "start-review",
			name: "Start review session",
			callback: () => void this.startReviewSession(),
		});

		// Review flashcards from current note
		this.addCommand({
			id: "review-current-note",
			name: "Review flashcards from current note",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (file && file.extension === "md" && !file.name.startsWith(FLASHCARD_CONFIG.filePrefix)) {
					if (!checking) {
						void this.reviewCurrentNote();
					}
					return true;
				}
				return false;
			},
		});

		// Review today's new cards
		this.addCommand({
			id: "review-todays-cards",
			name: "Review today's new cards",
			callback: () => void this.reviewTodaysCards(),
		});

		// Statistics panel command
		this.addCommand({
			id: "open-statistics",
			name: "Open statistics panel",
			callback: () => void this.openStatsView(),
		});

		// Command dashboard command
		this.addCommand({
			id: "open-command-dashboard",
			name: "Open command dashboard",
			callback: () => this.openCommandDashboard(),
		});

		// Scan vault command - add FSRS IDs to new flashcards and cleanup orphaned
		this.addCommand({
			id: "scan-vault",
			name: "Scan vault for new flashcards",
			callback: async () => {
				try {
					new Notice("Scanning vault for flashcards...");
					const result = await this.flashcardManager.scanVault();

					// Build message with cleanup info
					let message = `Scan complete! Found ${result.totalCards} cards`;
					if (result.newCardsProcessed > 0) {
						message += `, added ${result.newCardsProcessed} new`;
					}
					if (result.orphanedRemoved > 0) {
						message += `, removed ${result.orphanedRemoved} orphaned`;
					}
					message += ` in ${result.filesProcessed} files.`;

					new Notice(message);
				} catch (error) {
					new Notice(`Scan failed: ${error instanceof Error ? error.message : "Unknown error"}`);
				}
			},
		});

		// Show notes missing flashcards
		this.addCommand({
			id: "show-missing-flashcards",
			name: "Show notes missing flashcards",
			callback: () => void this.showMissingFlashcards(),
		});

		// Harvest dashboard command (Seeding → Incubation → Harvest workflow)
		this.addCommand({
			id: "open-harvest-dashboard",
			name: "Open harvest dashboard",
			callback: () => void this.openHarvestDashboard(),
		});

		// Register settings tab
		this.addSettingTab(new EpistemeSettingTab(this.app, this));

		// Register file context menu for custom review
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (file instanceof TFile && file.extension === "md") {
					// Don't show on flashcard files themselves
					if (file.name.startsWith(FLASHCARD_CONFIG.filePrefix)) return;

					menu.addItem((item) => {
						item.setTitle("Review flashcards from this note")
							.setIcon("brain")
							.onClick(() => void this.reviewNoteFlashcards(file));
					});
				}
			})
		);

		// Listen for active file changes
		this.registerEvent(
			this.app.workspace.on("file-open", (file) => {
				this.updatePanelView(file);
			})
		);

		// Also listen for active leaf changes (covers more scenarios)
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				const file = this.app.workspace.getActiveFile();
				this.updatePanelView(file);
			})
		);
	}

	onunload(): void {
		// Disable backlinks filter
		this.backlinksFilter?.disable();

		// Save sharded store immediately on unload
		if (this.shardedStore) {
			void this.shardedStore.saveNow();
		}

		// Obsidian automatically handles leaf cleanup when plugin unloads
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<EpistemeSettings>
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);

		// Update services with new settings
		if (this.flashcardManager) {
			this.flashcardManager.updateSettings(this.settings);
		}
		if (this.openRouterService) {
			this.openRouterService.updateCredentials(
				this.settings.openRouterApiKey,
				this.settings.aiModel
			);
		}
		if (this.fsrsService) {
			const fsrsSettings = extractFSRSSettings(this.settings);
			this.fsrsService.updateSettings(fsrsSettings);
		}
		if (this.backlinksFilter) {
			this.backlinksFilter.setUpdateCount(this.settings.updateLinkedMentionsCount);
			if (this.settings.hideFlashcardsFromBacklinks) {
				this.backlinksFilter.enable();
			} else {
				this.backlinksFilter.disable();
			}
		}
		if (this.dayBoundaryService) {
			this.dayBoundaryService.updateDayStartHour(this.settings.dayStartHour);
		}
	}

	// Activate the sidebar view
	async activateView(): Promise<void> {
		const { workspace } = this.app;

		// Check if view already exists
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_FLASHCARD_PANEL)[0];

		if (!leaf) {
			if (Platform.isMobile) {
				// On mobile, open in main area (no sidebar support)
				leaf = workspace.getLeaf(true);
				await leaf.setViewState({
					type: VIEW_TYPE_FLASHCARD_PANEL,
					active: true,
				});
			} else {
				// Desktop: use right sidebar
				const rightLeaf = workspace.getRightLeaf(false);
				if (rightLeaf) {
					await rightLeaf.setViewState({
						type: VIEW_TYPE_FLASHCARD_PANEL,
						active: true,
					});
					leaf = rightLeaf;
				}
			}
		}

		// Reveal and focus the leaf
		if (leaf) {
			void workspace.revealLeaf(leaf);
		}
	}

	// Update the panel view with current file
	private updatePanelView(file: TFile | null): void {
		const leaves = this.app.workspace.getLeavesOfType(
			VIEW_TYPE_FLASHCARD_PANEL
		);
		leaves.forEach((leaf) => {
			const view = leaf.view;
			if (view instanceof FlashcardPanelView) {
				void view.handleFileChange(file);
			}
		});
	}

	// Start a review session (opens modal with options)
	async startReviewSession(): Promise<void> {
		const { workspace } = this.app;

		// Check for existing review view
		const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_REVIEW);
		if (existingLeaves.length > 0) {
			void workspace.revealLeaf(existingLeaves[0]!);
			return;
		}

		const allCards = await this.flashcardManager.getAllFSRSCards();
		if (allCards.length === 0) {
			new Notice("No flashcards found. Generate some flashcards first!");
			return;
		}

		const currentFile = this.app.workspace.getActiveFile();
		const currentNoteName =
			currentFile && !currentFile.name.startsWith(FLASHCARD_CONFIG.filePrefix)
				? currentFile.basename
				: null;

		const modal = new CustomSessionModal(this.app, {
			currentNoteName,
			allCards,
			dayBoundaryService: this.dayBoundaryService,
		});

		const result = await modal.openAndWait();
		if (result.cancelled) return;

		// Handle "Default" option - open with Knowledge deck, no filters
		if (result.useDefaultDeck) {
			await this.openReviewView("Knowledge");
			return;
		}

		// Handle other options with filters
		await this.openReviewViewWithFilters({
			deckFilter: null,
			sourceNoteFilter: result.sourceNoteFilter,
			sourceNoteFilters: result.sourceNoteFilters,
			filePathFilter: result.filePathFilter,
			createdTodayOnly: result.createdTodayOnly,
			readyToHarvestOnly: result.readyToHarvestOnly,
			ignoreDailyLimits: result.ignoreDailyLimits,
			bypassScheduling: result.bypassScheduling,
		});
	}

	/**
	 * Open the review view with optional deck filter
	 */
	private async openReviewView(deckFilter: string | null): Promise<void> {
		const { workspace } = this.app;

		// Force fullscreen on mobile (no sidebar support)
		if (Platform.isMobile || this.settings.reviewMode === "fullscreen") {
			// Open in main area
			const leaf = workspace.getLeaf(true);
			await leaf.setViewState({
				type: VIEW_TYPE_REVIEW,
				active: true,
				state: { deckFilter },
			});
			workspace.revealLeaf(leaf);
		} else {
			// Desktop: Open in right panel
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				await rightLeaf.setViewState({
					type: VIEW_TYPE_REVIEW,
					active: true,
					state: { deckFilter },
				});
				workspace.revealLeaf(rightLeaf);
			}
		}
	}

	/**
	 * Open the statistics view
	 */
	async openStatsView(): Promise<void> {
		const { workspace } = this.app;

		// Check if stats view already exists
		const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_STATS);
		if (existingLeaves.length > 0) {
			// Focus existing stats view
			const leaf = existingLeaves[0];
			if (leaf) {
				workspace.revealLeaf(leaf);
				// Refresh the view
				const view = leaf.view;
				if (view instanceof StatsView) {
					void view.refresh();
				}
			}
			return;
		}

		// Open in main area
		const leaf = workspace.getLeaf(true);
		await leaf.setViewState({
			type: VIEW_TYPE_STATS,
			active: true,
		});
		workspace.revealLeaf(leaf);
	}

	/**
	 * Show modal with notes missing flashcards
	 */
	async showMissingFlashcards(): Promise<void> {
		const modal = new MissingFlashcardsModal(
			this.app,
			this.flashcardManager,
			{ flashcardsFolder: this.settings.flashcardsFolder }
		);

		const result = await modal.openAndWait();
		if (result.cancelled || !result.selectedNotePath) return;

		// Open the selected note
		const file = this.app.vault.getAbstractFileByPath(result.selectedNotePath);
		if (file instanceof TFile) {
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);
			// Activate panel to allow flashcard generation
			await this.activateView();
		}
	}

	/**
	 * Open the harvest dashboard modal
	 * Shows temporary cards with maturity indicators for the Seeding → Incubation → Harvest workflow
	 */
	async openHarvestDashboard(): Promise<void> {
		const allCards = await this.flashcardManager.getAllFSRSCards();
		const temporaryCards = allCards.filter((c) => c.isTemporary);

		if (temporaryCards.length === 0) {
			new Notice("No temporary cards found. Seed some flashcards from Literature Notes first!");
			return;
		}

		const modal = new HarvestDashboardModal(this.app, {
			harvestService: this.harvestService,
			allCards,
			flashcardsFolder: this.settings.flashcardsFolder,
		});

		const result = await modal.openAndWait();
		if (result.cancelled) return;

		if (result.action === "review") {
			// Start review session with ready-to-harvest filter
			// bypassScheduling: true allows reviewing mature cards even if not due
			await this.openReviewViewWithFilters({
				deckFilter: null,
				temporaryOnly: true,
				readyToHarvestOnly: true,
				ignoreDailyLimits: true,
				bypassScheduling: true,
			});
		} else if (result.action === "move" && result.selectedCardIds.length > 0) {
			// Find the selected cards from allCards
			const selectedCards = allCards.filter((c) => result.selectedCardIds.includes(c.id));
			if (selectedCards.length === 0) return;

			const firstCard = selectedCards[0];
			if (!firstCard) return;

			// Open move modal
			const moveModal = new MoveCardModal(this.app, {
				cardCount: selectedCards.length,
				sourceNoteName: firstCard.sourceNoteName,
				flashcardsFolder: this.settings.flashcardsFolder,
				cardQuestion: firstCard.question,
				cardAnswer: firstCard.answer,
			});

			const moveResult = await moveModal.openAndWait();
			if (moveResult.cancelled || !moveResult.targetNotePath) return;

			// Move all selected cards
			let successCount = 0;
			for (const card of selectedCards) {
				try {
					await this.flashcardManager.moveCard(card.id, card.filePath, moveResult.targetNotePath);
					successCount++;
				} catch (error) {
					console.error(`Failed to move card ${card.id}:`, error);
				}
			}

			if (successCount > 0) {
				// Get target note name for display
				const targetFile = this.app.vault.getAbstractFileByPath(moveResult.targetNotePath);
				const targetName = targetFile instanceof TFile ? targetFile.basename : moveResult.targetNotePath;
				new Notice(`Moved ${successCount} card(s) to ${targetName}`);
			}
		}
	}

	/**
	 * Review flashcards from current note
	 */
	async reviewCurrentNote(): Promise<void> {
		const file = this.app.workspace.getActiveFile();
		if (!file) {
			new Notice("No active note");
			return;
		}
		await this.reviewNoteFlashcards(file);
	}

	/**
	 * Review flashcards linked to a specific note
	 */
	async reviewNoteFlashcards(file: TFile): Promise<void> {
		// Skip if it's a flashcard file
		if (file.name.startsWith(FLASHCARD_CONFIG.filePrefix)) {
			new Notice(
				"This is a flashcard file. Select the original source note instead."
			);
			return;
		}

		const allCards = await this.flashcardManager.getAllFSRSCards();
		const noteCards = allCards.filter(
			(c) => c.sourceNoteName === file.basename
		);

		if (noteCards.length === 0) {
			new Notice(`No flashcards found for "${file.basename}"`);
			return;
		}

		// Count available cards (new or due) using day-based scheduling
		const availableCards = noteCards.filter((c) => {
			return this.dayBoundaryService.isCardAvailable(c);
		});

		if (availableCards.length === 0) {
			new Notice(
				`No cards due for "${file.basename}". All ${noteCards.length} cards are scheduled for later.`
			);
			return;
		}

		await this.openReviewViewWithFilters({
			deckFilter: null,
			sourceNoteFilter: file.basename,
			ignoreDailyLimits: true,
		});
	}

	/**
	 * Review today's new cards
	 */
	async reviewTodaysCards(): Promise<void> {
		const allCards = await this.flashcardManager.getAllFSRSCards();

		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);

		const todaysCards = allCards.filter((c) => {
			const createdAt = c.fsrs.createdAt;
			if (!createdAt || createdAt < todayStart.getTime()) return false;
			// Only show new or due (using day-based scheduling)
			return this.dayBoundaryService.isCardAvailable(c);
		});

		if (todaysCards.length === 0) {
			new Notice("No new cards created today");
			return;
		}

		await this.openReviewViewWithFilters({
			deckFilter: null,
			createdTodayOnly: true,
			ignoreDailyLimits: true,
		});
	}

	/**
	 * Open the command dashboard modal
	 */
	openCommandDashboard(): void {
		const modal = new CommandDashboardModal(this.app, this);
		modal.openAndWait();
	}

	/**
	 * Open review view with custom filters
	 */
	private async openReviewViewWithFilters(filters: {
		deckFilter?: string | null;
		sourceNoteFilter?: string;
		sourceNoteFilters?: string[];
		filePathFilter?: string;
		createdTodayOnly?: boolean;
		createdThisWeek?: boolean;
		weakCardsOnly?: boolean;
		stateFilter?: "due" | "learning" | "new";
		temporaryOnly?: boolean;
		readyToHarvestOnly?: boolean;
		ignoreDailyLimits?: boolean;
		bypassScheduling?: boolean;
	}): Promise<void> {
		const { workspace } = this.app;

		const state = {
			deckFilter: filters.deckFilter ?? null,
			sourceNoteFilter: filters.sourceNoteFilter,
			sourceNoteFilters: filters.sourceNoteFilters,
			filePathFilter: filters.filePathFilter,
			createdTodayOnly: filters.createdTodayOnly,
			createdThisWeek: filters.createdThisWeek,
			weakCardsOnly: filters.weakCardsOnly,
			stateFilter: filters.stateFilter,
			temporaryOnly: filters.temporaryOnly,
			readyToHarvestOnly: filters.readyToHarvestOnly,
			ignoreDailyLimits: filters.ignoreDailyLimits,
			bypassScheduling: filters.bypassScheduling,
		};

		if (Platform.isMobile || this.settings.reviewMode === "fullscreen") {
			const leaf = workspace.getLeaf(true);
			await leaf.setViewState({
				type: VIEW_TYPE_REVIEW,
				active: true,
				state,
			});
			void workspace.revealLeaf(leaf);
		} else {
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				await rightLeaf.setViewState({
					type: VIEW_TYPE_REVIEW,
					active: true,
					state,
				});
				void workspace.revealLeaf(rightLeaf);
			}
		}
	}
}
