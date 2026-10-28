import { TFile } from "obsidian";

import { t } from "@true-recall/obsidian/i18n";
import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { isFeaturePreferenceEnabled } from "@true-recall/obsidian/plugin/plugin-utils";
import { isDesktop } from "@true-recall/obsidian/utils/platform";

/** Formats Obsidian renders inline and the occlusion editor can mask. */
const IMAGE_EXTENSIONS = new Set([
	"avif",
	"bmp",
	"gif",
	"jpeg",
	"jpg",
	"png",
	"svg",
	"webp",
]);

/**
 * Adds "Create image occlusion card" to the context menu of an image, so a
 * diagram can be masked without opening the editor and picking the file again.
 *
 * Right-clicking an image rendered inside a note fires `file-menu` — with
 * source "link-context-menu" — and never `editor-menu`, so the editor's own
 * menu cannot host this item. The image path is handed to the editor directly;
 * the plain "add" entry point opens an empty editor.
 */
export function registerImageOcclusionContextMenu(
	plugin: TrueRecallPlugin,
): void {
	plugin.registerEvent(
		plugin.app.workspace.on("file-menu", (menu, file) => {
			if (!plugin.settings.imageOcclusionContextMenu) return;
			if (!isDesktop()) return;
			// The module's own on/off switch still applies to users who have it,
			// but this entry point does not depend on the module being available.
			if (!isFeaturePreferenceEnabled(plugin.settings, "image-occlusion"))
				return;
			if (!(file instanceof TFile)) return;
			if (!IMAGE_EXTENSIONS.has(file.extension.toLowerCase())) return;

			menu.addItem((item) =>
				item
					.setTitle(t("Create image occlusion card"))
					.setIcon("image")
					.onClick(() =>
						void plugin.openImageOcclusionEditorForActiveNote(file.path),
					),
			);
		}),
	);
}
