import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components";
import { useIcon } from "@true-recall/obsidian/preact";
export function ContextChip({ item, onDismiss }) {
    const isNote = item.kind.includes("note");
    const iconRef = useIcon(isNote ? "file-text" : "brain");
    const closeRef = useIcon("x");
    const label = isNote
        ? item.basename
        : item.question;
    return (_jsxs("div", { class: `ep:inline-flex ep:items-center ep:gap-1 ep:text-xs ep:pl-1.5 ep:pr-0.5 ep:py-0.5 ep:rounded-md ep:max-w-[220px] ep:text-obs-muted ep:transition-colors ${item.auto
            ? "ep:border ep:border-dashed ep:border-obs-border ep:bg-transparent"
            : "ep:bg-obs-modifier-hover"}`, children: [_jsx("span", { ref: iconRef, class: "ep:shrink-0 ep:flex ep:items-center [&_svg]:ep:w-3 [&_svg]:ep:h-3" }), _jsx("span", { class: "ep:truncate ep:leading-none", children: label }), _jsx(Clickable, { class: "ep:w-5 ep:h-5 ep:shrink-0 ep:flex ep:items-center ep:justify-center ep:rounded-sm ep:text-obs-faint ep:hover:text-obs-normal ep:hover:bg-obs-modifier-hover ep:transition-colors [&_svg]:ep:w-3 [&_svg]:ep:h-3", onClick: (e) => {
                    e.stopPropagation();
                    onDismiss();
                }, "aria-label": "Remove context", children: _jsx("span", { ref: closeRef }) })] }));
}
