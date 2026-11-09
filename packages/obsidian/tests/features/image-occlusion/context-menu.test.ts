import { TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import { registerImageOcclusionContextMenu } from "../../../src/features/image-occlusion/context-menu";

vi.mock("@true-recall/obsidian/utils/platform", () => ({
	isDesktop: () => true,
}));

function setup(settings: Record<string, unknown>) {
	let handler: ((menu: unknown, file: unknown) => void) | undefined;
	const plugin = {
		settings: { imageOcclusionContextMenu: true, ...settings },
		registerEvent: () => {},
		openImageOcclusionEditorForActiveNote: vi.fn(),
		app: {
			workspace: {
				on: (_name: string, fn: typeof handler) => {
					handler = fn;
					return {};
				},
			},
		},
	};
	registerImageOcclusionContextMenu(plugin as never);
	const image = Object.assign(new TFile(), {
		path: "diagram.png",
		extension: "png",
	});
	const addItem = vi.fn();
	handler?.({ addItem }, image);
	return addItem;
}

describe("image occlusion context menu", () => {
	it("offers the item to Pro users", () => {
		expect(setup({ proKey: "pro-key" })).toHaveBeenCalledOnce();
	});

	it("stays hidden without Pro, like the command", () => {
		expect(setup({ proKey: "" })).not.toHaveBeenCalled();
	});
});
