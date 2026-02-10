import { type App, type Component, MarkdownRenderer, setIcon } from "obsidian";
import { BaseComponent } from "../../component.base";
import { renderStateBadge } from "../../components";
import type { FSRSFlashcardItem } from "../../../types";
import { formatDueDate, formatIntervalDays } from "../helpers/browser-helpers";

export interface CardDetailPanelProps {
	card: FSRSFlashcardItem | null;
	app: App;
	component: Component;
	onClose: () => void;
	onOpenSource: (path: string) => void;
	onSuspend: (cardId: string) => void;
	onUnsuspend: (cardId: string) => void;
	onDelete: (cardId: string) => void;
	onReset: (cardId: string) => void;
}

export class CardDetailPanel extends BaseComponent {
	private props: CardDetailPanelProps;

	constructor(container: HTMLElement, props: CardDetailPanelProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		const { card } = this.props;
		if (!card) return;

		this.element = this.container.createDiv({
			cls: "ep:border-t ep:border-obs-border ep:bg-obs-primary ep:flex ep:flex-col ep:h-[220px] ep:shrink-0",
		});

		this.renderHeader(card);
		this.renderContent(card);
	}

	private renderHeader(card: FSRSFlashcardItem): void {
		if (!this.element) return;

		const header = this.element.createDiv({
			cls: "ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-2 ep:border-b ep:border-obs-border ep:shrink-0",
		});

		// Close button
		const closeBtn = header.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": "Close preview" },
		});
		setIcon(closeBtn, "x");
		this.events.addEventListener(closeBtn, "click", () => this.props.onClose());

		// State badge
		renderStateBadge(header, {
			state: card.fsrs.state,
			suspended: card.fsrs.suspended,
			buriedUntil: card.fsrs.buriedUntil,
			size: "sm",
		});

		// Card type
		if (card.cardType && card.cardType !== "basic") {
			header.createSpan({
				text: card.cardType,
				cls: "ep:text-ui-smaller ep:text-obs-muted ep:uppercase",
			});
		}

		// Spacer
		header.createDiv({ cls: "ep:flex-1" });

		// Source link
		if (card.sourceNoteName && card.sourceNotePath) {
			const sourceLink = header.createEl("a", {
				text: card.sourceNoteName,
				cls: "ep:text-ui-smaller ep:text-obs-accent ep:hover:underline ep:cursor-pointer ep:truncate ep:max-w-[200px]",
			});
			this.events.addEventListener(sourceLink, "click", (e) => {
				e.preventDefault();
				if (card.sourceNotePath) this.props.onOpenSource(card.sourceNotePath);
			});
		}

		// Action buttons
		const actions = header.createDiv({ cls: "ep:flex ep:items-center ep:gap-1" });

		if (card.fsrs.suspended) {
			this.addActionButton(actions, "play", "Unsuspend", () =>
				this.props.onUnsuspend(card.id)
			);
		} else {
			this.addActionButton(actions, "pause", "Suspend", () =>
				this.props.onSuspend(card.id)
			);
		}

		this.addActionButton(actions, "rotate-ccw", "Reset", () =>
			this.props.onReset(card.id)
		);

		this.addActionButton(actions, "trash-2", "Delete", () =>
			this.props.onDelete(card.id), "danger"
		);
	}

	private addActionButton(
		container: HTMLElement,
		icon: string,
		label: string,
		onClick: () => void,
		variant?: "danger"
	): void {
		const btn = container.createEl("button", {
			cls: `clickable-icon ${variant === "danger" ? "ep:text-obs-error" : ""}`,
			attr: { "aria-label": label },
		});
		setIcon(btn, icon);
		this.events.addEventListener(btn, "click", () => onClick());
	}

	private renderContent(card: FSRSFlashcardItem): void {
		if (!this.element) return;

		const content = this.element.createDiv({
			cls: "ep:flex-1 ep:overflow-y-auto ep:min-h-0",
		});

		const inner = content.createDiv({
			cls: "ep:grid ep:grid-cols-[1fr_1fr] ep:gap-0 ep:h-full",
		});

		// Left column: Q & A
		const qaSection = inner.createDiv({
			cls: "ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:border-r ep:border-obs-border ep:overflow-y-auto",
		});

		// Question
		const qBlock = qaSection.createDiv();
		qBlock.createDiv({
			text: "Q:",
			cls: "ep:text-ui-smaller ep:font-semibold ep:text-obs-muted ep:mb-1",
		});
		const qContent = qBlock.createDiv({ cls: "ep:text-ui-small ep:text-obs-normal" });
		void MarkdownRenderer.render(
			this.props.app, card.question, qContent, "", this.props.component
		);

		// Answer
		const aBlock = qaSection.createDiv();
		aBlock.createDiv({
			text: "A:",
			cls: "ep:text-ui-smaller ep:font-semibold ep:text-obs-muted ep:mb-1",
		});
		const aContent = aBlock.createDiv({ cls: "ep:text-ui-small ep:text-obs-normal" });
		void MarkdownRenderer.render(
			this.props.app, card.answer, aContent, "", this.props.component
		);

		// Right column: Metadata grid
		const meta = inner.createDiv({
			cls: "ep:grid ep:grid-cols-2 ep:gap-x-4 ep:gap-y-1 ep:p-3 ep:content-start ep:overflow-y-auto",
		});

		const fields: [string, string][] = [
			["Due", formatDueDate(card.fsrs.due)],
			["Interval", formatIntervalDays(card.fsrs.scheduledDays)],
			["Stability", card.fsrs.stability > 0 ? `${card.fsrs.stability.toFixed(1)}d` : "-"],
			["Difficulty", card.fsrs.difficulty.toFixed(1)],
			["Lapses", String(card.fsrs.lapses)],
			["Reps", String(card.fsrs.reps)],
			["Created", card.fsrs.createdAt
				? new Date(card.fsrs.createdAt).toLocaleDateString()
				: "-"],
			["Last review", card.fsrs.lastReview
				? new Date(card.fsrs.lastReview).toLocaleDateString()
				: "-"],
			["Projects", card.projects.length > 0 ? card.projects.join(", ") : "-"],
		];

		for (const [label, value] of fields) {
			meta.createSpan({
				text: label,
				cls: "ep:text-ui-smaller ep:text-obs-muted ep:font-medium",
			});
			meta.createSpan({
				text: value,
				cls: "ep:text-ui-smaller ep:text-obs-normal",
			});
		}
	}

	updateProps(props: Partial<CardDetailPanelProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}
}

export function createCardDetailPanel(
	container: HTMLElement,
	props: CardDetailPanelProps
): CardDetailPanel {
	const panel = new CardDetailPanel(container, props);
	panel.render();
	return panel;
}
