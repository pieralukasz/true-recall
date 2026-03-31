import { useContextMenu } from "@true-recall/obsidian/preact/useContextMenu";
export function useNoteContextMenu({ note, onStudy, onCustomStudy, onNavigate, onRename, onArchive, onUnarchive, onDetach, onEnterSelection, }) {
    const menuItems = [
        { title: "Study", icon: "play", onClick: onStudy },
        {
            title: "Custom session",
            icon: "sliders-horizontal",
            onClick: onCustomStudy,
        },
        { title: "Go to note", icon: "file-text", onClick: onNavigate },
        { title: "Rename", icon: "pencil", onClick: () => onRename === null || onRename === void 0 ? void 0 : onRename() },
        note.archived
            ? {
                title: "Unarchive",
                icon: "archive-restore",
                onClick: () => onUnarchive === null || onUnarchive === void 0 ? void 0 : onUnarchive(),
            }
            : { title: "Archive", icon: "archive", onClick: () => onArchive === null || onArchive === void 0 ? void 0 : onArchive() },
        ...(onDetach
            ? [
                "separator",
                { title: "Detach from project", icon: "unlink", onClick: onDetach },
            ]
            : []),
        ...(onEnterSelection
            ? [
                "separator",
                { title: "Select", icon: "check-square", onClick: onEnterSelection },
            ]
            : []),
    ];
    return useContextMenu(menuItems);
}
