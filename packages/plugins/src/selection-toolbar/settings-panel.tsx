import type { PluginSettingsProps } from "../types";
import { ToolbarConfigSection } from "./ToolbarConfigSection";

export function SelectionToolbarSettingsPanel({
	settings,
	save,
}: PluginSettingsProps) {
	return (
		<>
			<ToolbarConfigSection
				title="Editor toolbar"
				description="Buttons shown when selecting text in the markdown editor"
				buttons={settings.editorToolbarButtons}
				onChange={(b) => void save({ editorToolbarButtons: b })}
				context="editor"
			/>
			<ToolbarConfigSection
				title="Global toolbar"
				description="Buttons shown when selecting text outside the editor (sidebars, terminal, reading view)"
				buttons={settings.globalToolbarButtons}
				onChange={(b) => void save({ globalToolbarButtons: b })}
				context="global"
			/>
			<ToolbarConfigSection
				title="Image toolbar"
				description="Buttons shown when clicking an image in the editor"
				buttons={settings.imageToolbarButtons}
				onChange={(b) => void save({ imageToolbarButtons: b })}
				context="image"
			/>
		</>
	);
}
