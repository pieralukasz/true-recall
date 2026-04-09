import { clamp } from "@true-recall/core/utils/canvas-geometry";
import { getNextIOGroupKey } from "@true-recall/core/utils/io-definition";

import type { IODefinition, IORegion, IOShape } from "./types";

export type ResizeCorner = "nw" | "ne" | "sw" | "se";

const MIN_REGION_SIZE = 0.01;

export function getRegionCorner(
	region: IORegion,
	corner: ResizeCorner,
): { x: number; y: number } {
	switch (corner) {
		case "nw":
			return { x: region.x, y: region.y };
		case "ne":
			return { x: region.x + region.w, y: region.y };
		case "sw":
			return { x: region.x, y: region.y + region.h };
		case "se":
			return { x: region.x + region.w, y: region.y + region.h };
	}
}

export function updateRegion(
	definition: IODefinition,
	regionId: string,
	update: (region: IORegion) => IORegion,
): IODefinition {
	return {
		...definition,
		regions: definition.regions.map((region) =>
			region.id === regionId ? update(region) : region,
		),
	};
}

export function deleteRegion(
	definition: IODefinition,
	regionId: string,
): IODefinition {
	return {
		...definition,
		regions: definition.regions.filter((region) => region.id !== regionId),
	};
}

export function buildDraftRegion(
	startX: number,
	startY: number,
	currentX: number,
	currentY: number,
	shape: IOShape,
): IORegion {
	return {
		id: "draft",
		x: Math.min(startX, currentX),
		y: Math.min(startY, currentY),
		w: Math.abs(currentX - startX),
		h: Math.abs(currentY - startY),
		groupKey: "draft",
		shape,
	};
}

export function buildMoveUpdate(
	region: IORegion,
	point: { x: number; y: number },
	offset: { x: number; y: number },
): Pick<IORegion, "x" | "y"> {
	return {
		x: clamp(point.x - offset.x, 0, 1 - region.w),
		y: clamp(point.y - offset.y, 0, 1 - region.h),
	};
}

export function buildResizeUpdate(
	region: IORegion,
	corner: ResizeCorner,
	point: { x: number; y: number },
): Pick<IORegion, "x" | "y" | "w" | "h"> {
	let left = region.x;
	let top = region.y;
	let right = region.x + region.w;
	let bottom = region.y + region.h;

	if (corner === "nw") {
		left = point.x;
		top = point.y;
	} else if (corner === "ne") {
		right = point.x;
		top = point.y;
	} else if (corner === "sw") {
		left = point.x;
		bottom = point.y;
	} else {
		right = point.x;
		bottom = point.y;
	}

	left = clamp(left, 0, right - MIN_REGION_SIZE);
	top = clamp(top, 0, bottom - MIN_REGION_SIZE);
	right = clamp(right, left + MIN_REGION_SIZE, 1);
	bottom = clamp(bottom, top + MIN_REGION_SIZE, 1);

	return {
		x: left,
		y: top,
		w: clamp(right - left, MIN_REGION_SIZE, 1),
		h: clamp(bottom - top, MIN_REGION_SIZE, 1),
	};
}

/**
 * Returns null if draft is too small to commit.
 */
export function commitDraftRegion(
	definition: IODefinition,
	draft: IORegion,
): { definition: IODefinition; regionId: string } | null {
	if (draft.w <= MIN_REGION_SIZE || draft.h <= MIN_REGION_SIZE) return null;

	const id = crypto.randomUUID();
	const region: IORegion = {
		...draft,
		id,
		groupKey: getNextIOGroupKey(definition),
	};

	return {
		definition: { ...definition, regions: [...definition.regions, region] },
		regionId: id,
	};
}
