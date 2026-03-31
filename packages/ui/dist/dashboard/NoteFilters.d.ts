import type { NoteFilterMode, ProjectFilter } from "./types";
interface NoteFiltersProps {
    activeFilter: NoteFilterMode;
    onFilterChange: (filter: NoteFilterMode) => void;
    counts: Record<NoteFilterMode, number>;
    projectFilter: ProjectFilter;
    unassignedCount: number;
    onProjectFilterChange: (filter: ProjectFilter) => void;
}
export declare function NoteFilters({ activeFilter, onFilterChange, counts, projectFilter, unassignedCount, onProjectFilterChange, }: NoteFiltersProps): import("preact").JSX.Element;
export {};
