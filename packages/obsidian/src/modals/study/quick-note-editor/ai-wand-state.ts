/** Maps the two preconditions into the wand button's disabled state and tooltip. */
export function deriveAIWandState(input: {
	hasSourceNote: boolean;
	assistantActive: boolean;
}): { disabled: boolean; title: string } {
	if (!input.hasSourceNote) {
		return { disabled: true, title: "Select a source note first" };
	}
	if (!input.assistantActive) {
		return {
			disabled: true,
			title: "Enable AI Assistant in plugin settings",
		};
	}
	return { disabled: false, title: "Generate with AI" };
}
