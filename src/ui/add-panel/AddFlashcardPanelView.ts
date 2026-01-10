/**
 * Add Flashcard Panel View
 * Dedicated panel for adding flashcards with rich markdown editor
 */
import { ItemView, WorkspaceLeaf, TFile, Notice } from "obsidian";
import { VIEW_TYPE_ADD_FLASHCARD_PANEL } from "../../constants";
import type EpistemePlugin from "../../main";

/**
 * Panel for adding new flashcards with contenteditable markdown editor
 */
export class AddFlashcardPanelView extends ItemView {
    private plugin: EpistemePlugin;

    // State
    private question: string = "";
    private answer: string = "";
    private targetFilePath: string | null = null;
    private targetNoteName: string | null = null;
    private isProcessing: boolean = false;
    private activeField: "question" | "answer" | null = null;

    // Container elements
    private headerContainer!: HTMLElement;
    private questionContainer!: HTMLElement;
    private answerContainer!: HTMLElement;
    private footerContainer!: HTMLElement;

    constructor(leaf: WorkspaceLeaf, plugin: EpistemePlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_ADD_FLASHCARD_PANEL;
    }

    getDisplayText(): string {
        return "Add Flashcard";
    }

    getIcon(): string {
        return "plus-circle";
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass("episteme-add-panel");

        // Create container elements
        this.headerContainer = container.createDiv({ cls: "episteme-add-panel-header" });
        this.questionContainer = container.createDiv({ cls: "episteme-add-panel-field" });
        this.answerContainer = container.createDiv({ cls: "episteme-add-panel-field" });
        this.footerContainer = container.createDiv({ cls: "episteme-add-panel-footer" });

        // Register for active file changes
        this.registerEvent(
            this.app.workspace.on("active-leaf-change", () => {
                void this.updateTargetFromActiveFile();
            })
        );

        // Handle keyboard shortcuts
        container.addEventListener("keydown", (e) => this.handleKeydown(e));

        // Initial target detection
        await this.updateTargetFromActiveFile();

        // Render UI
        this.render();
    }

    async onClose(): Promise<void> {
        // Cleanup handled by Obsidian's Component base class
    }

    /**
     * Public method to prefill the form with existing card content (for copy feature)
     */
    public prefillFromCard(question: string, answer: string): void {
        this.question = question;
        this.answer = answer;
        this.render();

        // Focus on question field
        setTimeout(() => {
            const questionEditEl = this.questionContainer.querySelector('[contenteditable="true"]') as HTMLElement;
            questionEditEl?.focus();
        }, 50);
    }

    // ===== Private Methods =====

    private async updateTargetFromActiveFile(): Promise<void> {
        const file = this.app.workspace.getActiveFile();

        if (!file || file.extension !== "md") {
            // Keep existing target if no valid file
            if (!this.targetFilePath) {
                this.targetFilePath = null;
                this.targetNoteName = null;
                this.renderHeader();
            }
            return;
        }

        // Check if it's already a flashcard file
        if (this.plugin.flashcardManager.isFlashcardFile(file)) {
            this.targetFilePath = file.path;
            this.targetNoteName = file.basename;
        } else {
            // Get flashcard path for this source note
            try {
                this.targetFilePath = await this.plugin.flashcardManager.getFlashcardPathAsync(file);
                this.targetNoteName = file.basename;
            } catch {
                this.targetFilePath = null;
                this.targetNoteName = null;
            }
        }

        this.renderHeader();
    }

    private render(): void {
        this.renderHeader();
        this.renderQuestionField();
        this.renderAnswerField();
        this.renderFooter();
    }

    private renderHeader(): void {
        this.headerContainer.empty();

        const title = this.headerContainer.createEl("h4", {
            text: "Add Flashcard",
            cls: "episteme-add-panel-title",
        });

        if (this.targetNoteName) {
            const targetInfo = this.headerContainer.createDiv({ cls: "episteme-add-panel-target" });
            targetInfo.createSpan({ text: "Target: " });
            targetInfo.createSpan({ text: this.targetNoteName, cls: "episteme-add-panel-target-name" });
        } else {
            const noTarget = this.headerContainer.createDiv({ cls: "episteme-add-panel-no-target" });
            noTarget.setText("Select a note to add flashcards");
        }
    }

