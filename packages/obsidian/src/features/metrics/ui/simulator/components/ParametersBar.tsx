import { Clickable } from "@true-recall/obsidian/components";

import { BUTTON_CLS } from "../utils/simulator-helpers";

interface ParametersBarProps {
	parametersString: string;
	canUndo: boolean;
	canRedo: boolean;
	onReset: () => void;
	onUndo: () => void;
	onRedo: () => void;
}

export function ParametersBar({
	parametersString,
	canUndo,
	canRedo,
	onReset,
	onUndo,
	onRedo,
}: ParametersBarProps) {
	return (
		<div class="ep:mb-4">
			<div
				class={[
					"ep:text-ui-smaller ep:text-obs-muted",
					"ep:bg-obs-secondary ep:p-2 ep:rounded-lg",
					"ep:font-mono ep:mb-2",
				].join(" ")}
			>
				{parametersString}
			</div>
			<div class="ep:flex ep:gap-2 ep:items-center">
				<Clickable class={BUTTON_CLS} onClick={onReset}>
					Reset parameters
				</Clickable>
				<Clickable class={BUTTON_CLS} disabled={!canUndo} onClick={onUndo}>
					Undo
				</Clickable>
				<Clickable class={BUTTON_CLS} disabled={!canRedo} onClick={onRedo}>
					Redo
				</Clickable>
				<div class="ep:text-ui-smaller ep:text-obs-muted ep:ml-2">1 / 1</div>
			</div>
		</div>
	);
}
