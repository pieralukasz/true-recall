import { __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { IconButton } from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact";
import { Notice } from "obsidian";
import { useCallback, useMemo, useState } from "preact/hooks";
function formatProgress(p) {
    switch (p.phase) {
        case "notes":
            return `Notes ${p.current}/${p.total}`;
        case "flashcards":
            return `Flashcards ${p.current}/${p.total}`;
        case "embedding":
            return `Embedding ${p.current}/${p.total}`;
    }
}
export function IndexStatus({ view }) {
    const plugin = usePlugin();
    const [reindexing, setReindexing] = useState(false);
    const [progress, setProgress] = useState("");
    const stats = useMemo(() => {
        if (!plugin.ragActions)
            return null;
        return plugin.ragActions.getStats();
    }, [plugin]);
    const handleReindex = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        if (!plugin.ragIndexer || reindexing)
            return;
        setReindexing(true);
        const notice = new Notice("Indexing knowledge base...", 0);
        try {
            const result = yield plugin.ragIndexer.fullReindex((p) => {
                const msg = formatProgress(p);
                notice.noticeEl.setText(msg);
                setProgress(msg);
            });
            notice.hide();
            notify().success(`Indexed ${result.indexed} files, embedded ${result.embedded} chunks`);
        }
        catch (e) {
            notice.hide();
            notify().error("Reindex failed", e);
        }
        finally {
            setReindexing(false);
            setProgress("");
        }
    }), [plugin, reindexing]);
    if (!stats)
        return null;
    const label = stats.totalChunks > 0
        ? `${stats.embeddedChunks.toLocaleString()} chunks`
        : "Not indexed";
    return (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-1", children: [_jsx("span", { class: "ep:text-[10px] ep:text-obs-faint", children: reindexing ? progress : label }), _jsx(IconButton, { icon: "refresh-cw", ariaLabel: "Reindex knowledge base", onClick: handleReindex, disabled: reindexing, size: "small" })] }));
}
