import { useSignal } from "@preact/signals";
import { prioritySortComparator } from "@true-recall/core/helpers/note-priority";
import { useCallback, useMemo } from "preact/hooks";
const FILTER_PREDICATES = {
    due: (n) => n.due > 0,
    new: (n) => n.newCount > 0,
    learning: (n) => n.learning > 0,
    overdue: (n) => n.overdueCount > 0,
};
export function useNoteFiltering({ notes, searchQuery, }) {
    const activeFilter = useSignal("all");
    const projectFilter = useSignal({ type: "none" });
    const unassignedCount = useMemo(() => notes.filter((n) => n.projects.length === 0).length, [notes]);
    const projectFiltered = useMemo(() => {
        const pf = projectFilter.value;
        if (pf.type === "project")
            return notes.filter((n) => n.projects.includes(pf.name));
        if (pf.type === "unassigned")
            return notes.filter((n) => n.projects.length === 0);
        return notes;
    }, [notes, projectFilter.value]);
    const counts = useMemo(() => {
        const c = {
            all: projectFiltered.length,
            due: 0,
            new: 0,
            learning: 0,
            overdue: 0,
        };
        for (const n of projectFiltered) {
            if (n.due > 0)
                c.due++;
            if (n.newCount > 0)
                c.new++;
            if (n.learning > 0)
                c.learning++;
            if (n.overdueCount > 0)
                c.overdue++;
        }
        return c;
    }, [projectFiltered]);
    const filteredNotes = useMemo(() => {
        let result = projectFiltered;
        const predicate = FILTER_PREDICATES[activeFilter.value];
        if (predicate) {
            result = result.filter(predicate);
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter((n) => n.name.toLowerCase().includes(q));
        }
        return [...result].sort(prioritySortComparator);
    }, [projectFiltered, searchQuery, activeFilter.value]);
    const handleFilterChange = useCallback((f) => {
        activeFilter.value = f;
    }, []);
    const handleProjectFilterChange = useCallback((pf) => {
        projectFilter.value = pf;
    }, []);
    return {
        activeFilter,
        projectFilter,
        filteredNotes,
        counts,
        unassignedCount,
        handleFilterChange,
        handleProjectFilterChange,
    };
}
