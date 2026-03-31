import type { ComponentChildren } from "preact";
export interface InfoBlockProps {
    children: ComponentChildren;
    class?: string;
}
export declare function InfoBlock({ children, class: cls }: InfoBlockProps): import("preact").JSX.Element;
