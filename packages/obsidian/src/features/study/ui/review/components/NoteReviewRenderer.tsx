import type { FSRSFlashcardItem } from "@true-recall/core/types";
import { Clickable } from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { useNoteReviewContent } from "../hooks/useNoteReviewContent";
import { LivePreviewField } from "./LivePreviewField";
import { type PresetPickerOption, PresetPopover } from "./PresetPopover";

interface NoteReviewRendererProps {
	card: FSRSFlashcardItem;
	presetName?: string;
	presetOptions?: PresetPickerOption[];
	onPresetChange?: (presetName: string) => void;
	onOpenSourceNote?: () => void;
}

export function NoteReviewRenderer({
	card,
	presetName,
	presetOptions,
	onPresetChange,
	onOpenSourceNote,
}: NoteReviewRendererProps) {
	const { noteReviewShowFrontmatter } = usePlugin().settings;
	const content = useNoteReviewContent(
		card.sourceNotePath,
		card.id,
		noteReviewShowFrontmatter,
	);

	return (
		<div class="true-recall-review-card-container ep:flex-1 ep:min-h-0 ep:flex ep:items-start ep:justify-center ep:pt-8 ep:px-6 ep:pb-2 ep:overflow-y-auto ep:w-full ep:max-w-3xl ep:mx-auto">
			<div class="ep:w-full">
				<div class="ep:text-xs ep:text-obs-faint ep:mb-2 ep:uppercase ep:tracking-wider">
					Note Review
				</div>

				{content !== null ? (
					<LivePreviewField
						content={content}
						field="question"
						sourcePath={card.sourceNotePath ?? ""}
						cls="true-recall-review-note ep:leading-relaxed ep:text-obs-normal"
					/>
				) : (
					<div class="ep:text-obs-muted ep:italic">
						{card.sourceNotePath
							? "Could not load note content."
							: "No source note linked."}
					</div>
				)}

				<NoteReviewFooter
					card={card}
					presetName={presetName}
					presetOptions={presetOptions}
					onPresetChange={onPresetChange}
					onOpenSourceNote={onOpenSourceNote}
				/>
			</div>
		</div>
	);
}

function NoteReviewFooter({
	card,
	presetName,
	presetOptions,
	onPresetChange,
	onOpenSourceNote,
}: {
	card: FSRSFlashcardItem;
	presetName?: string;
	presetOptions?: PresetPickerOption[];
	onPresetChange?: (presetName: string) => void;
	onOpenSourceNote?: () => void;
}) {
	if (!card.sourceNoteName && !presetName) return null;

	return (
		<div class="ep:flex ep:flex-col ep:items-center ep:gap-4 ep:pt-8">
			{card.sourceNoteName && onOpenSourceNote && (
				<Clickable
					class="ep:text-obs-faint ep:text-ui-smaller ep:no-underline ep:hover:text-obs-accent ep:hover:underline ep:transition-colors ep:p-0"
					onClick={onOpenSourceNote}
				>
					Source: {card.sourceNoteName}
				</Clickable>
			)}
			{presetName && presetOptions && onPresetChange ? (
				<PresetPopover
					value={presetName}
					options={presetOptions}
					onChange={onPresetChange}
				/>
			) : presetName ? (
				<span class="ep:text-obs-faint ep:text-ui-smaller">
					FSRS: {presetName}
				</span>
			) : null}
		</div>
	);
}
