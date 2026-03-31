import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components";
import { BasePromiseModal } from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
function CreateNoteTypeBody({ noteTypes, onResolve, }) {
    const [name, setName] = useState("");
    const [cloneFromId, setCloneFromId] = useState("");
    const inputRef = useRef(null);
    useEffect(() => {
        const id = setTimeout(() => { var _a; return (_a = inputRef.current) === null || _a === void 0 ? void 0 : _a.focus(); }, 50);
        return () => clearTimeout(id);
    }, []);
    const trimmed = name.trim();
    const canCreate = trimmed.length > 0;
    const handleCreate = () => {
        if (!canCreate)
            return;
        onResolve({
            cancelled: false,
            name: trimmed,
            cloneFromId: cloneFromId || null,
        });
    };
    return (_jsxs(_Fragment, { children: [_jsx("div", { class: "ep:block ep:text-ui-small ep:text-obs-muted ep:mb-1", children: "Name" }), _jsx("input", { ref: inputRef, type: "text", placeholder: "My Custom Note Type", class: "ep:w-full ep:py-2.5 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted ep:mb-4", value: name, onInput: (e) => setName(e.target.value), onKeyDown: (e) => {
                    if (e.key === "Enter")
                        handleCreate();
                } }), _jsx("div", { class: "ep:block ep:text-ui-small ep:text-obs-muted ep:mb-1", children: "Clone from" }), _jsxs("select", { class: "ep:w-full ep:py-2.5 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:mb-4", value: cloneFromId, onChange: (e) => setCloneFromId(e.target.value), children: [_jsx("option", { value: "", children: "None (start empty)" }), noteTypes.map((nt) => (_jsxs("option", { value: nt.id, children: [nt.name, nt.type === 1 ? " [cloze]" : ""] }, nt.id)))] }), _jsx("div", { class: "ep:flex ep:justify-end", children: _jsx(Clickable, { class: "mod-cta ep-btn ep:px-4 ep:py-1.5 ep:rounded-md ep:text-ui-small", onClick: handleCreate, disabled: !canCreate, children: "Create" }) })] }));
}
export class CreateNoteTypeModal extends BasePromiseModal {
    constructor(app, noteTypes) {
        super(app, {
            title: "Create Note Type",
            width: "400px",
        });
        this.noteTypes = noteTypes;
    }
    getDefaultResult() {
        return { cancelled: true, name: "", cloneFromId: null };
    }
    renderBody(container) {
        render(_jsx(CreateNoteTypeBody, { noteTypes: this.noteTypes, onResolve: (result) => this.resolve(result) }), container);
    }
}
