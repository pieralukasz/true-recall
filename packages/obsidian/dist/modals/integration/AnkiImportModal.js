import { __awaiter } from "tslib";
import { jsx as _jsx } from "preact/jsx-runtime";
import { ErrorPhase, FileSelectPhase, PreviewPhase, ProgressPhase, ResultPhase, } from "@true-recall/obsidian/modals/integration/anki-import";
import { AnkiConverterService } from "@true-recall/core/integration/anki/anki-converter.service";
import { AnkiImportService } from "@true-recall/core/integration/anki/anki-import.service";
import { ApkgParserService } from "@true-recall/core/integration/anki/apkg/apkg-parser.service";
import { ObsidianAnkiImportVault } from "@true-recall/obsidian/adapters/ObsidianAnkiImportVault";
import { ObsidianVaultFileReader } from "@true-recall/obsidian/adapters/ObsidianVaultFileReader";
import { ObsidianPersistence } from "@true-recall/obsidian/adapters/ObsidianPersistence";
import { notifyCardChange } from "@true-recall/obsidian/services/signals";
import { BaseModal } from "@true-recall/obsidian/modals/shared/BaseModal";
import { render } from "preact";
import { useCallback, useState } from "preact/hooks";
function AnkiImportBody({ onFileSelected, onImport, onClose, onUpdateTitle, }) {
    const [phase, setPhase] = useState({ type: "file-select" });
    const [importScheduling, setImportScheduling] = useState(true);
    const [importMedia, setImportMedia] = useState(true);
    const [createProject, setCreateProject] = useState(true);
    const handleFile = useCallback((file) => __awaiter(this, void 0, void 0, function* () {
        setPhase({ type: "parsing" });
        const result = yield onFileSelected(file);
        setPhase(result);
        if (result.type === "preview") {
            onUpdateTitle(`Import Anki deck (${result.preview.totalCards} cards)`);
        }
    }), [onFileSelected, onUpdateTitle]);
    const handleImport = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        setPhase({ type: "importing" });
        const result = yield onImport({
            importScheduling,
            importMedia,
            createProject,
        });
        setPhase(result);
        if (result.type === "result") {
            onUpdateTitle("Import complete");
        }
    }), [onImport, importScheduling, importMedia, createProject, onUpdateTitle]);
    switch (phase.type) {
        case "parsing":
        case "importing":
            return _jsx(ProgressPhase, { type: phase.type });
        case "error":
            return (_jsx(ErrorPhase, { message: phase.message, canRetry: phase.canRetry, onRetry: () => setPhase({ type: "file-select" }), onClose: onClose }));
        case "result":
            return _jsx(ResultPhase, { result: phase.result, onClose: onClose });
        case "preview":
            return (_jsx(PreviewPhase, { preview: phase.preview, importScheduling: importScheduling, importMedia: importMedia, createProject: createProject, onSchedulingChange: setImportScheduling, onMediaChange: setImportMedia, onCreateProjectChange: setCreateProject, onImport: () => void handleImport(), onCancel: onClose }));
        case "file-select":
            return _jsx(FileSelectPhase, { onFile: (file) => void handleFile(file) });
    }
}
export class AnkiImportModal extends BaseModal {
    constructor(app, store, fsrsService) {
        super(app, { title: "Import Anki deck", width: "520px" });
        this.fileData = null;
        this.deckNames = [];
        this.store = store;
        this.fsrsService = fsrsService;
    }
    renderBody(container) {
        render(_jsx(AnkiImportBody, { onFileSelected: (file) => this.handleFileSelected(file), onImport: (opts) => this.startImport(opts), onClose: () => this.close(), onUpdateTitle: (title) => this.updateTitle(title) }), container);
    }
    handleFileSelected(file) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.fileData = yield file.arrayBuffer();
                const parser = new ApkgParserService();
                const apkgData = yield parser.parseApkg(this.fileData);
                const converter = new AnkiConverterService();
                const convertedCards = converter.convert(apkgData);
                this.deckNames = this.getUniqueDecks(apkgData);
                const preview = {
                    totalCards: convertedCards.length,
                    basicCards: convertedCards.filter((c) => c.cardType === "basic").length,
                    clozeCards: convertedCards.filter((c) => c.cardType === "cloze").length,
                    reversedCards: convertedCards.filter((c) => c.cardType === "reversed")
                        .length,
                    decks: this.deckNames,
                    mediaCount: Object.keys(apkgData.mediaMap).length,
                };
                return { type: "preview", preview };
            }
            catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                return { type: "error", message: errMsg, canRetry: true };
            }
        });
    }
    startImport(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!this.fileData) {
                return { type: "error", message: "No file data", canRetry: true };
            }
            try {
                const importService = new AnkiImportService(this.store, this.fsrsService, new ObsidianPersistence(this.app), new ObsidianAnkiImportVault(this.app), new ObsidianVaultFileReader(this.app), (change) => notifyCardChange(change));
                const topDeck = ((_a = this.deckNames[0]) !== null && _a !== void 0 ? _a : "anki-import")
                    .split("/")[0]
                    .replace(/[\\/:*?"<>|]/g, "-")
                    .trim();
                const mediaFolder = `Attachments/anki-import/${topDeck}`;
                const result = yield importService.importApkg(this.fileData, {
                    importScheduling: opts.importScheduling,
                    importMedia: opts.importMedia,
                    mediaFolder,
                    createProject: opts.createProject,
                });
                return { type: "result", result };
            }
            catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                return { type: "error", message: errMsg, canRetry: false };
            }
        });
    }
    getUniqueDecks(data) {
        const names = new Set();
        for (const [, deck] of data.decks) {
            if (deck.name !== "Default") {
                names.add(deck.name.replace(/::/g, "/"));
            }
        }
        return [...names].sort();
    }
}
