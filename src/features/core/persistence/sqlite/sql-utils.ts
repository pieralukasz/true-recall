export function sqlPlaceholders(count: number): string {
	return Array.from({ length: count }, () => "?").join(",");
}
