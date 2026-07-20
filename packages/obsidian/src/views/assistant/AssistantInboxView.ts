import { ItemView, type WorkspaceLeaf } from "obsidian";
import { h } from "preact";

import { VIEW_TYPE_ASSISTANT_INBOX } from "@true-recall/core/constants";

import { mountPreact } from "@true-recall/obsidian/preact";

import type TrueRecallPlugin from "../../main";
import { AssistantInboxApp } from "./AssistantInboxApp";

export class AssistantInboxView extends ItemView {
	private unmountPreact: (() => void) | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: TrueRecallPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_ASSISTANT_INBOX;
	}

	getDisplayText(): string {
		return "AI Inbox";
	}

	getIcon(): string {
		return "sparkles";
	}

	onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (container instanceof HTMLElement) {
			container.empty();
			container.addClasses(["ep:h-full", "ep:overflow-y-auto"]);
			this.unmountPreact = mountPreact(
				container,
				this.plugin,
				h(AssistantInboxApp, {}),
			);
		}
		return Promise.resolve();
	}

	onClose(): Promise<void> {
		this.unmountPreact?.();
		this.unmountPreact = null;
		return Promise.resolve();
	}
}
