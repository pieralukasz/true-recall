export function normalizeSearchQuery(query) {
    return query.trim().toLowerCase();
}
export function matchesCardSearch(question, answer, rawQuery) {
    const normalized = normalizeSearchQuery(rawQuery);
    if (!normalized)
        return true;
    return (question.toLowerCase().includes(normalized) ||
        answer.toLowerCase().includes(normalized));
}
