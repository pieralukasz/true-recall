import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components";
import { BasePromiseModal } from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import { TFile, TFolder } from "obsidian";
import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
function RenameBody({ currentName, isFolder, onResolve, }) {
    const [name, setName] = useState(currentName);
    const inputRef = useRef(null);
    useEffect(() => {
        const id = setTimeout(() => { var _a; return (_a = inputRef.current) === null || _a === void 0 ? void 0 : _a.focus(); }, 50);
        return () => clearTimeout(id);
    }, []);
    // Select all text on focus
    useEffect(() => {
        const id = setTimeout(() => { var _a; return (_a = inputRef.current) === null || _a === void 0 ? void 0 : _a.select(); }, 60);
        return () => clearTimeout(id);
    }, []);
    const trimmed = name.trim();
    const canRename = trimmed.length > 0 && trimmed !== currentName;
    const handleRename = () => {
        if (!canRename)
            return;
        onResolve({ cancelled: false, newName: trimmed });
    };
    return (_jsxs(_Fragment, { children: [_jsx("div", { class: "ep:block ep:text-ui-small ep:text-obs-muted ep:mb-1", children: isFolder ? "Folder name" : "Note name" }), _jsx("input", { ref: inputRef, type: "text", placeholder: isFolder ? "Folder name" : "Note name", class: "ep:w-full ep:py-2.5 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted ep:mb-4", value: name, onInput: (e) => setName(e.target.value), onKeyDown: (e) => {
                    if (e.key === "Enter")
                        handleRename();
                } }), _jsxs("div", { class: "ep:flex ep:justify-end ep:gap-2", children: [_jsx(Clickable, { class: "ep-btn ep:px-4 ep:py-1.5 ep:rounded-md ep:text-ui-small", onClick: () => onResolve({ cancelled: true, newName: "" }), stopPropagation: false, children: "Cancel" }), _jsx(Clickable, { class: "mod-cta ep-btn ep:px-4 ep:py-1.5 ep:rounded-md ep:text-ui-small", onClick: handleRename, disabled: !canRename, stopPropagation: false, children: "Rename" })] })] }));
}
export class RenameModal extends BasePromiseModal {
    constructor(app, file) {
        super(app, {
            title: `Rename ${file instanceof TFolder ? "folder" : "note"}`,
            width: "400px",
        });
        // For files, strip the .md extension for display
        this.currentName = file instanceof TFile ? file.basename : file.name;
        this.isFolder = file instanceof TFolder;
    }
    getDefaultResult() {
        return { cancelled: true, newName: "" };
    }
    renderBody(container) {
        render(_jsx(RenameBody, { currentName: this.currentName, isFolder: this.isFolder, onResolve: (result) => this.resolve(result) }), container);
    }
}
