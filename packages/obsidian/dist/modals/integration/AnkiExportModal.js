import { __awaiter } from "tslib";
import { jsx as _jsx } from "preact/jsx-runtime";
import { ErrorPhase, ExportingPhase, FormPhase, SuccessPhase, } from "@true-recall/obsidian/modals/integration/anki-export";
import { AnkiExportService } from "@true-recall/core/integration/anki/anki-export.service";
import { ObsidianSourceUidResolver } from "@true-recall/obsidian/adapters/ObsidianSourceUidResolver";
import { ObsidianVaultMediaReader } from "@true-recall/obsidian/adapters/ObsidianVaultMediaReader";
import { downloadBlob, resolveNotes, } from "@true-recall/obsidian/features/integration/utils/export-helpers";
import { BaseModal } from "@true-recall/obsidian/modals/shared/BaseModal";
import { render } from "preact";
import { useCallback, useState } from "preact/hooks";
function AnkiExportBody({ totalCards, allNotes, onExport, onClose, }) {
    const [phase, setPhase] = useState({ type: "form" });
    const handleExport = useCallback((values) => __awaiter(this, void 0, void 0, function* () {
        setPhase({ type: "exporting" });
        const result = yield onExport(values);
        setPhase(result);
    }), [onExport]);
    switch (phase.type) {
        case "exporting":
            return _jsx(ExportingPhase, {});
        case "success":
            return _jsx(SuccessPhase, { filename: phase.filename, onClose: onClose });
        case "error":
            return _jsx(ErrorPhase, { message: phase.message, onClose: onClose });
        case "form":
            return (_jsx(FormPhase, { totalCards: totalCards, allNotes: allNotes, onExport: (values) => void handleExport(values), onClose: onClose }));
    }
}
export class AnkiExportModal extends BaseModal {
    constructor(app, store, fsrsService) {
        super(app, { title: "Export to Anki", width: "520px" });
        this.allNotes = [];
        this.store = store;
        this.fsrsService = fsrsService;
        this.allNotes = resolveNotes(app);
    }
    renderBody(container) {
        const totalCards = this.store.size();
        this.updateTitle(`Export to Anki (${totalCards} cards)`);
        render(_jsx(AnkiExportBody, { totalCards: totalCards, allNotes: this.allNotes, onExport: (opts) => this.startExport(opts), onClose: () => this.close() }), container);
    }
    startExport(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const exportService = new AnkiExportService(this.store, this.fsrsService, new ObsidianSourceUidResolver(this.app), new ObsidianVaultMediaReader(this.app));
                const options = {
                    exportMode: opts.exportMode,
                    sourceUids: opts.exportMode === "notes"
                        ? [...opts.selectedSourceUids]
                        : undefined,
                    includeScheduling: opts.includeScheduling,
                    includeMedia: opts.includeMedia,
                };
                const { data, filename } = yield exportService.exportApkg(options);
                downloadBlob(data, filename);
                return { type: "success", filename };
            }
            catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                return { type: "error", message: errMsg };
            }
        });
    }
}
