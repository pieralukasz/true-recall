export function normalizeSearchQuery(query: string): string {
	return query.trim().toLowerCase();
}

export function matchesCardSearch(
	question: string,
	answer: string,
	rawQuery: string,
): boolean {
	const normalized = normalizeSearchQuery(rawQuery);
	if (!normalized) return true;

	return (
		question.toLowerCase().includes(normalized) ||
		answer.toLowerCase().includes(normalized)
	);
}
