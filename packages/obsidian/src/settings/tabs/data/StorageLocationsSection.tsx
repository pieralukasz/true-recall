import {
	FolderSuggestInput,
	FormCard,
	FormField,
} from "@true-recall/obsidian/components";
import { t } from "@true-recall/obsidian/i18n";
import { useApp } from "@true-recall/obsidian/preact/ObsidianContext";

import { useSettings } from "../../hooks/useSettings";

export function StorageLocationsSection() {
	const app = useApp();
	const { settings, save } = useSettings();

	return (
		<FormCard title={t("Storage locations")}>
			<FormField
				name={t("Attachment folder")}
				description={t(
					"Where pasted images, Image Occlusion crops, and Anki import media are saved. Leave empty to keep each feature's current default location.",
				)}
			>
				<FolderSuggestInput
					app={app}
					value={settings.attachmentFolder}
					onChange={(v) => void save({ attachmentFolder: v })}
					placeholder={t("Feature-specific default")}
				/>
			</FormField>

			<FormField
				name={t("Default Anki import folder")}
				description={t(
					"Pre-fills the notes destination when importing an Anki deck. Still editable per import.",
				)}
			>
				<FolderSuggestInput
					app={app}
					value={settings.defaultAnkiImportFolder}
					onChange={(v) => void save({ defaultAnkiImportFolder: v })}
					placeholder={t("Anki Import")}
				/>
			</FormField>

			<FormField
				name={t("Default project folder")}
				description={t(
					"Pre-fills the folder field when creating a new project. Still editable per project.",
				)}
			>
				<FolderSuggestInput
					app={app}
					value={settings.defaultProjectFolder}
					onChange={(v) => void save({ defaultProjectFolder: v })}
					placeholder={t("Vault root")}
				/>
			</FormField>
		</FormCard>
	);
}
