import type { ComponentType } from "preact";
import { useCallback, useState } from "preact/hooks";

import type { CardAIPreset, CardAIUserSettings } from "@true-recall/core";
import { moveItem } from "@true-recall/core/utils";

import {
	ActionButton,
	FormField,
	ToggleInput,
} from "@true-recall/obsidian/components";

import type { PluginSettingsProps } from "../types";
import { CardAIPresetEditor } from "./CardAIPresetEditor";
import { LMStudioScopedModelField } from "./LMStudioScopedModelField";
import { ReorderableList } from "./ReorderableList";
import { usePersistentSettingsSlice } from "./usePersistentSettingsSlice";

export interface CardAIPanelConfig {
	bucketKey: "cardPolish";
	/** Never persisted — live in plugin code, not in settings. */
	builtins: CardAIPreset[];
	description: string;
	lmStudioField?: {
		modelKey: "lmStudioCardPolishModel";
		name: string;
		description: string;
	};
}

const EMPTY_BUCKET: CardAIUserSettings = {
	userPresets: [],
	customPromptAutoApply: false,
};

function makeId(existing: readonly CardAIPreset[]): string {
	const taken = new Set(existing.map((preset) => preset.id));
	let id = "";
	do {
		id = `preset-${Math.random().toString(36).slice(2, 10)}`;
	} while (taken.has(id));
	return id;
}

function normalizeBucket(bucket: CardAIUserSettings): CardAIUserSettings {
	return {
		customPromptAutoApply: !!bucket.customPromptAutoApply,
		userPresets: [...(bucket.userPresets ?? [])],
	};
}

export function createCardAISettingsPanel(
	config: CardAIPanelConfig,
): ComponentType<PluginSettingsProps> {
	return function CardAISettingsPanel({ settings, save }: PluginSettingsProps) {
		const [bucket, persistBucket] = usePersistentSettingsSlice(
			settings[config.bucketKey] ?? EMPTY_BUCKET,
			save,
			{
				normalize: normalizeBucket,
				buildPatch: (next) => ({ [config.bucketKey]: next }),
			},
		);

		const isPro = !!settings.proKey;
		const visibleBuiltins = config.builtins.filter(
			(b) => !b.requiresPro || isPro,
		);

		const [expandedIds, setExpandedIds] = useState<Set<string>>(
			() => new Set(),
		);
		const toggleExpanded = (id: string) => {
			setExpandedIds((prev) => {
				const next = new Set(prev);
				if (next.has(id)) next.delete(id);
				else next.add(id);
				return next;
			});
		};

		const updateUserPreset = useCallback(
			(id: string, patch: Partial<CardAIPreset>) => {
				persistBucket((current) => ({
					...current,
					userPresets: current.userPresets.map((existing) =>
						existing.id === id && !existing.builtin
							? { ...existing, ...patch }
							: existing,
					),
				}));
			},
			[persistBucket],
		);

		const forkBuiltin = (p: CardAIPreset) => {
			let forkedId: string | null = null;
			persistBucket(
				(current) => {
					const id = makeId([...config.builtins, ...current.userPresets]);
					forkedId = id;
					const forked: CardAIPreset = {
						...p,
						id,
						name: `${p.name} (fork)`,
						builtin: false,
						requiresPro: false,
					};
					return { ...current, userPresets: [...current.userPresets, forked] };
				},
				{ flush: true },
			);
			if (forkedId) {
				const id = forkedId;
				setExpandedIds((prev) => new Set(prev).add(id));
			}
		};

		const reorderUserPresets = useCallback(
			(from: number, to: number) => {
				persistBucket(
					(current) => ({
						...current,
						userPresets: moveItem(current.userPresets, from, to),
					}),
					{ flush: true },
				);
			},
			[persistBucket],
		);

		const removeUserPreset = (p: CardAIPreset) => {
			persistBucket(
				(current) => ({
					...current,
					userPresets: current.userPresets.filter(
						(existing) => existing.id !== p.id,
					),
				}),
				{ flush: true },
			);
			setExpandedIds((prev) => {
				const next = new Set(prev);
				next.delete(p.id);
				return next;
			});
		};

		const addNew = () => {
			let freshId: string | null = null;
			persistBucket(
				(current) => {
					const id = makeId([...config.builtins, ...current.userPresets]);
					freshId = id;
					const fresh: CardAIPreset = {
						id,
						name: "New preset",
						prompt: "",
						autoApply: false,
						autoApplyNewCards: false,
						builtin: false,
						mode: "edit",
						fieldScope: "all",
						executor: "ai",
					};
					return { ...current, userPresets: [...current.userPresets, fresh] };
				},
				{ flush: true },
			);
			if (freshId) {
				const id = freshId;
				setExpandedIds((prev) => new Set(prev).add(id));
			}
		};

		return (
			<>
				<FormField
					name="Auto-apply custom prompts"
					description="Run freeform prompts instantly without a preview step"
				>
					<ToggleInput
						value={bucket.customPromptAutoApply}
						onChange={(v) =>
							persistBucket((current) => ({
								...current,
								customPromptAutoApply: v,
							}))
						}
					/>
				</FormField>

				{config.lmStudioField && (
					<LMStudioScopedModelField
						settings={settings}
						save={save}
						modelKey={config.lmStudioField.modelKey}
						name={config.lmStudioField.name}
						description={config.lmStudioField.description}
					/>
				)}

				{visibleBuiltins.length > 0 && (
					<div class="tr-preset-section">
						<div class="tr-preset-section__header">
							<h3 class="tr-preset-section__title">Built-in presets</h3>
							<span class="tr-preset-section__description">
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

				<div class="tr-preset-section">
					<div class="tr-preset-section__header">
						<h3 class="tr-preset-section__title">Your presets</h3>
						<span class="tr-preset-section__description">
							{config.description}
						</span>
					</div>
					{bucket.userPresets.length === 0 && (
						<span class="ep:text-ui-smaller ep:text-obs-muted ep:italic">
							No custom presets yet. Add one to craft your own instruction.
						</span>
					)}
					<ReorderableList
						items={bucket.userPresets}
						getKey={(p) => p.id}
						onReorder={reorderUserPresets}
						getMoveLabel={(p) => `Reorder ${p.name}`}
						renderItem={(p) => (
							<CardAIPresetEditor
								preset={p}
								onChange={updateUserPreset}
								onDelete={() => removeUserPreset(p)}
								expanded={expandedIds.has(p.id)}
								onToggleExpanded={() => toggleExpanded(p.id)}
							/>
						)}
					/>
					<div class="tr-preset-section__actions">
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
