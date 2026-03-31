import type { RetentionEntry } from "@true-recall/core";
interface RetentionChartProps {
    data: RetentionEntry[];
    targetRetention?: number;
}
export declare function RetentionChart({ data, targetRetention, }: RetentionChartProps): import("preact").JSX.Element;
export {};
