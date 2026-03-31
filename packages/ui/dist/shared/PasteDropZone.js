import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { cn } from "../utils/cn";
import { useState } from "preact/hooks";
export function PasteDropZone({ onFileDrop, accept = "image/", icon, label = "Paste from clipboard", hint = "Ctrl+V or drag & drop", onClick, }) {
    const [dragActive, setDragActive] = useState(false);
    return (_jsxs("div", { role: "button", tabIndex: 0, class: cn("ep:flex ep:flex-col ep:items-center ep:justify-center ep:p-6 ep:mb-4 ep:border-2 ep:border-dashed ep:rounded-lg ep:cursor-pointer ep:transition-all ep:hover:border-obs-interactive ep:bg-transparent ep:font-inherit ep:w-full", dragActive ? "true-recall-paste-zone-active" : "ep:border-obs-border"), onDragOver: (e) => {
            e.preventDefault();
            setDragActive(true);
        }, onDragLeave: () => setDragActive(false), onDrop: (e) => {
            var _a;
            e.preventDefault();
            setDragActive(false);
            const files = (_a = e.dataTransfer) === null || _a === void 0 ? void 0 : _a.files;
            if (files && files.length > 0) {
                const file = files[0];
                if (file && (accept === "*" || file.type.startsWith(accept))) {
                    onFileDrop(file);
                }
            }
        }, onClick: onClick, onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick === null || onClick === void 0 ? void 0 : onClick();
            }
        }, children: [icon && _jsx("div", { class: "ep:text-obs-muted", children: icon }), _jsx("div", { class: "ep:text-ui-small ep:font-medium ep:text-obs-normal", children: label }), _jsx("div", { class: "ep:text-ui-smaller ep:text-obs-muted", children: hint })] }));
}
