import {
	createEmptyIODefinition,
	getNextIOGroupKey,
	parseIODefinition,
} from "@true-recall/core/utils/io-definition";

import type {
	IODefinition,
	IOEditorMode,
	IOEditorTool,
	IORegion,
} from "../types";
import { updateRegion } from "./canvas-interactions";

export interface IOEditorInitialState {
	definition: IODefinition;
	imagePath: string;
	tool: IOEditorTool;
}

export type EditableRegionFields = Pick<
	IORegion,
	"x" | "y" | "w" | "h" | "label"
>;

export function createIOEditorInitialState(
	mode: IOEditorMode,
): IOEditorInitialState {
	const definition =
		mode.mode === "edit"
			? (parseIODefinition(mode.note.fields.Regions) ??
				createEmptyIODefinition("solo"))
			: createEmptyIODefinition("solo");
	const imagePath =
		mode.mode === "edit"
			? (mode.note.fields.Image ?? "")
			: (mode.imagePath ?? "");

	return {
		definition,
		imagePath,
		tool: definition.regions.length > 0 ? "select" : "rect",
	};
}

export function appendDetectedRegions(
	definition: IODefinition,
	regions: IORegion[],
): IODefinition {
	let nextGroupKey = Number(getNextIOGroupKey(definition));
	const keyedRegions = regions.map((region) => ({
		...region,
		groupKey: String(nextGroupKey++),
	}));

	return {
		...definition,
		regions: [...definition.regions, ...keyedRegions],
	};
}

export function patchRegion(
	definition: IODefinition,
	regionId: string,
	patch: Partial<EditableRegionFields>,
): IODefinition {
	return updateRegion(definition, regionId, (region) => ({
		...region,
		...patch,
	}));
}