    private renderQuestionField(): void {
        this.questionContainer.empty();

        const label = this.questionContainer.createEl("label", {
            text: "Question",
            cls: "episteme-add-panel-label",
        });

        this.renderEditableField(this.questionContainer, this.question, "question");
    }

    private renderAnswerField(): void {
        this.answerContainer.empty();

        const label = this.answerContainer.createEl("label", {
            text: "Answer",
            cls: "episteme-add-panel-label",
        });

        this.renderEditableField(this.answerContainer, this.answer, "answer");
    }

    private renderFooter(): void {
        this.footerContainer.empty();

        const buttonContainer = this.footerContainer.createDiv({ cls: "episteme-add-panel-buttons" });

        // Clear button
        const clearBtn = buttonContainer.createEl("button", {
            text: "Clear",
            cls: "episteme-btn-secondary",
        });
        clearBtn.addEventListener("click", () => this.handleClear());

        // Add button
        const addBtn = buttonContainer.createEl("button", {
            text: "Add Flashcard",
            cls: "episteme-btn-primary",
        });
        addBtn.disabled = this.isProcessing || !this.targetFilePath;
        addBtn.addEventListener("click", () => void this.handleAddFlashcard());

        // Keyboard hint
        const hint = this.footerContainer.createDiv({ cls: "episteme-add-panel-hint" });
        hint.setText("Cmd+Enter to add • Tab to switch fields");
    }

    /**
     * Render an editable field (contenteditable div) with formatting toolbar
     */
    private renderEditableField(
        container: HTMLElement,
        content: string,
        field: "question" | "answer"
    ): void {
        const editEl = container.createDiv({
            cls: "episteme-review-editable",
            attr: {
                contenteditable: "true",
                "data-field": field,
            },
        });

        // Convert markdown <br> back to actual line breaks for display
        editEl.innerHTML = this.markdownToEditableHtml(content);

        // Render toolbar under the editable field
        this.renderEditToolbar(container, editEl);

        // Event listeners
        editEl.addEventListener("input", () => {
            const newContent = this.convertEditableToMarkdown(editEl);
            if (field === "question") {
                this.question = newContent;
            } else {
                this.answer = newContent;
            }
        });

        editEl.addEventListener("focus", () => {
            this.activeField = field;
        });

        editEl.addEventListener("blur", () => {
            if (this.activeField === field) {
                this.activeField = null;
            }
        });

        editEl.addEventListener("keydown", (e) => this.handleFieldKeydown(e, field));
    }

    /**
     * Convert markdown content to HTML for display in contenteditable
     */
    private markdownToEditableHtml(content: string): string {
        // Replace <br> tags with actual line breaks for editing
        return content.replace(/<br>/g, "\n");
    }

    /**
     * Render formatting toolbar for edit mode
     */
    private renderEditToolbar(container: HTMLElement, editEl: HTMLElement): void {
        const toolbar = container.createDiv({ cls: "episteme-edit-toolbar" });

        const buttons = [
            { label: "**[[]]**", title: "Bold Wiki Link", action: () => this.wrapSelection(editEl, "**[[", "]]**") },
            { label: "⏎⏎", title: "Double Line Break", action: () => this.insertAtCursor(editEl, "<br><br>") },
            { label: "B", title: "Bold", action: () => this.wrapSelection(editEl, "**", "**") },
            { label: "I", title: "Italic", action: () => this.wrapSelection(editEl, "*", "*") },
            { label: "U", title: "Underline", action: () => this.wrapSelection(editEl, "<u>", "</u>") },
            { label: "[[]]", title: "Wiki Link", action: () => this.wrapSelection(editEl, "[[", "]]") },
            { label: "$", title: "Math", action: () => this.wrapSelection(editEl, "$", "$") },
            { label: "x²", title: "Superscript", action: () => this.wrapSelection(editEl, "<sup>", "</sup>") },
            { label: "x₂", title: "Subscript", action: () => this.wrapSelection(editEl, "<sub>", "</sub>") },
        ];

        for (const btn of buttons) {
            const btnEl = toolbar.createEl("button", {
                cls: "episteme-edit-toolbar-btn",
                text: btn.label,
                attr: { title: btn.title },
            });
            btnEl.addEventListener("mousedown", (e) => {
                e.preventDefault(); // Prevent blur on editEl
            });
            btnEl.addEventListener("click", (e) => {
                e.preventDefault();
                btn.action();
                editEl.focus();
            });
        }
    }

