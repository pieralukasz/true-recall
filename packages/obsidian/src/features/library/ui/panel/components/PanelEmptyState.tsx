import { Clickable, LoadingSpinner } from "@shared/ui/components";
import { useIcon } from "@shared/ui/preact";
import { useState } from "preact/hooks";

export interface PanelEmptyStateProps {
	onGenerate: () => Promise<void>;
	onGenerateFromHighlights: () => Promise<void>;
	onCollect: () => Promise<void>;
	uncollectedCount: number;
	hasApiKey: boolean;
	hasHighlights: boolean;
}

const CALLOUT_CLS =
	"ep:w-full ep:rounded-lg ep:bg-obs-bg-secondary ep:border ep:border-obs-modifier-border ep:px-3.5 ep:py-3 ep:text-left ep:flex ep:flex-col ep:gap-2";

const BTN_BASE_CLS =
	"ep:px-4 ep:py-1.5 ep:rounded-md ep:text-ui-small ep:font-medium ep:w-full ep:inline-flex ep:items-center ep:justify-center ep:gap-1.5";

export function PanelEmptyState({
	onGenerate,
	onGenerateFromHighlights,
	onCollect,
	uncollectedCount,
	hasApiKey,
	hasHighlights,
}: PanelEmptyStateProps) {
	const [generating, setGenerating] = useState(false);
	const [generatingSource, setGeneratingSource] = useState<
		"note" | "highlights" | null
	>(null);
	const [collecting, setCollecting] = useState(false);
	const sparklesRef = useIcon("sparkles");
	const highlighterRef = useIcon("highlighter");
	const fileTextRef = useIcon("file-text");

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

	const handleCollect = async () => {
		setCollecting(true);
		try {
			await onCollect();
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

	return (
		<div class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:h-full ep:py-6 ep:px-5 ep:text-center ep:gap-4">
			{/* Collect button */}
			{hasCollect && (
				<Clickable
					class={`mod-cta ${BTN_BASE_CLS}`}
					onClick={() => void handleCollect()}
				>
					Collect {uncollectedCount} flashcard
					{uncollectedCount !== 1 ? "s" : ""}
				</Clickable>
			)}

			{/* Callout with header + tip */}
			<div class={CALLOUT_CLS}>
				<div class="ep:flex ep:flex-col ep:items-center ep:gap-1">
					<div class="ep:text-obs-muted ep:text-3xl">
						<span ref={sparklesRef} />
					</div>
					<div class="ep:text-ui-small ep:text-obs-muted ep:font-medium">
						No flashcards yet
					</div>
				</div>
				<div class="ep:text-ui-smaller ep:text-obs-faint ep:text-center">
					For best results, select text in the editor, then right-click or use
					the command palette to generate focused cards.
				</div>
			</div>

			{/* Divider */}
			<div class="ep:flex ep:items-center ep:gap-2 ep:w-full">
				<div class="ep:flex-1 ep:h-px ep:bg-obs-modifier-border" />
				<span class="ep:text-ui-smaller ep:text-obs-faint">or</span>
				<div class="ep:flex-1 ep:h-px ep:bg-obs-modifier-border" />
			</div>

			{/* Generate from highlights */}
			<Clickable
				class={generateBtnCls}
				onClick={() => void handleGenerateFromHighlights()}
				disabled={!hasApiKey || !hasHighlights}
			>
				<span ref={highlighterRef} class="ep:shrink-0" />
				Generate from ==highlights==
			</Clickable>

			{/* Divider */}
			<div class="ep:flex ep:items-center ep:gap-2 ep:w-full">
				<div class="ep:flex-1 ep:h-px ep:bg-obs-modifier-border" />
				<span class="ep:text-ui-smaller ep:text-obs-faint">or</span>
				<div class="ep:flex-1 ep:h-px ep:bg-obs-modifier-border" />
			</div>

			{/* Generate from note */}
			<Clickable
				class={generateBtnCls}
				onClick={() => void handleGenerate()}
				disabled={!hasApiKey}
			>
				<span ref={fileTextRef} class="ep:shrink-0" />
				Generate from entire note
			</Clickable>
		</div>
	);
}
