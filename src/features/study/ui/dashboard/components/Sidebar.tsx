import type { DashboardNoteEntry } from "../types";
import { ProjectsSection } from "./ProjectsSection";
import { RecentlyStudiedSection } from "./RecentlyStudiedSection";

interface SidebarProps {
	notes: DashboardNoteEntry[];
}

export function Sidebar({ notes }: SidebarProps) {
	return (
		<div class="ep:flex ep:flex-col ep:gap-4">
			<ProjectsSection />
			<RecentlyStudiedSection notes={notes} />
		</div>
	);
}
