import { useEffect } from "preact/hooks";

import { isMobile } from "@true-recall/obsidian/utils/platform";

/**
 * Tracks the soft-keyboard overlap via the VisualViewport API and exposes it
 * as the `--tr-keyboard-inset` CSS variable on document.body, so sticky
 * footers (Save buttons, grade bars) can stay above the keyboard. No-op on
 * desktop and on WebViews without visualViewport.
 */
export function useKeyboardInset(): void {
	useEffect(() => {
		const viewport = window.visualViewport;
		if (!viewport || !isMobile()) return;

		const update = () => {
			const inset = Math.max(
				0,
				window.innerHeight - viewport.height - viewport.offsetTop,
			);
			activeDocument.body.style.setProperty(
				"--tr-keyboard-inset",
				`${Math.round(inset)}px`,
			);
		};

		update();
		viewport.addEventListener("resize", update);
		viewport.addEventListener("scroll", update);
		return () => {
			viewport.removeEventListener("resize", update);
			viewport.removeEventListener("scroll", update);
			activeDocument.body.style.removeProperty("--tr-keyboard-inset");
		};
	}, []);
}
