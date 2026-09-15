import { Clickable } from "@true-recall/obsidian/components";

interface IOAIDetectionControlsProps {
	visible: boolean;
	loading: boolean;
	hint: string;
	onHintChange: (hint: string) => void;
	onDetect: (hint?: string) => void;
	onCancel: () => void;
}

function InlineSpinner() {
	return <span class="true-recall-io-spinner" aria-hidden="true" />;
}

export function IOAIDetectionControls({
	visible,
	loading,
	hint,
	onHintChange,
	onDetect,
	onCancel,
}: IOAIDetectionControlsProps) {
	if (loading) {
		return (
			<div class="true-recall-io-hint-text ep:flex ep:items-center ep:gap-2">
				<InlineSpinner />
				Detecting regions…
			</div>
		);
	}
	if (!visible) return null;

	return (
		<div class="ep:flex ep:flex-col ep:gap-1.5 ep:mt-1">
			<input
				type="text"
				class="ep:w-full ep:px-2 ep:py-1.5 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded"
				placeholder="Optional hint, e.g. 'label the bones'"
				maxLength={50}
				value={hint}
				onInput={(event) => onHintChange(event.currentTarget.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") onDetect(hint);
					else if (event.key === "Escape") onCancel();
				}}
			/>
			<div class="ep:flex ep:gap-2">
				<Clickable
					class="ep:px-3 ep:py-1 ep:text-ui-smaller ep:rounded ep:bg-obs-accent/10 ep:text-obs-accent ep:border ep:border-obs-accent ep:transition-colors"
					onClick={() => onDetect(hint)}
				>
					Detect
				</Clickable>
				<Clickable
					class="ep:px-3 ep:py-1 ep:text-ui-smaller ep:text-obs-muted ep:hover:text-obs-normal ep:transition-colors"
					onClick={onCancel}
				>
					Cancel
				</Clickable>
			</div>
		</div>
	);
}
