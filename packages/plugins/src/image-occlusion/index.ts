import type { PluginManifest } from "../types";
import { ImageOcclusionSettingsPanel } from "./settings-panel";

export { IOCardRenderer } from "./components/IOCardRenderer";
export { IOEditorApp } from "./components/IOEditorApp";
export { IOEditorModal } from "./components/IOEditorModal";
export type { IOEditorMode, IOEditorResult } from "./types";

export const imageOcclusionManifest: PluginManifest = {
	info: {
		id: "image-occlusion",
		name: "Image Occlusion",
		description:
			"Create flashcards by masking regions of images. Draw rectangles and ellipses over diagrams, maps, or any image to test visual recall.",
		features: [
			"Draw rectangular and elliptical occlusion regions",
			"AI-powered automatic region detection",
			"Multiple mask modes: hide one / hide all",
			"Edit existing occlusion cards",
		],
		icon: "image",
		requiresPro: true,
	},
	toolbarButtonIds: ["io"],
	settingsPanel: ImageOcclusionSettingsPanel,
};
