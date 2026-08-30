import { Menu } from "obsidian";
import { useCallback, useRef } from "preact/hooks";

import {
	describePolishRunMode,
	isCardPolishAvailable,
	listCardPolishWorkflows,
} from "@true-recall/obsidian/features/library/ui/panel/utils/card-polish.utils";
import { usePlugin } from "@true-recall/obsidian/preact";

import { useSelectionActions } from "./useSelectionActions";

/** One preset menu for every bulk "Polish with AI" entry point (selection
 * toolbar icon, actions-bar More… item), so they cannot drift apart. */
export function usePolishPresetMenu() {
	const plugin = usePlugin();
	const actions = useSelectionActions();
	const workflows = isCardPolishAvailable(plugin.settings)
		? listCardPolishWorkflows(plugin.settings)
		: [];
	const workflowsRef = useRef(workflows);
	const actionsRef = useRef(actions);
	workflowsRef.current = workflows;
	actionsRef.current = actions;

	const openPolishMenu = useCallback((event: MouseEvent) => {
		const menu = new Menu();
		for (const workflow of workflowsRef.current) {
			menu.addItem((item) =>
				item
					.setTitle(`${workflow.name} (${describePolishRunMode(workflow)})`)
					.setIcon("wand")
					.onClick(
						() => void actionsRef.current.handlePolishSelected(workflow),
					),
			);
		}
		menu.showAtMouseEvent(event);
	}, []);

	return { hasPolishPresets: workflows.length > 0, openPolishMenu };
}
