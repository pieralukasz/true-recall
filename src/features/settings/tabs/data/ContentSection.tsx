import { SettingRow, TextInput } from "@shared/ui/components";
import { useSettings } from "@features/settings/hooks/useSettings";

export function ContentSection() {
	const { settings, save } = useSettings();

	return (
		<>
			<SettingRow heading name="Content" />

			<SettingRow
				name="Excluded folders"
				description="Comma-separated list of folders to exclude from flashcard search"
			>
				<TextInput
					value={settings.excludedFolders.join(", ")}
					onChange={(v) => {
						const folders = v
							.split(",")
							.map((s) => s.trim())
							.filter((s) => s.length > 0);
						void save({ excludedFolders: folders });
					}}
					placeholder="templates, archive"
				/>
			</SettingRow>
		</>
	);
}
