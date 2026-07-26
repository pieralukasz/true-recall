export type ComposerKeyAction = "submit" | "newline" | "dismiss" | "none";

/** Keyboard contract for every AI composer: Enter submits, Shift+Enter keeps
 * the newline, Escape dismisses the surface. */
export function resolveComposerKeyAction(event: {
	key: string;
	shiftKey: boolean;
}): ComposerKeyAction {
	if (event.key === "Escape") return "dismiss";
	if (event.key !== "Enter") return "none";
	return event.shiftKey ? "newline" : "submit";
}
