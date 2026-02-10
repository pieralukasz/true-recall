import { App, Component, Menu, MarkdownRenderer, setIcon } from "obsidian";
import { State } from "ts-fsrs";
import { BaseComponent } from "../component.base";
import { setupLongPress, type LongPressResult } from "../utils";
import type { FlashcardItem } from "../../types";
import type { FSRSFlashcardItem } from "../../types/fsrs/card.types";
import { stripBrTags } from "../../utils";

export interface CardGroupItemProps {
	groupType: "cloze" | "reverse";
	cards: FlashcardItem[];
	fsrsCards: (FSRSFlashcardItem | undefined)[];
	template?: string;
	filePath: string;
	app: App;
	component: Component;
	isExpanded: boolean;
	isSelected: boolean;
	isSelectionMode: boolean;
	onToggleExpand?: () => void;
	onToggleSelect?: () => void;
	onEditGroup?: () => void;
	onDeleteGroup?: () => void;
	onCopyGroup?: () => void;
	onMoveGroup?: () => void;
	onSelect?: () => void;
	onLongPress?: () => void;
}

export class CardGroupItem extends BaseComponent {
	private props: CardGroupItemProps;
	private longPressHandler: LongPressResult | null = null;

	constructor(container: HTMLElement, props: CardGroupItemProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		const { isExpanded, isSelected } = this.props;

		this.element = this.container.createDiv({
			cls: `ep:flex ep:flex-col ep:mb-2 ep:rounded ep:bg-obs-secondary ep:border ep:border-obs-border ${isSelected ? "ep:border-obs-interactive ep:border-2" : ""}`,
		});

		this.renderHeader();

		if (isExpanded) {
			this.renderExpandedContent();
		}
	}

