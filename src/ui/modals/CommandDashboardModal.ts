/**
 * Command Dashboard Modal
 * Displays all Episteme commands as clickable buttons organized by category
 */
import { App, Notice } from "obsidian";
import { BaseModal } from "./BaseModal";
import type EpistemePlugin from "../../main";
import { CommandCategory, type CommandDefinition, type CommandCategoryConfig } from "../../types/command.types";

/**
 * Command category configurations
 */
const CATEGORIES: CommandCategoryConfig[] = [
	{
		id: CommandCategory.PANEL,
		name: "Panels",
		description: "",
		icon: "layout",
		order: 1,
	},
	{
		id: CommandCategory.GENERATION,
		name: "Flashcard Generation",
		description: "",
		icon: "sparkles",
		order: 2,
	},
	{
		id: CommandCategory.REVIEW,
		name: "Review Sessions",
		description: "",
		icon: "brain",
		order: 3,
	},
	{
		id: CommandCategory.ANALYSIS,
		name: "Analysis & Stats",
		description: "",
		icon: "bar-chart-2",
		order: 4,
	},
	{
		id: CommandCategory.WORKFLOW,
		name: "Workflow Tools",
		description: "",
		icon: "workflow",
		order: 5,
	},
];

/**
 * Modal for command dashboard with grid button layout
 */
export class CommandDashboardModal extends BaseModal {
	private plugin: EpistemePlugin;
	private commands: CommandDefinition[] = [];

	constructor(app: App, plugin: EpistemePlugin) {
		super(app, { title: "Command Dashboard", width: "600px" });
		this.plugin = plugin;
		this.initializeCommands();
	}

	async openAndWait(): Promise<void> {
		this.open();
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("episteme-command-dashboard-modal");
	}

	protected renderBody(container: HTMLElement): void {
		// Render command buttons in grid layout by category
		for (const category of CATEGORIES) {
			this.renderCategorySection(container, category);
		}
	}

	/**
	 * Initialize all command definitions
	 */
	private initializeCommands(): void {
		this.commands = [
			// PANEL CATEGORY
			{
				id: "open-flashcard-panel",
				name: "Open Flashcard Panel",
				description: "Open the main flashcard management panel",
				icon: "layers",
				category: CommandCategory.PANEL,
				requiresActiveFile: false,
				callback: () => this.plugin.activateView(),
			},
			{
				id: "open-statistics",
				name: "Open Statistics Panel",
				description: "View detailed learning statistics",
				icon: "bar-chart-2",
				category: CommandCategory.PANEL,
				requiresActiveFile: false,
				callback: () => this.plugin.openStatsView(),
			},

			// GENERATION CATEGORY
			{
				id: "generate-flashcards",
				name: "Generate Flashcards",
				description: "Generate flashcards for the current note",
				icon: "sparkles",
				category: CommandCategory.GENERATION,
				requiresActiveFile: true,
				callback: () => this.handleGenerateFlashcards(),
			},
			{
				id: "scan-vault",
				name: "Scan Vault",
				description: "Scan vault for new flashcards and cleanup",
				icon: "scan",
				category: CommandCategory.GENERATION,
				requiresActiveFile: false,
				callback: async () => {
					try {
						new Notice("Scanning vault for flashcards...");
						const result =
							await this.plugin.flashcardManager.scanVault();
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
						new Notice(
							`Scan failed: ${error instanceof Error ? error.message : "Unknown error"}`
						);
					}
				},
			},
			{
				id: "show-missing-flashcards",
				name: "Show Notes Missing Flashcards",
				description: "Find notes that don't have flashcards yet",
				icon: "search",
				category: CommandCategory.GENERATION,
				requiresActiveFile: false,
				callback: () => this.plugin.showMissingFlashcards(),
			},

			// REVIEW CATEGORY
			{
				id: "start-review",
				name: "Start Review Session",
				description: "Begin reviewing with Knowledge deck",
				icon: "brain",
				category: CommandCategory.REVIEW,
				requiresActiveFile: false,
				callback: () => this.plugin.startReviewSession(),
			},
			{
				id: "start-custom-review",
				name: "Start Custom Review",
				description: "Review with custom filters",
				icon: "filter",
				category: CommandCategory.REVIEW,
				requiresActiveFile: false,
				callback: () => this.plugin.startCustomReviewSession(),
			},
			{
				id: "review-current-note",
				name: "Review Current Note",
				description: "Review flashcards from the active note",
				icon: "file-text",
				category: CommandCategory.REVIEW,
				requiresActiveFile: true,
				callback: () => this.handleReviewCurrentNote(),
			},
			{
				id: "review-todays-cards",
				name: "Review Today's Cards",
				description: "Review new cards created today",
				icon: "calendar",
				category: CommandCategory.REVIEW,
				requiresActiveFile: false,
				callback: () => this.plugin.reviewTodaysCards(),
			},

			// ANALYSIS CATEGORY
			{
				id: "open-statistics-dashboard",
				name: "View Statistics",
				description: "Open detailed statistics panel",
				icon: "bar-chart-2",
				category: CommandCategory.ANALYSIS,
				requiresActiveFile: false,
				callback: () => this.plugin.openStatsView(),
			},

			// WORKFLOW CATEGORY
			{
				id: "open-harvest-dashboard",
				name: "Open Harvest Dashboard",
				description: "Manage Seeding → Incubation → Harvest workflow",
				icon: "wheat",
				category: CommandCategory.WORKFLOW,
				requiresActiveFile: false,
				callback: () => this.plugin.openHarvestDashboard(),
			},
		];
	}

