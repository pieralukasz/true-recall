import type { ComponentChildren } from "preact";
export interface StatBadgeProps {
    label: string;
    count: number;
    colorCls?: string;
}
export declare function StatBadge({ label, count, colorCls }: StatBadgeProps): import("preact").JSX.Element;
export interface StatGridProps {
    children: ComponentChildren;
    columns?: number;
}
export declare function StatGrid({ children, columns }: StatGridProps): import("preact").JSX.Element;
