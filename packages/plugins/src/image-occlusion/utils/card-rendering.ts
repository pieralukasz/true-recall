import type { IOMaskMode, IORegion } from "../types";

export type IORegionVisualState =
	| "is-mask-active"
	| "is-mask-passive"
	| "is-outline-passive"
	| "is-revealed-active"
	| "is-revealed-passive";

export interface RenderableIORegion {
	region: IORegion;
	ordinal: number;
}

export function getRegionOrdinal(
	region: IORegion,
	fallbackOrdinal: number,
): number {
	const ordinal = Number.parseInt(region.groupKey, 10);
	return Number.isFinite(ordinal) && ordinal >= 0 ? ordinal : fallbackOrdinal;
}

export function buildRenderableRegions(
	regions: IORegion[],
): RenderableIORegion[] {
	return regions.map((region, index) => ({
		region,
		ordinal: getRegionOrdinal(region, index),
	}));
}

export function getRegionVisualState(
	ordinal: number,
	activeOrdinal: number,
	revealed: boolean,
	maskMode: IOMaskMode,
	revealSingleOnly = false,
): IORegionVisualState {
	const isActive = ordinal === activeOrdinal;
	if (revealed) {
		if (isActive) return "is-revealed-active";
		if (revealSingleOnly) {
			return maskMode === "all" ? "is-mask-passive" : "is-outline-passive";
		}
		return "is-revealed-passive";
	}

	if (isActive) return "is-mask-active";
	return maskMode === "all" ? "is-mask-passive" : "is-outline-passive";
}
