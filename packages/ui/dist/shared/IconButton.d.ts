export interface IconButtonProps {
    icon: string;
    ariaLabel: string;
    onClick: (e: MouseEvent | KeyboardEvent) => void;
    label?: string;
    size?: "small" | "medium";
    danger?: boolean;
    disabled?: boolean;
    class?: string;
}
export declare function IconButton({ icon, ariaLabel, onClick, label, size, danger, disabled, class: cls, }: IconButtonProps): import("preact").JSX.Element;
