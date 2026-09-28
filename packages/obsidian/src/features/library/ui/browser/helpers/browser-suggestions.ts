import {
	buildStaticSuggestions,
	getTokenAtCursor,
	getTokenContext,
} from "@true-recall/obsidian/helpers/search-suggestions";
import type {
	SearchSuggestion,
	SuggestionProvider,
} from "@true-recall/obsidian/helpers/search-suggestions.types";

interface BrowserSuggestionData {
	sourceNotes: { uid: string; name: string; count: number }[];
	presetNames: string[];
	projectNames: string[];
	tags?: { name: string; count: number }[];
}

export function createBrowserSuggestionProvider(
	data: BrowserSuggestionData,
): SuggestionProvider {
	return (inputValue: string, cursorPosition: number): SearchSuggestion[] => {
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
					category: "note" as const,
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
					category: "project" as const,
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
					category: "preset" as const,
				}));
		}

		if (context.type === "tag") {
			const neg = context.negated ? "-" : "";
			return (
				(data.tags ?? [])
					.filter((tag) => tag.name.toLowerCase().includes(context.partial))
					.slice(0, 10)
					// notes.tags is space-separated, so a tag never needs quoting
					.map((tag) => ({
						id: `tag-${neg}${tag.name}`,
						label: `${neg}tag:${tag.name}`,
						insertText: `${neg}tag:${tag.name}`,
						category: "tag" as const,
						description: `${tag.count} cards`,
					}))
			);
		}

		return buildStaticSuggestions(context);
	};
}
