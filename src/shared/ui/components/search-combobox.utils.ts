import type {
	SearchSuggestion,
	SuggestionCategory,
} from "@shared/ui/helpers/search-suggestions.types";

export const SEARCH_CATEGORY_LABELS: Record<SuggestionCategory, string> = {
	keyword: "Filters",
	state: "States",
	property: "Properties",
	note: "Notes",
	project: "Projects",
	preset: "Presets",
	type: "Card Types",
	via: "Created Via",
	date: "Date Filters",
};

export interface SectionedSuggestion extends SearchSuggestion {
	showSectionLabel: boolean;
	sectionLabel: string;
}

export function withSectionLabels(
	suggestions: SearchSuggestion[],
): SectionedSuggestion[] {
	const groups = new Map<SuggestionCategory, SearchSuggestion[]>();
	const orderedCategories: SuggestionCategory[] = [];

	for (const suggestion of suggestions) {
		if (!groups.has(suggestion.category)) {
			groups.set(suggestion.category, []);
			orderedCategories.push(suggestion.category);
		}
		groups.get(suggestion.category)!.push(suggestion);
	}

	const sectioned: SectionedSuggestion[] = [];
	for (const category of orderedCategories) {
		const items = groups.get(category)!;
		items.forEach((item, index) => {
			sectioned.push({
				...item,
				showSectionLabel: index === 0,
				sectionLabel: SEARCH_CATEGORY_LABELS[category],
			});
		});
	}

	return sectioned;
}
