import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components";
import { cn } from "@true-recall/ui/utils/cn";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
export function OptionsMenu({ onAdd, onRemove, onRename, currentName, canRemove, }) {
    const [open, setOpen] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState("");
    const menuRef = useRef(null);
    useEffect(() => {
        if (!open)
            return;
        const handleClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setOpen(false);
                setRenaming(false);
            }
        };
        document.addEventListener("click", handleClick, true);
        return () => document.removeEventListener("click", handleClick, true);
    }, [open]);
    const handleRenameStart = useCallback(() => {
        setRenameValue(currentName);
        setRenaming(true);
    }, [currentName]);
    const handleRenameCommit = useCallback(() => {
        const trimmed = renameValue.trim();
        if (trimmed && trimmed !== currentName) {
            onRename(trimmed);
        }
        setRenaming(false);
        setOpen(false);
    }, [renameValue, currentName, onRename]);
    return (_jsxs("div", { ref: menuRef, class: "ep:relative", children: [_jsx(Clickable, { class: "ep:px-3 ep:py-1.5 ep:text-ui-small ep:border ep:border-obs-border ep:rounded ep:hover:bg-obs-hover ep:transition-colors", onClick: () => setOpen((v) => !v), children: "Options \u25BE" }), open && (_jsx("div", { class: "ep:absolute ep:right-0 ep:top-full ep:mt-1 ep:w-52 ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:shadow-lg ep:z-50 ep:py-1", children: renaming ? (_jsx("div", { class: "ep:px-3 ep:py-2", children: _jsx("input", { type: "text", class: "ep:w-full ep:px-2 ep:py-1 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-accent ep:rounded", value: renameValue, onInput: (e) => setRenameValue(e.target.value), onKeyDown: (e) => {
                            if (e.key === "Enter")
                                handleRenameCommit();
                            if (e.key === "Escape") {
                                setRenaming(false);
                                setOpen(false);
                            }
                        }, onBlur: handleRenameCommit }) })) : (_jsxs(_Fragment, { children: [_jsx(MenuItem, { label: "Add Card Type", onClick: () => {
                                onAdd();
                                setOpen(false);
                            } }), _jsx(MenuItem, { label: "Remove Card Type", onClick: () => {
                                onRemove();
                                setOpen(false);
                            }, disabled: !canRemove, danger: true }), _jsx(MenuItem, { label: "Rename Card Type", onClick: handleRenameStart })] })) }))] }));
}
function MenuItem({ label, onClick, disabled, danger, }) {
    return (_jsx(Clickable, { class: cn("ep:w-full ep:text-left ep:px-3 ep:py-1.5 ep:text-ui-small ep:transition-colors", disabled
            ? "ep:text-obs-muted ep:cursor-not-allowed"
            : danger
                ? "ep:text-obs-error ep:hover:bg-obs-hover"
                : "ep:text-obs-normal ep:hover:bg-obs-hover"), onClick: onClick, disabled: disabled, children: label }));
}
