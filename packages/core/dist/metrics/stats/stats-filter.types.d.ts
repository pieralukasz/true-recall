export interface StatsFilterContext {
    archivedSourceUids: ReadonlySet<string>;
    presetNames: ReadonlySet<string> | null;
    presetSourceUids: ReadonlySet<string> | null;
}
export declare const EMPTY_FILTER: StatsFilterContext;
