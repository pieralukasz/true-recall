/** @jsxImportSource react */
import { ItemView, type WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";

import { VIEW_TYPE_AI_CHAT } from "@true-recall/core/constants";

import type TrueRecallPlugin from "../../main";
import { ChatApp } from "./ui/ChatApp";

/** The chat is a React 19 island (assistant-ui needs real React); the rest of the plugin stays Preact. */
export class AiChatView extends ItemView {
	private root: Root | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: TrueRecallPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_AI_CHAT;
	}

	getDisplayText(): string {
		return "AI chat";
	}

	getIcon(): string {
		return "sparkles";
	}

	onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		const controller = this.plugin.aiChat;
		if (container instanceof HTMLElement) {
			container.empty();
			container.addClass("tr-ai-chat-host");
			if (!controller) {
				container.createDiv({
					cls: "tr-ai-chat__muted",
					text: "True Recall is still loading.",
				});
				return Promise.resolve();
			}
			this.root = createRoot(container);
			this.root.render(
				<ChatApp plugin={this.plugin} controller={controller} />,
			);
		}
		// An empty chat follows the note the user opens.
		this.registerEvent(
			this.app.workspace.on("file-open", () => controller?.followActiveNote()),
		);
		return Promise.resolve();
	}

	onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
		return Promise.resolve();
	}
}
