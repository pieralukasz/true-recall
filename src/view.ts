import { ItemView, WorkspaceLeaf, TFile, Notice } from "obsidian";
import { VIEW_TYPE_FLASHCARD_PANEL } from "./constants";
import { FlashcardManager, FlashcardInfo } from "./flashcardManager";
import { OpenRouterService } from "./api";
import type ShadowAnkiPlugin from "./main";

type ProcessingStatus = "none" | "exists" | "processing";

export class FlashcardPanelView extends ItemView {
    private plugin: ShadowAnkiPlugin;
    private flashcardManager: FlashcardManager;
    private openRouterService: OpenRouterService;
    private currentFile: TFile | null = null;
    private status: ProcessingStatus = "none";
    private renderVersion = 0; // Prevents race conditions in async renders

    // UI elements
    private headerEl!: HTMLElement;
    private mainContentEl!: HTMLElement;
    private footerEl!: HTMLElement;

    constructor(leaf: WorkspaceLeaf, plugin: ShadowAnkiPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.flashcardManager = plugin.flashcardManager;
        this.openRouterService = plugin.openRouterService;
    }

    getViewType(): string {
        return VIEW_TYPE_FLASHCARD_PANEL;
    }

    getDisplayText(): string {
        return "Shadow Anki";
    }

    getIcon(): string {
        return "layers";
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass("shadow-anki-panel");

        // Create header section
        this.headerEl = container.createDiv({ cls: "shadow-anki-header" });

        // Create content section
        this.mainContentEl = container.createDiv({ cls: "shadow-anki-content" });

        // Create footer section
        this.footerEl = container.createDiv({ cls: "shadow-anki-footer" });

        // Initial render
        await this.updateView();
    }

    async onClose(): Promise<void> {
        // Cleanup if needed
    }

    // Called when active file changes
    async handleFileChange(file: TFile | null): Promise<void> {
        this.currentFile = file;
        this.status = "none";
        await this.updateView();
    }

    // Main render method
    private async updateView(): Promise<void> {
        this.renderHeader();
        await this.renderContent();
        this.renderFooter();
    }

    // Render header with note title and status
    private renderHeader(): void {
        this.headerEl.empty();

        const titleRow = this.headerEl.createDiv({ cls: "shadow-anki-title-row" });

        // Status indicator
        const statusEl = titleRow.createSpan({ cls: "shadow-anki-status" });
        statusEl.setText(this.getStatusIcon());

        // Note title
        const titleEl = titleRow.createSpan({ cls: "shadow-anki-title" });
        if (this.currentFile) {
            titleEl.setText(this.currentFile.basename);
        } else {
            titleEl.setText("No note selected");
        }

        // Open flashcard file icon button (only when flashcards exist)
        if (this.status === "exists" && this.currentFile) {
            const openBtn = titleRow.createSpan({ cls: "shadow-anki-open-btn clickable-icon" });
            openBtn.setText("📄");
            openBtn.setAttribute("aria-label", "Open flashcard file");
            openBtn.addEventListener("click", () => void this.handleOpenFlashcardFile());
        }
    }

    private getStatusIcon(): string {
        switch (this.status) {
            case "exists": return "\u{1F7E2}"; // green circle
            case "processing": return "\u{1F7E1}"; // yellow circle
            default: return "\u{1F534}"; // red circle
        }
    }

    // Render content section
    private async renderContent(): Promise<void> {
        const currentVersion = ++this.renderVersion;
        this.mainContentEl.empty();

        if (!this.currentFile) {
            this.renderEmptyState("Open a note to see flashcard options");
            return;
        }

        // Only process markdown files
        if (this.currentFile.extension !== "md") {
            this.renderEmptyState("Select a markdown file");
            return;
        }

        const info = await this.flashcardManager.getFlashcardInfo(this.currentFile);

        // Check if this render is still current (prevents race condition)
        if (currentVersion !== this.renderVersion) return;

        this.status = info.exists ? "exists" : "none";
        this.renderHeader(); // Re-render header with updated status

        if (!info.exists) {
            await this.renderNoFlashcardsState(currentVersion);
        } else {
            this.renderPreviewState(info);
        }
    }

