import { useSignal } from "@preact/signals";
import { CardCountDisplay } from "@shared/ui/components/CardCountDisplay";
import { Clickable } from "@shared/ui/components/Clickable";
import { IconButton } from "@shared/ui/components/IconButton";
import { useIcon } from "@shared/ui/preact/hooks";
import { usePlugin } from "@shared/ui/preact";
import { cn } from "@shared/ui/utils";
import { healthColor } from "../../editor/widgets/project-stats";
import type { DashboardProject } from "../types";
import { NoteRow } from "./NoteRow";

interface ProjectAccordionProps {
	project: DashboardProject;
	depth?: number;
	searchQuery?: string;
	onNavigateToNote: (noteName: string) => void;
	onStudyNote: (noteName: string) => void;
	onCustomStudyNote: (noteName: string) => void;
}

function hasSearchMatch(
	project: DashboardProject,
	query: string,
): boolean {
	if (project.name.toLowerCase().includes(query)) return true;
	if (project.memberNotes.some((n) => n.name.toLowerCase().includes(query)))
		return true;
	return project.children.some((c) => hasSearchMatch(c, query));
}

export function ProjectAccordion({
	project,
	depth = 0,
	searchQuery = "",
	onNavigateToNote,
	onStudyNote,
	onCustomStudyNote,
}: ProjectAccordionProps) {
	const plugin = usePlugin();

	// Auto-expand when search matches a member note
	const shouldAutoExpand =
		searchQuery.length > 0 && hasSearchMatch(project, searchQuery);
	const isExpanded = useSignal(shouldAutoExpand);

	// Keep in sync with search: if searching and match found, expand
	if (searchQuery.length > 0 && shouldAutoExpand && !isExpanded.value) {
		isExpanded.value = true;
	}

	const chevronRef = useIcon(
		isExpanded.value ? "chevron-down" : "chevron-right",
	);

	const activeDue = project.due + project.newCount + project.learning;
	const color = healthColor(project.healthPct);

	// Filter member notes by search query
	const visibleNotes =
		searchQuery.length > 0
			? project.memberNotes.filter((n) =>
					n.name.toLowerCase().includes(searchQuery),
				)
			: project.memberNotes;

	return (
		<div>
			{/* Project header row */}
			<div
				class={cn(
					"ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-2 ep:rounded-lg ep:transition-colors ep:duration-150 ep:hover:bg-obs-modifier-hover",
					activeDue === 0 && "ep:opacity-40",
				)}
				style={{ paddingLeft: `${12 + depth * 20}px` }}
			>
				<Clickable
					class="ep:flex ep:items-center ep:gap-2 ep:flex-1 ep:min-w-0"
					onClick={() => {
						isExpanded.value = !isExpanded.value;
					}}
				>
					<span
						ref={chevronRef}
						class="[&_svg]:ep:w-3.5 [&_svg]:ep:h-3.5 ep:text-obs-muted ep:shrink-0"
					/>

					<span
						class="ep:w-2 ep:h-2 ep:rounded-full ep:shrink-0"
						style={{ backgroundColor: color }}
					/>

					<span class="ep:text-sm ep:text-obs-normal ep:truncate ep:min-w-0 ep:font-medium">
						{project.name}
					</span>

					{project.healthPct > 0 && (
						<span class="ep:text-xs ep:text-obs-muted ep:shrink-0 ep:tabular-nums">
							{project.healthPct}%
						</span>
					)}
				</Clickable>

				<CardCountDisplay
					newCount={project.newCount}
					learningCount={project.learning}
					dueCount={project.due}
				/>

				<IconButton
					icon="play"
					ariaLabel={`Study ${project.name}`}
					onClick={() => {
						void plugin.openReviewViewWithFilters({
							projectPath: project.path,
							ignoreDailyLimits: true,
						});
					}}
					size="small"
				/>
			</div>

			{/* Expanded content: member notes + child projects */}
			{isExpanded.value && (
				<div style={{ paddingLeft: `${20 + depth * 20}px` }}>
					{visibleNotes.map((note) => (
						<NoteRow
							key={note.name}
							note={note}
							onNavigate={() => onNavigateToNote(note.name)}
							onStudy={() => onStudyNote(note.name)}
							onCustomStudy={() => onCustomStudyNote(note.name)}
						/>
					))}

					{project.children.map((child) => (
						<ProjectAccordion
							key={child.path}
							project={child}
							depth={depth + 1}
							searchQuery={searchQuery}
							onNavigateToNote={onNavigateToNote}
							onStudyNote={onStudyNote}
							onCustomStudyNote={onCustomStudyNote}
						/>
					))}

					{visibleNotes.length === 0 &&
						project.children.length === 0 && (
							<div class="ep:text-xs ep:text-obs-muted ep:px-3 ep:py-2">
								No member notes
							</div>
						)}
				</div>
			)}
		</div>
	);
}
