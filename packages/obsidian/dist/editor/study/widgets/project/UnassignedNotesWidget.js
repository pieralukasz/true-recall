import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { useComputed } from "@preact/signals";
import { cards, cardsBySourceUid } from "@true-recall/obsidian/services/reactive-card-store";
import { Clickable } from "@true-recall/obsidian/components";
import { FSRS_COLORS } from "@true-recall/obsidian/helpers/fsrs-colors";
import { usePlugin } from "@true-recall/obsidian/preact";
import { State } from "ts-fsrs";
import { WidgetCta } from "../WidgetCta";
export function UnassignedNotesWidget() {
    const plugin = usePlugin();
    const notes = useComputed(() => {
        var _a, _b, _c;
        void cards.value;
        const unassignedPaths = plugin.hierarchyService.getUnassignedPaths();
        const result = [];
        const now = new Date();
        const uidMap = cardsBySourceUid.value;
        for (const path of unassignedPaths) {
            const uids = plugin.frontmatterIndex.getValues("flashcard_uid", path);
            const uid = uids[0];
            if (!uid)
                continue;
            const uidCards = (_a = uidMap.get(uid)) !== null && _a !== void 0 ? _a : [];
            if (uidCards.length === 0)
                continue;
            let newCount = 0;
            let dueCount = 0;
            let activeCount = 0;
            for (const card of uidCards) {
                const fsrs = card.fsrs;
                if (fsrs.suspended)
                    continue;
                if (fsrs.buriedUntil && new Date(fsrs.buriedUntil) > now)
                    continue;
                activeCount++;
                if (fsrs.state === State.New)
                    newCount++;
                else if (fsrs.state === State.Learning ||
                    fsrs.state === State.Relearning)
                    dueCount++;
                else if (fsrs.state === State.Review && new Date(fsrs.due) <= now)
                    dueCount++;
            }
            const file = plugin.app.vault.getAbstractFileByPath(path);
            const name = (_c = (_b = file === null || file === void 0 ? void 0 : file.name) === null || _b === void 0 ? void 0 : _b.replace(/\.md$/, "")) !== null && _c !== void 0 ? _c : path;
            result.push({
                path,
                name,
                cardCount: activeCount,
                newCount,
                dueCount,
            });
        }
        // Sort by due count descending, then by name
        result.sort((a, b) => b.dueCount - a.dueCount || a.name.localeCompare(b.name));
        return result;
    }).value;
    if (notes.length === 0) {
        return (_jsx("div", { class: "ep:text-obs-muted ep:text-xs ep:p-3", children: "All flashcard notes are assigned to projects." }));
    }
    const handleOpenNote = (path) => {
        void plugin.app.workspace.openLinkText(path, "", false);
    };
    const handleReviewAll = () => {
        // Collect all source UIDs from unassigned notes
        const uids = new Set();
        for (const note of notes) {
            const noteUids = plugin.frontmatterIndex.getValues("flashcard_uid", note.path);
            for (const uid of noteUids)
                uids.add(uid);
        }
        // Open review with these UIDs as sourceNoteFilters
        const noteNames = notes.map((n) => n.name).filter((n) => !!n);
        plugin
            .openReviewViewWithFilters({
            sourceNoteFilters: noteNames,
            ignoreDailyLimits: true,
        })
            .catch(() => { });
    };
    const totalDue = notes.reduce((sum, n) => sum + n.dueCount, 0);
    const totalNew = notes.reduce((sum, n) => sum + n.newCount, 0);
    return (_jsxs("div", { class: "ep:flex ep:flex-col ep:gap-2 ep:p-3 ep:text-sm", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between", children: [_jsx("span", { class: "ep:font-semibold ep:text-obs-normal", children: "Unassigned Notes" }), _jsxs("span", { class: "ep:text-xs ep:text-obs-muted", children: [notes.length, " note", notes.length !== 1 ? "s" : ""] })] }), (totalDue > 0 || totalNew > 0) && (_jsxs("div", { class: "ep:flex ep:gap-3 ep:text-xs", children: [totalDue > 0 && (_jsxs("span", { style: { color: `var(${FSRS_COLORS.review.cssVar})` }, children: [totalDue, " due"] })), totalNew > 0 && (_jsxs("span", { style: { color: `var(${FSRS_COLORS.new.cssVar})` }, children: [totalNew, " new"] }))] })), _jsx("div", { class: "ep:flex ep:flex-col ep:gap-1 ep:max-h-60 ep:overflow-y-auto", children: notes.map((note) => (_jsxs(Clickable, { class: "ep:flex ep:items-center ep:justify-between ep:px-2 ep:py-1 ep:rounded ep:bg-obs-secondary hover:ep:bg-obs-tertiary ep:transition-colors", onClick: () => handleOpenNote(note.path), children: [_jsx("span", { class: "ep:truncate ep:flex-1 ep:text-obs-normal ep:text-xs", children: note.name }), _jsxs("div", { class: "ep:flex ep:gap-2 ep:ml-2 ep:text-[10px] ep:shrink-0", children: [note.dueCount > 0 && (_jsx("span", { style: { color: `var(${FSRS_COLORS.review.cssVar})` }, children: note.dueCount })), note.newCount > 0 && (_jsx("span", { style: { color: `var(${FSRS_COLORS.new.cssVar})` }, children: note.newCount })), _jsx("span", { class: "ep:text-obs-faint", children: note.cardCount })] })] }, note.path))) }), totalDue > 0 && (_jsx(WidgetCta, { label: `Review Unassigned (${totalDue} due)`, onClick: handleReviewAll }))] }));
}
