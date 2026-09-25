/**
 * Keeps a self-sizing popout window fitted to its editor content.
 *
 * The controller is attached to one window at a time. Attaching centres the
 * window (on first mount), pins its width, and starts tracking the content:
 * a ResizeObserver built from that window's own globals, plus a `resize`
 * listener that re-fits whenever something else changes the height
 * (Obsidian restoring a remembered size, a drag, the zoom button). All
 * triggers coalesce into one animation frame.
 *
 * Every listener, observer and frame is remembered together with the window
 * it was registered on, so detaching — on close or when the view migrates to
 * another window — releases it there, and a frame that still fires after
 * detaching does nothing.
 */

import { computeFitOuterHeight } from "./popout-fit";
import {
	applyPopoutHeight,
	centerPopoutWindow,
	getPopoutOuterHeight,
	lockPopoutResize,
} from "./popout-helpers";

/** Elements the fit is measured from. */
export interface EditorWindowLayout {
	/** The view's `.view-content`, whose top offset is Obsidian's chrome. */
	viewContent: HTMLElement;
	dragBar: HTMLElement;
	/** Scroll body wrapping the editor. */
	body: HTMLElement;
	/** The body's first child: the editor's natural-height root. */
	content: HTMLElement;
	/** The editor element inside `content`, when rendered. */
	editor: HTMLElement | null;
}

export interface EditorWindowGeometryOptions {
	/** Current layout, or null while the editor is not rendered. */
	readLayout: () => EditorWindowLayout | null;
	/** Lower bound for the window height, in screen px. */
	minOuterHeight: number;
}

/** Height differences below this are treated as already fitted. */
const FIT_TOLERANCE_PX = 4;
const FALLBACK_MAX_HEIGHT = 1200;

export class EditorWindowGeometryController {
	private win: Window | null = null;
	private observer: ResizeObserver | null = null;
	private resizeHandler: (() => void) | null = null;
	private frame: { win: Window; id: number } | null = null;
	private hasFitted = false;

	constructor(private readonly options: EditorWindowGeometryOptions) {}

	/**
	 * Starts managing `win`, releasing any previous window first. `null`
	 * (an embedded view sharing the main window) only releases: resizing
	 * would resize the whole Obsidian app.
	 */
	attach(win: Window | null, options: { center: boolean }): void {
		this.detach();
		if (!win) return;
		this.win = win;

		// Centre before any measurement so the window never flashes in
		// Electron's default top-left position.
		if (options.center) centerPopoutWindow(win);
		lockPopoutResize(win);

		if (!this.options.readLayout()) return;
		this.schedule();

		const RO =
			(win as Window & { ResizeObserver?: typeof ResizeObserver })
				.ResizeObserver ?? ResizeObserver;
		this.observer = new RO(() => {
			this.observeTargets();
			this.schedule();
		});
		this.observeTargets();

		const handler = () => this.schedule();
		win.addEventListener("resize", handler);
		this.resizeHandler = handler;
	}

	detach(): void {
		if (this.win && this.resizeHandler) {
			this.win.removeEventListener("resize", this.resizeHandler);
		}
		this.resizeHandler = null;
		this.observer?.disconnect();
		this.observer = null;
		if (this.frame) {
			this.frame.win.cancelAnimationFrame(this.frame.id);
			this.frame = null;
		}
		this.win = null;
	}

	/** Makes the next fit centre the window again (a new editor session). */
	resetFit(): void {
		this.hasFitted = false;
	}

	/** Queues a fit for the next frame; repeated calls share one frame. */
	schedule(): void {
		const win = this.win;
		if (!win || this.frame) return;
		const id = win.requestAnimationFrame(() => {
			if (this.frame?.win !== win || this.frame.id !== id) return;
			this.frame = null;
			this.fit();
		});
		this.frame = { win, id };
	}

	private observeTargets(): void {
		const observer = this.observer;
		const layout = this.options.readLayout();
		if (!observer || !layout) return;
		observer.observe(layout.content);
		if (layout.editor) observer.observe(layout.editor);
	}

	private fit(): void {
		const win = this.win;
		const layout = this.options.readLayout();
		if (!win || !layout) return;
		// The editor subtree can be re-rendered; observe whatever is current.
		this.observeTargets();

		const { viewContent, dragBar, body, content, editor } = layout;
		const bodyStyle = win.getComputedStyle(body);
		const bodyPadding =
			(parseFloat(bodyStyle.paddingTop) || 0) +
			(parseFloat(bodyStyle.paddingBottom) || 0);
		const contentHeight = Math.max(
			content.offsetHeight,
			content.scrollHeight,
			editor?.offsetHeight ?? 0,
			editor?.scrollHeight ?? 0,
		);
		const target = computeFitOuterHeight({
			dragBarHeight: dragBar.offsetHeight,
			contentHeight,
			bodyPadding,
			viewportHeight: win.innerHeight,
			viewContentHeight: viewContent.offsetHeight,
			outerWidth: win.outerWidth,
			innerWidth: win.innerWidth,
			minOuterHeight: this.options.minOuterHeight,
			maxOuterHeight: win.screen?.availHeight ?? FALLBACK_MAX_HEIGHT,
		});
		if (target === null) return;

		if (
			this.hasFitted &&
			Math.abs(target - getPopoutOuterHeight(win)) < FIT_TOLERANCE_PX
		) {
			return;
		}

		// Centre only on the first fit, so later growth doesn't move the
		// window around while the user is typing.
		const center = !this.hasFitted;
		applyPopoutHeight(win, target, { center });
		this.hasFitted = true;
	}
}
