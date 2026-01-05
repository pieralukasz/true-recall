/**
 * Harvest Dashboard Modal
 * Shows temporary cards ready to harvest with maturity indicators
 * Part of the Seeding → Incubation → Harvest workflow
 */
import { App, Component, MarkdownRenderer } from "obsidian";
import type { FSRSFlashcardItem } from "../../types";
import type { HarvestService, HarvestableCard, HarvestStats } from "../../services";
import { BaseModal } from "./BaseModal";

export interface HarvestDashboardResult {
	cancelled: boolean;
	selectedCardIds: string[];
	action: "move" | "review" | null;
}

export interface HarvestDashboardOptions {
	harvestService: HarvestService;
	allCards: FSRSFlashcardItem[];
	flashcardsFolder: string;
}

/**
 * Modal showing temporary cards with harvest readiness indicators
 */
export class HarvestDashboardModal extends BaseModal {
	private options: HarvestDashboardOptions;
	private resolvePromise: ((result: HarvestDashboardResult) => void) | null = null;
	private selectedCardIds: Set<string> = new Set();
	private harvestableCards: HarvestableCard[] = [];
	private hasSelected = false;
	private component: Component;

	constructor(app: App, options: HarvestDashboardOptions) {
		super(app, { title: "Harvest Dashboard", width: "600px" });
		this.options = options;
		this.harvestableCards = options.harvestService.getHarvestableCards(options.allCards);
		this.component = new Component();
	}

