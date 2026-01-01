import {
	ItemView,
	WorkspaceLeaf,
	TFile,
	Notice,
	MarkdownRenderer,
} from "obsidian";
import { VIEW_TYPE_FLASHCARD_PANEL } from "./constants";
import {
	FlashcardManager,
	FlashcardInfo,
	FlashcardItem,
	FlashcardChange,
	DiffResult,
} from "./flashcardManager";
import { OpenRouterService } from "./api";
import { AnkiService } from "./ankiService";
import type ShadowAnkiPlugin from "./main";

type ProcessingStatus = "none" | "exists" | "processing";
type ViewMode = "list" | "diff";

export class FlashcardPanelView extends ItemView {
	private plugin: ShadowAnkiPlugin;
	private flashcardManager: FlashcardManager;
	private openRouterService: OpenRouterService;
	private ankiService: AnkiService;
	private currentFile: TFile | null = null;
	private status: ProcessingStatus = "none";
	private renderVersion = 0; // Prevents race conditions in async renders
	private isFlashcardFile = false; // True when viewing a flashcards_ file
	private viewMode: ViewMode = "list";
	private diffResult: DiffResult | null = null; // Holds pending diff changes
	private userInstructions = ""; // User's additional instructions for AI

	// UI elements
	private headerEl!: HTMLElement;
	private mainContentEl!: HTMLElement;
	private footerEl!: HTMLElement;

