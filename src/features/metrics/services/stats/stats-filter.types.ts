export interface StatsFilterContext {
	archivedSourceUids: ReadonlySet<string>;
	presetName: string | null;
	presetSourceUids: ReadonlySet<string> | null;
}

export const EMPTY_FILTER: StatsFilterContext = {
	archivedSourceUids: new Set(),
	presetName: null,
	presetSourceUids: null,
};
