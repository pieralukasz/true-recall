import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { ExportScopeSelector, } from "@true-recall/obsidian/features/integration/components/ExportScopeSelector";
import { ModalFooter } from "@true-recall/obsidian/components/ModalFooter";
import { OptionCheckbox } from "@true-recall/obsidian/components/OptionCheckbox";
import { useCallback, useRef, useState } from "preact/hooks";
export function FormPhase({ totalCards, allNotes, onExport, onClose, }) {
    const [exportMode, setExportMode] = useState("all");
    const [includeScheduling, setIncludeScheduling] = useState(true);
    const [includeMedia, setIncludeMedia] = useState(true);
    const selectedSourceUids = useRef(new Set());
    const handleToggleNote = useCallback((key, checked) => {
        if (checked)
            selectedSourceUids.current.add(key);
        else
            selectedSourceUids.current.delete(key);
    }, []);
    const handleExport = useCallback(() => {
        onExport({
            exportMode,
            selectedSourceUids: selectedSourceUids.current,
            includeScheduling,
            includeMedia,
        });
    }, [exportMode, includeScheduling, includeMedia, onExport]);
    return (_jsxs(_Fragment, { children: [_jsx(ExportScopeSelector, { exportMode: exportMode, onModeChange: setExportMode, totalCards: totalCards, allNotes: allNotes, selectedSourceUids: selectedSourceUids.current, onToggleNote: handleToggleNote }), _jsxs("div", { class: "ep:mb-4", children: [_jsx("div", { class: "ep:text-ui-small ep:font-medium ep:mb-2", children: "Options" }), _jsx(OptionCheckbox, { label: "Include scheduling data", description: "Export review history and card progress", checked: includeScheduling, onChange: setIncludeScheduling }), _jsx(OptionCheckbox, { label: "Include media", description: "Export images and audio files", checked: includeMedia, onChange: setIncludeMedia })] }), _jsx(ModalFooter, { onCancel: onClose, onConfirm: handleExport, confirmLabel: "Export" })] }));
}
