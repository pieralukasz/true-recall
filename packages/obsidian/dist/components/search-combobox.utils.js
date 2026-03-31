export const SEARCH_CATEGORY_LABELS = {
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
export function withSectionLabels(suggestions) {
    var _a;
    const groups = new Map();
    const orderedCategories = [];
    for (const suggestion of suggestions) {
        if (!groups.has(suggestion.category)) {
            groups.set(suggestion.category, []);
            orderedCategories.push(suggestion.category);
        }
        (_a = groups.get(suggestion.category)) === null || _a === void 0 ? void 0 : _a.push(suggestion);
    }
    const sectioned = [];
    for (const category of orderedCategories) {
        const items = groups.get(category);
        if (!items)
            continue;
        items.forEach((item, index) => {
            sectioned.push(Object.assign(Object.assign({}, item), { showSectionLabel: index === 0, sectionLabel: SEARCH_CATEGORY_LABELS[category] }));
        });
    }
    return sectioned;
}
