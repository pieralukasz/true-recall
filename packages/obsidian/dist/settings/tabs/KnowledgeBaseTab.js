import { __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useSettings } from "../hooks/useSettings";
import { notify } from "@true-recall/obsidian/services/notification.service";
import { ActionButton, FolderPicker, FormCard, FormField, InfoBlock, TextAreaInput, ToggleInput, } from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact";
import { Notice } from "obsidian";
import { useCallback, useState } from "preact/hooks";
function formatProgress(p) {
    switch (p.phase) {
        case "notes":
            return `Indexing notes... ${p.current}/${p.total}`;
        case "flashcards":
            return `Indexing flashcards... ${p.current}/${p.total}`;
        case "embedding":
            return `Embedding chunks... ${p.current}/${p.total}`;
    }
}
export function KnowledgeBaseTab() {
    const { settings, save } = useSettings();
    const plugin = usePlugin();
    const [reindexing, setReindexing] = useState(false);
    const [progress, setProgress] = useState("");
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
    if (settings.aiTier !== "pro") {
        return (_jsx("div", { class: "ep:flex ep:flex-col ep:gap-3", children: _jsx(FormCard, { title: "Knowledge Base", children: _jsxs(InfoBlock, { children: ["Knowledge Base is a ", _jsx("strong", { children: "Pro-only" }), " feature. It indexes your vault notes and flashcards for semantic search, so AI assistants can find relevant information without reading every file."] }) }) }));
    }
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-3", children: [_jsxs(FormCard, { title: "Knowledge Base", children: [_jsx(InfoBlock, { children: "Index your vault for semantic search. AI assistants can search your notes and flashcards with awareness of FSRS mastery levels." }), _jsx(FormField, { name: "Enable Knowledge Base", description: "Index your vault content for semantic search", children: _jsx(ToggleInput, { value: settings.ragEnabled, onChange: (v) => save({ ragEnabled: v }) }) })] }), settings.ragEnabled && (_jsxs(FormCard, { title: "Indexing", children: [_jsx(FormField, { name: "Auto-index", description: "Re-index automatically when files change", children: _jsx(ToggleInput, { value: settings.ragAutoIndex, onChange: (v) => save({ ragAutoIndex: v }) }) }), _jsx(FormField, { name: "Index flashcards", description: "Also index flashcard content alongside notes", children: _jsx(ToggleInput, { value: settings.ragIndexFlashcards, onChange: (v) => save({ ragIndexFlashcards: v }) }) }), _jsx(FormField, { name: "Include folders", description: "Only index notes in these folders (empty = all)", children: _jsx(FolderPicker, { value: settings.ragIncludeFolders, onChange: (v) => save({ ragIncludeFolders: v }), placeholder: "Search folders to include..." }) }), _jsx(FormField, { name: "Exclude folders", description: "Skip notes in these folders", children: _jsx(FolderPicker, { value: settings.ragExcludeFolders, onChange: (v) => save({ ragExcludeFolders: v }), placeholder: "Search folders to exclude..." }) }), _jsx(FormField, { name: "Daily notes folder", description: "Override daily notes folder for smarter indexing (empty = auto-detect)", children: _jsx(FolderPicker, { value: settings.ragDailyNotesFolder
                                ? [settings.ragDailyNotesFolder]
                                : [], onChange: (v) => { var _a; return save({ ragDailyNotesFolder: (_a = v[0]) !== null && _a !== void 0 ? _a : "" }); }, placeholder: "Select daily notes folder..." }) }), _jsx(FormField, { name: "Daily note excluded headings", description: "Sections under these headings won't be indexed in daily notes (one per line)", children: _jsx(TextAreaInput, { value: settings.ragDailyNoteExcludeHeadings.join("\n"), onChange: (v) => save({
                                ragDailyNoteExcludeHeadings: v
                                    .split("\n")
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                            }), rows: 3, placeholder: "Thoughts\nJournal\nReflections" }) }), _jsx(FormField, { name: "Manual reindex", description: progress || "Re-chunk and re-embed all vault content", children: _jsx(ActionButton, { label: reindexing ? "Reindexing..." : "Reindex now", variant: "primary", onClick: handleReindex, disabled: reindexing }) })] }))] }));
}
