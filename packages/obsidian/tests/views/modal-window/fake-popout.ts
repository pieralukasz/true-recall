/**
 * Minimal DOM and window doubles for the popout editor views. Vitest runs in
 * Node, so these model only what the views read: classes, children, a few
 * layout metrics, event listeners and animation frames. Everything is
 * inspectable so tests can assert that listeners and frames are cleaned up
 * on the window they were registered on.
 */
import { vi } from "vitest";

type Listener = (event: unknown) => void;

export class FakeElement {
	nodeType = 1;
	classes = new Set<string>();
	children: FakeElement[] = [];
	parent: FakeElement | null = null;
	offsetHeight = 0;
	scrollHeight = 0;
	isContentEditable = false;
	/** Elements returned by `querySelector`, keyed by selector. */
	selectorMap = new Map<string, FakeElement>();
	closestMap = new Map<string, FakeElement>();
	win: Window | undefined;
	doc: { activeElement: unknown } = { activeElement: null };
	private migrationCallbacks = new Set<() => void>();

	get firstElementChild(): FakeElement | null {
		return this.children[0] ?? null;
	}

	empty(): void {
		for (const child of this.children) child.parent = null;
		this.children = [];
	}

	addClass(cls: string): void {
		this.classes.add(cls);
	}

	removeClass(cls: string): void {
		this.classes.delete(cls);
	}

	toggleClass(cls: string, value: boolean): void {
		if (value) this.classes.add(cls);
		else this.classes.delete(cls);
	}

	createDiv(options?: { cls?: string; text?: string }): FakeElement {
		const child = new FakeElement();
		if (options?.cls) child.classes.add(options.cls);
		child.parent = this;
		this.children.push(child);
		return child;
	}

	remove(): void {
		if (!this.parent) return;
		this.parent.children = this.parent.children.filter((c) => c !== this);
		this.parent = null;
	}

	querySelector(selector: string): FakeElement | null {
		return this.selectorMap.get(selector) ?? null;
	}

	closest(selector: string): FakeElement | null {
		return this.closestMap.get(selector) ?? null;
	}

	onWindowMigrated(callback: () => void): () => void {
		this.migrationCallbacks.add(callback);
		return () => this.migrationCallbacks.delete(callback);
	}

	/** Simulates Obsidian moving the view into another window. */
	migrateTo(win: Window): void {
		this.win = win;
		for (const callback of [...this.migrationCallbacks]) callback();
	}

	get migrationListenerCount(): number {
		return this.migrationCallbacks.size;
	}

	/** Constructors this element counts as an instance of (`instanceOf`). */
	kinds = new Set<unknown>();

	instanceOf(ctor: unknown): boolean {
		return this.kinds.has(ctor);
	}
}

export class FakeResizeObserver {
	static instances: FakeResizeObserver[] = [];
	observed = new Set<unknown>();
	disconnected = false;

	constructor(readonly callback: () => void) {
		FakeResizeObserver.instances.push(this);
	}

	observe(target: unknown): void {
		this.observed.add(target);
	}

	disconnect(): void {
		this.disconnected = true;
		this.observed.clear();
	}
}

export interface FakeWindow {
	win: Window;
	listeners: Map<string, Set<Listener>>;
	frames: Map<number, () => void>;
	cancelAnimationFrame: ReturnType<typeof vi.fn>;
	setTimeout: ReturnType<typeof vi.fn>;
	/** Runs every queued animation frame. */
	flushFrames(): void;
	dispatch(type: string, event?: unknown): void;
	listenerCount(type: string): number;
}

export function createFakeWindow(
	overrides: Partial<{
		innerHeight: number;
		innerWidth: number;
		outerWidth: number;
		availHeight: number;
		paddingTop: string;
		paddingBottom: string;
	}> = {},
): FakeWindow {
	const listeners = new Map<string, Set<Listener>>();
	const frames = new Map<number, () => void>();
	let nextFrame = 1;

	const cancelAnimationFrame = vi.fn((id: number) => {
		frames.delete(id);
	});
	const setTimeout = vi.fn((callback: () => void, _ms?: number) => {
		callback();
		return 0;
	});

	const win = {
		innerHeight: overrides.innerHeight ?? 400,
		innerWidth: overrides.innerWidth ?? 720,
		outerWidth: overrides.outerWidth ?? 720,
		outerHeight: 400,
		screen: { availHeight: overrides.availHeight ?? 1000 },
		ResizeObserver: FakeResizeObserver,
		addEventListener: (type: string, listener: Listener) => {
			if (!listeners.has(type)) listeners.set(type, new Set());
			listeners.get(type)?.add(listener);
		},
		removeEventListener: (type: string, listener: Listener) => {
			listeners.get(type)?.delete(listener);
		},
		requestAnimationFrame: (callback: () => void) => {
			const id = nextFrame++;
			frames.set(id, callback);
			return id;
		},
		cancelAnimationFrame,
		setTimeout,
		getComputedStyle: () => ({
			paddingTop: overrides.paddingTop ?? "8px",
			paddingBottom: overrides.paddingBottom ?? "8px",
		}),
	} as unknown as Window;

	return {
		win,
		listeners,
		frames,
		cancelAnimationFrame,
		setTimeout,
		flushFrames() {
			const pending = [...frames.entries()];
			frames.clear();
			for (const [, callback] of pending) callback();
		},
		dispatch(type, event) {
			for (const listener of [...(listeners.get(type) ?? [])]) {
				listener(event);
			}
		},
		listenerCount(type) {
			return listeners.get(type)?.size ?? 0;
		},
	};
}
