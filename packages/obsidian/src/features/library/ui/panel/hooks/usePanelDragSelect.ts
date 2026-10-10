import type { RefObject } from "preact";
import { useCallback, useEffect, useRef } from "preact/hooks";

import type { PanelItem } from "@true-recall/obsidian/features/library/ui/panel/group-cards";
import {
	computeDragSelection,
	getDragSelectMode,
	getPanelItemCardIds,
} from "@true-recall/obsidian/features/library/ui/panel/utils/drag-select.utils";

const ROW_SELECTOR = "[data-panel-row-index]";
const START_THRESHOLD_PX = 6;
const SCROLL_EDGE_PX = 28;
const SCROLL_STEP_PX = 8;
const SCROLL_INTERVAL_MS = 30;

interface DragSelectArgs {
	listRef: RefObject<HTMLElement>;
	scrollRef: RefObject<HTMLElement>;
	items: PanelItem[];
	selectedCardIds: Set<string>;
	isSelectionMode: boolean;
	onReplaceSelection: (cardIds: string[]) => void;
}

interface DragState {
	anchorIndex: number;
	base: Set<string>;
	mode: "add" | "remove";
	startY: number;
	lastX: number;
	lastY: number;
	moved: boolean;
}

/**
 * Drag to select (like Finder or Gmail): press the mouse on a card row and move over
 * other rows with the button held. Rows between the start and the pointer take the
 * start row's new state; a plain click still opens or toggles the card.
 */
export function usePanelDragSelect(args: DragSelectArgs) {
	const argsRef = useRef(args);
	argsRef.current = args;
	const cleanupRef = useRef<(() => void) | null>(null);

	useEffect(() => () => cleanupRef.current?.(), []);

	return useCallback((event: PointerEvent) => {
		if (
			event.pointerType !== "mouse" ||
			event.button !== 0 ||
			event.shiftKey ||
			event.metaKey ||
			event.ctrlKey ||
			event.altKey
		)
			return;
		const target = event.target as HTMLElement | null;
		if (!target || target.closest(".tr-panel-icon-button")) return;
		const list = argsRef.current.listRef.current;
		const anchorIndex = getRowIndex(target, list);
		if (anchorIndex === null) return;

		const { items, selectedCardIds, isSelectionMode } = argsRef.current;
		const anchorItem = items[anchorIndex];
		if (!anchorItem) return;
		const base = isSelectionMode ? new Set(selectedCardIds) : new Set<string>();
		const drag: DragState = {
			anchorIndex,
			base,
			mode: getDragSelectMode(getPanelItemCardIds(anchorItem), base),
			startY: event.clientY,
			lastX: event.clientX,
			lastY: event.clientY,
			moved: false,
		};
		const doc = target.ownerDocument;
		const win = doc.defaultView ?? window;

		const apply = (overIndex: number) => {
			const current = argsRef.current;
			current.onReplaceSelection(
				computeDragSelection({
					rows: current.items.map(getPanelItemCardIds),
					base: drag.base,
					anchorIndex: drag.anchorIndex,
					overIndex,
					mode: drag.mode,
				}),
			);
		};

		const rowAt = (x: number, y: number) =>
			getRowIndex(
				doc.elementFromPoint(x, y) as HTMLElement | null,
				argsRef.current.listRef.current,
			);

		const onMove = (moveEvent: PointerEvent) => {
			drag.lastX = moveEvent.clientX;
			drag.lastY = moveEvent.clientY;
			const overIndex = rowAt(moveEvent.clientX, moveEvent.clientY);
			if (
				!drag.moved &&
				((overIndex !== null && overIndex !== drag.anchorIndex) ||
					Math.abs(moveEvent.clientY - drag.startY) > START_THRESHOLD_PX)
			) {
				drag.moved = true;
				list?.classList.add("tr-panel-drag-selecting");
				doc.getSelection()?.removeAllRanges();
				apply(drag.anchorIndex);
			}
			if (!drag.moved) return;
			moveEvent.preventDefault();
			if (overIndex !== null) apply(overIndex);
		};

		const autoScroll = () => {
			const scroller = argsRef.current.scrollRef.current;
			if (!drag.moved || !scroller) return;
			const rect = scroller.getBoundingClientRect();
			const dy =
				drag.lastY < rect.top + SCROLL_EDGE_PX
					? -SCROLL_STEP_PX
					: drag.lastY > rect.bottom - SCROLL_EDGE_PX
						? SCROLL_STEP_PX
						: 0;
			if (!dy) return;
			scroller.scrollTop += dy;
			const y = Math.min(Math.max(drag.lastY, rect.top + 2), rect.bottom - 2);
			const x = Math.min(Math.max(drag.lastX, rect.left + 2), rect.right - 2);
			const overIndex = rowAt(x, y);
			if (overIndex !== null) apply(overIndex);
		};

		const blockNative = (nativeEvent: Event) => {
			if (drag.moved) nativeEvent.preventDefault();
		};

		const swallowClick = (clickEvent: MouseEvent) => {
			clickEvent.preventDefault();
			clickEvent.stopPropagation();
		};

		const timer = win.setInterval(autoScroll, SCROLL_INTERVAL_MS);

		const cleanup = () => {
			win.clearInterval(timer);
			doc.removeEventListener("pointermove", onMove, true);
			doc.removeEventListener("pointerup", onUp, true);
			doc.removeEventListener("pointercancel", cleanup, true);
			doc.removeEventListener("selectstart", blockNative, true);
			doc.removeEventListener("dragstart", blockNative, true);
			list?.classList.remove("tr-panel-drag-selecting");
			cleanupRef.current = null;
		};

		function onUp() {
			const moved = drag.moved;
			cleanup();
			if (!moved) return;
			// Entering selection mode swaps the pressed row button for a checkbox, which drops
			// focus to the body; keep it in the panel so Esc and ⌘A still work.
			const listEl = argsRef.current.listRef.current;
			if (listEl && !listEl.contains(doc.activeElement))
				listEl.focus({ preventScroll: true });
			// The click that follows a drag must not open the card or toggle its checkbox.
			doc.addEventListener("click", swallowClick, true);
			win.setTimeout(
				() => doc.removeEventListener("click", swallowClick, true),
				0,
			);
		}

		cleanupRef.current?.();
		cleanupRef.current = cleanup;
		doc.addEventListener("pointermove", onMove, true);
		doc.addEventListener("pointerup", onUp, true);
		doc.addEventListener("pointercancel", cleanup, true);
		doc.addEventListener("selectstart", blockNative, true);
		doc.addEventListener("dragstart", blockNative, true);
	}, []);
}

function getRowIndex(
	element: HTMLElement | null,
	list: HTMLElement | null,
): number | null {
	const row = element?.closest?.(ROW_SELECTOR) as HTMLElement | null;
	if (!row || !list?.contains(row)) return null;
	const index = Number(row.dataset.panelRowIndex);
	return Number.isInteger(index) ? index : null;
}
