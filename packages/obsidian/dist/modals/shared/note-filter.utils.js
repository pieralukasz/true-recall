/**
 * Filter and sort notes by search query.
 * Without query: sorts by modification time (most recent first).
 * With query: filters by basename/path match, prioritizes exact basename matches.
 */
export function filterNotesByQuery(notes, query) {
    if (!query) {
        return [...notes].sort((a, b) => b.stat.mtime - a.stat.mtime);
    }
    const lowerQuery = query.toLowerCase();
    return notes
        .filter((note) => note.basename.toLowerCase().includes(lowerQuery) ||
        note.path.toLowerCase().includes(lowerQuery))
        .sort((a, b) => {
        const aExact = a.basename.toLowerCase().startsWith(lowerQuery);
        const bExact = b.basename.toLowerCase().startsWith(lowerQuery);
        if (aExact && !bExact)
            return -1;
        if (bExact && !aExact)
            return 1;
        return a.basename.localeCompare(b.basename);
    });
}
/** Max notes to display in modal lists */
export const MAX_DISPLAY_NOTES = 50;
