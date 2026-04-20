import type { ComponentType } from "preact";

import type {
	CardAIPreset,
	CardAIUserSettings,
	TrueRecallSettings,
} from "@true-recall/core";

import {
	ActionButton,
	FormField,
	ToggleInput,
} from "@true-recall/obsidian/components";

import type { PluginSettingsProps } from "../types";
import { CardAIPresetEditor } from "./CardAIPresetEditor";

export interface CardAIPanelConfig {
	bucketKey: "cardPolish" | "flashcardGeneration";
	/** Never persisted — live in plugin code, not in settings. */
	builtins: CardAIPreset[];
	description: string;
}

const EMPTY_BUCKET: CardAIUserSettings = {
	userPresets: [],
	customPromptAutoApply: false,
};

function makeId(): string {
	return `preset-${Math.random().toString(36).slice(2, 10)}`;
}

export function createCardAISettingsPanel(
	config: CardAIPanelConfig,
): ComponentType<PluginSettingsProps> {
	return function CardAISettingsPanel({ settings, save }: PluginSettingsProps) {
		const bucket: CardAIUserSettings =
			settings[config.bucketKey] ?? EMPTY_BUCKET;
		const isPro = !!settings.proKey;
		const visibleBuiltins = config.builtins.filter(
			(b) => !b.requiresPro || isPro,
		);

		const persist = (next: CardAIUserSettings) =>
			save({ [config.bucketKey]: next } as Partial<TrueRecallSettings>);

		const updateUserPreset = (p: CardAIPreset) => {
			persist({
				...bucket,
				userPresets: bucket.userPresets.map((existing) =>
					existing.id === p.id ? p : existing,
				),
			});
		};

		const forkBuiltin = (p: CardAIPreset) => {
			const forked: CardAIPreset = {
				...p,
				id: makeId(),
				name: `${p.name} (fork)`,
				builtin: false,
				requiresPro: false,
			};
			persist({ ...bucket, userPresets: [...bucket.userPresets, forked] });
		};

		const removeUserPreset = (p: CardAIPreset) => {
			persist({
				...bucket,
				userPresets: bucket.userPresets.filter(
					(existing) => existing.id !== p.id,
				),
			});
		};

		const addNew = () => {
			const fresh: CardAIPreset = {
				id: makeId(),
				name: "New preset",
				prompt: "",
				autoApply: false,
				builtin: false,
			};
			persist({ ...bucket, userPresets: [...bucket.userPresets, fresh] });
		};

		return (
			<>
				<FormField
					name="Auto-apply custom prompts"
					description="Run freeform prompts instantly without a preview step"
				>
					<ToggleInput
						value={bucket.customPromptAutoApply}
						onChange={(v) => persist({ ...bucket, customPromptAutoApply: v })}
					/>
				</FormField>

				{visibleBuiltins.length > 0 && (
					<div class="ep:flex ep:flex-col ep:gap-3 ep:mt-4">
						<div class="ep:flex ep:flex-col ep:gap-0.5">
							<h3 class="ep:text-ui-small ep:font-semibold ep:text-obs-normal ep:m-0">
								Built-in presets
							</h3>
							<span class="ep:text-ui-smaller ep:text-obs-muted">
								Ship with the plugin — fork to customize
							</span>
						</div>
						{visibleBuiltins.map((p) => (
							<CardAIPresetEditor
								key={p.id}
								preset={p}
								readOnly
								onFork={() => forkBuiltin(p)}
							/>
						))}
					</div>
				)}

				<div class="ep:flex ep:flex-col ep:gap-3 ep:mt-4">
					<div class="ep:flex ep:flex-col ep:gap-0.5">
						<h3 class="ep:text-ui-small ep:font-semibold ep:text-obs-normal ep:m-0">
							Your presets
						</h3>
						<span class="ep:text-ui-smaller ep:text-obs-muted">
							{config.description}
						</span>
					</div>
					{bucket.userPresets.length === 0 && (
						<span class="ep:text-ui-smaller ep:text-obs-muted ep:italic">
							No custom presets yet. Add one to craft your own instruction.
						</span>
					)}
					{bucket.userPresets.map((p) => (
						<CardAIPresetEditor
							key={p.id}
							preset={p}
							onChange={updateUserPreset}
							onDelete={() => removeUserPreset(p)}
						/>
					))}
					<div>
						<ActionButton
							label="+ New preset"
							variant="outline"
							size="sm"
							onClick={addNew}
						/>
					</div>
				</div>
			</>
		);
	};
}
