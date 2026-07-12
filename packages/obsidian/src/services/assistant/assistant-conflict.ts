/**
 * Which fields changed since the proposal snapshot was taken?
 * Returns null when nothing changed, otherwise the list of changed field names.
 */
export function detectFieldConflict(
	snapshot: Record<string, string>,
	current: Record<string, string>,
): string[] | null {
	const changed = Object.keys(snapshot).filter(
		(k) => (current[k] ?? "") !== (snapshot[k] ?? ""),
	);
	return changed.length > 0 ? changed : null;
}
