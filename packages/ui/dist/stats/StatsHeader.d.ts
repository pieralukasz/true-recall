import type { Signal } from "@preact/signals";
import type { StatsTimeRange } from "@true-recall/core";
interface StatsHeaderProps {
    timeRange: Signal<StatsTimeRange>;
}
export declare function StatsHeader({ timeRange }: StatsHeaderProps): import("preact").JSX.Element;
export {};