	/**
	 * Render a category section with its command buttons
	 */
	private renderCategorySection(
		container: HTMLElement,
		category: CommandCategoryConfig
	): void {
		const categoryCommands = this.commands.filter(
			(cmd) => cmd.category === category.id
		);

		if (categoryCommands.length === 0) return;

		// Category header
		container.createEl("h3", {
			text: category.name,
			cls: "episteme-command-category-title",
		});

		// Buttons grid
		const gridEl = container.createDiv({
			cls: "episteme-command-buttons-grid",
		});

		for (const command of categoryCommands) {
			const btn = gridEl.createEl("button", {
				cls: "episteme-command-btn",
			});

			// Icon + label
			btn.createSpan({
				cls: "episteme-command-btn-icon",
				text: this.getIconEmoji(command.icon),
			});

			btn.createSpan({
				cls: "episteme-command-btn-label",
				text: command.name,
			});

			// Show description on hover
			btn.title = command.description;

			btn.addEventListener("click", () => {
				void this.executeCommand(command);
				this.close();
			});
		}
	}

	/**
	 * Map Obsidian icon names to emoji
	 */
	private getIconEmoji(iconName: string): string {
		const iconMap: Record<string, string> = {
			layout: "📐",
			layers: "📚",
			sparkles: "✨",
			scan: "🔍",
			search: "🔎",
			brain: "🧠",
			filter: "🔧",
			"file-text": "📄",
			calendar: "📅",
			"bar-chart-2": "📊",
			wheat: "🌾",
			workflow: "⚙️",
		};

		return iconMap[iconName] || "⚡";
	}

	/**
	 * Execute a command with validation
	 */
	private async executeCommand(command: CommandDefinition): Promise<void> {
		// Check if command requires active file
		if (command.requiresActiveFile) {
			const activeFile = this.plugin.app.workspace.getActiveFile();
			if (!activeFile || activeFile.extension !== "md") {
				new Notice("This command requires an active markdown file");
				return;
			}
		}

		try {
			await command.callback();
		} catch (error) {
			new Notice(
				`Command failed: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Handle generate flashcards command
	 */
	private handleGenerateFlashcards(): void {
		const activeFile = this.plugin.app.workspace.getActiveFile();
		if (!activeFile || activeFile.extension !== "md") {
			new Notice("Please open a markdown file first");
			return;
		}

		// Activate panel which will show generation options
		void this.plugin.activateView();
	}

	/**
	 * Handle review current note command
	 */
	private async handleReviewCurrentNote(): Promise<void> {
		const activeFile = this.plugin.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active note");
			return;
		}

		await this.plugin.reviewCurrentNote();
	}
}
