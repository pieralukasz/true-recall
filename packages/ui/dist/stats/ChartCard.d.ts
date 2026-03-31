import type { ComponentChildren } from "preact";
interface ChartCardProps {
    title: string;
    subtitle?: string;
    children: ComponentChildren;
}
export declare function ChartCard({ title, subtitle, children }: ChartCardProps): import("preact").JSX.Element;
export {};
