export const PRIORITY_DOT = {
    overdue: "ep:bg-obs-red",
    hot: "ep:bg-obs-orange",
    due: "ep:bg-obs-blue",
    light: "ep:bg-obs-green",
    done: "ep:bg-obs-faint",
};
const PRIORITY_ORDER = {
    overdue: 0,
    hot: 1,
    due: 2,
    light: 3,
    done: 4,
};
export function computePriority(note) {
    if (note.overdueCount > 0)
        return "overdue";
    if (note.due + note.learning >= 10)
        return "hot";
    if (note.due + note.learning > 0)
        return "due";
    if (note.newCount > 0)
        return "light";
    return "done";
}
export function prioritySortComparator(a, b) {
    const pa = PRIORITY_ORDER[a.priority];
    const pb = PRIORITY_ORDER[b.priority];
    if (pa !== pb)
        return pa - pb;
    const aActive = a.due + a.learning + a.newCount;
    const bActive = b.due + b.learning + b.newCount;
    if (aActive !== bActive)
        return bActive - aActive;
    return a.name.localeCompare(b.name);
}
