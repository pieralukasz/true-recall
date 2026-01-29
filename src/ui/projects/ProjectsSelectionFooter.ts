/**
 * Projects Selection Footer Component
 * Shows Anki-style card counts and "Review Selected" action button
 */
import { setIcon } from "obsidian";
import { BaseComponent } from "../component.base";

export interface ProjectsSelectionFooterProps {
	newCount: number;
	learningCount: number;
	dueCount: number;
	onReviewSelected?: () => void;
	onExitSelectionMode?: () => void;
}

/**
 * Footer for selection mode with review action
 */
export class ProjectsSelectionFooter extends BaseComponent {
	private props: ProjectsSelectionFooterProps;

	constructor(container: HTMLElement, props: ProjectsSelectionFooterProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		const { newCount, learningCount, dueCount, onReviewSelected, onExitSelectionMode } =
			this.props;

		this.element = this.container.createDiv({
			cls: "ep:flex ep:items-center ep:justify-between ep:py-2 ep:px-3 ep:border-t ep:border-obs-border ep:bg-obs-secondary",
		});

		// Left side: Cancel button and Anki-style counts
		const leftSide = this.element.createDiv({
			cls: "ep:flex ep:items-center ep:gap-2",
		});

		// Cancel button
		const cancelBtn = leftSide.createEl("button", {
			cls: "clickable-icon",
			attr: { "aria-label": "Cancel selection" },
		});
		setIcon(cancelBtn, "x");
		this.events.addEventListener(cancelBtn, "click", () => {
			onExitSelectionMode?.();
		});

		// Anki-style colored counts (New · Learning · Due)
		const countsEl = leftSide.createSpan({
			cls: "ep:flex ep:items-center ep:gap-1 ep:font-medium ep:text-ui-small",
		});

		// New count (blue)
		countsEl.createSpan({
			text: String(newCount),
			cls: "ep:text-blue-500",
		});

		countsEl.createSpan({ text: "·", cls: "ep:text-obs-faint" });

		// Learning count (orange)
		countsEl.createSpan({
			text: String(learningCount),
			cls: "ep:text-orange-500",
		});

		countsEl.createSpan({ text: "·", cls: "ep:text-obs-faint" });

		// Due count (green)
		countsEl.createSpan({
			text: String(dueCount),
			cls: "ep:text-green-500",
		});

		// Right side: Review Selected button
		if (onReviewSelected) {
			const btnBase =
				"ep:flex ep:items-center ep:gap-1.5 ep:px-3 ep:py-1.5 ep:rounded ep:text-ui-small ep:font-medium ep:border-none ep:cursor-pointer ep:transition-colors";

			const reviewBtn = this.element.createEl("button", {
				cls: `${btnBase} mod-cta`,
			});

			const iconEl = reviewBtn.createSpan({ cls: "ep:flex ep:items-center" });
			setIcon(iconEl, "play");
			reviewBtn.createSpan({ text: "Review Selected" });

			const totalCards = newCount + learningCount + dueCount;
			if (totalCards === 0) {
				reviewBtn.disabled = true;
				reviewBtn.classList.add("ep:opacity-50", "ep:cursor-not-allowed");
			} else {
				this.events.addEventListener(reviewBtn, "click", () =>
					onReviewSelected()
				);
			}
		}
	}

	updateProps(props: Partial<ProjectsSelectionFooterProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}
}

export function createProjectsSelectionFooter(
	container: HTMLElement,
	props: ProjectsSelectionFooterProps
): ProjectsSelectionFooter {
	const footer = new ProjectsSelectionFooter(container, props);
	footer.render();
	return footer;
}
