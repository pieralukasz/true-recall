import { Plugin, TFile, Notice } from "obsidian";
import { VIEW_TYPE_FLASHCARD_PANEL, VIEW_TYPE_REVIEW } from "./constants";
import { FlashcardManager, OpenRouterService, FSRSService, StatsService } from "./services";
import { extractFSRSSettings } from "./types";
import {
    FlashcardPanelView,
    ReviewView,
    ShadowAnkiSettingTab,
    type ShadowAnkiSettings,
    DEFAULT_SETTINGS,
} from "./ui";

export default class ShadowAnkiPlugin extends Plugin {
    settings!: ShadowAnkiSettings;
    flashcardManager!: FlashcardManager;
    openRouterService!: OpenRouterService;
    fsrsService!: FSRSService;
    statsService!: StatsService;

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

        // Add ribbon icon to start review
        this.addRibbonIcon("brain", "Shadow Anki - Study", () => {
            void this.startReviewSession();
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

        // Open review view based on settings
        if (this.settings.reviewMode === "fullscreen") {
            // Open in main area
            const leaf = workspace.getLeaf(true);
            await leaf.setViewState({
                type: VIEW_TYPE_REVIEW,
                active: true,
            });
            workspace.revealLeaf(leaf);
        } else {
            // Open in right panel
            const rightLeaf = workspace.getRightLeaf(false);
            if (rightLeaf) {
                await rightLeaf.setViewState({
                    type: VIEW_TYPE_REVIEW,
                    active: true,
                });
                workspace.revealLeaf(rightLeaf);
            }
        }
    }
}
