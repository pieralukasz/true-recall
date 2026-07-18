import {
	Clickable,
	FormCard,
	FormField,
	InfoBlock,
} from "@true-recall/obsidian/components";
import {
	getInkIntegrationStatus,
	type InkIntegrationStatus,
} from "@true-recall/obsidian/editor/shared/ink-embeddable-editor";
import { usePlugin } from "@true-recall/obsidian/preact";
import { useIcon } from "@true-recall/obsidian/preact/hooks";

const INK_GITHUB_URL = "https://github.com/daledesilva/obsidian_ink";

const STATUS_COPY: Record<
	InkIntegrationStatus,
	{ label: string; description: string; class: string }
> = {
	ready: {
		label: "Ready",
		description:
			"Ink is enabled and supports drawings inside True Recall editors.",
		class: "ep:text-obs-accent",
	},
	incompatible: {
		label: "Update required",
		description:
			"Ink is enabled, but this version does not expose the embedded-editor API required by True Recall. Install a True Recall-compatible Ink build, then reload Obsidian.",
		class: "ep:text-obs-warning",
	},
	disabled: {
		label: "Disabled",
		description:
			"Ink is installed but not loaded. Enable it under Community plugins, then reload Obsidian.",
		class: "ep:text-obs-warning",
	},
	"not-installed": {
		label: "Not installed",
		description:
			"Open Settings > Community plugins > Browse, search for Ink, install and enable it, then reload Obsidian.",
		class: "ep:text-obs-muted",
	},
};

export function InkIntegrationSection() {
	const plugin = usePlugin();
	const githubIconRef = useIcon("github");
	const status = getInkIntegrationStatus(plugin.app);
	const copy = STATUS_COPY[status];

	return (
		<FormCard title="Ink drawings">
			<InfoBlock>
				Ink is a separate Obsidian community plugin and is not bundled with True
				Recall. Install and enable a compatible Ink version to create and edit
				drawings directly in review cards and the Add/Edit Flashcard dialog.
			</InfoBlock>

			<FormField name="Integration status" description={copy.description}>
				<span class={`ep:text-ui-small ep:font-medium ${copy.class}`}>
					{copy.label}
				</span>
			</FormField>

			<FormField
				name="Ink plugin"
				description="View installation instructions, releases, and source code"
			>
				<Clickable
					class="ep-btn ep-btn-outline ep:inline-flex ep:items-center ep:gap-1.5"
					onClick={() => window.open(INK_GITHUB_URL, "_blank")}
				>
					<div ref={githubIconRef} class="ep:w-4 ep:h-4" />
					Open Ink on GitHub
				</Clickable>
			</FormField>
		</FormCard>
	);
}
