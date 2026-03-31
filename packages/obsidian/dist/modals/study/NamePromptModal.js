import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components";
import { BasePromiseModal } from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
function NamePromptBody({ defaultName, onResolve, }) {
    const [name, setName] = useState(defaultName);
    const inputRef = useRef(null);
    useEffect(() => {
        const id = setTimeout(() => {
            var _a, _b;
            (_a = inputRef.current) === null || _a === void 0 ? void 0 : _a.focus();
            (_b = inputRef.current) === null || _b === void 0 ? void 0 : _b.select();
        }, 50);
        return () => clearTimeout(id);
    }, []);
    const trimmed = name.trim();
    const canCreate = trimmed.length > 0;
    const handleCreate = () => {
        if (!canCreate)
            return;
        onResolve({ cancelled: false, name: trimmed });
    };
    return (_jsxs(_Fragment, { children: [_jsx("div", { class: "ep:block ep:text-ui-small ep:text-obs-muted ep:mb-1", children: "Project name" }), _jsx("input", { ref: inputRef, type: "text", placeholder: "Project name", class: "ep:w-full ep:py-2.5 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted ep:mb-4", value: name, onInput: (e) => setName(e.target.value), onKeyDown: (e) => {
                    if (e.key === "Enter")
                        handleCreate();
                } }), _jsx("div", { class: "ep:flex ep:justify-end", children: _jsx(Clickable, { class: "mod-cta ep-btn ep:px-4 ep:py-1.5 ep:rounded-md ep:text-ui-small", onClick: handleCreate, disabled: !canCreate, children: "Create" }) })] }));
}
export class NamePromptModal extends BasePromiseModal {
    constructor(app, defaultName) {
        super(app, {
            title: "Create project from notes",
            width: "400px",
        });
        this.defaultName = defaultName;
    }
    getDefaultResult() {
        return { cancelled: true, name: "" };
    }
    renderBody(container) {
        render(_jsx(NamePromptBody, { defaultName: this.defaultName, onResolve: (result) => this.resolve(result) }), container);
    }
}