	private renderHeader(): void {
		if (!this.element) return;

		const { cards, isSelectionMode, isSelected } = this.props;

		const headerRow = this.element.createDiv({
			cls: "ep:flex ep:items-start ep:gap-2 ep:p-2 ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:rounded ep:transition-colors",
		});

		this.longPressHandler = setupLongPress(headerRow, this.events, {
			onLongPress: () => this.props.onLongPress?.(),
		});

		this.events.addEventListener(headerRow, "click", (e) => {
			if (this.longPressHandler?.didLongPress()) return;
			if ((e.target as HTMLElement).closest("button")) return;
			e.stopPropagation();

			if (isSelectionMode) {
				this.props.onToggleSelect?.();
			} else {
				this.props.onToggleExpand?.();
			}
		});

		// Checkbox in selection mode
		if (isSelectionMode) {
			const checkbox = headerRow.createEl("input", {
				type: "checkbox",
				cls: "ep:w-4 ep:h-4 ep:cursor-pointer",
			});
			checkbox.checked = isSelected;
			this.events.addEventListener(checkbox, "click", (e) => {
				e.stopPropagation();
				this.props.onToggleSelect?.();
			});
		}

		// Aggregate status dot
		const statusDotEl = headerRow.createSpan({
			cls: "ep:w-2 ep:h-2 ep:rounded-full ep:flex-shrink-0 ep:mt-1.5",
			attr: { title: this.getAggregateStatusTitle() },
		});
		statusDotEl.addClass(this.getAggregateStatusDotColor());

		// Group type icon
		const iconEl = headerRow.createSpan({
			cls: "ep:flex-shrink-0 ep:mt-0.5 ep:text-obs-faint",
		});
		setIcon(iconEl, this.props.groupType === "cloze" ? "brackets" : "arrow-left-right");

		// Group label text
		const labelEl = headerRow.createDiv({
			cls: "ep:flex-1 ep:text-ui-small ep:text-obs-normal ep:truncate",
		});
		const displayText = this.getHeaderDisplayText();
		labelEl.setText(displayText);

		// Card count badge
		headerRow.createSpan({
			cls: "ep:text-ui-smaller ep:text-obs-muted ep:bg-obs-base-25 ep:rounded ep:px-1.5 ep:py-0.5 ep:flex-shrink-0",
			text: `${cards.length}`,
		});

		// Menu button
		const menuBtn = headerRow.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": "Group actions" },
		});
		setIcon(menuBtn, "more-vertical");
		this.events.addEventListener(menuBtn, "click", (e) => {
			e.stopPropagation();
			this.showGroupMenu(e);
		});
	}

	private renderExpandedContent(): void {
		if (!this.element) return;

		const { cards, fsrsCards, filePath, app, component, groupType } = this.props;

		const contentEl = this.element.createDiv({
			cls: "ep:border-t ep:border-obs-border",
		});

		for (let i = 0; i < cards.length; i++) {
			const card = cards[i]!;
			const fsrsCard = fsrsCards[i];

			const cardRow = contentEl.createDiv({
				cls: "ep:flex ep:items-start ep:gap-2 ep:pl-6 ep:pr-2 ep:py-2 ep:border-b ep:border-obs-border last:ep:border-b-0",
			});

			// Individual status dot
			const dotEl = cardRow.createSpan({
				cls: "ep:w-2 ep:h-2 ep:rounded-full ep:flex-shrink-0 ep:mt-1.5",
			});
			dotEl.addClass(this.getCardStatusDotColor(fsrsCard));

			// Card label
			const labelEl = cardRow.createDiv({
				cls: "ep:flex-1 ep:flex ep:flex-col ep:gap-1",
			});

			if (groupType === "cloze") {
				labelEl.createSpan({
					cls: "ep:text-xs ep:text-obs-faint ep:uppercase ep:tracking-wider",
					text: `Cloze ${card.clozeIndex}`,
				});
			} else {
				labelEl.createSpan({
					cls: "ep:text-xs ep:text-obs-faint ep:uppercase ep:tracking-wider",
					text: i === 0 ? "Original" : "Reversed",
				});
			}

			const questionEl = labelEl.createDiv({
				cls: "ep:text-ui-small ep:text-obs-normal true-recall-card-markdown",
			});
			void MarkdownRenderer.render(app, stripBrTags(card.question), questionEl, filePath, component);
		}
	}

	private getHeaderDisplayText(): string {
		if (this.props.groupType === "cloze" && this.props.template) {
			// Strip cloze syntax for display: {{c1::text}} → text
			return this.props.template.replace(
				/\{\{c\d+::([^}]*?)(?:::[^}]*?)?\}\}/g,
				"$1"
			);
		}
		// Reverse group: show original question
		return this.props.cards[0]?.question ?? "";
	}

	private showGroupMenu(e: MouseEvent): void {
		const menu = new Menu();

		if (this.props.onEditGroup) {
			menu.addItem((item) => {
				item.setTitle("Edit group")
					.setIcon("pencil")
					.onClick(() => this.props.onEditGroup?.());
			});
		}

		if (this.props.onCopyGroup) {
			menu.addItem((item) => {
				item.setTitle("Copy")
					.setIcon("copy")
					.onClick(() => this.props.onCopyGroup?.());
			});
		}

		if (this.props.onMoveGroup) {
			menu.addItem((item) => {
				item.setTitle("Move")
					.setIcon("folder-input")
					.onClick(() => this.props.onMoveGroup?.());
			});
		}

		if (this.props.onDeleteGroup) {
			menu.addSeparator();
			menu.addItem((item) => {
				item.setTitle("Delete group")
					.setIcon("trash-2")
					.onClick(() => this.props.onDeleteGroup?.());
			});
		}

		if (this.props.onSelect && !this.props.isSelectionMode) {
			menu.addSeparator();
			menu.addItem((item) => {
				item.setTitle("Select")
					.setIcon("check-square")
					.onClick(() => this.props.onSelect?.());
			});
		}

		menu.showAtMouseEvent(e);
	}

	private getAggregateStatusDotColor(): string {
		const { fsrsCards } = this.props;
		// Priority: New > Learning/Relearning > Review > unknown
		let hasNew = false;
		let hasLearning = false;
		let hasReview = false;

		for (const fsrs of fsrsCards) {
			if (!fsrs) continue;
			switch (fsrs.fsrs.state) {
				case State.New: hasNew = true; break;
				case State.Learning:
				case State.Relearning: hasLearning = true; break;
				case State.Review: hasReview = true; break;
			}
		}

		if (hasNew) return "ep:bg-obs-blue";
		if (hasLearning) return "ep:bg-obs-orange";
		if (hasReview) return "ep:bg-obs-green";
		return "ep:bg-obs-base-40";
	}

	private getAggregateStatusTitle(): string {
		const { fsrsCards } = this.props;
		const counts = { new: 0, learning: 0, review: 0 };
		for (const fsrs of fsrsCards) {
			if (!fsrs) continue;
			switch (fsrs.fsrs.state) {
				case State.New: counts.new++; break;
				case State.Learning:
				case State.Relearning: counts.learning++; break;
				case State.Review: counts.review++; break;
			}
		}
		const parts: string[] = [];
		if (counts.new > 0) parts.push(`${counts.new} new`);
		if (counts.learning > 0) parts.push(`${counts.learning} learning`);
		if (counts.review > 0) parts.push(`${counts.review} review`);
		return parts.join(", ") || "Unknown";
	}

	private getCardStatusDotColor(fsrsCard?: FSRSFlashcardItem): string {
		if (!fsrsCard) return "ep:bg-obs-base-40";
		switch (fsrsCard.fsrs.state) {
			case State.New: return "ep:bg-obs-blue";
			case State.Learning:
			case State.Relearning: return "ep:bg-obs-orange";
			case State.Review: return "ep:bg-obs-green";
			default: return "ep:bg-obs-base-40";
		}
	}

	updateProps(props: Partial<CardGroupItemProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}

	destroy(): void {
		this.longPressHandler = null;
		super.destroy();
	}
}

export function createCardGroupItem(
	container: HTMLElement,
	props: CardGroupItemProps
): CardGroupItem {
	const item = new CardGroupItem(container, props);
	item.render();
	return item;
}
