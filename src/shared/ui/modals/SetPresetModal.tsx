import { Clickable } from "@shared/ui/components";
import { ModalFooter } from "@shared/ui/components/ModalFooter";
import { BasePromiseModal } from "@shared/ui/modals/BasePromiseModal";
import type { App } from "obsidian";
import { render } from "preact";

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
				<Clickable
					class="ep:bg-transparent ep:border-none ep:p-0 ep:font-inherit ep:text-left ep:w-full ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-2 ep:rounded-md hover:ep:bg-interactive-hover"
					onClick={() => onResolve({ cancelled: false, presetName: null })}
					stopPropagation={false}
				>
					<span class="ep:text-ui-small">Default (remove override)</span>
					{!currentPreset && (
						<span class="ep:text-ui-small ep:opacity-50"> (current)</span>
					)}
				</Clickable>
				{presetNames
					.filter((n) => n !== "Default")
					.map((name) => (
						<Clickable
							key={name}
							class="ep:bg-transparent ep:border-none ep:p-0 ep:font-inherit ep:text-left ep:w-full ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-2 ep:rounded-md hover:ep:bg-interactive-hover"
							onClick={() =>
								onResolve({
									cancelled: false,
									presetName: name,
								})
							}
							stopPropagation={false}
						>
							<span class="ep:text-ui-small">{name}</span>
							{name === currentPreset && (
								<span class="ep:text-ui-small ep:opacity-50"> (current)</span>
							)}
						</Clickable>
					))}
			</div>
			<ModalFooter
				onCancel={() => onResolve({ cancelled: true, presetName: null })}
				cancelLabel="Cancel"
			/>
		</>
	);
}

export class SetPresetModal extends BasePromiseModal<SetPresetResult> {
	private presetNames: string[];
	private currentPreset: string | null;

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
	}
}
