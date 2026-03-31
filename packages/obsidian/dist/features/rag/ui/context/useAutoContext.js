import { usePlugin } from "@true-recall/obsidian/preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
export function useAutoContext() {
    const plugin = usePlugin();
    const [state, setState] = useState({
        activeNote: null,
        reviewCard: null,
    });
    const [dismissedKeys, setDismissedKeys] = useState(new Set());
    const resolveNote = useCallback((file) => {
        var _a, _b, _c;
        if (!file || file.extension !== "md")
            return null;
        let sourceUid;
        let cardCount;
        if (plugin.frontmatterIndex) {
            const cache = plugin.app.metadataCache.getFileCache(file);
            sourceUid = (_b = (_a = cache === null || cache === void 0 ? void 0 : cache.frontmatter) === null || _a === void 0 ? void 0 : _a.flashcard_uid) !== null && _b !== void 0 ? _b : undefined;
            if (sourceUid && ((_c = plugin.cardStore) === null || _c === void 0 ? void 0 : _c.cards)) {
                cardCount =
                    plugin.cardStore.cards.getCardsBySourceUid(sourceUid).length;
            }
        }
        return {
            kind: "active-note",
            path: file.path,
            basename: file.basename,
            sourceUid,
            cardCount,
            auto: true,
        };
    }, [plugin]);
    // Track active note via workspace events
    useEffect(() => {
        const ws = plugin.app.workspace;
        const update = () => {
            const file = ws.getActiveFile();
            setState((prev) => (Object.assign(Object.assign({}, prev), { activeNote: resolveNote(file) })));
        };
        // Initial state
        update();
        const refs = [
            ws.on("file-open", update),
            ws.on("active-leaf-change", update),
        ];
        return () => {
            for (const ref of refs)
                ws.offref(ref);
        };
    }, [plugin, resolveNote]);
    // Track review card via Zustand store
    const storeRef = useRef(plugin.store);
    storeRef.current = plugin.store;
    useEffect(() => {
        const store = storeRef.current;
        if (!store)
            return;
        const updateCard = () => {
            const review = store.getState().review;
            const card = review.getCurrentCard();
            if (!card) {
                setState((prev) => (Object.assign(Object.assign({}, prev), { reviewCard: null })));
                return;
            }
            setState((prev) => (Object.assign(Object.assign({}, prev), { reviewCard: {
                    kind: "review-card",
                    cardId: card.id,
                    question: card.question.length > 60
                        ? `${card.question.slice(0, 57)}...`
                        : card.question,
                    sourceNoteName: card.sourceNoteName,
                    auto: true,
                } })));
        };
        updateCard();
        return store.subscribe((s) => s.review, updateCard);
    }, []);
    const dismiss = useCallback((key) => {
        setDismissedKeys((prev) => new Set([...prev, key]));
    }, []);
    const autoItems = [];
    if (state.activeNote && !dismissedKeys.has(state.activeNote.path)) {
        autoItems.push(state.activeNote);
    }
    if (state.reviewCard && !dismissedKeys.has(state.reviewCard.cardId)) {
        autoItems.push(state.reviewCard);
    }
    return { autoItems, dismissedKeys, dismiss };
}
