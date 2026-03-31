import { __awaiter } from "tslib";
import { RagChatService } from "@true-recall/core/rag/chat/rag-chat.service";
import { RagToolExecutor } from "@true-recall/core/rag/chat/rag-chat-tools";
import { RagQueryService } from "@true-recall/core/rag/chat/rag-query.service";
import { VIEW_TYPE_KNOWLEDGE_CHAT } from "@true-recall/core/constants";
import { mountPreact } from "@true-recall/obsidian/preact";
import { ObsidianHttpClient } from "@true-recall/obsidian/adapters/ObsidianHttpClient";
import { ItemView, TFile } from "obsidian";
import { h } from "preact";
import { KnowledgeChatApp } from "./KnowledgeChatApp";
const ATTACHED_CONTEXT_CHAR_LIMIT = 6000;
export class KnowledgeChatView extends ItemView {
    constructor(leaf, plugin) {
        super(leaf);
        this.chatService = null;
        this.plugin = plugin;
    }
    getViewType() {
        return VIEW_TYPE_KNOWLEDGE_CHAT;
    }
    getDisplayText() {
        return "Chat";
    }
    getIcon() {
        return "bot";
    }
    onOpen() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const s = this.plugin.settings;
            if (s.proKey && s.ragEnabled && this.plugin.ragActions) {
                const search = this.plugin.ragSearch;
                if (!search)
                    return;
                const toolExecutor = this.plugin.cardStore &&
                    this.plugin.fsrsHelper &&
                    this.plugin.dayBoundaryService &&
                    this.plugin.hierarchyService
                    ? new RagToolExecutor(search, this.plugin.cardStore, this.plugin.fsrsHelper, this.plugin.flashcardManager, this.plugin.dayBoundaryService, this.plugin.hierarchyService)
                    : undefined;
                const contextResolver = this.createContextResolver();
                const query = new RagQueryService(search, () => this.plugin.settings, new ObsidianHttpClient(), this.plugin.frontmatterIndex, toolExecutor, contextResolver);
                this.chatService = new RagChatService(query);
                (_a = this.plugin.ragIndexer) === null || _a === void 0 ? void 0 : _a.setSearchService(search);
            }
            const container = this.containerEl.children[1];
            if (!(container instanceof HTMLElement))
                return;
            container.empty();
            container.addClasses(["ep:h-full", "ep:overflow-hidden"]);
            this.unmountPreact = mountPreact(container, this.plugin, h(KnowledgeChatApp, { view: this }));
        });
    }
    onClose() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.unmountPreact) === null || _a === void 0 ? void 0 : _a.call(this);
        });
    }
    createContextResolver() {
        return (items) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const sections = [];
            for (const item of items) {
                if (item.kind.includes("note")) {
                    const noteItem = item;
                    const abstract = this.plugin.app.vault.getAbstractFileByPath(noteItem.path);
                    if (abstract instanceof TFile) {
                        const content = yield this.plugin.app.vault.cachedRead(abstract);
                        const truncated = content.length > ATTACHED_CONTEXT_CHAR_LIMIT
                            ? `${content.slice(0, ATTACHED_CONTEXT_CHAR_LIMIT)}…`
                            : content;
                        sections.push(`[Note: ${noteItem.basename}]\n${truncated}`);
                    }
                }
                else {
                    const cardItem = item;
                    const cards = (_a = this.plugin.cardStore) === null || _a === void 0 ? void 0 : _a.getByIds([cardItem.cardId]);
                    const card = cards === null || cards === void 0 ? void 0 : cards[0];
                    if (card) {
                        sections.push(`[Flashcard]\nQ: ${card.question}\nA: ${card.answer}`);
                    }
                }
            }
            return sections.join("\n\n---\n\n");
        });
    }
}
