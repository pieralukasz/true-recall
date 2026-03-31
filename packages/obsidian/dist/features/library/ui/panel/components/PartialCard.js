import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "preact/jsx-runtime";
import { useStreamingText, useWordReveal, } from "@true-recall/obsidian/features/library/ui/panel/hooks";
import { hasClozeSyntax, parseClozeText, } from "@true-recall/obsidian/features/library/ui/panel/utils/cloze-parser";
import { useRef } from "preact/hooks";
function ClozeRenderer({ text }) {
    if (!text)
        return null;
    const parts = parseClozeText(text);
    return (_jsx(_Fragment, { children: parts.map((part, i) => {
            if (!part.isCloze) {
                return (_jsx("span", { children: part.text }, `${i}-t-${part.text.slice(0, 20)}`));
            }
            if (part.isIncomplete) {
                return (_jsx("span", { class: "ep:bg-obs-interactive ep:text-on-accent ep:px-0.5 ep:rounded ep:animate-pulse", children: part.text }, `${i}-c${part.clozeIndex}-incomplete`));
            }
            return (_jsx("span", { class: "ep:bg-obs-accent-muted ep:px-0.5 ep:rounded", title: `Cloze ${part.clozeIndex}`, children: part.text }, `${i}-c${part.clozeIndex}`));
        }) }));
}
const NEW_WORD_STYLE = {
    opacity: 0,
    filter: "blur(4px)",
    transform: "translateY(4px)",
};
export function PartialCard({ streaming, }) {
    var _a, _b, _c;
    const { words: qWords, isTyping: qTyping } = useStreamingText((_a = streaming.partialQuestion) !== null && _a !== void 0 ? _a : "");
    const { words: aWords, isTyping: aTyping } = useStreamingText((_b = streaming.partialAnswer) !== null && _b !== void 0 ? _b : "");
    const qRef = useRef(null);
    const aRef = useRef(null);
    useWordReveal(qRef, qWords);
    useWordReveal(aRef, aWords);
    const hasCloze = hasClozeSyntax(streaming.partialQuestion);
    const chunkProgress = streaming.totalChunks != null ? (_jsxs("div", { class: "ep:text-ui-smaller ep:text-obs-muted ep:mb-1 ep:px-3", children: ["Section ", streaming.completedChunks + 1, "/", streaming.totalChunks, streaming.currentChunkLabel && ` — ${streaming.currentChunkLabel}`] })) : null;
    if (streaming.phase === "waiting" || (qWords.length === 0 && !hasCloze)) {
        return (_jsxs(_Fragment, { children: [chunkProgress, _jsx(StreamingSkeleton, {})] }));
    }
    return (_jsxs(_Fragment, { children: [chunkProgress, _jsxs("div", { class: "ep:flex ep:flex-col ep:mb-2 ep:rounded-lg ep:bg-obs-secondary ep:border ep:border-obs-border/20 ep:shadow-sm ep:p-3", children: [_jsxs("div", { ref: qRef, class: "ep:text-ui-small ep:text-obs-normal ep:leading-relaxed", children: [hasCloze ? (_jsx(ClozeRenderer, { text: (_c = streaming.partialQuestion) !== null && _c !== void 0 ? _c : "" })) : (qWords.map((w, i) => (_jsx("span", { "data-wi": i, style: w.isNew ? NEW_WORD_STYLE : undefined, children: w.text }, `q-${i}`)))), qTyping && _jsx("span", { class: "ep-streaming-cursor" })] }), (aWords.length > 0 || streaming.partialAnswer != null) && (_jsxs("div", { ref: aRef, class: "ep:text-ui-small ep:text-obs-muted ep:mt-1.5 ep:leading-relaxed", children: [aWords.map((w, i) => (_jsx("span", { "data-wi": i, style: w.isNew ? NEW_WORD_STYLE : undefined, children: w.text }, `a-${i}`))), aTyping && _jsx("span", { class: "ep-streaming-cursor" })] }))] })] }));
}
function StreamingSkeleton() {
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:mb-2 ep:rounded-lg ep:bg-obs-secondary ep:border ep:border-obs-border/20 ep:shadow-sm ep:p-3 ep:gap-2.5", children: [_jsx("div", { class: "ep-shimmer ep:h-3.5 ep:w-4/5 ep:rounded" }), _jsx("div", { class: "ep-shimmer ep:h-3.5 ep:w-3/5 ep:rounded" }), _jsx("div", { class: "ep-shimmer ep:h-3 ep:w-2/5 ep:rounded ep:mt-1 ep:opacity-60" })] }));
}
