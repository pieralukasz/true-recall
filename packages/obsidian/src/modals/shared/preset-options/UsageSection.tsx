import { useMemo } from "preact/hooks";

import type { FSRSPreset } from "@true-recall/core/types";

import { FormCard } from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact";

interface UsageSectionProps {
	preset: FSRSPreset;
}

export function UsageSection({ preset }: UsageSectionProps) {
	const plugin = usePlugin();

	const usage = useMemo(() => {
		const files = plugin.frontmatterIndex.getFilesByValue(
			"fsrs_preset",
			preset.name,
		);
		const noteNames = files.map(
			(f) => f.split("/").pop()?.replace(/\.md$/, "") || f,
		);
		return { count: files.length, names: noteNames.slice(0, 10) };
	}, [plugin, preset.name]);

	if (usage.count === 0) return null;

	return (
		<FormCard title="Usage">
			<div class="ep:flex ep:flex-col ep:gap-1.5">
				<span class="ep:text-ui-small ep:text-obs-normal">
					{usage.count} {usage.count === 1 ? "note" : "notes"} using this preset
				</span>
				{usage.names.length > 0 && (
					<div class="ep:flex ep:flex-wrap ep:gap-1.5">
						{usage.names.map((name) => (
							<span
								key={name}
								class="ep:max-w-full ep:truncate ep:py-0.5 ep:px-2 ep:rounded-md ep:bg-obs-modifier-hover ep:text-ui-smaller ep:text-obs-muted"
							>
								{name}
							</span>
						))}
						{usage.count > usage.names.length && (
							<span class="ep:py-0.5 ep:text-ui-smaller ep:text-obs-faint">
								+{usage.count - usage.names.length} more
							</span>
						)}
					</div>
				)}
			</div>
		</FormCard>
	);
}
