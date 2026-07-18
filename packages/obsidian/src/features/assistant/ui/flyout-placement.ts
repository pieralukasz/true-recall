export const AI_PANEL_WIDTH = 400;
export const AI_PANEL_GAP = 12;

export type FlyoutPlacement = "right" | "drawer";

/** The quick note editor popout must never move or shrink (user requirement),
 * so the AI panel either grows the window rightward or docks as a drawer. */
export function resolveFlyoutPlacement(input: {
	isPopout: boolean;
	spaceRightPx: number;
}): FlyoutPlacement {
	if (!input.isPopout) return "drawer";
	return input.spaceRightPx >= AI_PANEL_WIDTH + AI_PANEL_GAP
		? "right"
		: "drawer";
}
