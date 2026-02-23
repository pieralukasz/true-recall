import { Clickable, LoadingSpinner } from "@shared/ui/components";
import { useIcon } from "@shared/ui/preact";
import { useState } from "preact/hooks";

export interface PanelEmptyStateProps {
	onGenerate: () => Promise<void>;
	onGenerateFromHighlights: () => Promise<void>;
	hasApiKey: boolean;
	hasHighlights: boolean;
}

export function PanelEmptyState({
	onGenerate,
	onGenerateFromHighlights,
	hasApiKey,
	hasHighlights,
}: PanelEmptyStateProps) {
	const [generating, setGenerating] = useState(false);
	const [generatingSource, setGeneratingSource] = useState<
		"note" | "highlights" | null
	>(null);
	const iconRef = useIcon("sparkles");

	const handleGenerate = async () => {
		setGenerating(true);
		setGeneratingSource("note");
		try {
			await onGenerate();
		} finally {
			setGenerating(false);
			setGeneratingSource(null);
		}
	};

	const handleGenerateFromHighlights = async () => {
		setGenerating(true);
		setGeneratingSource("highlights");
		try {
			await onGenerateFromHighlights();
		} finally {
			setGenerating(false);
			setGeneratingSource(null);
		}
	};

	if (generating) {
		const message =
			generatingSource === "highlights"
				? "Generating from highlights..."
				: "Generating flashcards...";
		return (
			<div class="ep:flex ep:items-center ep:justify-center ep:h-full">
				<LoadingSpinner
					message={message}
					subMessage="This may take a moment"
				/>
			</div>
		);
	}

	return (
		<div class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:h-full ep:py-6 ep:px-4 ep:text-center ep:gap-4">
			<div class="ep:text-obs-muted ep:text-3xl">
				<span ref={iconRef} />
			</div>

			<div class="ep:text-ui-small ep:text-obs-muted">
				No flashcards yet for this note
			</div>

			<div class="ep:flex ep:flex-col ep:gap-2">
				<Clickable
					class="mod-cta ep:px-4 ep:py-1.5 ep:rounded-md ep:text-ui-small ep:font-medium"
					onClick={handleGenerate}
					disabled={!hasApiKey}
				>
					Generate flashcards from note
				</Clickable>

				{hasHighlights && (
					<Clickable
						class="ep:px-4 ep:py-1.5 ep:rounded-md ep:text-ui-small ep:font-medium ep:border ep:border-obs-modifier-border"
						onClick={handleGenerateFromHighlights}
						disabled={!hasApiKey}
					>
						Generate from ==highlights==
					</Clickable>
				)}
			</div>

			{!hasApiKey && (
				<div class="ep:text-ui-smaller ep:text-obs-error">
					Add an OpenRouter API key in settings to use AI generation
				</div>
			)}

			<div class="ep:text-ui-smaller ep:text-obs-faint ep:max-w-[220px]">
				Tip: You can also select text in the editor to generate flashcards
				from a specific section
			</div>
		</div>
	);
}
