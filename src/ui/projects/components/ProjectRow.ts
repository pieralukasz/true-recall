import { type App, type Component, MarkdownRenderer, Platform, setIcon } from "obsidian";
import { BaseComponent } from "../../component.base";
import { setupLongPress } from "../../utils/long-press";
import {
	showProjectContextMenu,
	type ProjectContextAction,
} from "../helpers/project-context-menu";
import type { ProjectInfo } from "../../../types";

export interface ProjectRowProps {
	project: ProjectInfo;
	depth: number;
	isExpanded: boolean;
	app: App;
	component: Component;
	onToggleExpand: (id: string) => void;
	onContextAction: (action: ProjectContextAction, project: ProjectInfo) => void;
}

export class ProjectRow extends BaseComponent {
	private props: ProjectRowProps;

	constructor(container: HTMLElement, props: ProjectRowProps) {
		super(container);
		this.props = props;
	}

	render(): void {
		if (this.element) {
			this.element.remove();
			this.events.cleanup();
		}

		const { project, depth, isExpanded } = this.props;
		const hasCards = project.cardCount > 0;
		const totalDue = project.newCount + project.learningCount + project.dueCount;

		this.element = this.container.createDiv({
			cls: `ep-project-row ep:flex ep:items-center ep:gap-2 ep:py-2.5 ep:px-3 ep:cursor-pointer ep:transition-colors ep:hover:bg-obs-modifier-hover${!hasCards ? " ep:opacity-60" : ""}`,
			attr: { "data-project-id": project.id },
		});

		if (depth > 0) {
			this.element.addClass("ep-tree-indent");
			this.element.style.setProperty("--ep-indent", `${12 + depth * 20}px`);
		}

		// Drag handle (desktop only, visible on hover)
		if (!Platform.isMobile) {
			const handle = this.element.createDiv({
				cls: "ep-drag-handle ep:flex ep:items-center ep:justify-center ep:w-4 ep:h-4 ep:shrink-0 ep:text-obs-faint [&_svg]:ep:w-3 [&_svg]:ep:h-3",
			});
			setIcon(handle, "grip-vertical");
		}

		// Folder icon
		const folderIcon = this.element.createDiv({
			cls: "ep:flex ep:items-center ep:justify-center ep:w-4 ep:h-4 ep:shrink-0 ep:text-obs-muted [&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5",
		});
		setIcon(folderIcon, isExpanded ? "folder-open" : "folder");

		// Project name (wiki-link)
		const nameEl = this.element.createDiv({
			cls: "ep:flex-1 ep:min-w-0 ep:text-ui-small ep:font-medium ep:text-obs-normal ep:leading-snug ep:truncate [&_p]:ep:m-0 [&_p]:ep:inline [&_a.internal-link]:ep:text-obs-normal [&_a.internal-link]:ep:no-underline [&_a.internal-link:hover]:ep:text-obs-link [&_a.internal-link:hover]:ep:underline",
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

		// Due count badge (right side)
		if (totalDue > 0) {
			this.element.createDiv({
				text: String(totalDue),
				cls: "ep:text-ui-smaller ep:font-semibold ep:text-obs-accent ep:shrink-0",
			});
		}

		const iconBtnCls =
			"clickable-icon ep:cursor-pointer ep:w-6 ep:h-6 ep:flex ep:items-center ep:justify-center ep:rounded-md ep:text-obs-muted ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:transition-colors [&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5";

		// Play button (only if project has due cards)
		if (totalDue > 0) {
			const playBtn = this.element.createEl("button", {
				cls: iconBtnCls,
				attr: { "aria-label": "Start review" },
			});
			setIcon(playBtn, "play");
			this.events.addEventListener(playBtn, "click", (e) => {
				e.stopPropagation();
				this.props.onContextAction("review", project);
			});
		}

		// More actions button
		const moreBtn = this.element.createEl("button", {
			cls: iconBtnCls,
			attr: { "aria-label": "More actions" },
		});
		setIcon(moreBtn, "more-horizontal");
		this.events.addEventListener(moreBtn, "click", (e) => {
			e.stopPropagation();
			const rect = moreBtn.getBoundingClientRect();
			this.showContextMenu({ x: rect.left, y: rect.bottom });
		});

		// Click to expand/collapse
		this.events.addEventListener(this.element, "click", (e) => {
			if ((e.target as HTMLElement).closest("a")) return;
			if ((e.target as HTMLElement).closest(".ep-drag-handle")) return;
			this.props.onToggleExpand(project.id);
		});

		// Context menu (right-click on desktop)
		this.events.addEventListener(this.element, "contextmenu", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.showContextMenu(e);
		});

		// Long press for mobile context menu
		if (Platform.isMobile) {
			setupLongPress(this.element, this.events, {
				onLongPress: () => {
					const rect = this.element!.getBoundingClientRect();
					this.showContextMenu({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
				},
			});
		}
	}

	private showContextMenu(event: MouseEvent | { x: number; y: number }): void {
		const { project } = this.props;
		showProjectContextMenu(event, {
			project,
			hasCards: project.cardCount > 0,
			onAction: (action) => this.props.onContextAction(action, project),
		});
	}

	updateProps(props: Partial<ProjectRowProps>): void {
		this.props = { ...this.props, ...props };
		this.render();
	}
}

export function createProjectRow(
	container: HTMLElement,
	props: ProjectRowProps
): ProjectRow {
	const row = new ProjectRow(container, props);
	row.render();
	return row;
}
