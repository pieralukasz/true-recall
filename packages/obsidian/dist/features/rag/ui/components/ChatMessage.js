import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { groupSources } from "@true-recall/core/rag/retrieval/rag-source-grouper";
import { stripBrTags } from "@true-recall/core/utils";
import { Clickable } from "@true-recall/obsidian/components";
import { useApp, useIcon } from "@true-recall/obsidian/preact";
import { MarkdownRenderer, Component as ObsidianComponent } from "obsidian";
import { useEffect, useRef } from "preact/hooks";
import { SourcePanel } from "./SourcePanel";
const CITE_RE = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
const FLASHCARD_UID_RE = /\[flashcard_uid:\s*([a-f0-9]+)\]/gi;
/** Ensure lines starting with bold text or list markers become separate paragraphs */
function ensureBlockSeparation(text) {
    return (text
        // single \n before **bold → paragraph break
        .replace(/([^\n])\n(\*\*)/g, "$1\n\n$2")
        // single \n before list marker (- or 1.) → paragraph break
        .replace(/([^\n])\n([-*] |\d+\. )/g, "$1\n\n$2"));
}
function injectCitationHandlers(el, sources, navigation) {
    var _a, _b, _c, _d, _e;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    for (;;) {
        const node = walker.nextNode();
        if (!node)
            break;
        if (CITE_RE.test((_a = node.textContent) !== null && _a !== void 0 ? _a : "")) {
            textNodes.push(node);
        }
        CITE_RE.lastIndex = 0;
    }
    for (const textNode of textNodes) {
        const text = (_b = textNode.textContent) !== null && _b !== void 0 ? _b : "";
        const frag = document.createDocumentFragment();
        let lastIdx = 0;
        for (const match of text.matchAll(CITE_RE)) {
            const idx = match.index;
            if (idx > lastIdx) {
                frag.appendChild(document.createTextNode(text.slice(lastIdx, idx)));
            }
            const nums = ((_c = match[1]) !== null && _c !== void 0 ? _c : "")
                .split(",")
                .map((s) => Number.parseInt(s.trim(), 10))
                .filter((n) => !Number.isNaN(n));
            frag.appendChild(document.createTextNode("["));
            for (let i = 0; i < nums.length; i++) {
                if (i > 0)
                    frag.appendChild(document.createTextNode(", "));
                const num = (_d = nums[i]) !== null && _d !== void 0 ? _d : 0;
                const source = num > 0 && num <= sources.length ? sources[num - 1] : null;
                if (source) {
                    const span = document.createElement("span");
                    span.textContent = String(num);
                    span.className =
                        "ep:text-obs-accent ep:font-semibold ep:cursor-pointer ep:hover:underline";
                    span.addEventListener("click", (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (source.sourceType === "note") {
                            navigation.onNavigateToNote(source.sourceId, source.headingBreadcrumb);
                        }
                        else {
                            navigation.onNavigateToCard(source.sourceId);
                        }
                    });
                    frag.appendChild(span);
                }
                else {
                    frag.appendChild(document.createTextNode(String(num)));
                }
            }
            frag.appendChild(document.createTextNode("]"));
            lastIdx = idx + match[0].length;
        }
        if (lastIdx < text.length) {
            frag.appendChild(document.createTextNode(text.slice(lastIdx)));
        }
        (_e = textNode.parentNode) === null || _e === void 0 ? void 0 : _e.replaceChild(frag, textNode);
    }
}
function injectFlashcardUidLinks(el, navigation) {
    var _a, _b, _c, _d;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    for (;;) {
        const node = walker.nextNode();
        if (!node)
            break;
        if (FLASHCARD_UID_RE.test((_a = node.textContent) !== null && _a !== void 0 ? _a : "")) {
            textNodes.push(node);
        }
        FLASHCARD_UID_RE.lastIndex = 0;
    }
    for (const textNode of textNodes) {
        const text = (_b = textNode.textContent) !== null && _b !== void 0 ? _b : "";
        const frag = document.createDocumentFragment();
        let lastIdx = 0;
        for (const match of text.matchAll(FLASHCARD_UID_RE)) {
            const idx = match.index;
            if (idx > lastIdx) {
                frag.appendChild(document.createTextNode(text.slice(lastIdx, idx)));
            }
            const uid = (_c = match[1]) !== null && _c !== void 0 ? _c : "";
            const span = document.createElement("span");
            span.textContent = uid;
            span.className =
                "ep:text-obs-accent ep:font-mono ep:text-[11px] ep:cursor-pointer ep:hover:underline";
            span.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                navigation.onNavigateToUid(uid);
            });
            frag.appendChild(span);
            lastIdx = idx + match[0].length;
        }
        if (lastIdx < text.length) {
            frag.appendChild(document.createTextNode(text.slice(lastIdx)));
        }
        (_d = textNode.parentNode) === null || _d === void 0 ? void 0 : _d.replaceChild(frag, textNode);
    }
}
function AssistantMessage({ content, sources, navigation, isStreaming, }) {
    const app = useApp();
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        if (!el)
            return;
        el.empty();
        const comp = new ObsidianComponent();
        const processed = ensureBlockSeparation(stripBrTags(content));
        void MarkdownRenderer.render(app, processed, el, "", comp);
        if (navigation) {
            if (sources) {
                injectCitationHandlers(el, sources, navigation);
            }
            injectFlashcardUidLinks(el, navigation);
        }
        const onInternalLink = (e) => {
            const target = e.target.closest("a.internal-link");
            if (!target)
                return;
            e.preventDefault();
            e.stopPropagation();
            const href = target.getAttribute("data-href");
            if (href)
                void app.workspace.openLinkText(href, "", false);
        };
        el.addEventListener("click", onInternalLink, true);
        if (isStreaming) {
            const cursor = document.createElement("span");
            cursor.className = "ep-streaming-cursor";
            el.appendChild(cursor);
        }
        return () => {
            el.removeEventListener("click", onInternalLink, true);
            comp.unload();
        };
    }, [app, content, sources, navigation, isStreaming]);
    return (_jsx("div", { ref: ref, class: "ep-chat-markdown ep:text-sm ep:leading-relaxed ep:select-text" }));
}
function SourcePill({ group, navigation, }) {
    const iconRef = useIcon(group.sourceType === "note" ? "file-text" : "brain");
    const label = group.sourceType === "note"
        ? group.displayName
        : group.displayName || "Flashcard";
    const count = group.chunks.length > 1 ? ` (${group.chunks.length})` : "";
    return (_jsxs(Clickable, { class: "ep:inline-flex ep:items-center ep:gap-1 ep:text-[11px] ep:pl-1.5 ep:pr-2 ep:py-0.5 ep:rounded-md ep:bg-obs-modifier-hover ep:text-obs-muted ep:hover:text-obs-accent ep:hover:underline ep:transition-colors ep:max-w-[200px]", onClick: () => {
            var _a;
            if (!navigation)
                return;
            if (group.sourceType === "note") {
                navigation.onNavigateToNote(group.sourceId, (_a = group.headings[0]) !== null && _a !== void 0 ? _a : "");
            }
            else {
                navigation.onNavigateToCard(group.sourceId);
            }
        }, children: [_jsx("span", { ref: iconRef, class: "ep:shrink-0 ep:flex ep:items-center [&_svg]:ep:w-3 [&_svg]:ep:h-3" }), _jsxs("span", { class: "ep:truncate", children: [label, count] })] }));
}
export function ChatMessage({ turn, isStreaming, navigation }) {
    const isUser = turn.role === "user";
    const grouped = turn.sources && turn.sources.length > 0 ? groupSources(turn.sources) : null;
    return (_jsxs("div", { class: `ep:flex ep:flex-col ep:gap-1.5 ${isUser ? "ep:items-end" : "ep:items-start"}`, children: [isUser ? (_jsx("div", { class: "ep:max-w-[85%] ep:rounded-2xl ep:rounded-br-sm ep:px-4 ep:py-3 ep:text-sm ep:whitespace-pre-wrap ep:select-text ep:bg-obs-interactive/20 ep:text-obs-normal", children: turn.content })) : (_jsx("div", { class: "ep:w-full ep:px-1", children: _jsx(AssistantMessage, { content: turn.content, sources: turn.sources, navigation: navigation, isStreaming: isStreaming }) })), grouped && (_jsx("div", { class: "ep:flex ep:flex-wrap ep:gap-1.5 ep:px-1", children: grouped.slice(0, 5).map((g) => (_jsx(SourcePill, { group: g, navigation: navigation }, g.sourceId))) })), grouped && navigation && turn.sources && (_jsx(SourcePanel, { sources: turn.sources, navigation: navigation }))] }));
}
