import { describe, expect, it } from "vitest";

import type { HierarchyTreeNode } from "@true-recall/core/services/notes/hierarchy.service";

import {
	type ProjectChoice,
	ProjectSuggestModal,
} from "../../../../../src/features/study/ui/dashboard/helpers/project-suggest-modal";

function makeNode(name: string): HierarchyTreeNode {
	return {
		path: `${name}.md`,
		name,
		treePath: `${name}.md`,
		children: [],
		memberPaths: [],
	};
}

describe("ProjectSuggestModal", () => {
	it("resolves openAndWait with the chosen project when a suggestion is selected", async () => {
		const node = makeNode("Electricity");
		const modal = new ProjectSuggestModal(undefined as never, [node]);

		const promise = modal.openAndWait();
		// Obsidian's SuggestModal fires onClose (via close()) BEFORE
		// onChooseSuggestion when the user picks a suggestion.
		const choice: ProjectChoice = { kind: "existing", node };
		modal.selectSuggestion(choice, {} as KeyboardEvent);

		await expect(promise).resolves.toEqual(choice);
	});

	it("resolves openAndWait with null when the modal is dismissed without a choice", async () => {
		const modal = new ProjectSuggestModal(undefined as never, [
			makeNode("Electricity"),
		]);

		const promise = modal.openAndWait();
		modal.close();

		await expect(promise).resolves.toBeNull();
	});
});
