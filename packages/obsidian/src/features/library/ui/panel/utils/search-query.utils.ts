import {
	matchesCardSearch,
	normalizeFullText,
} from "@true-recall/obsidian/features/library/ui/panel/utils/panel-list.utils";

export { matchesCardSearch };

export function normalizeSearchQuery(query: string): string {
	return normalizeFullText(query);
}
