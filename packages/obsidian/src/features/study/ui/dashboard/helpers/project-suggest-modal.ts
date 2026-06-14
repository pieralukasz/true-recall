import type { App } from "obsidian";
import { SuggestModal } from "obsidian";

import type { HierarchyTreeNode } from "@true-recall/core/services/notes/hierarchy.service";

export type ProjectChoice =
	| { kind: "existing"; node: HierarchyTreeNode }
	| { kind: "create"; name: string };

export class ProjectSuggestModal extends SuggestModal<ProjectChoice> {
	private resolve: ((choice: ProjectChoice | null) => void) | null = null;

	constructor(
		app: App,
		private nodes: HierarchyTreeNode[],
	) {
		super(app);
		this.setPlaceholder("Choose or create a project...");
	}

	openAndWait(): Promise<ProjectChoice | null> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}

	onClose(): void {
		this.resolve?.(null);
		this.resolve = null;
	}

	// Obsidian's SuggestModal calls close() (firing onClose) BEFORE
	// onChooseSuggestion, which would resolve the promise with null first.
	// Resolve here, before the base class closes the modal.
	selectSuggestion(item: ProjectChoice, evt: MouseEvent | KeyboardEvent): void {
		this.resolve?.(item);
		this.resolve = null;
		super.selectSuggestion(item, evt);
	}

	getSuggestions(query: string): ProjectChoice[] {
		const q = query.toLowerCase().trim();
		const existing: ProjectChoice[] = (
			q
				? this.nodes.filter((n) => n.name.toLowerCase().includes(q))
				: this.nodes
		).map((node) => ({ kind: "existing", node }));

		if (q && !this.nodes.some((n) => n.name.toLowerCase() === q)) {
			existing.push({ kind: "create", name: query.trim() });
		}

		return existing;
	}

	renderSuggestion(item: ProjectChoice, el: HTMLElement): void {
		if (item.kind === "create") {
			el.addClass("mod-complex");
			const content = el.createDiv({ cls: "suggestion-content" });
			content.createDiv({
				cls: "suggestion-title",
				text: `Create "${item.name}"`,
			});
			content.createDiv({
				cls: "suggestion-note",
				text: "New project",
			});
		} else {
			el.setText(item.node.name);
		}
	}

	onChooseSuggestion(item: ProjectChoice): void {
		this.resolve?.(item);
		this.resolve = null;
	}
}

export function flattenNodes(nodes: HierarchyTreeNode[]): HierarchyTreeNode[] {
	const result: HierarchyTreeNode[] = [];
	const walk = (list: HierarchyTreeNode[]) => {
		for (const n of list) {
			result.push(n);
			walk(n.children);
		}
	};
	walk(nodes);
	return result;
}
