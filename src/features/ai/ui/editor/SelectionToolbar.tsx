import type { GenerationMode } from "@features/ai/prompts/default-prompts";
import { Clickable } from "@shared/ui/components";
import { useCallback, useState } from "preact/hooks";

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
	const [generatingMode, setGeneratingMode] = useState<GenerationMode | null>(
		null,
	);
	const [isQuickAdding, setIsQuickAdding] = useState(false);

	const busy = generatingMode !== null || isQuickAdding;

	const handleGenerate = useCallback(
		async (mode: GenerationMode) => {
			if (busy || !hasApiKey) return;
			onDismiss();
			await onGenerate(mode);
		},
		[busy, hasApiKey, onGenerate, onDismiss],
	);

	const handleQuickAdd = useCallback(async () => {
		if (busy) return;
		setIsQuickAdding(true);
		try {
			await onQuickAdd();
		} finally {
			setIsQuickAdding(false);
		}
	}, [busy, onQuickAdd]);

	const handleEdit = useCallback(() => {
		if (busy) return;
		onEdit();
	}, [busy, onEdit]);

	return (
		<div class="true-recall-selection-toolbar ep:flex ep:items-center ep:gap-0.5 ep:p-1">
			{AI_BUTTONS.map(({ mode, label }) => (
				<Clickable
					key={mode}
					class={`true-recall-st-btn ${!hasApiKey ? "true-recall-st-btn-disabled" : ""}`}
					disabled={busy || !hasApiKey}
					onClick={() => void handleGenerate(mode)}
					title={
						hasApiKey
							? `Generate ${label} flashcard(s) with AI`
							: "Configure OpenRouter API key in settings"
					}
				>
					{generatingMode === mode ? <SmallSpinner /> : null}
					<span>{label}</span>
				</Clickable>
			))}

			<span class="true-recall-st-divider" />

			<Clickable
				class="true-recall-st-btn"
				disabled={busy}
				onClick={handleEdit}
				title="Open in flashcard editor"
			>
				<span>Edit</span>
			</Clickable>

			<Clickable
				class="true-recall-st-btn"
				disabled={busy}
				onClick={() => void handleQuickAdd()}
				title="Quick add as basic flashcard"
			>
				{isQuickAdding ? <SmallSpinner /> : null}
				<span>Quick+</span>
			</Clickable>
		</div>
	);
}

function SmallSpinner() {
	return (
		<svg
			viewBox="0 0 16 16"
			width="12"
			height="12"
			class="true-recall-st-spinner"
			aria-hidden="true"
		>
			<circle
				cx="8"
				cy="8"
				r="6"
				stroke="currentColor"
				stroke-width="2"
				fill="none"
				stroke-dasharray="18.85 18.85"
				stroke-linecap="round"
			>
				<animateTransform
					attributeName="transform"
					type="rotate"
					dur="0.8s"
					from="0 8 8"
					to="360 8 8"
					repeatCount="indefinite"
				/>
			</circle>
		</svg>
	);
}
