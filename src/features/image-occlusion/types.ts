export type IOShape = "rect" | "ellipse";
export type IOMaskMode = "solo" | "all";

/** Normalized coordinates (0-1 range) for resolution independence */
export interface IORegion {
	id: string;
	/** Left edge, normalized 0-1 */
	x: number;
	/** Top edge, normalized 0-1 */
	y: number;
	/** Width, normalized 0-1 */
	w: number;
	/** Height, normalized 0-1 */
	h: number;
	groupKey: string;
	shape: IOShape;
	label?: string;
}

export interface IODefinition {
	regions: IORegion[];
	maskMode: IOMaskMode;
	version: 1;
}

export interface IOEditorResult {
	cancelled: boolean;
	imagePath?: string;
	definition?: IODefinition;
	prompt?: string;
}
