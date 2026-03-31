import type { DashboardNoteEntry } from "./types";
interface NoteRowProps {
    note: DashboardNoteEntry;
    onNavigate: () => void;
    onStudy: () => void;
    onCustomStudy: () => void;
    onProjectClick?: (projectName: string) => void;
    onPresetClick?: (notePath: string | null) => void;
    onContextMenu?: (e: MouseEvent) => void;
    isSelectionMode?: boolean;
    isSelected?: boolean;
    onToggleSelect?: () => void;
}
export declare function NoteRow({ note, onNavigate, onStudy, onCustomStudy: _onCustomStudy, onProjectClick, onPresetClick, onContextMenu, isSelectionMode, isSelected, onToggleSelect, }: NoteRowProps): import("preact").JSX.Element;
export {};
