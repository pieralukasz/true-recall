import type { GenerationMode } from "@features/ai/prompts/default-prompts";
import { Clickable } from "@shared/ui/components";
import { useCallback, useState } from "preact/hooks";

export interface SelectionToolbarProps {
	selectedText: string;
	onGenerate: (mode: GenerationMode) => Promise<void>;
	onEdit: () => void;
	onQuickAdd: () => Promise<void>;
	onDismiss: () => void;
	onHighlight: () => void;
	hasApiKey: boolean;
	detectedImagePath?: string | null;
	onImageOcclusion?: (path: string) => void;
}

const AI_BUTTONS: { mode: GenerationMode; label: string }[] = [
	{ mode: "basic", label: "Flashcards" },
];

export function SelectionToolbar({
	selectedText,
	onGenerate,
	onEdit,
	onQuickAdd,
	onDismiss,
	onHighlight,
	hasApiKey,
	detectedImagePath,
	onImageOcclusion,
}: SelectionToolbarProps) {
	const [copied, setCopied] = useState(false);

	const handleGenerate = useCallback(
		async (mode: GenerationMode) => {
			if (!hasApiKey) return;
			onDismiss();
			await onGenerate(mode);
		},
		[hasApiKey, onGenerate, onDismiss],
	);

	const handleQuickAdd = useCallback(async () => {
		onDismiss();
		await onQuickAdd();
	}, [onQuickAdd, onDismiss]);

	const handleEdit = useCallback(() => {
		onDismiss();
		onEdit();
	}, [onEdit, onDismiss]);

	const handleCopy = useCallback(() => {
		void navigator.clipboard.writeText(selectedText).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		});
	}, [selectedText]);

	const handleHighlight = useCallback(() => {
		onHighlight();
		onDismiss();
	}, [onHighlight, onDismiss]);

	return (
		<div class="true-recall-selection-toolbar ep:flex ep:items-center ep:gap-0.5 ep:p-1">
			{AI_BUTTONS.map(({ mode, label }) => (
				<Clickable
					key={mode}
					class={`true-recall-st-btn ${!hasApiKey ? "true-recall-st-btn-disabled" : ""}`}
					disabled={!hasApiKey}
					onClick={() => void handleGenerate(mode)}
					title={
						hasApiKey
							? `Generate ${label} flashcard(s) with AI`
							: "Add a subscription or OpenRouter API key in settings"
					}
				>
					<span>{label}</span>
				</Clickable>
			))}

			<span class="true-recall-st-divider" />

			{detectedImagePath && onImageOcclusion && (
				<Clickable
					class="true-recall-st-btn"
					onClick={() => {
						onDismiss();
						onImageOcclusion(detectedImagePath);
					}}
					title="Create image occlusion card"
				>
					<span>IO</span>
				</Clickable>
			)}

			<Clickable
				class="true-recall-st-btn"
				onClick={handleEdit}
				title="Open in flashcard editor"
			>
				<span>Edit</span>
			</Clickable>

			<Clickable
				class="true-recall-st-btn"
				onClick={() => void handleQuickAdd()}
				title="Quick add as basic flashcard"
			>
				<span>Quick+</span>
			</Clickable>

			<span class="true-recall-st-divider" />

			<Clickable
				class="true-recall-st-btn"
				onClick={handleHighlight}
				title="Wrap selection with ==highlight=="
			>
				<span>Highlight</span>
			</Clickable>

			<Clickable
				class="true-recall-st-btn"
				onClick={handleCopy}
				title={copied ? "Copied!" : "Copy selection"}
			>
				<span>{copied ? "Copied!" : "Copy"}</span>
			</Clickable>
		</div>
	);
}
