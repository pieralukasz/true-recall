import { ENABLE_RAG } from "@true-recall/core/constants";
import { editSelectionAsFlashcard, generateFlashcardsFromSelection, hasApiKey, quickAddFlashcardFromSelection, } from "./SelectionActions";
export function registerCommands(plugin) {
    plugin.addCommand({
        id: "open-flashcard-panel",
        name: "Open flashcard panel",
        callback: () => void plugin.activateView(),
    });
    plugin.addCommand({
        id: "review-current-note",
        name: "Review flashcards from current note",
        checkCallback: (checking) => {
            const file = plugin.app.workspace.getActiveFile();
            if (file && file.extension === "md") {
                if (!checking) {
                    void plugin.reviewCurrentNote();
                }
                return true;
            }
            return false;
        },
    });
    plugin.addCommand({
        id: "review-todays-cards",
        name: "Review today's new cards",
        callback: () => void plugin.reviewTodaysCards(),
    });
    plugin.addCommand({
        id: "open-dashboard",
        name: "Open dashboard",
        callback: () => void plugin.openDashboard(),
    });
    plugin.addCommand({
        id: "open-card-browser",
        name: "Open card browser",
        callback: () => void plugin.openCardBrowser(),
    });
    plugin.addCommand({
        id: "open-fsrs-simulator",
        name: "Open FSRS simulator",
        callback: () => void plugin.openSimulator(),
    });
    plugin.addCommand({
        id: "open-stats",
        name: "Open statistics",
        callback: () => void plugin.openStats(),
    });
    plugin.addCommand({
        id: "manage-note-types",
        name: "Manage note types",
        callback: () => plugin.openCardTypesEditor(),
    });
    plugin.addCommand({
        id: "add-flashcards",
        name: "Import flashcards",
        callback: () => plugin.openImportStudio(),
    });
    plugin.addCommand({
        id: "create-image-occlusion-card",
        name: "Create image occlusion card",
        callback: () => void plugin.openImageOcclusionEditorForActiveNote(),
    });
    plugin.addCommand({
        id: "create-backup",
        name: "Create database backup",
        callback: () => void plugin.createManualBackup(),
    });
    plugin.addCommand({
        id: "add-flashcard-uid",
        name: "Add flashcard uid to current note",
        checkCallback: (checking) => {
            const file = plugin.app.workspace.getActiveFile();
            if (file && file.extension === "md") {
                if (!checking) {
                    void plugin.addFlashcardUidToCurrentNote();
                }
                return true;
            }
            return false;
        },
    });
    plugin.addCommand({
        id: "undo-flashcard-action",
        name: "Undo last flashcard action",
        checkCallback: (checking) => {
            var _a;
            if (!((_a = plugin.undoService) === null || _a === void 0 ? void 0 : _a.canUndo())) {
                return false;
            }
            if (!checking) {
                void plugin.undoService.undo();
            }
            return true;
        },
    });
    plugin.addCommand({
        id: "import-anki",
        name: "Import Anki deck (.apkg)",
        callback: () => void plugin.importAnki(),
    });
    plugin.addCommand({
        id: "export-anki",
        name: "Export to Anki (.apkg)",
        callback: () => void plugin.exportAnki(),
    });
    plugin.addCommand({
        id: "export-csv",
        name: "Export as CSV/TSV",
        callback: () => void plugin.exportCsv(),
    });
    plugin.addCommand({
        id: "insert-project-dashboard",
        name: "Insert project dashboard",
        editorCheckCallback: (checking, editor) => {
            if (checking)
                return true;
            editor.replaceSelection("```true-recall-project\n```\n");
            return true;
        },
    });
    plugin.addCommand({
        id: "create-master-dashboard",
        name: "Create master dashboard note",
        callback: () => void plugin.createMasterDashboard(),
    });
    plugin.addCommand({
        id: "set-fsrs-preset",
        name: "Set FSRS preset for current note",
        checkCallback: (checking) => {
            const file = plugin.app.workspace.getActiveFile();
            if (file && file.extension === "md") {
                if (!checking) {
                    void plugin.setFsrsPresetForCurrentNote();
                }
                return true;
            }
            return false;
        },
    });
    plugin.addCommand({
        id: "archive-current-note",
        name: "Archive current note",
        checkCallback: (checking) => {
            const file = plugin.app.workspace.getActiveFile();
            if (file && file.extension === "md") {
                if (plugin.hierarchyService.isNoteArchived(file.path))
                    return false;
                if (!checking) {
                    void plugin.flashcardManager
                        .getFrontmatterService()
                        .setArchive(file.path, true);
                }
                return true;
            }
            return false;
        },
    });
    plugin.addCommand({
        id: "unarchive-current-note",
        name: "Unarchive current note",
        checkCallback: (checking) => {
            const file = plugin.app.workspace.getActiveFile();
            if (file && file.extension === "md") {
                if (!plugin.hierarchyService.isNoteArchived(file.path))
                    return false;
                if (!checking) {
                    void plugin.flashcardManager
                        .getFrontmatterService()
                        .setArchive(file.path, false);
                }
                return true;
            }
            return false;
        },
    });
    if (ENABLE_RAG) {
        plugin.addCommand({
            id: "open-knowledge-chat",
            name: "Chat with knowledge base",
            callback: () => void plugin.openKnowledgeChat(),
        });
    }
    plugin.addCommand({
        id: "generate-flashcards-from-selection",
        name: "Generate flashcards from selection",
        editorCheckCallback: (checking, editor) => {
            const selection = editor.getSelection();
            if (!selection || selection.trim().length < 3)
                return false;
            if (!hasApiKey(plugin))
                return false;
            if (checking)
                return true;
            void generateFlashcardsFromSelection(plugin, selection.trim());
            return true;
        },
    });
    plugin.addCommand({
        id: "quick-add-flashcard-from-selection",
        name: "Quick add flashcard from selection",
        editorCheckCallback: (checking, editor) => {
            const selection = editor.getSelection();
            if (!selection || selection.trim().length < 3)
                return false;
            if (checking)
                return true;
            void quickAddFlashcardFromSelection(plugin, selection.trim());
            return true;
        },
    });
    plugin.addCommand({
        id: "edit-selection-as-flashcard",
        name: "Edit selection as flashcard",
        editorCheckCallback: (checking, editor) => {
            const selection = editor.getSelection();
            if (!selection || selection.trim().length < 3)
                return false;
            if (checking)
                return true;
            editSelectionAsFlashcard(plugin, selection.trim());
            return true;
        },
    });
}