    private renderEmptyState(message: string): void {
        const emptyEl = this.mainContentEl.createDiv({ cls: "shadow-anki-empty" });
        emptyEl.setText(message);
    }

    private async renderNoFlashcardsState(version: number): Promise<void> {
        const stateEl = this.mainContentEl.createDiv({ cls: "shadow-anki-no-cards" });

        stateEl.createEl("p", { text: "No flashcards yet for this note." });

        // Word count
        if (this.currentFile) {
            const content = await this.app.vault.cachedRead(this.currentFile);

            // Check if render is still current after await
            if (version !== this.renderVersion) return;

            const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
            stateEl.createEl("p", {
                text: `Word count: ${wordCount}`,
                cls: "shadow-anki-word-count"
            });
        }
    }

    private renderPreviewState(info: FlashcardInfo): void {
        const previewEl = this.mainContentEl.createDiv({ cls: "shadow-anki-preview" });

        // Card count and last modified
        const metaEl = previewEl.createDiv({ cls: "shadow-anki-meta-row" });
        metaEl.createSpan({
            text: `${info.cardCount} flashcard${info.cardCount !== 1 ? "s" : ""}`,
            cls: "shadow-anki-card-count"
        });
        if (info.lastModified) {
            const date = new Date(info.lastModified);
            metaEl.createSpan({
                text: ` • ${this.formatDate(date)}`,
                cls: "shadow-anki-meta"
            });
        }

        // Flashcard list (Q&A)
        if (info.flashcards.length > 0) {
            const cardsContainer = previewEl.createDiv({ cls: "shadow-anki-cards-container" });

            info.flashcards.forEach((card, index) => {
                const cardEl = cardsContainer.createDiv({ cls: "shadow-anki-card" });

                // Question
                const questionEl = cardEl.createDiv({ cls: "shadow-anki-card-question" });
                questionEl.createSpan({ text: "Q: ", cls: "shadow-anki-card-label" });
                this.renderTextWithWikilinks(questionEl, card.question);

                // Answer
                const answerEl = cardEl.createDiv({ cls: "shadow-anki-card-answer" });
                answerEl.createSpan({ text: "A: ", cls: "shadow-anki-card-label" });
                this.renderTextWithWikilinks(answerEl, card.answer);

                // Separator (except for last card)
                if (index < info.flashcards.length - 1) {
                    cardsContainer.createDiv({ cls: "shadow-anki-card-separator" });
                }
            });
        }
    }

    // Render text with [[wikilinks]] styled as Obsidian internal links
    private renderTextWithWikilinks(container: HTMLElement, text: string): void {
        // Regex to match [[wikilinks]] and **bold**
        const parts = text.split(/(\[\[[^\]]+\]\]|\*\*[^*]+\*\*)/g);

