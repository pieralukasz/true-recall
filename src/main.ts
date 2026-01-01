import { Plugin, TFile } from "obsidian";
import { ShadowAnkiSettings, ShadowAnkiSettingTab, DEFAULT_SETTINGS } from "./settings";
import { VIEW_TYPE_FLASHCARD_PANEL } from "./constants";
import { FlashcardPanelView } from "./view";
import { FlashcardManager } from "./flashcardManager";
import { OpenRouterService } from "./api";

export default class ShadowAnkiPlugin extends Plugin {
    settings!: ShadowAnkiSettings;
    flashcardManager!: FlashcardManager;
    openRouterService!: OpenRouterService;

    async onload(): Promise<void> {
        await this.loadSettings();

        // Initialize services
        this.flashcardManager = new FlashcardManager(this.app, this.settings);
        this.openRouterService = new OpenRouterService(
            this.settings.openRouterApiKey,
            this.settings.aiModel
        );

        // Register the sidebar view
        this.registerView(
            VIEW_TYPE_FLASHCARD_PANEL,
            (leaf) => new FlashcardPanelView(leaf, this)
        );

        // Add ribbon icon to open the panel
        this.addRibbonIcon("layers", "Shadow Anki", () => {
            void this.activateView();
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
}
