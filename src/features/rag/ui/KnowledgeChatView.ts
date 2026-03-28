import { RagChatService } from "@features/rag/services/rag-chat.service";
import { RagEmbeddingService } from "@features/rag/services/rag-embedding.service";
import { RagQueryService } from "@features/rag/services/rag-query.service";
import { RagSearchService } from "@features/rag/services/rag-search.service";
import { VIEW_TYPE_KNOWLEDGE_CHAT } from "@shared/constants";
import { mountPreact } from "@shared/ui/preact";
import { ItemView, type WorkspaceLeaf } from "obsidian";
import { h } from "preact";
import type TrueRecallPlugin from "../../../main";
import { KnowledgeChatApp } from "./KnowledgeChatApp";

export class KnowledgeChatView extends ItemView {
	private plugin: TrueRecallPlugin;
	private unmountPreact?: () => void;
	chatService: RagChatService | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_KNOWLEDGE_CHAT;
	}

	getDisplayText(): string {
		return "Knowledge Chat";
	}

	getIcon(): string {
		return "message-circle";
	}

	async onOpen(): Promise<void> {
		const s = this.plugin.settings;
		if (s.proKey && s.ragEnabled && this.plugin.ragActions) {
			const rag = this.plugin.ragActions;
			const embedder = new RagEmbeddingService(s.proKey);
			const search = new RagSearchService(rag, embedder);
			const query = new RagQueryService(
				search,
				() => this.plugin.settings,
				this.plugin.frontmatterIndex,
			);
			this.chatService = new RagChatService(query);
			this.plugin.ragIndexer?.setSearchService(search);
		}

		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		container.empty();
		container.addClasses(["ep:h-full", "ep:overflow-hidden"]);

		this.unmountPreact = mountPreact(
			container,
			this.plugin,
			h(KnowledgeChatApp, { view: this }),
		);
	}

	async onClose(): Promise<void> {
		this.unmountPreact?.();
	}
}
