export type ActionButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "outline" | "seed";
export type ActionButtonSize = "sm" | "md" | "lg";
export interface ActionButtonProps {
    label: string;
    onClick?: () => void;
    variant: ActionButtonVariant;
    size?: ActionButtonSize;
    icon?: string;
    disabled?: boolean;
    fullWidth?: boolean;
    class?: string;
}
export declare function ActionButton({ label, onClick, variant, size, icon, disabled, fullWidth, class: cls, }: ActionButtonProps): import("preact").JSX.Element;
