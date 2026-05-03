import type { ComponentType } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

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
import { LMStudioScopedModelField } from "./LMStudioScopedModelField";

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

const PERSIST_DEBOUNCE_MS = 400;

function makeId(): string {
	return `preset-${Math.random().toString(36).slice(2, 10)}`;
}

export function createCardAISettingsPanel(
	config: CardAIPanelConfig,
): ComponentType<PluginSettingsProps> {
	return function CardAISettingsPanel({ settings, save }: PluginSettingsProps) {
		// Local working copy: keystrokes update this immediately, while writes to
		// the underlying settings store are debounced. This avoids round-tripping
		// every character through async persistence, which would re-render the
		// panel mid-typing and clobber in-flight input values.
		const [bucket, setBucket] = useState<CardAIUserSettings>(
			() => settings[config.bucketKey] ?? EMPTY_BUCKET,
		);
		const bucketRef = useRef(bucket);
		const saveRef = useRef(save);
		const flushTimerRef = useRef<number | null>(null);

		useEffect(() => {
			bucketRef.current = bucket;
		}, [bucket]);

		useEffect(() => {
			saveRef.current = save;
		}, [save]);

		const flushPending = () => {
			if (flushTimerRef.current === null) return;
			window.clearTimeout(flushTimerRef.current);
			flushTimerRef.current = null;
			void saveRef.current({
				[config.bucketKey]: bucketRef.current,
			} as Partial<TrueRecallSettings>);
		};

		// Flush any pending edits when the panel unmounts (tab switch, modal close)
		useEffect(() => () => flushPending(), []);

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

		const persist = (next: CardAIUserSettings) => {
			setBucket(next);
			bucketRef.current = next;
			if (flushTimerRef.current !== null) {
				window.clearTimeout(flushTimerRef.current);
			}
			flushTimerRef.current = window.setTimeout(() => {
				flushTimerRef.current = null;
				void saveRef.current({
					[config.bucketKey]: next,
				} as Partial<TrueRecallSettings>);
			}, PERSIST_DEBOUNCE_MS);
		};

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
			setExpandedIds((prev) => new Set(prev).add(forked.id));
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
			setExpandedIds((prev) => new Set(prev).add(fresh.id));
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
							expanded={expandedIds.has(p.id)}
							onToggleExpanded={() => toggleExpanded(p.id)}
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
