import type { JSX } from "preact";
export interface ClickableProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "role" | "tabIndex" | "onClick"> {
    onClick: (e: MouseEvent | KeyboardEvent) => void;
    disabled?: boolean;
    role?: JSX.HTMLAttributes<HTMLDivElement>["role"];
    stopPropagation?: boolean;
    preventDefault?: boolean;
}
export declare function Clickable({ onClick, disabled, role: roleOverride, stopPropagation: stop, preventDefault: prevent, class: cls, children, ...rest }: ClickableProps): JSX.Element;
