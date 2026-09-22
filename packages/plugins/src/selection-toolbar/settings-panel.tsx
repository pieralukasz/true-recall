import { t } from "@true-recall/obsidian/i18n";

import type { PluginSettingsProps } from "../types";
import { ToolbarConfigSection } from "./ToolbarConfigSection";

export function SelectionToolbarSettingsPanel({
	settings,
	save,
}: PluginSettingsProps) {
	return (
		<>
			<ToolbarConfigSection
				title={t("Editor toolbar")}
				description={t(
					"Buttons shown when selecting text in the markdown editor",
				)}
				buttons={settings.editorToolbarButtons}
				onChange={(b) => void save({ editorToolbarButtons: b })}
				context="editor"
			/>
			<ToolbarConfigSection
				title={t("Global toolbar")}
				description={t(
					"Buttons shown when selecting text outside the editor (sidebars, terminal, reading view)",
				)}
				buttons={settings.globalToolbarButtons}
				onChange={(b) => void save({ globalToolbarButtons: b })}
				context="global"
			/>
			<ToolbarConfigSection
				title={t("Image toolbar")}
				description={t("Buttons shown when clicking an image in the editor")}
				buttons={settings.imageToolbarButtons}
				onChange={(b) => void save({ imageToolbarButtons: b })}
				context="image"
			/>
		</>
	);
}
