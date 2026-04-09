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
			<div class="ep:py-2 ep:text-ui-small ep:text-obs-muted">
				<p>
					{usage.count} {usage.count === 1 ? "note" : "notes"} using this preset
				</p>
				{usage.names.length > 0 && (
					<p class="ep:mt-1 ep:text-ui-smaller ep:opacity-70">
						{usage.names.join(", ")}
						{usage.count > 10 && ` and ${usage.count - 10} more`}
					</p>
				)}
			</div>
		</FormCard>
	);
}
