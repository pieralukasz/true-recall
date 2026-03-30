import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { Clickable } from "@true-recall/obsidian/components/Clickable";
import { usePlugin } from "@true-recall/obsidian/preact";
import { setIcon } from "obsidian";
import { useEffect, useRef } from "preact/hooks";
const ANKI_SHARED_DECKS_URL = "https://ankiweb.net/shared/decks";
function SmallIcon({ icon }) {
    const ref = useRef(null);
    useEffect(() => {
        if (!ref.current)
            return;
        setIcon(ref.current, icon);
        const svg = ref.current.querySelector("svg");
        if (svg) {
            svg.setAttribute("width", "12");
            svg.setAttribute("height", "12");
        }
    }, [icon]);
    return _jsx("span", { ref: ref, class: "ep:flex ep:items-center" });
}
function BarButton({ label, icon, onClick, }) {
    return (_jsxs(Clickable, { class: "ep:flex ep:items-center ep:gap-1.5 ep:py-1 ep:px-3 ep:rounded-md ep:text-xs ep:text-obs-muted ep:bg-obs-border/50 ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal ep:transition-colors ep:border-none ep:cursor-pointer", onClick: onClick, children: [_jsx(SmallIcon, { icon: icon }), _jsx("span", { children: label })] }));
}
export function BottomActionBar() {
    const plugin = usePlugin();
    return (_jsx("div", { class: "ep:shrink-0 ep:bg-obs-primary", children: _jsxs("div", { class: "ep:flex ep:justify-center ep:gap-3 ep:px-4 ep:py-2", children: [_jsx(BarButton, { label: "Get Shared", icon: "globe", onClick: () => window.open(ANKI_SHARED_DECKS_URL, "_blank") }), _jsx(BarButton, { label: "Import File", icon: "file-down", onClick: () => void plugin.importAnki() })] }) }));
}
