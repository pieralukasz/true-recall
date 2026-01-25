/**
 * Project Item Component
 * Displays a single project with stats and actions
 */
import { setIcon, MarkdownRenderer, type App, type Component } from "obsidian";
import { BaseComponent } from "../component.base";
import type { ProjectInfo } from "../../types";

export interface ProjectItemProps {
	project: ProjectInfo;
	app: App;
	component: Component;
	onStartReview: (projectName: string) => void;
	onDelete: (projectId: string) => void;
	onAddNotes: (projectId: string, projectName: string) => void;
}

/**
 * Single project item component
 */
export class ProjectItem extends BaseComponent {
	private props: ProjectItemProps;

	constructor(container: HTMLElement, props: ProjectItemProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		const { project } = this.props;
		const isEmpty = project.noteCount === 0;
		const baseCls =
			"ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:bg-obs-secondary ep:rounded-md ep:border ep:border-obs-border ep:transition-all ep:hover:border-obs-interactive";
		const emptyCls = isEmpty ? "ep:opacity-70 ep:hover:opacity-100" : "";

		this.element = this.container.createDiv({
			cls: `${baseCls} ${emptyCls}`,
		});

		// Project icon and name row
		const nameRow = this.element.createDiv({
			cls: "ep:flex ep:items-center ep:gap-2",
		});

		const iconEl = nameRow.createSpan({
			cls: "ep:text-obs-muted ep:shrink-0 ep:flex ep:items-center [&_svg]:ep:w-4 [&_svg]:ep:h-4",
		});
		setIcon(iconEl, "folder");

		// Project name as clickable wiki link
		const nameEl = nameRow.createSpan({
			cls: "ep:text-sm ep:font-medium ep:text-obs-normal ep:flex-1 ep:min-w-0 ep:overflow-hidden [&_p]:ep:m-0 [&_p]:ep:inline [&_a.internal-link]:ep:text-link [&_a.internal-link]:ep:cursor-pointer [&_a.internal-link]:ep:no-underline [&_a.internal-link:hover]:ep:underline",
		});
		void MarkdownRenderer.render(
			this.props.app,
			`[[${project.name}]]`,
			nameEl,
			"",
			this.props.component
		);

		// Handle internal link clicks
		this.events.addEventListener(nameEl, "click", (e) => {
			const target = e.target as HTMLElement;
			const linkEl = target.closest("a.internal-link");
			if (!linkEl) return;

			e.preventDefault();
			e.stopPropagation();
			const href = linkEl.getAttribute("data-href");
			if (href) {
				void this.props.app.workspace.openLinkText(href, "", false);
			}
		});

		// Stats row - inline text with · separators
		const statsRow = this.element.createDiv({
			cls: "ep:text-xs ep:text-obs-muted",
		});

		const noteCountText =
			project.noteCount === 1 ? "1 note" : `${project.noteCount} notes`;
		statsRow.createSpan({ text: noteCountText });

		statsRow.createSpan({ text: "·", cls: "ep:mx-1.5 ep:text-obs-faint" });

		const cardCountText =
			project.cardCount === 1 ? "1 card" : `${project.cardCount} cards`;
		statsRow.createSpan({ text: cardCountText });

		// Actions row - icon buttons left, Review right
		const actionsRow = this.element.createDiv({
			cls: "ep:flex ep:flex-row ep:items-center ep:gap-1.5",
		});

		// Left side: icon buttons
		const actionsLeft = actionsRow.createDiv({
			cls: "ep:flex ep:items-center ep:gap-1",
		});

		const iconBtnCls =
			"ep:inline-flex ep:items-center ep:justify-center ep:w-7 ep:h-7 ep:border-none ep:rounded ep:bg-obs-modifier-hover ep:text-obs-muted ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-border ep:hover:text-obs-normal [&_svg]:ep:w-4 [&_svg]:ep:h-4";

		// Add notes button
		const addNotesBtn = actionsLeft.createEl("button", {
			cls: `${iconBtnCls} clickable-icon`,
			attr: { "aria-label": "Add notes to project" },
		});
		setIcon(addNotesBtn, "plus");
		this.events.addEventListener(addNotesBtn, "click", (e) => {
			e.stopPropagation();
			this.props.onAddNotes(project.id, project.name);
		});

		// Delete button
		const deleteBtn = actionsLeft.createEl("button", {
			cls: `${iconBtnCls} clickable-icon ep:hover:bg-red-500/15 ep:hover:text-red-500`,
			attr: { "aria-label": "Delete" },
		});
		setIcon(deleteBtn, "trash-2");
		this.events.addEventListener(deleteBtn, "click", (e) => {
			e.stopPropagation();
			this.props.onDelete(project.id);
		});

		// Spacer
		actionsRow.createDiv({ cls: "ep:flex-1" });

		// Start Review button (only if has cards)
		if (project.cardCount > 0) {
			const reviewBtn = actionsRow.createEl("button", {
				cls: "ep:inline-flex ep:items-center ep:gap-1 ep:h-7 ep:px-2.5 ep:border-none ep:rounded ep:bg-obs-modifier-hover ep:text-obs-normal ep:text-xs ep:font-medium ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-border [&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5",
			});
			setIcon(reviewBtn, "play");
			reviewBtn.createSpan({ text: "Review" });
			this.events.addEventListener(reviewBtn, "click", (e) => {
				e.stopPropagation();
				this.props.onStartReview(project.name);
			});
		}
	}

	updateProps(props: Partial<ProjectItemProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}
}

/**
 * Factory function to create ProjectItem
 */
export function createProjectItem(
	container: HTMLElement,
	props: ProjectItemProps
): ProjectItem {
	const item = new ProjectItem(container, props);
	item.render();
	return item;
}
