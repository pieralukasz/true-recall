import { useEffect, useState } from "preact/hooks";

import { isMobile } from "@true-recall/obsidian/utils/platform";

const SOFT_KEYBOARD_MIN_HEIGHT = 80;
const REVEAL_DELAYS_MS = [90, 300, 650] as const;
const TRUE_RECALL_SURFACE = [
	'[data-type^="true-recall-"]',
	".true-recall-modal",
	".tr-modal-host",
	".true-recall-add-field",
].join(", ");

type KeyboardListener = (isOpen: boolean) => void;

let controllerCleanup: (() => void) | null = null;
let keyboardOpen = false;
const keyboardListeners = new Set<KeyboardListener>();

function readPixelVariable(element: HTMLElement, name: string): number {
	const inlineValue = element.style.getPropertyValue(name);
	const value = inlineValue || getComputedStyle(element).getPropertyValue(name);
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function isEditableElement(element: Element | null): element is HTMLElement {
	return (
		element instanceof HTMLElement &&
		(element.isContentEditable || element.matches("input, textarea"))
	);
}

function isTrueRecallInput(element: Element | null): element is HTMLElement {
	return (
		isEditableElement(element) && element.closest(TRUE_RECALL_SURFACE) !== null
	);
}

function findScrollContainer(element: HTMLElement): HTMLElement | null {
	for (
		let parent = element.parentElement;
		parent;
		parent = parent.parentElement
	) {
		const overflowY = getComputedStyle(parent).overflowY;
		if (
			(overflowY === "auto" || overflowY === "scroll") &&
			parent.scrollHeight > parent.clientHeight + 1
		) {
			return parent;
		}
	}
	return null;
}

function getCaretRect(element: HTMLElement): DOMRect {
	const selection = activeDocument.getSelection();
	if (selection?.rangeCount && element.contains(selection.anchorNode)) {
		const rect = selection.getRangeAt(0).getBoundingClientRect();
		if (rect.height || rect.width) return rect;
	}
	return element.getBoundingClientRect();
}

function unpanDocument(): void {
	if (!isTrueRecallInput(activeDocument.activeElement)) return;
	if (window.scrollY) window.scrollTo(0, 0);
	if (activeDocument.documentElement.scrollTop) {
		activeDocument.documentElement.scrollTop = 0;
	}
	if (activeDocument.body.scrollTop) activeDocument.body.scrollTop = 0;
}

function revealActiveInput(): void {
	unpanDocument();
	const activeElement = activeDocument.activeElement;
	if (!isTrueRecallInput(activeElement)) return;

	const scroller = findScrollContainer(activeElement);
	if (!scroller) return;

	const scrollerRect = scroller.getBoundingClientRect();
	const caretRect = getCaretRect(activeElement);
	const edgePadding = 12;
	if (caretRect.bottom > scrollerRect.bottom - edgePadding) {
		scroller.scrollTop +=
			caretRect.bottom - (scrollerRect.bottom - edgePadding);
	} else if (caretRect.top < scrollerRect.top + edgePadding) {
		scroller.scrollTop -= scrollerRect.top + edgePadding - caretRect.top;
	}
}

function notifyKeyboardListeners(nextOpen: boolean): void {
	if (keyboardOpen === nextOpen) return;
	keyboardOpen = nextOpen;
	for (const listener of keyboardListeners) listener(nextOpen);
}

function installKeyboardController(): () => void {
	const viewport = window.visualViewport;
	const documentElement = activeDocument.documentElement;
	let maximumViewportHeight = Math.min(
		window.innerHeight,
		viewport?.height ?? window.innerHeight,
	);
	let nativeKeyboardHeight = 0;
	let revealTimers: number[] = [];

	const measure = () => {
		const currentViewportHeight = Math.min(
			window.innerHeight,
			viewport?.height ?? window.innerHeight,
		);
		const viewportInset = viewport
			? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
			: 0;
		const obsidianKeyboardHeight = readPixelVariable(
			documentElement,
			"--keyboard-height",
		);
		const activeElement = activeDocument.activeElement;
		const hasEditableFocus = isEditableElement(activeElement);

		if (
			!hasEditableFocus &&
			viewportInset < SOFT_KEYBOARD_MIN_HEIGHT &&
			obsidianKeyboardHeight < SOFT_KEYBOARD_MIN_HEIGHT
		) {
			maximumViewportHeight = Math.max(
				maximumViewportHeight,
				currentViewportHeight,
			);
		}

		const heightLoss = maximumViewportHeight - currentViewportHeight;
		const keyboardHeight = Math.max(
			nativeKeyboardHeight,
			viewportInset,
			obsidianKeyboardHeight,
			hasEditableFocus ? heightLoss : 0,
		);
		activeDocument.body.style.setProperty(
			"--tr-keyboard-inset",
			`${Math.round(keyboardHeight)}px`,
		);
		notifyKeyboardListeners(keyboardHeight >= SOFT_KEYBOARD_MIN_HEIGHT);
	};

	const scheduleReveal = () => {
		measure();
		for (const timer of revealTimers) window.clearTimeout(timer);
		revealTimers = REVEAL_DELAYS_MS.map((delay) =>
			window.setTimeout(revealActiveInput, delay),
		);
	};

	const handleKeyboardShow = (event: Event) => {
		const height = (event as Event & { keyboardHeight?: number })
			.keyboardHeight;
		nativeKeyboardHeight = typeof height === "number" ? height : 0;
		scheduleReveal();
	};
	const handleKeyboardHide = () => {
		nativeKeyboardHeight = 0;
		scheduleReveal();
	};
	const handleViewportScroll = () => {
		unpanDocument();
		measure();
	};
	const keyboardHeightObserver = new MutationObserver(scheduleReveal);
	keyboardHeightObserver.observe(documentElement, {
		attributes: true,
		attributeFilter: ["style"],
	});

	measure();
	window.addEventListener("keyboardWillShow", handleKeyboardShow);
	window.addEventListener("keyboardWillHide", handleKeyboardHide);
	window.addEventListener("resize", scheduleReveal);
	viewport?.addEventListener("resize", scheduleReveal);
	viewport?.addEventListener("scroll", handleViewportScroll);
	activeDocument.addEventListener("focusin", scheduleReveal);
	activeDocument.addEventListener("focusout", scheduleReveal);

	return () => {
		for (const timer of revealTimers) window.clearTimeout(timer);
		keyboardHeightObserver.disconnect();
		window.removeEventListener("keyboardWillShow", handleKeyboardShow);
		window.removeEventListener("keyboardWillHide", handleKeyboardHide);
		window.removeEventListener("resize", scheduleReveal);
		viewport?.removeEventListener("resize", scheduleReveal);
		viewport?.removeEventListener("scroll", handleViewportScroll);
		activeDocument.removeEventListener("focusin", scheduleReveal);
		activeDocument.removeEventListener("focusout", scheduleReveal);
		activeDocument.body.style.removeProperty("--tr-keyboard-inset");
		notifyKeyboardListeners(false);
	};
}

function subscribeToKeyboard(listener: KeyboardListener): () => void {
	keyboardListeners.add(listener);
	listener(keyboardOpen);
	if (!controllerCleanup && isMobile()) {
		controllerCleanup = installKeyboardController();
	}

	return () => {
		keyboardListeners.delete(listener);
		if (keyboardListeners.size === 0 && controllerCleanup) {
			const cleanup = controllerCleanup;
			controllerCleanup = null;
			cleanup();
		}
	};
}

/**
 * Tracks Obsidian's native mobile keyboard height, with VisualViewport and
 * focus-based fallbacks for iOS WebView. The shared controller also keeps the
 * focused True Recall field visible after the keyboard animation settles.
 */
export function useKeyboardInset(): boolean {
	const [isKeyboardOpen, setIsKeyboardOpen] = useState(keyboardOpen);

	useEffect(() => subscribeToKeyboard(setIsKeyboardOpen), []);

	return isKeyboardOpen;
}
