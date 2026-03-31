interface SelectionBarProps {
    selectedCount: number;
    onSelectAll: () => void;
    onCreateProject: () => void;
    onArchive: () => void;
    onStudy: () => void;
    onCancel: () => void;
}
export declare function SelectionBar({ selectedCount, onSelectAll, onCreateProject, onArchive, onStudy, onCancel, }: SelectionBarProps): import("preact").JSX.Element;
export {};
