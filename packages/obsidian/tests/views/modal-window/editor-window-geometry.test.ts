import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	EditorWindowGeometryController,
	type EditorWindowLayout,
} from "@true-recall/obsidian/views/modal-window/editor-window-geometry";

import {
	createFakeWindow,
	FakeElement,
	FakeResizeObserver,
} from "./fake-popout";

const helpers = vi.hoisted(() => ({
	outerHeight: { value: 280 },
	centerPopoutWindow: vi.fn(),
	lockPopoutResize: vi.fn(),
	applyPopoutHeight: vi.fn(),
}));

vi.mock("@true-recall/obsidian/views/modal-window/popout-helpers", () => ({
	centerPopoutWindow: helpers.centerPopoutWindow,
	lockPopoutResize: helpers.lockPopoutResize,
	applyPopoutHeight: helpers.applyPopoutHeight,
	getPopoutOuterHeight: () => helpers.outerHeight.value,
}));

function createLayout(): EditorWindowLayout & {
	viewContent: FakeElement;
	content: FakeElement;
	editor: FakeElement;
} {
	const viewContent = new FakeElement();
	viewContent.offsetHeight = 360;
	const dragBar = new FakeElement();
	dragBar.offsetHeight = 40;
	const content = new FakeElement();
	content.offsetHeight = 300;
	content.scrollHeight = 300;
	const editor = new FakeElement();
	return {
		viewContent,
		dragBar: dragBar as unknown as HTMLElement,
		body: new FakeElement() as unknown as HTMLElement,
		content,
		editor,
	} as never;
}

function createController(layout: EditorWindowLayout | null = createLayout()) {
	const state = { layout };
	const controller = new EditorWindowGeometryController({
		readLayout: () => state.layout,
		minOuterHeight: 280,
	});
	return { controller, state };
}

beforeEach(() => {
	helpers.outerHeight.value = 280;
	helpers.centerPopoutWindow.mockReset();
	helpers.lockPopoutResize.mockReset();
	helpers.applyPopoutHeight.mockReset();
	FakeResizeObserver.instances.length = 0;
});

