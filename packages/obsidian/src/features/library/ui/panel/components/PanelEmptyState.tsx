import { useState } from "preact/hooks";

import { Clickable, LoadingSpinner } from "@true-recall/obsidian/components";
import { usePanelActions } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePanelActions";
import { usePanelStore } from "@true-recall/obsidian/features/library/ui/panel/hooks/usePanelStore";
import { isPluginEnabled } from "@true-recall/obsidian/plugin/plugin-utils";
import { useIcon, usePlugin } from "@true-recall/obsidian/preact";

const CALLOUT_CLS =
	"ep:w-full ep:rounded-lg ep:bg-obs-bg-secondary ep:border ep:border-obs-modifier-border ep:px-3.5 ep:py-3 ep:text-left ep:flex ep:flex-col ep:gap-2";

const BTN_BASE_CLS =
	"ep:px-4 ep:py-1.5 ep:rounded-md ep:text-ui-small ep:font-medium ep:w-full ep:inline-flex ep:items-center ep:justify-center ep:gap-1.5";

export function PanelEmptyState() {
	const plugin = usePlugin();
	const { uncollectedCount, hasHighlights } = usePanelStore();
	const panelActions = usePanelActions();

	const hasApiKey = !!(
		plugin.settings.proKey || plugin.settings.openRouterApiKey
	);
	const aiGenerationEnabled = isPluginEnabled(plugin.settings, "ai-generation");
	const hasPresets = (plugin.settings.generationPresets?.length ?? 0) > 0;
	const canGenerate = aiGenerationEnabled && hasPresets;

	const [generating, setGenerating] = useState(false);
	const [generatingSource, setGeneratingSource] = useState<
		"note" | "highlights" | null
	>(null);
	const [collecting, setCollecting] = useState(false);
	const sparklesRef = useIcon("sparkles");
	const highlighterRef = useIcon("highlighter");
	const fileTextRef = useIcon("file-text");

	const runGenerate = async (
		source: "note" | "highlights",
		fn: () => Promise<void>,
	) => {
		setGenerating(true);
		setGeneratingSource(source);
		try {
			await fn();
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
				<LoadingSpinner message="Collecting flashcards..." />
			</div>
		);
	}

	if (generating) {
		const message =
			generatingSource === "highlights"
				? "Generating from highlights..."
				: "Generating flashcards...";
		return (
			<div class="ep:flex ep:items-center ep:justify-center ep:h-full">
				<LoadingSpinner message={message} subMessage="This may take a moment" />
			</div>
		);
	}

	const hasCollect = uncollectedCount > 0;
	const generateBtnCls = `${BTN_BASE_CLS} ep:border ep:border-obs-modifier-border ep:text-obs-muted`;

	if (!canGenerate) {
		const heading = !aiGenerationEnabled
			? "Flashcard generation is disabled"
			: "No generation presets";
		const body = !aiGenerationEnabled
			? "Enable the AI Generation plugin in Settings to create flashcards."
			: "Add a generation preset in Settings to create flashcards.";

		return (
			<div class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:h-full ep:py-6 ep:px-5 ep:text-center ep:gap-4">
				{hasCollect && (
					<Clickable
						class={`mod-cta ${BTN_BASE_CLS}`}
						onClick={() => void handleCollect()}
					>
						Collect {uncollectedCount} flashcard
						{uncollectedCount !== 1 ? "s" : ""}
					</Clickable>
				)}

				<div class={CALLOUT_CLS}>
					<div class="ep:flex ep:flex-col ep:items-center ep:gap-1">
						<div class="ep:text-obs-muted ep:text-3xl">
							<span ref={sparklesRef} />
						</div>
						<div class="ep:text-ui-small ep:text-obs-muted ep:font-medium">
							{heading}
						</div>
					</div>
					<div class="ep:text-ui-smaller ep:text-obs-faint ep:text-center">
						{body}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:h-full ep:py-6 ep:px-5 ep:text-center ep:gap-4">
			{hasCollect && (
				<Clickable
					class={`mod-cta ${BTN_BASE_CLS}`}
					onClick={() => void handleCollect()}
				>
					Collect {uncollectedCount} flashcard
					{uncollectedCount !== 1 ? "s" : ""}
				</Clickable>
			)}

			<div class={CALLOUT_CLS}>
				<div class="ep:flex ep:flex-col ep:items-center ep:gap-1">
					<div class="ep:text-obs-muted ep:text-3xl">
						<span ref={sparklesRef} />
					</div>
					<div class="ep:text-ui-small ep:text-obs-muted ep:font-medium">
						Start learning this note
					</div>
				</div>
				<div class="ep:text-ui-smaller ep:text-obs-faint ep:text-center">
					Select text for focused cards, or generate from the whole note below.
				</div>
			</div>

			<Clickable
				class={generateBtnCls}
				onClick={() => void handleGenerateFromHighlights()}
				disabled={!hasApiKey || !hasHighlights}
			>
				<span ref={highlighterRef} class="ep:shrink-0" />
				Generate from highlights
			</Clickable>

			<Clickable
				class={generateBtnCls}
				onClick={() => void handleGenerate()}
				disabled={!hasApiKey}
			>
				<span ref={fileTextRef} class="ep:shrink-0" />
				Generate from full note
			</Clickable>
		</div>
	);
}
