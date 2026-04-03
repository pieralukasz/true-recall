import type { FSRSFlashcardItem } from "@true-recall/core/types";
import { Clickable, MarkdownContent } from "@true-recall/obsidian/components";
import { useApp } from "@true-recall/obsidian/preact/ObsidianContext";
import { useEffect, useState } from "preact/hooks";
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
	const app = useApp();
	const [content, setContent] = useState<string | null>(null);

	useEffect(() => {
		const path = card.sourceNotePath;
		if (!path) {
			setContent(null);
			return;
		}

		const file = app.vault.getFileByPath(path);
		if (!file) {
			setContent(null);
			return;
		}

		let cancelled = false;
		void app.vault.cachedRead(file).then((text) => {
			if (!cancelled) setContent(text);
		});

		return () => {
			cancelled = true;
		};
	}, [app, card.sourceNotePath, card.id]);

	return (
		<div class="true-recall-review-card-container ep:flex-1 ep:min-h-0 ep:flex ep:items-start ep:justify-center ep:pt-8 ep:px-6 ep:pb-2 ep:overflow-y-auto ep:w-full ep:max-w-3xl ep:mx-auto">
			<div class="ep:w-full">
				<div class="ep:text-xs ep:text-obs-faint ep:mb-2 ep:uppercase ep:tracking-wider">
					Note Review
				</div>

				{content !== null ? (
					<MarkdownContent
						markdown={content}
						filePath={card.sourceNotePath ?? ""}
						class="true-recall-review-note ep:leading-relaxed ep:text-obs-normal"
					/>
				) : (
					<div class="ep:text-obs-muted ep:italic">
						{card.sourceNotePath
							? "Could not load note content."
							: "No source note linked."}
					</div>
				)}

				{(card.sourceNoteName || presetName) && (
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
				)}
			</div>
		</div>
	);
}
