/**
 * Derives the wand button's disabled state + tooltip from settings and source-note availability.
 * Pure function — no Preact/Obsidian deps — trivially unit-testable.
 */
export function deriveAIWandState(input: {
	hasSourceNote: boolean;
	cardPolishActive: boolean;
}): { disabled: boolean; title: string } {
	if (!input.hasSourceNote) {
		return { disabled: true, title: "Select a source note first" };
	}
	if (!input.cardPolishActive) {
		return {
			disabled: true,
			title: "Enable Card Polish in plugin settings",
		};
	}
	return { disabled: false, title: "Generate with AI" };
}
