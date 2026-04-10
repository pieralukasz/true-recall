import type { App } from "obsidian";
import { render } from "preact";

import type {
	PresetChainEntry,
	PresetResolutionContext,
	PresetService,
	PresetSource,
} from "@true-recall/core/services/notes/preset.service";

import { Clickable } from "@true-recall/obsidian/components";
import { BasePromiseModal } from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import { SetPresetModal } from "@true-recall/obsidian/modals/shared/SetPresetModal";

interface PresetInspectorResult {
	action: "set" | "clear" | "cancel";
	presetName?: string;
}

const SOURCE_LABELS: Record<PresetSource, string> = {
	note: "Note",
	parent: "Parent",
	default: "Default",
};

function ChainRow({ entry }: { entry: PresetChainEntry }) {
	const label = SOURCE_LABELS[entry.source];
	const fileName = entry.sourcePath?.split("/").pop()?.replace(/\.md$/, "");

	return (
		<div
			class={`ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-1.5 ep:rounded-md ${
				entry.active
					? "ep:bg-obs-accent/10 ep:text-obs-text-normal"
					: "ep:text-obs-muted"
			}`}
		>
			<span
				class={`ep:w-2 ep:h-2 ep:rounded-full ep:shrink-0 ${
					entry.active ? "ep:bg-obs-accent" : "ep:bg-obs-modifier-border"
				}`}
			/>
			<span class="ep:text-ui-small ep:font-medium ep:w-16 ep:shrink-0">
				{label}
			</span>
			{fileName && entry.source !== "default" && (
				<span class="ep:text-ui-smaller ep:opacity-60 ep:truncate ep:max-w-[140px]">
					{fileName}
				</span>
			)}
			<span class="ep:ml-auto ep:text-ui-small">
				{entry.presetName ? (
					<span class={entry.active ? "ep:font-semibold" : "ep:opacity-50"}>
						{entry.presetName}
					</span>
				) : (
					<span class="ep:opacity-30 ep:italic">none</span>
				)}
			</span>
			{entry.active && (
				<span class="ep:text-[10px] ep:text-obs-accent ep:shrink-0">
					active
				</span>
			)}
		</div>
	);
}

function PresetInspectorBody({
	chain,
	effectivePresetName,
	onResolve,
}: {
	chain: PresetChainEntry[];
	effectivePresetName: string;
	onResolve: (result: PresetInspectorResult) => void;
}) {
	return (
		<>
			<div class="ep:mb-3">
				<div class="ep:text-ui-small ep:text-obs-muted ep:mb-1">
					Effective preset
				</div>
				<div class="ep:text-lg ep:font-semibold ep:text-obs-text-normal">
					{effectivePresetName}
				</div>
			</div>

			<div class="ep:text-ui-small ep:text-obs-muted ep:mb-1">
				Inheritance chain
			</div>
			<div class="ep:border ep:border-obs-border ep:rounded-md ep:overflow-hidden ep:mb-4">
				{chain.map((entry) => (
					<ChainRow key={entry.source} entry={entry} />
				))}
			</div>

			<div class="ep-modal-footer ep:flex ep:justify-end ep:gap-2">
				<Clickable
					class="ep-btn ep-btn-outline"
					onClick={() => onResolve({ action: "clear" })}
					stopPropagation={false}
				>
					Clear note preset
				</Clickable>
				<Clickable
					class="ep-btn mod-cta"
					onClick={() => onResolve({ action: "set" })}
					stopPropagation={false}
				>
					Set preset...
				</Clickable>
			</div>
		</>
	);
}

export class PresetInspectorModal extends BasePromiseModal<PresetInspectorResult> {
	constructor(
		app: App,
		private presetService: PresetService,
		private notePath: string,
		private context?: PresetResolutionContext,
	) {
		super(app, {
			title: "FSRS Preset",
			width: "420px",
		});
	}

	protected getDefaultResult(): PresetInspectorResult {
		return { action: "cancel" };
	}

	protected renderBody(container: HTMLElement): void {
		const { chain, effective } = this.presetService.resolvePresetChain(
			this.notePath,
			this.context,
		);

		render(
			<PresetInspectorBody
				chain={chain}
				effectivePresetName={effective.preset.name}
				onResolve={(result) => {
					if (result.action === "set") {
						void this.openPresetPicker(result);
					} else {
						this.resolve(result);
					}
				}}
			/>,
			container,
		);
	}

	private async openPresetPicker(
		_partialResult: PresetInspectorResult,
	): Promise<void> {
		const presetNames = this.presetService.getPresets().map((p) => p.name);
		const currentPreset =
			this.presetService.resolvePresetChain(this.notePath, this.context)
				.chain[0]?.presetName ?? null;

		const pickerModal = new SetPresetModal(
			this.app,
			presetNames,
			currentPreset,
		);
		const pickerResult = await pickerModal.openAndWait();

		if (!pickerResult.cancelled) {
			this.resolve({
				action: "set",
				presetName: pickerResult.presetName ?? undefined,
			});
		}
	}
}