	/**
	 * Open modal and return promise with selection result
	 */
	async openAndWait(): Promise<HarvestDashboardResult> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
			this.open();
		});
	}

	onOpen(): void {
		this.component.load();
		super.onOpen();
		this.contentEl.addClass("episteme-harvest-dashboard-modal");
	}

	onClose(): void {
		this.component.unload();
		const { contentEl } = this;
		contentEl.empty();

		if (!this.hasSelected && this.resolvePromise) {
			this.resolvePromise({
				cancelled: true,
				selectedCardIds: [],
				action: null,
			});
			this.resolvePromise = null;
		}
	}

	protected renderBody(container: HTMLElement): void {
		// Stats summary
		const stats = this.options.harvestService.getHarvestStats(this.options.allCards);
		this.renderStats(container, stats);

		// Ready to harvest section
		const readyCards = this.harvestableCards.filter((h) => h.isReady);
		if (readyCards.length > 0) {
			this.renderSection(container, "Ready to Harvest 🌾", readyCards, true);
		}

		// Incubating section
		const incubating = this.harvestableCards.filter((h) => !h.isReady);
		if (incubating.length > 0) {
			this.renderSection(container, "Still Incubating ⏳", incubating, false);
		}

		// Empty state
		if (this.harvestableCards.length === 0) {
			container.createDiv({
				cls: "episteme-harvest-empty",
				text: "No temporary cards found. Seed some flashcards from Literature Notes to get started!",
			});
		}

		// Action buttons
		this.renderActions(container);
	}

	private renderStats(container: HTMLElement, stats: HarvestStats): void {
		const statsEl = container.createDiv({ cls: "episteme-harvest-stats" });

		const statItems = [
			{ text: `🌱 ${stats.totalTemporary} seeds planted`, cls: "" },
			{ text: `🌾 ${stats.readyToHarvest} ready to harvest`, cls: stats.readyToHarvest > 0 ? "episteme-harvest-stat--ready" : "" },
			{ text: `⏳ ${stats.incubating} incubating`, cls: "" },
			{ text: `📊 ${stats.averageMaturity}% avg maturity`, cls: "" },
		];

		for (const item of statItems) {
			statsEl.createDiv({
				cls: `episteme-harvest-stat ${item.cls}`,
				text: item.text,
			});
		}
	}

	private renderSection(
		container: HTMLElement,
		title: string,
		cards: HarvestableCard[],
		selectable: boolean
	): void {
		const section = container.createDiv({ cls: "episteme-harvest-section" });
		section.createEl("h3", { text: title });

		const list = section.createDiv({ cls: "episteme-harvest-list" });

		for (const { card, maturityPercentage, daysUntilHarvest, isReady } of cards) {
			const row = list.createDiv({ cls: "episteme-harvest-row" });

			// Checkbox for ready cards
			if (selectable) {
				const checkbox = row.createEl("input", { type: "checkbox" });
				checkbox.checked = this.selectedCardIds.has(card.id);
				checkbox.addEventListener("change", () => {
					if (checkbox.checked) {
						this.selectedCardIds.add(card.id);
					} else {
						this.selectedCardIds.delete(card.id);
					}
					this.updateActionButtons();
				});
			}

			// Card preview
			const preview = row.createDiv({ cls: "episteme-harvest-preview" });

			// Question with markdown rendering
			const questionEl = preview.createDiv({ cls: "episteme-harvest-question" });
			const questionContent = questionEl.createDiv({ cls: "episteme-md-content" });
			// Strip <br> tags and render markdown
			const cleanQuestion = card.question.replace(/<br\s*\/?>/gi, "\n");
			void MarkdownRenderer.render(
				this.app,
				cleanQuestion,
				questionContent,
				this.options.flashcardsFolder,
				this.component
			);

			preview.createDiv({
				cls: "episteme-harvest-source",
				text: card.sourceNoteName ?? "Unknown source",
			});

			// Maturity indicator
			const maturityEl = row.createDiv({ cls: "episteme-harvest-maturity" });
			const bar = maturityEl.createDiv({ cls: "episteme-maturity-bar" });
			const fill = bar.createDiv({ cls: "episteme-maturity-fill" });
			fill.style.width = `${maturityPercentage}%`;

			if (isReady) {
				fill.classList.add("episteme-maturity-ready");
				maturityEl.createSpan({
					text: "Ready!",
					cls: "episteme-maturity-label episteme-maturity-label--ready",
				});
			} else {
				maturityEl.createSpan({
					text: `${daysUntilHarvest}d to go`,
					cls: "episteme-maturity-label",
				});
			}
		}
	}

	private moveSelectedBtnEl: HTMLButtonElement | null = null;

	private renderActions(container: HTMLElement): void {
		const actionsEl = container.createDiv({ cls: "episteme-harvest-actions" });

		// Move selected button
		this.moveSelectedBtnEl = actionsEl.createEl("button", {
			cls: "episteme-btn-primary",
			text: "Move Selected to Permanent Notes",
		});
		this.moveSelectedBtnEl.disabled = true;
		this.moveSelectedBtnEl.addEventListener("click", () => {
			if (this.selectedCardIds.size === 0) return;
			this.hasSelected = true;
			this.resolvePromise?.({
				cancelled: false,
				selectedCardIds: Array.from(this.selectedCardIds),
				action: "move",
			});
			this.resolvePromise = null;
			this.close();
		});

		// Review ready button (only if there are ready cards)
		const readyCount = this.harvestableCards.filter((h) => h.isReady).length;
		if (readyCount > 0) {
			const reviewBtn = actionsEl.createEl("button", {
				cls: "episteme-btn-secondary",
				text: `Review Ready Cards (${readyCount})`,
			});
			reviewBtn.addEventListener("click", () => {
				this.hasSelected = true;
				this.resolvePromise?.({
					cancelled: false,
					selectedCardIds: [],
					action: "review",
				});
				this.resolvePromise = null;
				this.close();
			});
		}
	}

	private updateActionButtons(): void {
		if (this.moveSelectedBtnEl) {
			const count = this.selectedCardIds.size;
			this.moveSelectedBtnEl.disabled = count === 0;
			this.moveSelectedBtnEl.textContent = count === 0
				? "Move Selected to Permanent Notes"
				: `Move Selected (${count}) to Permanent Notes`;
		}
	}
}
