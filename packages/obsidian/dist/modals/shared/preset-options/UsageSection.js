import { jsxs as _jsxs, jsx as _jsx } from "preact/jsx-runtime";
import { FormCard } from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useMemo } from "preact/hooks";
export function UsageSection({ preset }) {
    const plugin = usePlugin();
    const usage = useMemo(() => {
        const files = plugin.frontmatterIndex.getFilesByValue("fsrs_preset", preset.name);
        const noteNames = files.map((f) => { var _a; return ((_a = f.split("/").pop()) === null || _a === void 0 ? void 0 : _a.replace(/\.md$/, "")) || f; });
        return { count: files.length, names: noteNames.slice(0, 10) };
    }, [plugin, preset.name]);
    if (usage.count === 0)
        return null;
    return (_jsx(FormCard, { title: "Usage", children: _jsxs("div", { class: "ep:py-2 ep:text-ui-small ep:text-obs-muted", children: [_jsxs("p", { children: [usage.count, " ", usage.count === 1 ? "note" : "notes", " using this preset"] }), usage.names.length > 0 && (_jsxs("p", { class: "ep:mt-1 ep:text-ui-smaller ep:opacity-70", children: [usage.names.join(", "), usage.count > 10 && ` and ${usage.count - 10} more`] }))] }) }));
}
