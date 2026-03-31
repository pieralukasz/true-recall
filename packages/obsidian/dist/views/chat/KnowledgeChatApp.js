import { __asyncValues, __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable, IconButton } from "@true-recall/obsidian/components";
import { useApp, useIcon, usePlugin } from "@true-recall/obsidian/preact";
import { Notice } from "obsidian";
import { useCallback, useMemo, useRef, useState } from "preact/hooks";
import { ChatConfigPanel } from "@true-recall/obsidian/features/rag/ui/components/ChatConfigPanel";
import { ChatInput } from "@true-recall/obsidian/features/rag/ui/components/ChatInput";
import { ChatMessage } from "@true-recall/obsidian/features/rag/ui/components/ChatMessage";
import { IndexStatus } from "@true-recall/obsidian/features/rag/ui/components/IndexStatus";
import { contextKey } from "@true-recall/core/rag/context/context.types";
import { useAutoContext } from "@true-recall/obsidian/features/rag/ui/context/useAutoContext";
function ThinkingIndicator() {
    return (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2 ep:px-1 ep:py-2", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:gap-1", children: [_jsx("span", { class: "ep:w-1.5 ep:h-1.5 ep:rounded-full ep:bg-obs-accent ep:opacity-70 ep:animate-bounce [animation-delay:0ms]" }), _jsx("span", { class: "ep:w-1.5 ep:h-1.5 ep:rounded-full ep:bg-obs-accent ep:opacity-70 ep:animate-bounce [animation-delay:150ms]" }), _jsx("span", { class: "ep:w-1.5 ep:h-1.5 ep:rounded-full ep:bg-obs-accent ep:opacity-70 ep:animate-bounce [animation-delay:300ms]" })] }), _jsx("span", { class: "ep:text-xs ep:text-obs-muted", children: "Thinking..." })] }));
}
const SUGGESTED_QUESTIONS = [
    "Summarize my recent notes",
    "How's my study progress?",
    "Which cards am I struggling with?",
];
export function KnowledgeChatApp({ view }) {
    const app = useApp();
    const plugin = usePlugin();
    const [messages, setMessages] = useState([]);
    const [streaming, setStreaming] = useState(false);
    const [streamingText, setStreamingText] = useState("");
    const [manualItems, setManualItems] = useState([]);
    const [configOpen, setConfigOpen] = useState(false);
    const scrollRef = useRef(null);
    const headerIconRef = useIcon("bot");
    const sparklesRef = useIcon("sparkles");
    const { autoItems, dismiss: dismissAuto } = useAutoContext();
    const allContext = useMemo(() => [...autoItems, ...manualItems], [autoItems, manualItems]);
    const handleDismissContext = useCallback((key) => {
        const isManual = manualItems.some((i) => contextKey(i) === key);
        if (isManual) {
            setManualItems((prev) => prev.filter((i) => contextKey(i) !== key));
        }
        else {
            dismissAuto(key);
        }
    }, [manualItems, dismissAuto]);
    const handleAddManualNote = useCallback((item) => {
        const key = contextKey(item);
        if (allContext.some((i) => contextKey(i) === key))
            return;
        setManualItems((prev) => [...prev, item]);
    }, [allContext]);
    const navigation = useMemo(() => ({
        onNavigateToNote: (sourceId, headingBreadcrumb) => {
            var _a, _b;
            const lastHeading = (_b = (_a = headingBreadcrumb.split(" > ").pop()) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : "";
            const link = lastHeading ? `${sourceId}#${lastHeading}` : sourceId;
            void app.workspace.openLinkText(link, "", false);
        },
        onNavigateToCard: (cardId) => {
            var _a;
            const cards = plugin.cardStore.getByIds([cardId]);
            const sourceUid = (_a = cards[0]) === null || _a === void 0 ? void 0 : _a.sourceUid;
            if (!sourceUid) {
                new Notice("Cannot navigate: card no longer exists");
                return;
            }
            const filePath = plugin.frontmatterIndex.getFileByValue("flashcard_uid", sourceUid);
            if (!filePath) {
                new Notice("Source note not found for this flashcard");
                return;
            }
            void app.workspace.openLinkText(filePath, "", false).then(() => {
                void plugin.activateView();
            });
        },
        onNavigateToUid: (flashcardUid) => {
            const filePath = plugin.frontmatterIndex.getFileByValue("flashcard_uid", flashcardUid);
            if (!filePath) {
                new Notice("Source note not found");
                return;
            }
            void app.workspace.openLinkText(filePath, "", false);
        },
    }), [app, plugin]);
    const scrollToBottom = useCallback(() => {
        requestAnimationFrame(() => {
            var _a;
            (_a = scrollRef.current) === null || _a === void 0 ? void 0 : _a.scrollTo(0, scrollRef.current.scrollHeight);
        });
    }, []);
    const handleSend = useCallback((text) => __awaiter(this, void 0, void 0, function* () {
        var _a, e_1, _b, _c;
        if (!view.chatService || streaming)
            return;
        const userTurn = {
            role: "user",
            content: text,
            timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, userTurn]);
        setStreaming(true);
        setStreamingText("");
        scrollToBottom();
        try {
            let fullResponse = "";
            try {
                for (var _d = true, _e = __asyncValues(view.chatService.sendMessage(text, allContext)), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                    _c = _f.value;
                    _d = false;
                    const chunk = _c;
                    fullResponse += chunk;
                    setStreamingText(fullResponse);
                    scrollToBottom();
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
                }
                finally { if (e_1) throw e_1.error; }
            }
            const history = view.chatService.getHistory();
            setMessages([...history]);
            setStreamingText("");
        }
        catch (e) {
            const errorTurn = {
                role: "assistant",
                content: `Error: ${e instanceof Error ? e.message : "Unknown error"}`,
                timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, errorTurn]);
        }
        finally {
            setStreaming(false);
            scrollToBottom();
        }
    }), [view.chatService, streaming, scrollToBottom, allContext]);
    const handleClear = useCallback(() => {
        var _a;
        (_a = view.chatService) === null || _a === void 0 ? void 0 : _a.clearHistory();
        setMessages([]);
        setStreamingText("");
        setManualItems([]);
    }, [view.chatService]);
    const handleConfigChange = useCallback((_config) => {
        var _a;
        if (messages.length > 0) {
            (_a = view.chatService) === null || _a === void 0 ? void 0 : _a.clearHistory();
            setMessages([]);
            setStreamingText("");
        }
    }, [view.chatService, messages.length]);
    if (!view.chatService) {
        return (_jsx("div", { class: "ep:flex ep:items-center ep:justify-center ep:h-full ep:p-4 ep:text-obs-muted", children: _jsx("p", { children: "Knowledge Base requires a Pro subscription and enabled RAG." }) }));
    }
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:h-full", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between ep:px-2 ep:py-3 ep:border-b ep:border-obs-border", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2", children: [_jsx("span", { ref: headerIconRef, class: "ep:shrink-0 ep:flex ep:items-center ep:text-obs-muted [&_svg]:ep:w-4 [&_svg]:ep:h-4" }), _jsx("span", { class: "ep:text-ui-small ep:font-semibold ep:text-obs-normal", children: "Chat" })] }), _jsxs("div", { class: "ep:flex ep:items-center ep:gap-1", children: [_jsx(IndexStatus, { view: view }), _jsx(IconButton, { icon: "settings-2", ariaLabel: "Configure chat", onClick: () => setConfigOpen((o) => !o), size: "small" }), messages.length > 0 && (_jsx(IconButton, { icon: "trash-2", ariaLabel: "Clear conversation", onClick: handleClear, size: "small" }))] })] }), configOpen && (_jsx(ChatConfigPanel, { config: plugin.settings.ragChatConfig, onConfigChange: handleConfigChange })), _jsxs("div", { ref: scrollRef, class: "ep:flex-1 ep:overflow-y-auto ep:px-2 ep:pt-4 ep:pb-2 ep:flex ep:flex-col ep:gap-5", children: [messages.length === 0 && !streaming && (_jsxs("div", { class: "ep:flex ep:flex-col ep:items-center ep:justify-center ep:h-full ep:gap-5 ep:px-2", children: [_jsxs("div", { class: "ep:flex ep:flex-col ep:items-center ep:gap-1", children: [_jsx("span", { ref: sparklesRef, class: "ep:flex ep:items-center ep:justify-center ep:text-obs-accent ep:opacity-70 [&_svg]:ep:w-10 [&_svg]:ep:h-10" }), _jsxs("div", { class: "ep:text-center", children: [_jsx("div", { class: "ep:text-ui-medium ep:font-semibold ep:text-obs-normal ep:mb-1", children: "Chat" }), _jsx("div", { class: "ep:text-sm ep:text-obs-muted", children: "Ask anything about your notes and flashcards" })] })] }), _jsx("div", { class: "ep:flex ep:flex-col ep:gap-2 ep:w-full ep:max-w-[280px]", children: SUGGESTED_QUESTIONS.map((q) => (_jsx(Clickable, { class: "ep:text-sm ep:text-obs-muted ep:text-left ep:px-4 ep:py-2.5 ep:rounded-xl ep:border ep:border-obs-border ep:hover:border-obs-interactive ep:hover:text-obs-normal ep:transition-colors ep:leading-snug", onClick: () => handleSend(q), children: q }, q))) })] })), messages.map((msg, i) => (_jsx(ChatMessage, { turn: msg, navigation: navigation }, i))), streaming && !streamingText && _jsx(ThinkingIndicator, {}), streaming && streamingText && (_jsx(ChatMessage, { turn: {
                            role: "assistant",
                            content: streamingText,
                            timestamp: Date.now(),
                        }, isStreaming: true }))] }), _jsx(ChatInput, { onSend: handleSend, disabled: streaming, contextItems: allContext, onDismissContext: handleDismissContext, onAddManualNote: handleAddManualNote })] }));
}
