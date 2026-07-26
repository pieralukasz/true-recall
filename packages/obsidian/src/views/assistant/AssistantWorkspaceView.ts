import { ItemView, type ViewStateResult, type WorkspaceLeaf } from "obsidian";
import { h } from "preact";

import { VIEW_TYPE_ASSISTANT_WORKSPACE } from "@true-recall/core/constants";

import type { AIWorkspaceMode } from "@true-recall/obsidian/features/assistant/ui/ai-workspace-modes";
import { mountPreact } from "@true-recall/obsidian/preact";

import type TrueRecallPlugin from "../../main";
import { AssistantWorkspaceApp } from "./AssistantWorkspaceApp";

interface AssistantWorkspaceViewState extends Record<string, unknown> {
	mode?: AIWorkspaceMode;
}

/** Docked home for the AI workspace, normally in the right sidebar next to the
 * review. Context comes from the workspace itself, not from an opening
 * snapshot, so the view stays useful across a whole study session. */
export class AssistantWorkspaceView extends ItemView {
	private unmountPreact: (() => void) | null = null;
	private mode: AIWorkspaceMode = "assistant";

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: TrueRecallPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_ASSISTANT_WORKSPACE;
	}

	getDisplayText(): string {
		return "Ask AI";
	}

	getIcon(): string {
		return "wand";
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const nextMode = (state as AssistantWorkspaceViewState | null)?.mode;
		if (nextMode && nextMode !== this.mode) {
			this.mode = nextMode;
			this.render();
		}
		await super.setState(state, result);
	}

	onOpen(): Promise<void> {
		this.render();
		return Promise.resolve();
	}

	onClose(): Promise<void> {
		this.unmountPreact?.();
		this.unmountPreact = null;
		return Promise.resolve();
	}

	private render(): void {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		this.unmountPreact?.();
		container.empty();
		container.addClasses(["ep:h-full", "ep:overflow-hidden"]);
		this.unmountPreact = mountPreact(
			container,
			this.plugin,
			h(AssistantWorkspaceApp, { initialMode: this.mode }),
		);
	}
}
