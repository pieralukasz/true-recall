import { useSettings } from "@features/settings/hooks/useSettings";
import { CheckboxListItem } from "@shared/ui/components/CheckboxListItem";
import { SearchInput } from "@shared/ui/components/SearchInput";
import { usePlugin } from "@shared/ui/preact";
import { TFolder } from "obsidian";
import { useMemo, useState } from "preact/hooks";

export function FolderExclusionPicker() {
	const plugin = usePlugin();
	const { settings, save } = useSettings();
	const [search, setSearch] = useState("");

	const allFolders = useMemo(() => {
		return plugin.app.vault
			.getAllLoadedFiles()
			.filter(
				(f): f is TFolder => f instanceof TFolder && f.path !== "/",
			)
			.map((f) => f.path)
			.sort((a, b) => a.localeCompare(b));
	}, [plugin]);

	const filtered = useMemo(() => {
		if (!search) return allFolders;
		return allFolders.filter((p) => p.toLowerCase().includes(search));
	}, [allFolders, search]);

	const excludedSet = useMemo(
		() => new Set(settings.excludedFolders),
		[settings.excludedFolders],
	);

	const handleToggle = (folder: string, checked: boolean) => {
		const next = checked
			? [...settings.excludedFolders, folder]
			: settings.excludedFolders.filter((f) => f !== folder);
		void save({ excludedFolders: next });
	};

	return (
		<div class="ep:flex ep:flex-col ep:gap-2 ep:mb-3">
			<SearchInput
				value={search}
				onChange={setSearch}
				placeholder="Filter folders..."
			/>
			<div class="ep:max-h-[250px] ep:overflow-y-auto ep:border ep:border-obs-border ep:rounded-md">
				{filtered.length === 0 ? (
					<div class="ep:p-3 ep:text-ui-small ep:text-obs-muted ep:text-center">
						No folders found
					</div>
				) : (
					filtered.map((folder) => (
						<CheckboxListItem
							key={folder}
							label={folder}
							itemKey={folder}
							selectedSet={excludedSet}
							onToggle={handleToggle}
						/>
					))
				)}
			</div>
		</div>
	);
}