        parts.forEach(part => {
            if (part.startsWith("[[") && part.endsWith("]]")) {
                // Wikilink - extract link text
                const linkText = part.slice(2, -2);
                const linkEl = container.createSpan({
                    text: linkText,
                    cls: "shadow-anki-wikilink"
                });
                // Make it clickable
                linkEl.addEventListener("click", () => {
                    const file = this.app.metadataCache.getFirstLinkpathDest(linkText, "");
                    if (file) {
                        void this.app.workspace.getLeaf("tab").openFile(file);
                    }
                });
            } else if (part.startsWith("**") && part.endsWith("**")) {
                // Bold text
                container.createEl("strong", { text: part.slice(2, -2) });
            } else if (part) {
                container.createSpan({ text: part });
            }
        });
    }

    private formatDate(date: Date): string {
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();

        if (isToday) {
            return `Today ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
        }

        return date.toLocaleDateString([], {
            month: "short",
            day: "numeric",
            year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined
        });
    }

    // Render footer with action buttons
    private renderFooter(): void {
        this.footerEl.empty();

        if (!this.currentFile || this.currentFile.extension !== "md") {
            return;
        }

        // Main action button
        const mainBtn = this.footerEl.createEl("button", {
            cls: "shadow-anki-btn-primary"
        });

        if (this.status === "processing") {
            mainBtn.setText("Processing...");
            mainBtn.disabled = true;
        } else if (this.status === "exists") {
            mainBtn.setText("Update (Append new)");
            mainBtn.addEventListener("click", () => this.handleUpdate());
        } else {
            mainBtn.setText("Generate Flashcards");
            mainBtn.addEventListener("click", () => this.handleGenerate());
        }

        // Sync button
        const syncBtn = this.footerEl.createEl("button", {
            text: "Force Sync (Anki)",
            cls: "shadow-anki-btn-sync"
        });
        syncBtn.addEventListener("click", () => this.handleSync());
    }

    // Action handlers
    private async handleGenerate(): Promise<void> {
        if (!this.currentFile) return;

        if (!this.plugin.settings.openRouterApiKey) {
            new Notice("Please configure your OpenRouter API key in settings");
            return;
        }

        this.status = "processing";
        await this.updateView();

        try {
            const content = await this.app.vault.read(this.currentFile);
            const flashcards = await this.openRouterService.generateFlashcards(content);

            // Check if AI returned no new cards indicator
            if (flashcards.trim() === "NO_NEW_CARDS") {
                new Notice("No flashcard-worthy content found in this note.");
                this.status = "none";
                await this.updateView();
                return;
            }

            await this.flashcardManager.createFlashcardFile(this.currentFile, flashcards);

            new Notice(`Generated flashcards for ${this.currentFile.basename}`);

            if (this.plugin.settings.autoSyncToAnki) {
                await this.handleSync();
            }
        } catch (error) {
            new Notice(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }

        this.status = "none";
        await this.updateView();
    }

    private async handleUpdate(): Promise<void> {
        if (!this.currentFile) return;

        if (!this.plugin.settings.openRouterApiKey) {
            new Notice("Please configure your OpenRouter API key in settings");
            return;
        }

        this.status = "processing";
        await this.updateView();

        try {
            const info = await this.flashcardManager.getFlashcardInfo(this.currentFile);
            const content = await this.app.vault.read(this.currentFile);

            const newFlashcards = await this.openRouterService.generateFlashcards(
                content,
                info.questions // Pass existing questions as blocklist
            );

            // Check if AI returned no new cards indicator
            if (newFlashcards.trim() === "NO_NEW_CARDS") {
                new Notice("No new information to add. Flashcards are up to date.");
                this.status = "exists";
                await this.updateView();
                return;
            }

            await this.flashcardManager.appendFlashcards(this.currentFile, newFlashcards);

            new Notice(`Added new flashcards for ${this.currentFile.basename}`);

            if (this.plugin.settings.autoSyncToAnki) {
                await this.handleSync();
            }
        } catch (error) {
            new Notice(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }

        this.status = "exists";
        await this.updateView();
    }

    private async handleSync(): Promise<void> {
        try {
            // Try different possible command IDs for obsidian-to-anki
            const commandIds = [
                "obsidian-to-anki-plugin:scan-vault",
                "obsidian-to-anki:scan-vault"
            ];

            let executed = false;
            for (const commandId of commandIds) {
                // @ts-expect-error - executeCommandById exists but is not in types
                const result = this.app.commands.executeCommandById(commandId);
                if (result !== false) {
                    executed = true;
                    break;
                }
            }

            if (executed) {
                new Notice("Triggered Anki sync");
            } else {
                new Notice("obsidian-to-anki plugin not found. Please install it for Anki sync.");
            }
        } catch (error) {
            new Notice("Failed to sync. Is obsidian-to-anki plugin installed?");
        }
    }

    private async handleOpenFlashcardFile(): Promise<void> {
        if (this.currentFile) {
            await this.flashcardManager.openFlashcardFile(this.currentFile);
        }
    }
}
