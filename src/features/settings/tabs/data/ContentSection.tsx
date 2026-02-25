import { useSettings } from "@features/settings/hooks/useSettings";
import { SettingRow, ToggleInput } from "@shared/ui/components";
import { FolderExclusionPicker } from "./FolderExclusionPicker";

export function ContentSection() {
	const { settings, save } = useSettings();

	return (
		<>
			<SettingRow heading name="Content" />

			<SettingRow
				name="Folder-based projects"
				description="Automatically detect folders with flashcard notes as projects"
			>
				<ToggleInput
					value={settings.folderProjectsEnabled}
					onChange={(v) => save({ folderProjectsEnabled: v })}
				/>
			</SettingRow>

			<SettingRow
				name="Excluded folders"
				description="Select folders to exclude from flashcard search and project detection"
			/>
			<FolderExclusionPicker />
		</>
	);
}
