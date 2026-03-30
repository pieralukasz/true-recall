import type { ComponentChildren } from "preact";
export interface PasteDropZoneProps {
    onFileDrop: (file: File) => void;
    accept?: string;
    icon?: ComponentChildren;
    label?: string;
    hint?: string;
    onClick?: () => void;
}
export declare function PasteDropZone({ onFileDrop, accept, icon, label, hint, onClick, }: PasteDropZoneProps): import("preact").JSX.Element;
