import { useRef } from "preact/hooks";

export function useScrollPreservation() {
	const contentRef = useRef<HTMLDivElement>(null);

	/**
	 * Wraps a synchronous action: captures scroll before, restores after via rAF.
	 * Use for toggleExpand, toggleSelect, and other sync DOM changes.
	 */
	function preserveScroll(action: () => void): void {
		const pos = contentRef.current?.scrollTop ?? 0;
		action();
		requestAnimationFrame(() => {
			if (contentRef.current) contentRef.current.scrollTop = pos;
		});
	}

	/**
	 * Captures current scroll position and returns a restorer function.
	 * Use for async handlers (edit modals, delete operations) where scroll
	 * must be captured BEFORE the async work and restored AFTER.
	 */
	function captureScroll(): () => void {
		const pos = contentRef.current?.scrollTop ?? 0;
		return () => {
			requestAnimationFrame(() => {
				if (contentRef.current) contentRef.current.scrollTop = pos;
			});
		};
	}

	return { contentRef, preserveScroll, captureScroll };
}
