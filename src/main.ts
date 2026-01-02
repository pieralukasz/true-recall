import { Plugin, TFile, Notice } from "obsidian";
import { VIEW_TYPE_FLASHCARD_PANEL, VIEW_TYPE_REVIEW, VIEW_TYPE_STATS } from "./constants";
import { FlashcardManager, OpenRouterService, FSRSService, StatsService, SessionPersistenceService, BacklinksFilterService } from "./services";
import { extractFSRSSettings } from "./types";
import {
    FlashcardPanelView,
    ReviewView,
    ShadowAnkiSettingTab,
    DeckSelectionModal,
    type ShadowAnkiSettings,
    DEFAULT_SETTINGS,
} from "./ui";
import { StatsView } from "./ui/stats";

export default class ShadowAnkiPlugin extends Plugin {
    settings!: ShadowAnkiSettings;
    flashcardManager!: FlashcardManager;
    openRouterService!: OpenRouterService;
    fsrsService!: FSRSService;
    statsService!: StatsService;
    sessionPersistence!: SessionPersistenceService;
    backlinksFilter!: BacklinksFilterService;

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
        this.statsService = new StatsService(this.flashcardManager, this.fsrsService);

        // Initialize session persistence service
        this.sessionPersistence = new SessionPersistenceService(this.app);
        // Note: We no longer clean up old stats - they're kept for the statistics panel

        // Initialize backlinks filter service
        this.backlinksFilter = new BacklinksFilterService();
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
        this.registerView(
            VIEW_TYPE_STATS,
            (leaf) => new StatsView(leaf, this)
        );

        // Add ribbon icon to start review
        this.addRibbonIcon("brain", "Shadow Anki - Study", () => {
            void this.startReviewSession();
        });

        // Add ribbon icon to open statistics
        this.addRibbonIcon("bar-chart-2", "Shadow Anki - Statistics", () => {
            void this.openStatsView();
        });

        // Register commands
        this.addCommand({
            id: "open-flashcard-panel",
            name: "Open flashcard panel",
            callback: () => void this.activateView()
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
            }
        });

        // Review session command
        this.addCommand({
            id: "start-review",
            name: "Start review session",
            callback: () => void this.startReviewSession()
        });

        // Review session for Knowledge deck (direct, no modal)
        this.addCommand({
            id: "start-review-knowledge",
            name: "Start review session (Knowledge)",
            callback: () => void this.openReviewView("Knowledge")
        });

        // Migrate flashcards command
        this.addCommand({
            id: "migrate-to-fsrs",
            name: "Migrate flashcards to FSRS format",
            callback: async () => {
                const result = await this.flashcardManager.migrateToFSRS();
                new Notice(`Migration complete: ${result.migrated}/${result.total} cards migrated`);
            }
        });

        // Remove all FSRS data (for testing)
        this.addCommand({
            id: "remove-all-fsrs",
            name: "Remove all FSRS data (for testing)",
            callback: async () => {
                const result = await this.flashcardManager.removeAllFSRSData();
                new Notice(`Removed FSRS: ${result.entriesRemoved} entries from ${result.filesModified} files`);
            }
        });

        // Remove legacy Anki IDs
        this.addCommand({
            id: "remove-legacy-ids",
            name: "Remove legacy Anki IDs from flashcards",
            callback: async () => {
                const result = await this.flashcardManager.removeAllLegacyIds();
                new Notice(`Removed ${result.idsRemoved} legacy IDs from ${result.filesModified} files`);
            }
        });

        // Statistics panel command
        this.addCommand({
            id: "open-statistics",
            name: "Open statistics panel",
            callback: () => void this.openStatsView()
        });

        // Register settings tab
        this.addSettingTab(new ShadowAnkiSettingTab(this.app, this));

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
        // Obsidian automatically handles leaf cleanup when plugin unloads
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<ShadowAnkiSettings>);
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
            if (this.settings.hideFlashcardsFromBacklinks) {
                this.backlinksFilter.enable();
            } else {
                this.backlinksFilter.disable();
            }
        }
    }

    // Activate the sidebar view
    async activateView(): Promise<void> {
        const { workspace } = this.app;

        // Check if view already exists
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_FLASHCARD_PANEL)[0];

        if (!leaf) {
            // Create new leaf in right sidebar
            const rightLeaf = workspace.getRightLeaf(false);
            if (rightLeaf) {
                await rightLeaf.setViewState({
                    type: VIEW_TYPE_FLASHCARD_PANEL,
                    active: true
                });
                leaf = rightLeaf;
            }
        }

        // Reveal and focus the leaf
        if (leaf) {
            void workspace.revealLeaf(leaf);
        }
    }

    // Update the panel view with current file
    private updatePanelView(file: TFile | null): void {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_FLASHCARD_PANEL);
        leaves.forEach(leaf => {
            const view = leaf.view;
            if (view instanceof FlashcardPanelView) {
                void view.handleFileChange(file);
            }
        });
    }

    // Start a review session
    async startReviewSession(): Promise<void> {
        const { workspace } = this.app;

        // Check if review view already exists
        const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_REVIEW);
        if (existingLeaves.length > 0) {
            // Focus existing review view
            const leaf = existingLeaves[0];
            if (leaf) {
                workspace.revealLeaf(leaf);
            }
            return;
        }

        // Get all decks and show selection modal
        const decks = await this.flashcardManager.getAllDecks();

        // If no flashcards found, show notice
        if (decks.length === 0) {
            new Notice("No flashcards found. Generate some flashcards first!");
            return;
        }

        // Show deck selection modal
        const modal = new DeckSelectionModal(this.app, decks);
        const result = await modal.openAndWait();

        if (result.cancelled) {
            return;
        }

        // Open review view with selected deck
        await this.openReviewView(result.selectedDeck);
    }

    /**
     * Open the review view with optional deck filter
     */
    private async openReviewView(deckFilter: string | null): Promise<void> {
        const { workspace } = this.app;

        if (this.settings.reviewMode === "fullscreen") {
            // Open in main area
            const leaf = workspace.getLeaf(true);
            await leaf.setViewState({
                type: VIEW_TYPE_REVIEW,
                active: true,
                state: { deckFilter },
            });
            workspace.revealLeaf(leaf);
        } else {
            // Open in right panel
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
}
