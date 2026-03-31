import type { ComponentChildren } from "preact";
export interface PanelProps {
    showFooter?: boolean;
    disableScroll?: boolean;
    children: ComponentChildren;
    footer?: ComponentChildren;
}
export declare function Panel({ disableScroll, children, footer }: PanelProps): import("preact").JSX.Element;
