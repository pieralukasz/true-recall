export function getSearchValueAfterEscape(key, currentValue) {
    if (key !== "Escape" || currentValue.length === 0) {
        return null;
    }
    return "";
}
export function clearSearchValue() {
    return "";
}
