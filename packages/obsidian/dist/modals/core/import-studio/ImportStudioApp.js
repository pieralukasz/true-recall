import { __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { CardPreviewList } from "@true-recall/obsidian/modals/core/add-flashcards/CardPreviewList";
import { ActionBar } from "@true-recall/obsidian/modals/core/import-studio/ActionBar";
import { EditorSection } from "@true-recall/obsidian/modals/core/import-studio/EditorSection";
import { FooterBar } from "@true-recall/obsidian/modals/core/import-studio/FooterBar";
import { parseBulkText, } from "@true-recall/core/flashcard/parsing/bulk-card-parser";
import { FormattingToolbar, } from "@true-recall/obsidian/editor/shared/formatting";
import { useApp, usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { Notice, TFile } from "obsidian";
import { useCallback, useEffect, useMemo, useRef, useState, } from "preact/hooks";
import { loadImportStudioPrefs, saveImportStudioPrefs } from "./types";
export function ImportStudioApp({ onClose: _onClose, defaultNoteTypeId, }) {
    const app = useApp();
    const plugin = usePlugin();
    const prefs = useMemo(() => loadImportStudioPrefs(app), [app]);
    const editorRef = useRef(null);
    const focusedEditorRef = useRef(null);
    const [text, setText] = useState("");
    const [noteTypeId] = useState(defaultNoteTypeId !== null && defaultNoteTypeId !== void 0 ? defaultNoteTypeId : prefs.lastNoteTypeId);
    const [sessionCount, setSessionCount] = useState(0);
    const [saving, setSaving] = useState(false);
    // Source note picker — auto-fill from active file, fall back to last used
    const initialSourceNote = useMemo(() => {
        const activeFile = app.workspace.getActiveFile();
        if (activeFile)
            return activeFile;
        if (!prefs.lastSourceNotePath)
            return null;
        const file = app.vault.getAbstractFileByPath(prefs.lastSourceNotePath);
        return file instanceof TFile ? file : null;
    }, [app, prefs.lastSourceNotePath]);
    const [selectedSourceNote, setSelectedSourceNote] = useState(initialSourceNote);
    // Resolve current NoteType object
    const noteType = useMemo(() => {
        var _a, _b, _c;
        return (_c = (_b = (_a = plugin.cardStore) === null || _a === void 0 ? void 0 : _a.noteTypes) === null || _b === void 0 ? void 0 : _b.getById(noteTypeId)) !== null && _c !== void 0 ? _c : null;
    }, [plugin.cardStore, noteTypeId]);
    // Debounced parsing so large pastes don't block the main thread
    const [parseResult, setParseResult] = useState({ cards: [], detectedFormat: "none", duplicateCount: 0 });
    const getNoteType = useCallback((slug) => plugin.noteTypeService.getBySlug(slug), [plugin]);
    useEffect(() => {
        const timer = setTimeout(() => {
            const raw = parseBulkText(text, noteType ? { noteType, getNoteType } : { getNoteType });
            const seen = new Set();
            const unique = [];
            for (const card of raw.cards) {
                const key = `${card.noteTypeId}\0${JSON.stringify(card.fields)}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    unique.push(card);
                }
            }
            setParseResult({
                cards: unique,
                detectedFormat: raw.detectedFormat,
                duplicateCount: raw.cards.length - unique.length,
            });
        }, 150);
        return () => clearTimeout(timer);
    }, [text, noteType, getNoteType]);
    // Handlers
    const handleSourceNoteChange = useCallback((note) => {
        var _a;
        setSelectedSourceNote(note);
        saveImportStudioPrefs(app, { lastSourceNotePath: (_a = note === null || note === void 0 ? void 0 : note.path) !== null && _a !== void 0 ? _a : "" });
    }, [app]);
    const resolveSourceUid = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        if (!selectedSourceNote || !plugin.flashcardManager)
            return undefined;
        const fmService = plugin.flashcardManager.getFrontmatterService();
        let uid = yield fmService.getSourceNoteUid(selectedSourceNote.path);
        if (!uid) {
            uid = fmService.generateUid();
            yield fmService.setSourceNoteUid(selectedSourceNote.path, uid);
        }
        return uid;
    }), [selectedSourceNote, plugin.flashcardManager]);
    const handleSave = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (parseResult.cards.length === 0 || saving)
            return;
        if (!selectedSourceNote) {
            new Notice("Select a source note first");
            return;
        }
        if (!((_a = plugin.flashcardManager) === null || _a === void 0 ? void 0 : _a.hasStore())) {
            new Notice("Database not initialized");
            return;
        }
        setSaving(true);
        try {
            const sourceUid = yield resolveSourceUid();
            const result = plugin.flashcardManager.createNoteBatch(parseResult.cards.map((c) => ({
                noteTypeId: c.noteTypeId,
                fields: c.fields,
                alwaysTypeIn: c.alwaysTypeIn,
                sourceUid,
                createdVia: "manual",
            })));
            const totalCards = result.cards.length;
            setSessionCount((prev) => prev + totalCards);
            new Notice(`Created ${totalCards} card${totalCards !== 1 ? "s" : ""}`);
            if (editorRef.current) {
                editorRef.current.set("");
                editorRef.current.cm.focus();
            }
            else {
                setText("");
            }
            setParseResult({ cards: [], detectedFormat: "none", duplicateCount: 0 });
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            new Notice(`Error: ${msg}`);
        }
        finally {
            setSaving(false);
        }
    }), [parseResult.cards, plugin.flashcardManager, resolveSourceUid, saving]);
    const handleEditorReady = useCallback((editor) => {
        editorRef.current = editor;
    }, []);
    const handleEditorFocus = useCallback((editorView) => {
        focusedEditorRef.current = { editorView };
    }, []);
    const getEditorView = useCallback(() => { var _a, _b; return (_b = (_a = focusedEditorRef.current) === null || _a === void 0 ? void 0 : _a.editorView) !== null && _b !== void 0 ? _b : null; }, []);
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-3", children: [_jsx(ActionBar, { app: app, selectedSourceNote: selectedSourceNote, onSourceSelect: handleSourceNoteChange }), _jsx(FormattingToolbar, { app: app, getEditorView: getEditorView }), _jsx(EditorSection, { app: app, text: text, onTextChange: setText, onEditorReady: handleEditorReady, onEditorFocus: handleEditorFocus, onModEnter: () => void handleSave() }), _jsx(CardPreviewList, { cards: parseResult.cards, duplicateCount: parseResult.duplicateCount }), _jsx(FooterBar, { sessionCount: sessionCount, cardCount: parseResult.cards.length, detectedFormat: parseResult.detectedFormat, saving: saving, hasSourceNote: selectedSourceNote !== null, onSave: () => void handleSave() })] }));
}
