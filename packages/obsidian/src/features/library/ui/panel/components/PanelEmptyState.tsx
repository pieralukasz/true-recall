import { Menu } from "obsidian";
import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";

import { hasAIKey } from "@true-recall/core/ai/config/ai-client-config";

import { LoadingSpinner } from "@true-recall/obsidian/components";
import { usePanelActions } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePanelActions";
import { usePanelStore } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePanelStore";
import { isPluginEnabled } from "@true-recall/obsidian/plugin/plugin-utils";
import { useIcon, usePlugin } from "@true-recall/obsidian/preact";

const BTN_BASE_CLS =
	"tr-panel-empty-action ep:inline-flex ep:items-center ep:justify-center ep:gap-2 ep:cursor-pointer ep:touch-manipulation";

export function PanelEmptyState() {
	const plugin = usePlugin();
	const { uncollectedCount, hasHighlights } = usePanelStore();
	const panelActions = usePanelActions();

	const hasApiKey = hasAIKey(plugin.settings);
	const aiGenerationEnabled = isPluginEnabled(plugin.settings, "ai-generation");
	const hasPresets = (plugin.settings.generationPresets?.length ?? 0) > 0;
	const canGenerate = aiGenerationEnabled && hasPresets;

	const presets = plugin.settings.generationPresets ?? [];
	const [presetId, setPresetId] = useState(
		() =>
			presets.find((p) => p.id === plugin.settings.defaultGenerationPresetId)
				?.id ??
			presets[0]?.id ??
			"",
	);
	const activePreset = presets.find((p) => p.id === presetId);

	const openPresetMenu = (event: MouseEvent | KeyboardEvent) => {
		const menu = new Menu();
		for (const preset of presets) {
			menu.addItem((item) =>
				item
					.setTitle(preset.name)
					.setChecked(preset.id === presetId)
					.onClick(() => setPresetId(preset.id)),
			);
		}
		// Enter/Space on the row hands us a KeyboardEvent, which has no pointer
		// coordinates — anchor the menu under the row instead.
		if (event instanceof MouseEvent) {
			menu.showAtMouseEvent(event);
			return;
		}
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		menu.showAtPosition({ x: rect.left, y: rect.bottom });
	};

	const [generating, setGenerating] = useState(false);
	const [generatingSource, setGeneratingSource] = useState<
		"note" | "highlights" | null
	>(null);
	const [collecting, setCollecting] = useState(false);
	const highlighterRef = useIcon("highlighter");
	const fileTextRef = useIcon("file-text");
	const chevronRef = useIcon("chevron-down");
	const collectRef = useIcon("download");

	const runGenerate = async (
		source: "note" | "highlights",
		fn: (presetId?: string) => Promise<void>,
	) => {
		setGenerating(true);
		setGeneratingSource(source);
		try {
			await fn(presetId || undefined);
		} finally {
			setGenerating(false);
			setGeneratingSource(null);
		}
	};

	const handleGenerate = () =>
		runGenerate("note", panelActions.handleGenerateFromNote);
	const handleGenerateFromHighlights = () =>
		runGenerate("highlights", panelActions.handleGenerateFromHighlights);

	const handleCollect = async () => {
		setCollecting(true);
		try {
			await panelActions.handleCollect();
		} finally {
			setCollecting(false);
		}
	};

	if (collecting) {
		return (
			<div class="ep:flex ep:items-center ep:justify-center ep:h-full">
				<LoadingSpinner message="Collecting flashcards…" />
			</div>
		);
	}

	if (generating) {
		const message =
			generatingSource === "highlights"
				? "Generating from highlights…"
				: "Generating flashcards…";
		return (
			<div class="ep:flex ep:items-center ep:justify-center ep:h-full">
				<LoadingSpinner message={message} subMessage="This may take a moment" />
			</div>
		);
	}

	const hasCollect = uncollectedCount > 0;

	if (!canGenerate) {
		const heading = !aiGenerationEnabled
			? "Flashcard generation is disabled"
			: "No generation presets";
		const body = !aiGenerationEnabled
			? "Enable the AI Generation plugin in Settings to create flashcards."
			: "Add a generation preset in Settings to create flashcards.";

		return (
			<EmptyStateShell heading={heading} body={body}>
				{hasCollect && (
					<button
						type="button"
						class={`mod-cta ${BTN_BASE_CLS}`}
						onClick={() => void handleCollect()}
					>
						<span ref={collectRef} aria-hidden="true" />
						Collect {uncollectedCount} flashcard
						{uncollectedCount !== 1 ? "s" : ""}
					</button>
				)}
			</EmptyStateShell>
		);
	}

	return (
		<EmptyStateShell
			heading="Create cards from this note"
			body="Generate a focused first set from the current note."
		>
			{hasCollect && (
				<button
					type="button"
					class={`mod-cta ${BTN_BASE_CLS}`}
					onClick={() => void handleCollect()}
				>
					<span ref={collectRef} aria-hidden="true" />
					Collect {uncollectedCount} flashcard
					{uncollectedCount !== 1 ? "s" : ""}
				</button>
			)}

			{presets.length > 1 ? (
				<button
					type="button"
					class="tr-panel-empty-preset"
					onClick={openPresetMenu}
					aria-label="Choose generation preset"
				>
					<span class="tr-panel-empty-preset-label">Preset</span>
					<span class="tr-panel-empty-preset-value">
						{activePreset?.name ?? "Choose preset"}
					</span>
					<span ref={chevronRef} aria-hidden="true" />
				</button>
			) : null}

			<button
				type="button"
				class={`${hasCollect ? "" : "mod-cta"} ${BTN_BASE_CLS} ${
					hasCollect ? "tr-panel-empty-action-secondary" : ""
				}`}
				disabled={!hasApiKey}
				onClick={() => void handleGenerate()}
			>
				<span ref={fileTextRef} aria-hidden="true" />
				Generate Cards
			</button>

			{hasHighlights ? (
				<button
					type="button"
					class={`${BTN_BASE_CLS} tr-panel-empty-action-secondary`}
					disabled={!hasApiKey}
					onClick={() => void handleGenerateFromHighlights()}
				>
					<span ref={highlighterRef} aria-hidden="true" />
					Use Highlights
				</button>
			) : null}

			{!hasApiKey ? (
				<div class="ep:text-ui-smaller ep:text-obs-muted">
					Add an AI provider key in Settings to generate cards.
				</div>
			) : null}
		</EmptyStateShell>
	);
}

function EmptyStateShell({
	heading,
	body,
	children,
}: {
	heading: string;
	body: string;
	children: ComponentChildren;
}) {
	return (
		<div class="tr-panel-empty-viewport">
			<div class="tr-panel-empty-module">
				<h2 class="tr-panel-empty-heading">{heading}</h2>
				<p class="tr-panel-empty-description">{body}</p>
				<div class="tr-panel-empty-controls">{children}</div>
			</div>
		</div>
	);
}
