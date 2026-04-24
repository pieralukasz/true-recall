import { ItemView, TFile, type WorkspaceLeaf } from "obsidian";
import { h } from "preact";

import { VIEW_TYPE_KNOWLEDGE_CHAT } from "@true-recall/core/constants";
import { RagChatService } from "@true-recall/core/rag/chat/rag-chat.service";
import { RagToolExecutor } from "@true-recall/core/rag/chat/rag-chat-tools";
import { RagQueryService } from "@true-recall/core/rag/chat/rag-query.service";
import type {
	CardContextItem,
	ContextItem,
	NoteContextItem,
} from "@true-recall/core/rag/context/context.types";

import { ObsidianHttpClient } from "@true-recall/obsidian/adapters/ObsidianHttpClient";
import { mountPreact } from "@true-recall/obsidian/preact";

import type TrueRecallPlugin from "../../main";
import { KnowledgeChatApp } from "./KnowledgeChatApp";

const ATTACHED_CONTEXT_CHAR_LIMIT = 6000;

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
		return "Chat";
	}

	getIcon(): string {
		return "bot";
	}

	onOpen(): Promise<void> {
		const s = this.plugin.settings;
		if (
			(s.proKey || s.openRouterApiKey) &&
			s.ragEnabled &&
			this.plugin.ragActions
		) {
			const search = this.plugin.ragSearch;
			if (search) {
				const toolExecutor =
					this.plugin.cardStore &&
					this.plugin.fsrsHelper &&
					this.plugin.dayBoundaryService &&
					this.plugin.hierarchyService
						? new RagToolExecutor(
								search,
								this.plugin.cardStore,
								this.plugin.fsrsHelper,
								this.plugin.flashcardManager,
								this.plugin.dayBoundaryService,
								this.plugin.hierarchyService,
							)
						: undefined;

				const contextResolver = this.createContextResolver();

				const query = new RagQueryService(
					search,
					() => this.plugin.settings,
					new ObsidianHttpClient(),
					this.plugin.frontmatterIndex,
					toolExecutor,
					contextResolver,
				);
				this.chatService = new RagChatService(query);
				this.plugin.ragIndexer?.setSearchService(search);
			}
		}

		const container = this.containerEl.children[1];
		if (container instanceof HTMLElement) {
			container.empty();
			container.addClasses(["ep:h-full", "ep:overflow-hidden"]);
			this.unmountPreact = mountPreact(
				container,
				this.plugin,
				h(KnowledgeChatApp, { view: this }),
			);
		}
		return Promise.resolve();
	}

	onClose(): Promise<void> {
		this.unmountPreact?.();
		return Promise.resolve();
	}

	private createContextResolver() {
		return async (items: ContextItem[]): Promise<string> => {
			const sections: string[] = [];

			for (const item of items) {
				if (item.kind.includes("note")) {
					const noteItem = item as NoteContextItem;
					const abstract = this.plugin.app.vault.getAbstractFileByPath(
						noteItem.path,
					);
					if (abstract instanceof TFile) {
						const content = await this.plugin.app.vault.cachedRead(abstract);
						const truncated =
							content.length > ATTACHED_CONTEXT_CHAR_LIMIT
								? `${content.slice(0, ATTACHED_CONTEXT_CHAR_LIMIT)}…`
								: content;
						sections.push(`[Note: ${noteItem.basename}]\n${truncated}`);
					}
				} else {
					const cardItem = item as CardContextItem;
					const cards = this.plugin.cardStore?.getByIds([cardItem.cardId]);
					const card = cards?.[0];
					if (card) {
						sections.push(
							`[Flashcard]\nQ: ${card.question}\nA: ${card.answer}`,
						);
					}
				}
			}

			return sections.join("\n\n---\n\n");
		};
	}
}
