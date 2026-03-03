import { useSettings } from "@features/settings/hooks/useSettings";
import { FormCard, FormField, ToggleInput } from "@shared/ui/components";
import { FolderExclusionPicker } from "./FolderExclusionPicker";

export function ContentSection() {
	const { settings, save } = useSettings();

	return (
		<FormCard title="Content">
			<FormField
				name="Folder-based projects"
				description="Automatically detect folders with flashcard notes as projects"
			>
				<ToggleInput
					value={settings.folderProjectsEnabled}
					onChange={(v) => save({ folderProjectsEnabled: v })}
				/>
			</FormField>

			<FormField
				name="Excluded folders"
				description="Select folders to exclude from flashcard search and project detection"
			/>
			<FolderExclusionPicker />
		</FormCard>
	);
}