describe("EditorWindowGeometryController", () => {
	describe("attach", () => {
		it("centres, locks and schedules a first fit", () => {
			const fw = createFakeWindow();
			const { controller } = createController();

			controller.attach(fw.win, { center: true });

			expect(helpers.centerPopoutWindow).toHaveBeenCalledWith(fw.win);
			expect(helpers.lockPopoutResize).toHaveBeenCalledWith(fw.win);
			expect(fw.frames.size).toBe(1);
			expect(fw.listenerCount("resize")).toBe(1);
		});

		it("does not centre when asked not to", () => {
			const fw = createFakeWindow();
			const { controller } = createController();

			controller.attach(fw.win, { center: false });

			expect(helpers.centerPopoutWindow).not.toHaveBeenCalled();
			expect(helpers.lockPopoutResize).toHaveBeenCalledWith(fw.win);
		});

		it("does nothing for an embedded view", () => {
			const { controller } = createController();

			controller.attach(null, { center: true });
			controller.schedule();

			expect(helpers.centerPopoutWindow).not.toHaveBeenCalled();
			expect(FakeResizeObserver.instances).toHaveLength(0);
		});

		it("does not track before the editor is rendered", () => {
			const fw = createFakeWindow();
			const { controller } = createController(null);

			controller.attach(fw.win, { center: true });

			expect(fw.frames.size).toBe(0);
			expect(fw.listenerCount("resize")).toBe(0);
			expect(FakeResizeObserver.instances).toHaveLength(0);
		});

		it("builds the observer from the popout's own globals", () => {
			const fw = createFakeWindow();
			const layout = createLayout();
			const { controller } = createController(layout);

			controller.attach(fw.win, { center: true });

			const observer = FakeResizeObserver.instances[0];
			expect(observer?.observed.has(layout.content)).toBe(true);
			expect(observer?.observed.has(layout.editor)).toBe(true);
		});
	});

	describe("fit", () => {
		it("fits content plus Obsidian's chrome and centres the first time", () => {
			const fw = createFakeWindow();
			const { controller } = createController();
			controller.attach(fw.win, { center: true });

			fw.flushFrames();

			// drag bar 40 + content 300 + padding 16 + tab header (400 - 360)
			expect(helpers.applyPopoutHeight).toHaveBeenCalledWith(fw.win, 396, {
				center: true,
			});
		});

		it("does not re-centre later fits", () => {
			const fw = createFakeWindow();
			const layout = createLayout();
			const { controller } = createController(layout);
			controller.attach(fw.win, { center: true });
			fw.flushFrames();
			helpers.outerHeight.value = 396;

			layout.content.offsetHeight = 500;
			controller.schedule();
			fw.flushFrames();

			expect(helpers.applyPopoutHeight).toHaveBeenLastCalledWith(fw.win, 596, {
				center: false,
			});
		});

		it("applies the first fit even when the size already matches", () => {
			const fw = createFakeWindow();
			const { controller } = createController();
			helpers.outerHeight.value = 396;
			controller.attach(fw.win, { center: true });

			fw.flushFrames();

			expect(helpers.applyPopoutHeight).toHaveBeenCalledTimes(1);
		});

		it.each([
			[3, false],
			[4, true],
		])("treats a %ipx difference as fitted: %s", (delta, applies) => {
			const fw = createFakeWindow();
			const { controller } = createController();
			controller.attach(fw.win, { center: true });
			fw.flushFrames();
			helpers.applyPopoutHeight.mockClear();
			helpers.outerHeight.value = 396 + delta;

			controller.schedule();
			fw.flushFrames();

			expect(helpers.applyPopoutHeight).toHaveBeenCalledTimes(applies ? 1 : 0);
		});

		it("centres again after resetFit", () => {
			const fw = createFakeWindow();
			const { controller } = createController();
			controller.attach(fw.win, { center: true });
			fw.flushFrames();

			controller.resetFit();
			controller.schedule();
			fw.flushFrames();

			expect(helpers.applyPopoutHeight).toHaveBeenLastCalledWith(fw.win, 396, {
				center: true,
			});
		});

		it("keeps the fitted state across a window migration", () => {
			const first = createFakeWindow();
			const second = createFakeWindow();
			const { controller } = createController();
			controller.attach(first.win, { center: true });
			first.flushFrames();
			helpers.outerHeight.value = 200;

			controller.attach(second.win, { center: false });
			second.flushFrames();

			expect(helpers.applyPopoutHeight).toHaveBeenLastCalledWith(
				second.win,
				396,
				{ center: false },
			);
		});

		it("skips a frame whose editor has been removed", () => {
			const fw = createFakeWindow();
			const { controller, state } = createController();
			controller.attach(fw.win, { center: true });

			state.layout = null;
			fw.flushFrames();

			expect(helpers.applyPopoutHeight).not.toHaveBeenCalled();
		});

		it("clamps to the usable screen height", () => {
			const fw = createFakeWindow({ availHeight: 500 });
			const layout = createLayout();
			layout.content.offsetHeight = 2000;
			const { controller } = createController(layout);
			controller.attach(fw.win, { center: true });

			fw.flushFrames();

			expect(helpers.applyPopoutHeight).toHaveBeenCalledWith(fw.win, 500, {
				center: true,
			});
		});
	});

	describe("scheduling", () => {
		it("coalesces triggers into one frame", () => {
			const fw = createFakeWindow();
			const { controller } = createController();
			controller.attach(fw.win, { center: true });

			fw.dispatch("resize");
			controller.schedule();
			FakeResizeObserver.instances[0]?.callback();

			expect(fw.frames.size).toBe(1);
		});

		it("schedules again after a frame ran", () => {
			const fw = createFakeWindow();
			const { controller } = createController();
			controller.attach(fw.win, { center: true });
			fw.flushFrames();

			fw.dispatch("resize");

			expect(fw.frames.size).toBe(1);
		});
	});

	describe("detach", () => {
		it("releases the listener, observer and pending frame", () => {
			const fw = createFakeWindow();
			const { controller } = createController();
			controller.attach(fw.win, { center: true });

			controller.detach();

			expect(fw.listenerCount("resize")).toBe(0);
			expect(fw.cancelAnimationFrame).toHaveBeenCalledTimes(1);
			expect(fw.frames.size).toBe(0);
			expect(FakeResizeObserver.instances[0]?.disconnected).toBe(true);
		});

		it("cancels the frame on the window that requested it", () => {
			const first = createFakeWindow();
			const second = createFakeWindow();
			const { controller } = createController();
			controller.attach(first.win, { center: true });

			controller.attach(second.win, { center: false });

			expect(first.cancelAnimationFrame).toHaveBeenCalledTimes(1);
			expect(second.cancelAnimationFrame).not.toHaveBeenCalled();
			expect(first.listenerCount("resize")).toBe(0);
			expect(second.listenerCount("resize")).toBe(1);
		});

		it("ignores a frame that fires after detaching", () => {
			const fw = createFakeWindow();
			fw.cancelAnimationFrame.mockImplementation(() => {});
			const { controller } = createController();
			controller.attach(fw.win, { center: true });

			controller.detach();
			fw.flushFrames();

			expect(helpers.applyPopoutHeight).not.toHaveBeenCalled();
		});

		it("stops scheduling after detaching", () => {
			const fw = createFakeWindow();
			const { controller } = createController();
			controller.attach(fw.win, { center: true });
			controller.detach();

			controller.schedule();

			expect(fw.frames.size).toBe(0);
		});
	});
});
