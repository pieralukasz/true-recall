/**
 * Dashboard Content Component
 * Contains command buttons organized by category
 */
import { Notice } from "obsidian";
import { BaseComponent } from "../component.base";
import { CommandCategory, type CommandDefinition, type CommandCategoryConfig } from "../../types/command.types";
import type TrueRecallPlugin from "../../main";

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
		name: "Flashcard generation",
		description: "",
		icon: "sparkles",
		order: 2,
	},
	{
		id: CommandCategory.REVIEW,
		name: "Review sessions",
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
];

/**
 * Map Obsidian icon names to emoji
 */
const ICON_MAP: Record<string, string> = {
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
};

export interface DashboardContentProps {
	plugin: TrueRecallPlugin;
	onCommandExecuted: () => void;
}

/**
 * Content component for dashboard view
 */
export class DashboardContent extends BaseComponent {
	private props: DashboardContentProps;
	private commands: CommandDefinition[] = [];

	constructor(container: HTMLElement, props: DashboardContentProps) {
		super(container);
		this.props = props;
		this.initializeCommands();
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		this.element = this.container.createDiv({
			cls: "ep:flex ep:flex-col ep:gap-5",
		});

		// Render command buttons in grid layout by category
		for (const category of CATEGORIES) {
			this.renderCategorySection(category);
		}
	}

	/**
	 * Initialize all command definitions
	 */
	private initializeCommands(): void {
		const plugin = this.props.plugin;

		this.commands = [
			// PANEL CATEGORY
			{
				id: "open-flashcard-panel",
				name: "Open Flashcard Panel",
				description: "Open the main flashcard management panel",
				icon: "layers",
				category: CommandCategory.PANEL,
				requiresActiveFile: false,
				callback: () => plugin.activateView(),
			},
			{
				id: "open-statistics",
				name: "Open Statistics Panel",
				description: "View detailed learning statistics",
				icon: "bar-chart-2",
				category: CommandCategory.PANEL,
				requiresActiveFile: false,
				callback: () => plugin.openStatsView(),
			},

			// GENERATION CATEGORY
			{
				id: "generate-flashcards",
				name: "Generate flashcards",
				description: "Generate flashcards for the current note",
				icon: "sparkles",
				category: CommandCategory.GENERATION,
				requiresActiveFile: true,
				callback: () => this.handleGenerateFlashcards(),
			},
			{
				id: "scan-vault",
				name: "Scan vault",
				description: "Scan vault for new flashcards and cleanup",
				icon: "scan",
				category: CommandCategory.GENERATION,
				requiresActiveFile: false,
				callback: async () => {
					try {
						new Notice("Scanning vault for flashcards...");
						const result = await plugin.flashcardManager.scanVault();
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
			// REVIEW CATEGORY
			{
				id: "start-review",
				name: "Start Review Session",
				description: "Begin reviewing with Knowledge deck",
				icon: "brain",
				category: CommandCategory.REVIEW,
				requiresActiveFile: false,
				callback: () => plugin.startReviewSession(),
			},
			{
				id: "start-custom-review",
				name: "Start Custom Review",
				description: "Review with custom filters",
				icon: "filter",
				category: CommandCategory.REVIEW,
				requiresActiveFile: false,
				callback: () => plugin.startReviewSession(),
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
				callback: () => plugin.reviewTodaysCards(),
			},

			// ANALYSIS CATEGORY
			{
				id: "open-statistics-dashboard",
				name: "View statistics",
				description: "Open detailed statistics panel",
				icon: "bar-chart-2",
				category: CommandCategory.ANALYSIS,
				requiresActiveFile: false,
				callback: () => plugin.openStatsView(),
			},
		];
	}

	/**
	 * Render a category section with its command buttons
	 */
	private renderCategorySection(category: CommandCategoryConfig): void {
		const categoryCommands = this.commands.filter(
			(cmd) => cmd.category === category.id
		);

		if (categoryCommands.length === 0) return;

		// Category header
		this.element!.createEl("h3", {
			text: category.name,
			cls: "ep:text-ui-small ep:font-semibold ep:text-obs-muted ep:uppercase ep:tracking-wide ep:m-0 ep:mb-2",
		});

		// Buttons grid
		const gridEl = this.element!.createDiv({
			cls: "ep:grid ep:grid-cols-2 ep:gap-2.5 ep:mb-3",
		});

		for (const command of categoryCommands) {
			const btn = gridEl.createEl("button", {
				cls: "ep:flex ep:items-center ep:gap-2.5 ep:py-3.5 ep:px-4 ep:bg-obs-secondary ep:border ep:border-obs-border ep:rounded-lg ep:cursor-pointer ep:text-ui-small ep:font-medium ep:text-obs-normal ep:transition-all ep:text-left ep:hover:bg-obs-modifier-hover ep:hover:border-obs-interactive ep:hover:-translate-y-px ep:active:translate-y-0",
			});

			// Icon + label
			btn.createSpan({
				cls: "ep:text-xl ep:shrink-0",
				text: ICON_MAP[command.icon] || "⚡",
			});

			btn.createSpan({
				cls: "ep:flex-1",
				text: command.name,
			});

			// Show description on hover
			btn.title = command.description;

			this.events.addEventListener(btn, "click", () => {
				void this.executeCommand(command);
			});
		}
	}

	/**
	 * Execute a command with validation
	 */
	private async executeCommand(command: CommandDefinition): Promise<void> {
		// Check if command requires active file
		if (command.requiresActiveFile) {
			const activeFile = this.props.plugin.app.workspace.getActiveFile();
			if (!activeFile || activeFile.extension !== "md") {
				new Notice("This command requires an active markdown file");
				return;
			}
		}

		try {
			await command.callback();
			this.props.onCommandExecuted();
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
		const activeFile = this.props.plugin.app.workspace.getActiveFile();
		if (!activeFile || activeFile.extension !== "md") {
			new Notice("Please open a markdown file first");
			return;
		}

		// Activate panel which will show generation options
		void this.props.plugin.activateView();
	}

	/**
	 * Handle review current note command
	 */
	private async handleReviewCurrentNote(): Promise<void> {
		const activeFile = this.props.plugin.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice("No active note");
			return;
		}

		await this.props.plugin.reviewCurrentNote();
	}
}
