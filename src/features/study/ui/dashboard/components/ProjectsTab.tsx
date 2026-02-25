import { useMemo } from "preact/hooks";
import type { DashboardProject } from "../types";
import { ProjectAccordion } from "./ProjectAccordion";

interface ProjectsTabProps {
	projects: DashboardProject[];
	searchQuery: string;
	onNavigateToNote: (noteName: string) => void;
	onStudyNote: (noteName: string) => void;
	onCustomStudyNote: (noteName: string) => void;
}

function projectMatchesSearch(
	project: DashboardProject,
	query: string,
): boolean {
	if (project.name.toLowerCase().includes(query)) return true;
	if (project.memberNotes.some((n) => n.name.toLowerCase().includes(query)))
		return true;
	return project.children.some((c) => projectMatchesSearch(c, query));
}

export function ProjectsTab({
	projects,
	searchQuery,
	onNavigateToNote,
	onStudyNote,
	onCustomStudyNote,
}: ProjectsTabProps) {
	const filteredProjects = useMemo(() => {
		if (!searchQuery) return projects;
		return projects.filter((p) => projectMatchesSearch(p, searchQuery));
	}, [projects, searchQuery]);

	if (filteredProjects.length === 0) {
		return (
			<div class="ep:text-sm ep:text-obs-muted ep:p-4 ep:text-center">
				{projects.length === 0
					? "No projects found. Organize notes in folders or add project: true to a note's frontmatter."
					: "No matching projects."}
			</div>
		);
	}

	return (
		<div class="ep:flex ep:flex-col">
			{filteredProjects.map((project) => (
				<ProjectAccordion
					key={project.path}
					project={project}
					searchQuery={searchQuery}
					onNavigateToNote={onNavigateToNote}
					onStudyNote={onStudyNote}
					onCustomStudyNote={onCustomStudyNote}
				/>
			))}
		</div>
	);
}
