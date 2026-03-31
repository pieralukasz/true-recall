export function getSearchValueAfterEscape(
	key: string,
	currentValue: string,
): string | null {
	if (key !== "Escape" || currentValue.length === 0) {
		return null;
	}
	return "";
}

export function clearSearchValue(): "" {
	return "";
}
