import type { ProjectInfo, ProjectNoteInfo } from "../../../types";

export function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
	if (a.size !== b.size) return false;
	for (const item of a) {
		if (!b.has(item)) return false;
	}
	return true;
}

export function difference<T>(a: Set<T>, b: Set<T>): Set<T> {
	const result = new Set<T>();
	for (const item of a) {
		if (!b.has(item)) result.add(item);
	}
	return result;
}

export function projectsEqual(
	a: ProjectInfo[],
	b: ProjectInfo[]
): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		const aItem = a[i];
		const bItem = b[i];
		if (!aItem || !bItem) return false;
		if (
			aItem.id !== bItem.id ||
			aItem.cardCount !== bItem.cardCount ||
			aItem.noteCount !== bItem.noteCount ||
			aItem.newCount !== bItem.newCount ||
			aItem.learningCount !== bItem.learningCount ||
			aItem.dueCount !== bItem.dueCount
		) {
			return false;
		}
	}
	return true;
}

export function notesEqual(
	a: ProjectNoteInfo[],
	b: ProjectNoteInfo[]
): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		const aItem = a[i];
		const bItem = b[i];
		if (!aItem || !bItem) return false;
		if (
			aItem.path !== bItem.path ||
			aItem.cardCount !== bItem.cardCount ||
			aItem.newCount !== bItem.newCount ||
			aItem.learningCount !== bItem.learningCount ||
			aItem.dueCount !== bItem.dueCount
		) {
			return false;
		}
	}
	return true;
}
