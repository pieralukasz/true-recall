/**
 * Load Balance Service
 *
 * Distributes reviews evenly across days to prevent workload spikes.
 */
import type { LoadBalanceOptions, SchedulerCardStore, SchedulingResult, WorkloadDistribution } from "./scheduler.types";
export declare class LoadBalanceService {
    private cardStore;
    constructor(cardStore: SchedulerCardStore);
    balance(options: LoadBalanceOptions): SchedulingResult;
    private findBestDay;
    private formatDate;
    private daysDiff;
    getDistribution(days: number): WorkloadDistribution[];
}
