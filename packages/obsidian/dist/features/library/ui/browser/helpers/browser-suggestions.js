import { buildStaticSuggestions, getTokenAtCursor, getTokenContext, } from "@true-recall/obsidian/helpers/search-suggestions";
export function createBrowserSuggestionProvider(data) {
    return (inputValue, cursorPosition) => {
        const tokenInfo = getTokenAtCursor(inputValue, cursorPosition);
        const context = getTokenContext(tokenInfo);
        if (context.type === "note") {
            return data.sourceNotes
                .filter((n) => n.name.toLowerCase().includes(context.partial))
                .slice(0, 10)
                .map((n) => ({
                id: `note-${n.uid}`,
                label: `note:"${n.name}"`,
                insertText: `note:"${n.name}"`,
                category: "note",
                description: `${n.count} cards`,
            }));
        }
        if (context.type === "project") {
            return data.projectNames
                .filter((p) => p.toLowerCase().includes(context.partial))
                .slice(0, 10)
                .map((p) => ({
                id: `project-${p}`,
                label: `project:"${p}"`,
                insertText: `project:"${p}"`,
                category: "project",
            }));
        }
        if (context.type === "preset") {
            return data.presetNames
                .filter((p) => p.toLowerCase().includes(context.partial))
                .slice(0, 10)
                .map((p) => ({
                id: `preset-${p}`,
                label: `preset:"${p}"`,
                insertText: `preset:"${p}"`,
                category: "preset",
            }));
        }
        return buildStaticSuggestions(context);
    };
}