    /**
     * Wrap selected text with before/after strings
     */
    private wrapSelection(editEl: HTMLElement, before: string, after: string): void {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        const range = sel.getRangeAt(0);
        const selectedText = range.toString();

        if (selectedText) {
            range.deleteContents();
            range.insertNode(document.createTextNode(before + selectedText + after));
        } else {
            // No selection - just insert wrapper
            range.insertNode(document.createTextNode(before + after));
        }

        // Update state after wrapping
        const field = editEl.getAttribute("data-field") as "question" | "answer";
        const newContent = this.convertEditableToMarkdown(editEl);
        if (field === "question") {
            this.question = newContent;
        } else {
            this.answer = newContent;
        }
    }

    /**
     * Insert text at cursor position
     */
    private insertAtCursor(editEl: HTMLElement, text: string): void {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        range.collapse(false);

        // Update state after insertion
        const field = editEl.getAttribute("data-field") as "question" | "answer";
        const newContent = this.convertEditableToMarkdown(editEl);
        if (field === "question") {
            this.question = newContent;
        } else {
            this.answer = newContent;
        }
    }

    /**
     * Convert contenteditable HTML to markdown text with <br> for line breaks
     */
    private convertEditableToMarkdown(editEl: HTMLElement): string {
        let html = editEl.innerHTML;

        // Normalize different browser line break representations
        html = html.replace(/<br\s*\/?>/gi, "\n");
        html = html.replace(/<\/div>/gi, "\n");
        html = html.replace(/<\/p>/gi, "\n");

        // Remove remaining HTML tags
        html = html.replace(/<[^>]*>/g, "");

        // Decode HTML entities
        const textarea = document.createElement("textarea");
        textarea.innerHTML = html;
        const text = textarea.value;

        // Trim trailing newlines but preserve internal ones
        const trimmed = text.replace(/\n+$/, "");

        // Replace remaining newlines with <br>
        return trimmed.replace(/\n/g, "<br>");
    }

    /**
     * Handle global keydown events
     */
    private handleKeydown(e: KeyboardEvent): void {
        // Cmd/Ctrl+Enter to add flashcard
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            void this.handleAddFlashcard();
        }
    }

    /**
     * Handle keydown events within editable fields
     */
    private handleFieldKeydown(e: KeyboardEvent, currentField: "question" | "answer"): void {
        if (e.key === "Tab") {
            e.preventDefault();
            // Switch between question and answer
            const nextField = currentField === "question" ? "answer" : "question";
            const nextContainer = nextField === "question" ? this.questionContainer : this.answerContainer;
            const nextEditEl = nextContainer.querySelector('[contenteditable="true"]') as HTMLElement;
            nextEditEl?.focus();
        }
    }

    /**
     * Handle adding a new flashcard
     */
    private async handleAddFlashcard(): Promise<void> {
        if (!this.question.trim() || !this.answer.trim()) {
            new Notice("Please enter both question and answer");
            return;
        }

        if (!this.targetFilePath) {
            new Notice("No target file selected. Open a note first.");
            return;
        }

        this.isProcessing = true;
        this.renderFooter(); // Update button state

        try {
            await this.plugin.flashcardManager.addSingleFlashcard(
                this.targetFilePath,
                this.question,
                this.answer
            );

            new Notice("Flashcard added!");

            // Clear fields for next entry
            this.question = "";
            this.answer = "";
            this.render();

            // Focus question field for batch entry
            setTimeout(() => {
                const questionEditEl = this.questionContainer.querySelector('[contenteditable="true"]') as HTMLElement;
                questionEditEl?.focus();
            }, 50);
        } catch (error) {
            console.error("Error adding flashcard:", error);
            new Notice(`Failed to add flashcard: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            this.isProcessing = false;
            this.renderFooter();
        }
    }

    /**
     * Handle clearing the form
     */
    private handleClear(): void {
        this.question = "";
        this.answer = "";
        this.render();

        // Focus question field
        setTimeout(() => {
            const questionEditEl = this.questionContainer.querySelector('[contenteditable="true"]') as HTMLElement;
            questionEditEl?.focus();
        }, 50);
    }
}
