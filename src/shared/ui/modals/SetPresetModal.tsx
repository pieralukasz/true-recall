import type { App } from "obsidian";
import { render } from "preact";
import { BasePromiseModal } from "./BasePromiseModal";

export interface SetPresetResult {
	cancelled: boolean;
	presetName: string | null;
}

function SetPresetBody({
	presetNames,
	currentPreset,
	onResolve,
}: {
	presetNames: string[];
	currentPreset: string | null;
	onResolve: (result: SetPresetResult) => void;
}) {
	return (
		<>
			<div
				class="ep:border ep:border-obs-border ep:rounded-md ep:overflow-y-auto"
				style="max-height: 240px"
			>
				<button
					type="button"
					class="ep:bg-transparent ep:border-none ep:p-0 ep:font-inherit ep:cursor-pointer ep:text-left ep:w-full ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-2 ep:rounded-md hover:ep:bg-interactive-hover"
					onClick={() => onResolve({ cancelled: false, presetName: null })}
				>
					<span class="ep:text-ui-small">Default (remove override)</span>
					{!currentPreset && (
						<span class="ep:text-ui-small ep:opacity-50"> (current)</span>
					)}
				</button>
				{presetNames
					.filter((n) => n !== "Default")
					.map((name) => (
						<button
							type="button"
							key={name}
							class="ep:bg-transparent ep:border-none ep:p-0 ep:font-inherit ep:cursor-pointer ep:text-left ep:w-full ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-2 ep:rounded-md hover:ep:bg-interactive-hover"
							onClick={() =>
								onResolve({
									cancelled: false,
									presetName: name,
								})
							}
						>
							<span class="ep:text-ui-small">{name}</span>
							{name === currentPreset && (
								<span class="ep:text-ui-small ep:opacity-50"> (current)</span>
							)}
						</button>
					))}
			</div>
			<div class="ep:flex ep:justify-end ep:gap-2 ep:pt-2 ep:border-t ep:border-obs-border">
				<button
					type="button"
					class="ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:hover:bg-obs-modifier-hover"
					onClick={() => onResolve({ cancelled: true, presetName: null })}
				>
					Cancel
				</button>
			</div>
		</>
	);
}

export class SetPresetModal extends BasePromiseModal<SetPresetResult> {
	private presetNames: string[];
	private currentPreset: string | null;
	private unmountBody?: () => void;

	constructor(app: App, presetNames: string[], currentPreset: string | null) {
		super(app, {
			title: "Set FSRS preset",
			width: "360px",
		});
		this.presetNames = presetNames;
		this.currentPreset = currentPreset;
	}

	protected getDefaultResult(): SetPresetResult {
		return { cancelled: true, presetName: null };
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<SetPresetBody
				presetNames={this.presetNames}
				currentPreset={this.currentPreset}
				onResolve={(result) => this.resolve(result)}
			/>,
			container,
		);
		this.unmountBody = () => render(null, container);
	}

	onClose(): void {
		this.unmountBody?.();
		super.onClose();
	}
}
