/**
 * Missing Flashcards Header Component
 * Displays title and count of notes missing flashcards
 */
import { BaseComponent } from "../component.base";

export interface MissingFlashcardsHeaderProps {
	count: number;
	isLoading: boolean;
}

/**
 * Header component for missing flashcards view
 */
export class MissingFlashcardsHeader extends BaseComponent {
	private props: MissingFlashcardsHeaderProps;

	constructor(container: HTMLElement, props: MissingFlashcardsHeaderProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		this.element = this.container.createDiv({
			cls: "episteme-missing-flashcards-header",
		});

		// Title row
		const titleRow = this.element.createDiv({
			cls: "episteme-missing-flashcards-title-row",
		});

		titleRow.createSpan({
			cls: "episteme-missing-flashcards-title",
			text: "Missing Flashcards",
		});

		// Summary section
		const summaryEl = this.element.createDiv({
			cls: "episteme-missing-summary",
		});

		if (this.props.isLoading) {
			summaryEl.createDiv({
				text: "Scanning vault...",
				cls: "episteme-missing-label",
			});
		} else {
			summaryEl.createDiv({
				text: this.props.count.toString(),
				cls: "episteme-missing-count",
			});
			summaryEl.createDiv({
				text: this.props.count === 1 ? "note needs flashcards" : "notes need flashcards",
				cls: "episteme-missing-label",
			});
		}
	}

	updateProps(props: Partial<MissingFlashcardsHeaderProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}
}
