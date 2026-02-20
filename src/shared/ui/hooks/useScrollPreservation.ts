import type { RefObject } from "preact";
import { useCallback, useRef } from "preact/hooks";

export interface ScrollPreservation {
	save: () => void;
	restore: () => void;
	/** Run an action and automatically preserve/restore scroll position */
	preserveAround: (action: () => void | Promise<void>) => Promise<void>;
}

/**
 * Saves and restores scrollTop on a container element.
 * Replaces the repeated `scrollTop = contentRef.current?.scrollTop ?? 0` +
 * `requestAnimationFrame(() => contentRef.current.scrollTop = pos)` pattern.
 */
export function useScrollPreservation(
	containerRef: RefObject<HTMLElement>,
): ScrollPreservation {
	const savedPosition = useRef(0);

	const save = useCallback(() => {
		savedPosition.current = containerRef.current?.scrollTop ?? 0;
	}, [containerRef]);

	const restore = useCallback(() => {
		const pos = savedPosition.current;
		requestAnimationFrame(() => {
			if (containerRef.current) containerRef.current.scrollTop = pos;
		});
	}, [containerRef]);

	const preserveAround = useCallback(
		async (action: () => void | Promise<void>) => {
			save();
			await action();
			restore();
		},
		[save, restore],
	);

	return { save, restore, preserveAround };
}
