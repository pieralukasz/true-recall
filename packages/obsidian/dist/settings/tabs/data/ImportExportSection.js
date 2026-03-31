import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useSettings } from "../../hooks/useSettings";
import { ActionButton, FormCard, FormField } from "@true-recall/obsidian/components";
export function ImportExportSection() {
    const { plugin } = useSettings();
    return (_jsxs(FormCard, { title: "Anki import / export", children: [_jsx(FormField, { name: "Import Anki deck", description: "Import flashcards from an Anki .apkg file with optional scheduling data", children: _jsx(ActionButton, { label: "Import .apkg", variant: "primary", onClick: () => void plugin.importAnki() }) }), _jsx(FormField, { name: "Export to Anki", description: "Export your flashcards as an Anki-compatible .apkg file", children: _jsx(ActionButton, { label: "Export .apkg", variant: "primary", onClick: () => plugin.exportAnki() }) }), _jsx(FormField, { name: "Export as CSV/TSV", description: "Export your flashcards as a CSV or TSV file for use in spreadsheets or other tools", children: _jsx(ActionButton, { label: "Export CSV", variant: "primary", onClick: () => plugin.exportCsv() }) })] }));
}
