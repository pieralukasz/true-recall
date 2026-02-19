import type {
	NoteHubSortBy,
	NoteHubSortDirection,
	NoteHubStatusFilter,
} from "../../../state/store/types";
import type { ProjectInfo, ProjectNoteInfo } from "../../../types";

export function filterNotesByStatus(
	notes: ProjectNoteInfo[],
	filter: NoteHubStatusFilter,
): ProjectNoteInfo[] {
	switch (filter) {
		case "all":
			return notes;
		case "has-due":
			return notes.filter((n) => n.dueCount > 0);
		case "has-new":
			return notes.filter((n) => n.newCount > 0);
		case "needs-cards":
			return notes.filter((n) => n.cardCount === 0);
		case "no-due":
			return notes.filter(
				(n) =>
					n.cardCount > 0 &&
					n.dueCount === 0 &&
					n.newCount === 0 &&
					n.learningCount === 0,
			);
	}
}

export function sortNotes(
	notes: ProjectNoteInfo[],
	sortBy: NoteHubSortBy,
	direction: NoteHubSortDirection,
): ProjectNoteInfo[] {
	const sorted = [...notes];
	const multiplier = direction === "asc" ? 1 : -1;

	sorted.sort((a, b) => {
		switch (sortBy) {
			case "name":
				return multiplier * a.name.localeCompare(b.name);
			case "due":
				return multiplier * (a.dueCount - b.dueCount);
			case "cards":
				return multiplier * (a.cardCount - b.cardCount);
			default:
				return 0;
		}
	});

	return sorted;
}

export function searchNotes(
	notes: ProjectNoteInfo[],
	query: string,
): ProjectNoteInfo[] {
	if (!query) return notes;
	const lower = query.toLowerCase();
	return notes.filter((n) => n.name.toLowerCase().includes(lower));
}

export function searchProjects(
	projects: ProjectInfo[],
	query: string,
): ProjectInfo[] {
	if (!query) return projects;
	const lower = query.toLowerCase();

	return projects.reduce<ProjectInfo[]>((result, project) => {
		const projectNameMatches = project.name.toLowerCase().includes(lower);

		if (projectNameMatches) {
			result.push(project);
			return result;
		}

		const matchingNotes = project.notes.filter((n) =>
			n.name.toLowerCase().includes(lower),
		);

		if (matchingNotes.length > 0) {
			result.push({ ...project, notes: matchingNotes });
		}

		return result;
	}, []);
}
