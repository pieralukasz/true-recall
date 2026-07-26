/** Why the AI is being opened. The intent — not the feature — decides which
 * surface renders, so running a saved preset stays as fast as it was before the
 * workspace existed. */
export type AiSurfaceIntent =
	/** A saved preset is about to run: preset list first, one click to run. */
	| "preset"
	/** A question about selected text, anchored where the selection is. */
	| "selection"
	/** Free-text writing or research, where vertical room matters. */
	| "compose";

export type AiSurfaceKind = "popover" | "docked" | "modal" | "popout";

export interface AiSurfaceRequest {
	intent: AiSurfaceIntent;
	/** Whether the caller can anchor a floating surface to an element or rect. */
	hasAnchor: boolean;
	isMobile: boolean;
	/** Honored on desktop when the caller deliberately wants another surface. */
	prefer?: AiSurfaceKind;
}

/** Mobile has no sidebar worth docking into and no popout windows, so every
 * invocation collapses to a modal there. */
export function resolveAiSurface(request: AiSurfaceRequest): AiSurfaceKind {
	if (request.isMobile) return "modal";
	if (request.prefer) return request.prefer;

	if (request.intent === "compose") return "docked";
	// Fast paths float next to their trigger; without an anchor there is nothing
	// to float against, so they fall back to the docked panel.
	return request.hasAnchor ? "popover" : "docked";
}

/** Fast surfaces open on the preset list; roomy ones open on the composer. */
export function entryForSurface(
	surface: AiSurfaceKind,
	intent: AiSurfaceIntent,
): "presets" | "compose" {
	if (intent === "preset") return "presets";
	if (surface === "popover") return "presets";
	return "compose";
}
