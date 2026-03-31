import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "preact/jsx-runtime";
import { PasteDropZone } from "@true-recall/obsidian/components/PasteDropZone";
import { useRef } from "preact/hooks";
export function FileSelectPhase({ onFile }) {
    const fileInputRef = useRef(null);
    return (_jsxs(_Fragment, { children: [_jsx("div", { class: "ep:text-ui-small ep:text-obs-muted ep:mb-4", children: "Select an .apkg file exported from Anki to import your flashcards." }), _jsx("input", { ref: fileInputRef, type: "file", accept: ".apkg", style: "display: none", onChange: (e) => {
                    var _a;
                    const file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
                    if (file)
                        onFile(file);
                } }), _jsx(PasteDropZone, { onFileDrop: (file) => {
                    if (file.name.endsWith(".apkg")) {
                        onFile(file);
                    }
                }, accept: "*", label: "Click to select .apkg file", hint: "or drag & drop", onClick: () => { var _a; return (_a = fileInputRef.current) === null || _a === void 0 ? void 0 : _a.click(); } })] }));
}
