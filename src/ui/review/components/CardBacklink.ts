/**
 * Card Backlink Component
 * Renders a clickable link to the source note
 */

export interface CardBacklinkCallbacks {
	onOpenSource: () => void;
}

export class CardBacklink {
	constructor(private readonly callbacks: CardBacklinkCallbacks) {}

	/**
	 * Render the backlink to source note
	 * @param container Parent element to render into
	 * @param sourceNoteName Name of the source note (null if none)
	 */
	render(container: HTMLElement, sourceNoteName: string | null): void {
		if (!sourceNoteName) return;

		const backlinkEl = container.createDiv({
			cls: "ep:mt-6 ep:text-center",
		});

		const linkEl = backlinkEl.createEl("span", {
			text: sourceNoteName,
			cls: "ep:text-obs-faint ep:text-ui-small ep:cursor-pointer ep:hover:text-obs-muted ep:hover:underline ep:transition-colors",
			attr: { "data-action": "open-source" },
		});

		linkEl.addEventListener("click", () => {
			this.callbacks.onOpenSource();
		});
	}
}
