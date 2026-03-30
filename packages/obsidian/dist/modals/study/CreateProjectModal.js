import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { Clickable, SearchInput } from "@true-recall/obsidian/components";
import { BasePromiseModal } from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import { normalizePath, TFolder } from "obsidian";
import { render } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
function CreateProjectBody({ folders, onResolve, }) {
    const [name, setName] = useState("");
    const [folder, setFolder] = useState("");
    const [folderSearch, setFolderSearch] = useState("");
    const nameRef = useRef(null);
    useEffect(() => {
        const id = setTimeout(() => { var _a; return (_a = nameRef.current) === null || _a === void 0 ? void 0 : _a.focus(); }, 50);
        return () => clearTimeout(id);
    }, []);
    const filtered = useMemo(() => {
        if (!folderSearch)
            return folders;
        const q = folderSearch.toLowerCase();
        return folders.filter((f) => f.toLowerCase().includes(q));
    }, [folders, folderSearch]);
    const trimmed = name.trim();
    const canCreate = trimmed.length > 0;
    const handleCreate = () => {
        if (!canCreate)
            return;
        onResolve({ cancelled: false, name: trimmed, folder });
    };
    return (_jsxs(_Fragment, { children: [_jsx("div", { class: "ep:block ep:text-ui-small ep:text-obs-muted ep:mb-1", children: "Project name" }), _jsx("input", { ref: nameRef, type: "text", placeholder: "My Project", class: "ep:w-full ep:py-2.5 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted ep:mb-4", value: name, onInput: (e) => setName(e.target.value), onKeyDown: (e) => {
                    if (e.key === "Enter")
                        handleCreate();
                } }), _jsx("div", { class: "ep:block ep:text-ui-small ep:text-obs-muted ep:mb-1", children: "Folder" }), _jsx(SearchInput, { placeholder: "Filter folders...", ariaLabel: "Filter folders", class: "ep:mb-2", value: folderSearch, onChange: setFolderSearch }), _jsxs("div", { class: "ep:border ep:border-obs-border ep:rounded-md ep:overflow-y-auto ep:mb-4", style: "max-height: 200px", children: [_jsx(Clickable, { class: `ep:w-full ep:flex ep:items-center ep:p-2.5 ep:text-ui-small ep:border-b ep:border-obs-border ep:transition-colors ${folder === ""
                            ? "ep:bg-obs-modifier-hover ep:text-obs-normal ep:font-medium"
                            : "ep:text-obs-muted ep:hover:bg-obs-modifier-hover"}`, onClick: () => setFolder(""), stopPropagation: false, children: "/ (vault root)" }), filtered.map((f) => (_jsx(Clickable, { class: `ep:w-full ep:flex ep:items-center ep:p-2.5 ep:text-ui-small ep:border-b ep:border-obs-border ep:last:border-b-0 ep:transition-colors ${folder === f
                            ? "ep:bg-obs-modifier-hover ep:text-obs-normal ep:font-medium"
                            : "ep:text-obs-muted ep:hover:bg-obs-modifier-hover"}`, onClick: () => setFolder(f), stopPropagation: false, children: f }, f)))] }), _jsx("div", { class: "ep:flex ep:justify-end", children: _jsx(Clickable, { class: "mod-cta ep-btn ep:px-4 ep:py-1.5 ep:rounded-md ep:text-ui-small", onClick: handleCreate, disabled: !canCreate, children: "Create" }) })] }));
}
export class CreateProjectModal extends BasePromiseModal {
    constructor(app) {
        super(app, {
            title: "Create new project",
            width: "450px",
        });
        this.folders = [];
    }
    getDefaultResult() {
        return { cancelled: true, name: "", folder: "" };
    }
    onOpen() {
        super.onOpen();
        this.folders = this.app.vault
            .getAllLoadedFiles()
            .filter((f) => f instanceof TFolder && f.path !== "/")
            .map((f) => f.path)
            .sort((a, b) => a.localeCompare(b));
    }
    renderBody(container) {
        render(_jsx(CreateProjectBody, { folders: this.folders, onResolve: (result) => this.resolve(result) }), container);
    }
    static buildNotePath(name, folder) {
        const raw = folder ? `${folder}/${name}.md` : `${name}.md`;
        return normalizePath(raw);
    }
}
