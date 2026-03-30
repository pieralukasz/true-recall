import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
export function ProgressPhase({ type }) {
    if (type === "parsing") {
        return _jsx("div", { class: "ep:text-center ep:py-6", children: "Parsing deck..." });
    }
    return (_jsxs("div", { class: "ep:text-center ep:py-6", children: [_jsx("div", { class: "ep:text-ui-small ep:font-medium ep:mb-2", children: "Importing..." }), _jsx("div", { class: "ep:text-ui-smaller ep:text-obs-muted", children: "This may take a moment for large decks" })] }));
}
