import type { GenerationMode } from "@features/ai/prompts/default-prompts";
import { Clickable } from "@shared/ui/components";
import { useCallback } from "preact/hooks";

export interface SelectionToolbarProps {
	selectedText: string;
	onGenerate: (mode: GenerationMode) => Promise<void>;
	onEdit: () => void;
	onQuickAdd: () => Promise<void>;
	onDismiss: () => void;
	hasApiKey: boolean;
}

const AI_BUTTONS: { mode: GenerationMode; label: string }[] = [
	{ mode: "basic", label: "Basic" },
	{ mode: "cloze", label: "Cloze" },
	{ mode: "reversed", label: "Reversed" },
	{ mode: "auto", label: "Auto" },
];

export function SelectionToolbar({
	onGenerate,
	onEdit,
	onQuickAdd,
	onDismiss,
	hasApiKey,
}: SelectionToolbarProps) {
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
							: "Configure OpenRouter API key in settings"
					}
				>
					<span>{label}</span>
				</Clickable>
			))}

			<span class="true-recall-st-divider" />

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
		</div>
	);
}