	constructor(leaf: WorkspaceLeaf, plugin: ShadowAnkiPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.flashcardManager = plugin.flashcardManager;
		this.openRouterService = plugin.openRouterService;
		this.ankiService = plugin.ankiService;
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
		this.mainContentEl = container.createDiv({
			cls: "shadow-anki-content",
		});

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
		// Nie resetuj jeśli plik się nie zmienił lub jesteśmy w trakcie przetwarzania
		if (
			this.currentFile?.path === file?.path ||
			this.status === "processing"
		) {
			return;
		}

		this.currentFile = file;
		this.status = "none";
		this.viewMode = "list";
		this.diffResult = null;
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

		const titleRow = this.headerEl.createDiv({
			cls: "shadow-anki-title-row",
		});

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
			const openBtn = titleRow.createSpan({
				cls: "shadow-anki-open-btn clickable-icon",
			});
			openBtn.setText("📄");
			openBtn.setAttribute("aria-label", "Open flashcard file");
			openBtn.addEventListener(
				"click",
				() => void this.handleOpenFlashcardFile()
			);
		}
	}

	private getStatusIcon(): string {
		switch (this.status) {
			case "exists":
				return "\u{1F7E2}"; // green circle
			case "processing":
				return "\u{1F7E1}"; // yellow circle
			default:
				return "\u{1F534}"; // red circle
		}
	}

	// Render content section
	private async renderContent(): Promise<void> {
		const currentVersion = ++this.renderVersion;
		this.mainContentEl.empty();

		// Show loader if processing
		if (this.status === "processing") {
			this.renderProcessingState();
			return;
		}

		// Show diff view if in diff mode
		if (this.viewMode === "diff" && this.diffResult) {
			await this.renderDiffState();
			return;
		}

		if (!this.currentFile) {
			this.isFlashcardFile = false;
			this.renderEmptyState("Open a note to see flashcard options");
			return;
		}

		// Only process markdown files
		if (this.currentFile.extension !== "md") {
			this.isFlashcardFile = false;
			this.renderEmptyState("Select a markdown file");
			return;
		}

		// Check if this is a flashcard file itself
		this.isFlashcardFile =
			this.currentFile.basename.startsWith("flashcards_");

		let info: FlashcardInfo;
		if (this.isFlashcardFile) {
			// Viewing a flashcard file directly - show its contents
			info = await this.flashcardManager.getFlashcardInfoDirect(
				this.currentFile
			);
		} else {
			// Viewing a source note - look for its flashcard file
			info = await this.flashcardManager.getFlashcardInfo(
				this.currentFile
			);
		}

		// Check if this render is still current (prevents race condition)
		if (currentVersion !== this.renderVersion) return;

		this.status = info.exists ? "exists" : "none";
		this.renderHeader(); // Re-render header with updated status

		if (!info.exists) {
			await this.renderNoFlashcardsState(currentVersion);
		} else {
			await this.renderPreviewState(info);
		}
	}

	private renderProcessingState(): void {
		const processingEl = this.mainContentEl.createDiv({
			cls: "shadow-anki-processing",
		});

		// Spinner
		const spinnerEl = processingEl.createDiv({
			cls: "shadow-anki-spinner",
		});
		spinnerEl.innerHTML = `<svg viewBox="0 0 24 24" width="32" height="32">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4 31.4" stroke-linecap="round">
                <animateTransform attributeName="transform" type="rotate" dur="1s" from="0 12 12" to="360 12 12" repeatCount="indefinite"/>
            </circle>
        </svg>`;

		// Text
		processingEl.createDiv({
			text: "Generating flashcards...",
			cls: "shadow-anki-processing-text",
		});
		processingEl.createDiv({
			text: "AI is analyzing your note",
			cls: "shadow-anki-processing-subtext",
		});
	}

	private renderEmptyState(message: string): void {
		const emptyEl = this.mainContentEl.createDiv({
			cls: "shadow-anki-empty",
		});
		emptyEl.setText(message);
	}

	private async renderNoFlashcardsState(version: number): Promise<void> {
		const stateEl = this.mainContentEl.createDiv({
			cls: "shadow-anki-no-cards",
		});

		stateEl.createEl("p", { text: "No flashcards yet for this note." });

		// Word count
		if (this.currentFile) {
			const content = await this.app.vault.cachedRead(this.currentFile);

			// Check if render is still current after await
			if (version !== this.renderVersion) return;

			const wordCount = content
				.split(/\s+/)
				.filter((w) => w.length > 0).length;
			stateEl.createEl("p", {
				text: `Word count: ${wordCount}`,
				cls: "shadow-anki-word-count",
			});
		}
	}

	private async renderPreviewState(info: FlashcardInfo): Promise<void> {
		const previewEl = this.mainContentEl.createDiv({
			cls: "shadow-anki-preview",
		});

		// Card count and last modified
		const metaEl = previewEl.createDiv({ cls: "shadow-anki-meta-row" });
		metaEl.createSpan({
			text: `${info.cardCount} flashcard${
				info.cardCount !== 1 ? "s" : ""
			}`,
			cls: "shadow-anki-card-count",
		});
		if (info.lastModified) {
			const date = new Date(info.lastModified);
			metaEl.createSpan({
				text: ` • ${this.formatDate(date)}`,
				cls: "shadow-anki-meta",
			});
		}

		// Flashcard list (Q&A)
		if (info.flashcards.length > 0) {
			const cardsContainer = previewEl.createDiv({
				cls: "shadow-anki-cards-container",
			});

			for (let index = 0; index < info.flashcards.length; index++) {
				const card = info.flashcards[index];
				if (!card) continue;

				const cardEl = cardsContainer.createDiv({
					cls: "shadow-anki-card clickable",
				});
				cardEl.style.cursor = "pointer";
				cardEl.addEventListener("click", () => {
					void this.handleEditCard(card);
				});

				// Card header with actions
				const cardHeader = cardEl.createDiv({
					cls: "shadow-anki-card-header",
				});

				// Question
				const questionEl = cardHeader.createDiv({
					cls: "shadow-anki-card-question",
				});
				questionEl.createSpan({
					text: "Q: ",
					cls: "shadow-anki-card-label",
				});
				const questionContent = questionEl.createDiv({
					cls: "shadow-anki-md-content",
				});
				await this.renderMarkdown(
					questionContent,
					card.question,
					info.filePath
				);

				// Action buttons
				const actionsEl = cardHeader.createDiv({
					cls: "shadow-anki-card-actions",
				});

				// Copy button
				const copyBtn = actionsEl.createSpan({
					cls: "shadow-anki-card-btn clickable-icon",
					attr: { "aria-label": "Copy flashcard" },
				});
				copyBtn.setText("📋");
				copyBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					void this.handleCopyCard(card);
				});

				// Remove button
				const removeBtn = actionsEl.createSpan({
					cls: "shadow-anki-card-btn clickable-icon",
					attr: { "aria-label": "Remove flashcard" },
				});
				removeBtn.setText("🗑️");
				removeBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					void this.handleRemoveCard(card);
				});

				// Answer
				const answerEl = cardEl.createDiv({
					cls: "shadow-anki-card-answer",
				});
				answerEl.createSpan({
					text: "A: ",
					cls: "shadow-anki-card-label",
				});
				const answerContent = answerEl.createDiv({
					cls: "shadow-anki-md-content",
				});
				await this.renderMarkdown(
					answerContent,
					card.answer,
					info.filePath
				);

				// Separator (except for last card)
				if (index < info.flashcards.length - 1) {
					cardsContainer.createDiv({
						cls: "shadow-anki-card-separator",
					});
				}
			}
		}
	}

	// Render markdown content using Obsidian's native renderer
	private async renderMarkdown(
		container: HTMLElement,
		text: string,
		sourcePath: string
	): Promise<void> {
		await MarkdownRenderer.render(
			this.app,
			text,
			container,
			sourcePath,
			this
		);
	}

	// Render diff view for proposed changes
	private async renderDiffState(): Promise<void> {
		if (!this.diffResult || !this.currentFile) return;

		const diffEl = this.mainContentEl.createDiv({
			cls: "shadow-anki-diff",
		});

		// Header with count
		const acceptedCount = this.diffResult.changes.filter(
			(c) => c.accepted
		).length;
		const totalCount = this.diffResult.changes.length;

		const headerEl = diffEl.createDiv({ cls: "shadow-anki-diff-header" });
		headerEl.createSpan({
			text: `Proposed Changes (${acceptedCount}/${totalCount} selected)`,
			cls: "shadow-anki-diff-title",
		});

		// Select All / Deselect All button
		const allSelected = acceptedCount === totalCount;
		const selectAllBtn = headerEl.createEl("button", {
			text: allSelected ? "Deselect All" : "Select All",
			cls: "shadow-anki-btn-secondary",
		});
		selectAllBtn.style.marginLeft = "auto";
		selectAllBtn.style.padding = "4px 8px";
		selectAllBtn.style.fontSize = "12px";
		selectAllBtn.addEventListener("click", () => {
			const newState = !allSelected;
			for (const change of this.diffResult!.changes) {
				change.accepted = newState;
			}
			void this.updateView();
		});

		// No changes case
		if (this.diffResult.changes.length === 0) {
			diffEl.createDiv({
				text: "No changes needed. Flashcards are up to date.",
				cls: "shadow-anki-diff-empty",
			});
			return;
		}

		// Render each change
		const changesContainer = diffEl.createDiv({
			cls: "shadow-anki-diff-changes",
		});
		const flashcardPath = this.flashcardManager.getFlashcardPath(
			this.currentFile
		);

		for (let i = 0; i < this.diffResult.changes.length; i++) {
			const change = this.diffResult.changes[i];
			if (!change) continue;

			const cardEl = changesContainer.createDiv({
				cls: `shadow-anki-diff-card shadow-anki-diff-card--${change.type.toLowerCase()} ${
					change.accepted ? "" : "shadow-anki-diff-card--rejected"
				}`,
			});

			// Card header with type badge and toggle
			const cardHeader = cardEl.createDiv({
				cls: "shadow-anki-diff-card-header",
			});

			// Type badge
			const badgeEl = cardHeader.createSpan({
				cls: `shadow-anki-diff-badge shadow-anki-diff-badge--${change.type.toLowerCase()}`,
			});
			badgeEl.setText(change.type);

			// Toggle checkbox
			const toggleEl = cardHeader.createEl("input", {
				type: "checkbox",
				cls: "shadow-anki-diff-toggle",
			});
			toggleEl.checked = change.accepted;
			toggleEl.addEventListener("change", () => {
				change.accepted = toggleEl.checked;
				cardEl.toggleClass(
					"shadow-anki-diff-card--rejected",
					!change.accepted
				);
				void this.updateView(); // Re-render to update count
			});

			// For DELETED: show card to be removed with reason
			if (change.type === "DELETED") {
				const deletedSection = cardEl.createDiv({
					cls: "shadow-anki-diff-deleted-content",
				});

				const delQ = deletedSection.createDiv({
					cls: "shadow-anki-diff-question",
				});
				delQ.createSpan({ text: "Q: ", cls: "shadow-anki-card-label" });
				const delQContent = delQ.createDiv({
					cls: "shadow-anki-md-content",
				});
				await this.renderMarkdown(
					delQContent,
					change.question,
					flashcardPath
				);

				const delA = deletedSection.createDiv({
					cls: "shadow-anki-diff-answer",
				});
				delA.createSpan({ text: "A: ", cls: "shadow-anki-card-label" });
				const delAContent = delA.createDiv({
					cls: "shadow-anki-md-content",
				});
				await this.renderMarkdown(
					delAContent,
					change.answer,
					flashcardPath
				);

				// Show reason if available
				if (change.reason) {
					cardEl.createDiv({
						text: `Reason: ${change.reason}`,
						cls: "shadow-anki-diff-reason",
					});
				}
			}
			// For MODIFIED: show old version first
			else if (change.type === "MODIFIED" && change.originalQuestion) {
				const oldSection = cardEl.createDiv({
					cls: "shadow-anki-diff-old",
				});
				oldSection.createDiv({
					text: "OLD:",
					cls: "shadow-anki-diff-label",
				});

				const oldQ = oldSection.createDiv({
					cls: "shadow-anki-diff-question",
				});
				oldQ.createSpan({ text: "Q: ", cls: "shadow-anki-card-label" });
				const oldQContent = oldQ.createDiv({
					cls: "shadow-anki-md-content",
				});
				await this.renderMarkdown(
					oldQContent,
					change.originalQuestion,
					flashcardPath
				);

				const oldA = oldSection.createDiv({
					cls: "shadow-anki-diff-answer",
				});
				oldA.createSpan({ text: "A: ", cls: "shadow-anki-card-label" });
				const oldAContent = oldA.createDiv({
					cls: "shadow-anki-md-content",
				});
				await this.renderMarkdown(
					oldAContent,
					change.originalAnswer || "",
					flashcardPath
				);

				// Arrow separator
				cardEl.createDiv({ cls: "shadow-anki-diff-arrow", text: "↓" });

				// New version for MODIFIED
				const newSection = cardEl.createDiv({
					cls: "shadow-anki-diff-new",
				});
				newSection.createDiv({
					text: "NEW:",
					cls: "shadow-anki-diff-label",
				});

				const newQ = newSection.createDiv({
					cls: "shadow-anki-diff-question",
				});
				newQ.createSpan({ text: "Q: ", cls: "shadow-anki-card-label" });
				const newQContent = newQ.createDiv({
					cls: "shadow-anki-md-content",
				});
				await this.renderMarkdown(
					newQContent,
					change.question,
					flashcardPath
				);

				const newA = newSection.createDiv({
					cls: "shadow-anki-diff-answer",
				});
				newA.createSpan({ text: "A: ", cls: "shadow-anki-card-label" });
				const newAContent = newA.createDiv({
					cls: "shadow-anki-md-content",
				});
				await this.renderMarkdown(
					newAContent,
					change.answer,
					flashcardPath
				);
			}
			// For NEW: show only the new card
			else if (change.type === "NEW") {
				const newSection = cardEl.createDiv({
					cls: "shadow-anki-diff-new",
				});

				const newQ = newSection.createDiv({
					cls: "shadow-anki-diff-question",
				});
				newQ.createSpan({ text: "Q: ", cls: "shadow-anki-card-label" });
				const newQContent = newQ.createDiv({
					cls: "shadow-anki-md-content",
				});
				await this.renderMarkdown(
					newQContent,
					change.question,
					flashcardPath
				);

				const newA = newSection.createDiv({
					cls: "shadow-anki-diff-answer",
				});
				newA.createSpan({ text: "A: ", cls: "shadow-anki-card-label" });
				const newAContent = newA.createDiv({
					cls: "shadow-anki-md-content",
				});
				await this.renderMarkdown(
					newAContent,
					change.answer,
					flashcardPath
				);
			}
		}
	}

	private formatDate(date: Date): string {
		const now = new Date();
		const isToday = date.toDateString() === now.toDateString();

		if (isToday) {
			return `Today ${date.toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
			})}`;
		}

		return date.toLocaleDateString([], {
			month: "short",
			day: "numeric",
			year:
				date.getFullYear() !== now.getFullYear()
					? "numeric"
					: undefined,
		});
	}

	// Render footer with action buttons
	private renderFooter(): void {
		this.footerEl.empty();

		if (!this.currentFile || this.currentFile.extension !== "md") {
			return;
		}

		// Diff mode footer
		if (this.viewMode === "diff" && this.diffResult) {
			const acceptedCount = this.diffResult.changes.filter(
				(c) => c.accepted
			).length;

			// Instructions input for regenerate
			const instructionsContainer = this.footerEl.createDiv({
				cls: "shadow-anki-instructions-container",
			});
			const instructionsInput = instructionsContainer.createEl(
				"textarea",
				{
					cls: "shadow-anki-instructions-input",
					placeholder:
						"Additional instructions (e.g., 'make shorter', 'focus on X')...",
				}
			);
			instructionsInput.value = this.userInstructions;
			instructionsInput.placeholder =
				"Additional instructions (e.g., 'make shorter', 'focus on X')...";
			instructionsInput.addEventListener("input", () => {
				this.userInstructions = instructionsInput.value;
			});

			// Buttons row
			const buttonsRow = this.footerEl.createDiv({
				cls: "shadow-anki-buttons-row",
			});

			// Regenerate button
			const regenerateBtn = buttonsRow.createEl("button", {
				text: "Regenerate",
				cls: "shadow-anki-btn-secondary",
			});
			regenerateBtn.addEventListener(
				"click",
				() => void this.handleUpdate()
			);

			// Apply button
			const applyBtn = buttonsRow.createEl("button", {
				cls: "shadow-anki-btn-primary",
			});
			applyBtn.setText(`Apply (${acceptedCount})`);
			applyBtn.disabled = acceptedCount === 0;
			applyBtn.addEventListener(
				"click",
				() => void this.handleApplyDiff()
			);

			// Cancel button
			const cancelBtn = buttonsRow.createEl("button", {
				text: "Cancel",
				cls: "shadow-anki-btn-secondary",
			});
			cancelBtn.addEventListener(
				"click",
				() => void this.handleCancelDiff()
			);

			return;
		}

		// Don't show Generate/Update buttons for flashcard files
		if (!this.isFlashcardFile) {
			// Instructions input
			const instructionsContainer = this.footerEl.createDiv({
				cls: "shadow-anki-instructions-container",
			});
			const instructionsInput = instructionsContainer.createEl(
				"textarea",
				{
					cls: "shadow-anki-instructions-input",
					placeholder: "Instructions for AI (optional)...",
				}
			);
			instructionsInput.value = this.userInstructions;
			instructionsInput.placeholder =
				"Additional instructions (e.g., 'make shorter', 'focus on X')...";
			instructionsInput.disabled = this.status === "processing";
			instructionsInput.addEventListener("input", () => {
				this.userInstructions = instructionsInput.value;
			});

			// Main action button
			const mainBtn = this.footerEl.createEl("button", {
				cls: "shadow-anki-btn-primary",
			});

			if (this.status === "processing") {
				mainBtn.setText("Processing...");
				mainBtn.disabled = true;
			} else if (this.status === "exists") {
				mainBtn.setText("Update flashcards");
				mainBtn.addEventListener(
					"click",
					() => void this.handleUpdate()
				);
			} else {
				mainBtn.setText("Generate flashcards");
				mainBtn.addEventListener(
					"click",
					() => void this.handleGenerate()
				);
			}
		}
	}

	// Action handlers
	private async handleGenerate(): Promise<void> {
		if (!this.currentFile) return;

		if (!this.plugin.settings.openRouterApiKey) {
			new Notice("Please configure your OpenRouter API key in settings.");
			return;
		}

		this.status = "processing";
		await this.updateView();

		try {
			const content = await this.app.vault.read(this.currentFile);
			const flashcards = await this.openRouterService.generateFlashcards(
				content,
				this.userInstructions || undefined
			);

			// Check if AI returned no new cards indicator
			if (flashcards.trim() === "NO_NEW_CARDS") {
				new Notice("No flashcard-worthy content found in this note.");
				this.status = "none";
				await this.updateView();
				return;
			}

			await this.flashcardManager.createFlashcardFile(
				this.currentFile,
				flashcards
			);

			// Store source content if enabled
			if (this.plugin.settings.storeSourceContent) {
				await this.flashcardManager.updateSourceContent(
					this.currentFile,
					content
				);
			}

			new Notice(`Generated flashcards for ${this.currentFile.basename}`);

			if (this.plugin.settings.autoSyncToAnki) {
				await this.handleSync();
			}
		} catch (error) {
			new Notice(
				`Error: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
		}

		this.status = "none";
		await this.updateView();
	}

	private async handleUpdate(): Promise<void> {
		console.debug("=== handleUpdate STARTED ===");
		if (!this.currentFile) return;

		if (!this.plugin.settings.openRouterApiKey) {
			new Notice("Please configure your OpenRouter API key in settings.");
			return;
		}

		this.status = "processing";
		await this.updateView();

		try {
			const info = await this.flashcardManager.getFlashcardInfo(
				this.currentFile
			);
			const content = await this.app.vault.read(this.currentFile);

			// Get old note content if stored
			const oldNoteContent =
				await this.flashcardManager.extractSourceContent(
					this.currentFile
				);

			console.debug("=== Calling generateFlashcardsDiff ===");
			console.debug("File:", this.currentFile.path);
			console.debug("Flashcards found:", info.flashcards.length);
			console.debug(
				"Old note content:",
				oldNoteContent ? "found" : "not found"
			);

			// Use diff-based generation
			const diffResult =
				await this.openRouterService.generateFlashcardsDiff(
					content,
					info.flashcards,
					this.userInstructions || undefined,
					oldNoteContent ?? undefined
				);

			// Check if no changes
			if (diffResult.changes.length === 0) {
				new Notice("No changes needed. Flashcards are up to date.");
				this.status = "exists";
				await this.updateView();
				return;
			}

			// Switch to diff view
			this.diffResult = diffResult;
			this.viewMode = "diff";
			this.status = "exists";
			await this.updateView();
		} catch (error) {
			new Notice(
				`Error: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
			this.status = "exists";
			await this.updateView();
		}
	}

	private async handleApplyDiff(): Promise<void> {
		if (!this.currentFile || !this.diffResult) return;

		const acceptedChanges = this.diffResult.changes.filter(
			(c) => c.accepted
		);
		if (acceptedChanges.length === 0) {
			new Notice("No changes selected");
			return;
		}

		try {
			await this.flashcardManager.applyDiffChanges(
				this.currentFile,
				this.diffResult.changes,
				this.diffResult.existingFlashcards
			);

			// Update stored source content if enabled
			if (this.plugin.settings.storeSourceContent) {
				const currentContent = await this.app.vault.read(
					this.currentFile
				);
				await this.flashcardManager.updateSourceContent(
					this.currentFile,
					currentContent
				);
			}

			const newCount = acceptedChanges.filter(
				(c) => c.type === "NEW"
			).length;
			const modifiedCount = acceptedChanges.filter(
				(c) => c.type === "MODIFIED"
			).length;
			const deletedCount = acceptedChanges.filter(
				(c) => c.type === "DELETED"
			).length;

			let message = "Applied: ";
			const parts = [];
			if (newCount > 0) parts.push(`${newCount} new`);
			if (modifiedCount > 0) parts.push(`${modifiedCount} modified`);
			if (deletedCount > 0) parts.push(`${deletedCount} deleted`);
			message += parts.join(", ");

			new Notice(message);

			if (this.plugin.settings.autoSyncToAnki) {
				await this.handleSync();
			}
		} catch (error) {
			new Notice(
				`Error: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
		}

		// Return to list view
		this.viewMode = "list";
		this.diffResult = null;
		this.userInstructions = ""; // Clear instructions after applying
		await this.updateView();
	}

	private async handleCancelDiff(): Promise<void> {
		this.viewMode = "list";
		this.diffResult = null;
		await this.updateView();
	}

	private async handleSync(): Promise<void> {
		try {
			// Try different possible command IDs for obsidian-to-anki
			const commandIds = [
				"obsidian-to-anki-plugin:scan-vault",
				"obsidian-to-anki:scan-vault",
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
				new Notice(
					"obsidian-to-anki plugin not found. Please install it for Anki sync."
				);
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

	private async handleEditCard(card: FlashcardItem): Promise<void> {
		if (!this.currentFile) return;

		if (this.isFlashcardFile) {
			// Viewing flashcard file directly - open at line
			await this.flashcardManager.openFileAtLine(
				this.currentFile,
				card.lineNumber
			);
		} else {
			// Viewing source file - open its flashcard file at line
			await this.flashcardManager.openFlashcardFileAtLine(
				this.currentFile,
				card.lineNumber
			);
		}
	}

	private async handleRemoveCard(card: FlashcardItem): Promise<void> {
		if (!this.currentFile) return;

		// If the card has an Anki ID, try to delete from Anki first
		if (card.ankiId) {
			const ankiAvailable = await this.ankiService.isAvailable();
			if (ankiAvailable) {
				const deleted = await this.ankiService.deleteNotes([
					card.ankiId,
				]);
				if (deleted) {
					new Notice("Removed from Anki");
				} else {
					new Notice(
						"Could not remove from Anki (card may already be deleted)"
					);
				}
			} else {
				new Notice("Anki not running - removing from file only");
			}
		}

		// Remove from the flashcard file
		let removed: boolean;
		if (this.isFlashcardFile) {
			// Viewing flashcard file directly
			removed = await this.flashcardManager.removeFlashcardDirect(
				this.currentFile,
				card.lineNumber
			);
		} else {
			// Viewing source file - remove from its flashcard file
			removed = await this.flashcardManager.removeFlashcard(
				this.currentFile,
				card.lineNumber
			);
		}

		if (removed) {
			new Notice("Flashcard removed");
			await this.updateView();
		} else {
			new Notice("Failed to remove flashcard from file");
		}
	}

	private async handleCopyCard(card: FlashcardItem): Promise<void> {
		const text = `Q: ${card.question}\nA: ${card.answer}`;
		await navigator.clipboard.writeText(text);
		new Notice("Copied to clipboard");
	}
}
