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
				<button type="button" class={BUTTON_CLS} onClick={onReset}>
					Reset parameters
				</button>
				<button
					type="button"
					class={`${BUTTON_CLS}${!canUndo ? " ep:opacity-50" : ""}`}
					disabled={!canUndo}
					onClick={onUndo}
				>
					Undo
				</button>
				<button
					type="button"
					class={`${BUTTON_CLS}${!canRedo ? " ep:opacity-50" : ""}`}
					disabled={!canRedo}
					onClick={onRedo}
				>
					Redo
				</button>
				<div class="ep:text-ui-smaller ep:text-obs-muted ep:ml-2">1 / 1</div>
			</div>
		</div>
	);
}
