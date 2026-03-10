export interface StatsFilterContext {
	archivedSourceUids: ReadonlySet<string>;
	presetNames: ReadonlySet<string> | null;
	presetSourceUids: ReadonlySet<string> | null;
}

export const EMPTY_FILTER: StatsFilterContext = {
	archivedSourceUids: new Set(),
	presetNames: null,
	presetSourceUids: null,
};
