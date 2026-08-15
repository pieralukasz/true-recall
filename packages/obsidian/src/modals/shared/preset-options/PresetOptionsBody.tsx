import { useCallback, useEffect, useMemo, useState } from "preact/hooks";

import type { FSRSPreset } from "@true-recall/core/types";

import { ActionButton } from "@true-recall/obsidian/components";
import { confirm } from "@true-recall/obsidian/modals/shared/ConfirmModal";
import { usePlugin } from "@true-recall/obsidian/preact";
import { notify } from "@true-recall/obsidian/services/notification.service";

import { DailyLimitsSection } from "./DailyLimitsSection";
import { getDescendantProjectPaths } from "./descendant-projects";
import { LapsesSection } from "./LapsesSection";
import { NewCardsSection } from "./NewCardsSection";
import { ParametersSection } from "./ParametersSection";
import { PresetSelector } from "./PresetSelector";
import { SchedulingSection } from "./SchedulingSection";
import { UsageSection } from "./UsageSection";

export interface PresetOptionsContext {
	contextPath?: string;
	contextName?: string;
}

interface PresetOptionsBodyProps {
	initialPresetId?: string;
	context?: PresetOptionsContext;
	onClose: () => void;
}

export function PresetOptionsBody({
	initialPresetId,
	context,
	onClose,
}: PresetOptionsBodyProps) {
	const plugin = usePlugin();
	const settings = plugin.settings;

	const [selectedPresetId, setSelectedPresetId] = useState(
		initialPresetId ?? settings.defaultPresetId,
	);
	const [version, setVersion] = useState(0);
	const [applyToChildren, setApplyToChildren] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	// Bumped to remount the selector when a preset switch is called off, so the
	// native <select> snaps back to the preset that is actually being edited.
	const [selectorNonce, setSelectorNonce] = useState(0);

	// Re-read persisted state on version bump
	void version;
	const presets = settings.fsrsPresets;
	const savedPreset =
		presets.find((p) => p.id === selectedPresetId) ?? presets[0];

	// Edits are staged here and only written on Save.
	const [draft, setDraft] = useState<FSRSPreset | null>(savedPreset ?? null);

	useEffect(() => {
		const next =
			plugin.settings.fsrsPresets.find((p) => p.id === selectedPresetId) ??
			plugin.settings.fsrsPresets[0];
		setDraft(next ? { ...next } : null);
	}, [plugin, selectedPresetId, version]);

	const isDirty = useMemo(() => {
		if (!draft || !savedPreset) return false;
		return JSON.stringify(draft) !== JSON.stringify(savedPreset);
	}, [draft, savedPreset]);

	const stageChanges = useCallback(async (changes: Partial<FSRSPreset>) => {
		setDraft((current) => (current ? { ...current, ...changes } : current));
	}, []);

	const refresh = useCallback(() => setVersion((v) => v + 1), []);

	const descendantProjectPaths = useCallback(
		(rootPath: string): string[] =>
			getDescendantProjectPaths(plugin.hierarchyService, rootPath),
		[plugin],
	);

	// Offer the cascade only when it would actually touch something — a parent
	// whose children are all plain notes gets no checkbox.
	const hasChildProjects = useMemo(() => {
		if (!context?.contextPath) return false;
		return descendantProjectPaths(context.contextPath).length > 0;
	}, [context?.contextPath, descendantProjectPaths]);

	const confirmDiscard = useCallback(async () => {
		if (!isDirty || !savedPreset) return true;
		return confirm(plugin.app, {
			title: "Unsaved changes",
			message: `"${savedPreset.name}" has unsaved changes that will be lost.`,
			confirmLabel: "Discard",
			cancelLabel: "Keep editing",
		});
	}, [isDirty, plugin.app, savedPreset]);

	const handlePresetChange = useCallback(
		async (id: string) => {
			if (id === selectedPresetId) return;
			if (!(await confirmDiscard())) {
				setSelectorNonce((n) => n + 1);
				return;
			}
			setSelectedPresetId(id);
		},
		[selectedPresetId, confirmDiscard],
	);

	const handleCreate = useCallback(async () => {
		if (!savedPreset) return;
		if (!(await confirmDiscard())) return;

		const { id: _id, createdAt: _createdAt, ...source } = savedPreset;
		const newPreset = await plugin.presetService.createPreset({
			...source,
			name: `${savedPreset.name} (copy)`,
			weights: savedPreset.weights ? [...savedPreset.weights] : null,
			learningSteps: [...savedPreset.learningSteps],
			relearningSteps: [...savedPreset.relearningSteps],
			lastOptimization: null,
			lastOptimizationReviewCount: null,
			lastOptimizationMetrics: null,
		});
		setSelectedPresetId(newPreset.id);
		refresh();
	}, [plugin, savedPreset, confirmDiscard, refresh]);

	const handleDelete = useCallback(async () => {
		if (!savedPreset) return;
		const confirmed = await confirm(plugin.app, {
			title: "Delete preset",
			message: `Delete "${savedPreset.name}"? Notes assigned to it fall back to the default preset.`,
			confirmLabel: "Delete",
		});
		if (!confirmed) return;

		await plugin.presetService.deletePreset(savedPreset.id);
		setSelectedPresetId(settings.defaultPresetId);
		refresh();
	}, [plugin, savedPreset, settings.defaultPresetId, refresh]);

	const handleSave = useCallback(async () => {
		if (!draft || !savedPreset) return;
		setIsSaving(true);
		try {
			const name = draft.name.trim();
			if (isDirty) {
				const { id: _id, createdAt: _createdAt, ...changes } = draft;
				await plugin.presetService.updatePreset(savedPreset.id, {
					...changes,
					name,
				});
			}

			const frontmatterService =
				plugin.flashcardManager?.getFrontmatterService();
			if (context?.contextPath && frontmatterService) {
				const file = plugin.app.vault.getFileByPath(context.contextPath);
				if (file) {
					await frontmatterService.setFsrsPreset(file.path, name);
				}

				if (applyToChildren) {
					const descendantPaths = descendantProjectPaths(context.contextPath);
					await Promise.all(
						descendantPaths.map((path) => {
							const f = plugin.app.vault.getFileByPath(path);
							return f
								? frontmatterService.setFsrsPreset(f.path, name)
								: Promise.resolve();
						}),
					);
				}
			}
			onClose();
		} catch (err) {
			notify().error(`Could not save preset: ${String(err)}`);
		} finally {
			setIsSaving(false);
		}
	}, [
		plugin,
		draft,
		savedPreset,
		isDirty,
		context,
		applyToChildren,
		descendantProjectPaths,
		onClose,
	]);

	const handleCancel = useCallback(async () => {
		if (!(await confirmDiscard())) return;
		onClose();
	}, [confirmDiscard, onClose]);

	if (!draft || !savedPreset) return null;

	const isDefault = draft.id === settings.defaultPresetId;
	const trimmedName = draft.name.trim();
	// Presets are referenced by name from note frontmatter, so an empty or
	// duplicated name would silently detach or merge assignments.
	const nameError = !trimmedName
		? "Preset name cannot be empty"
		: presets.some((p) => p.id !== draft.id && p.name.trim() === trimmedName)
			? "Another preset already uses this name"
			: null;
	const canSave =
		(isDirty || Boolean(context?.contextPath)) && nameError === null;

	return (
		<div class="ep:flex ep:flex-col ep:flex-1 ep:min-h-0">
			<div class="ep:flex-1 ep:overflow-y-auto ep:min-h-0 ep:flex ep:flex-col ep:gap-3">
				<PresetSelector
					key={`${selectedPresetId}-${selectorNonce}`}
					presets={presets}
					preset={draft}
					isDefault={isDefault}
					onPresetChange={(id) => void handlePresetChange(id)}
					onCreate={() => void handleCreate()}
					onDelete={() => void handleDelete()}
					onRename={(name) => void stageChanges({ name })}
				/>

				<DailyLimitsSection preset={draft} updatePreset={stageChanges} />
				<NewCardsSection preset={draft} updatePreset={stageChanges} />
				<LapsesSection preset={draft} updatePreset={stageChanges} />
				<SchedulingSection preset={draft} updatePreset={stageChanges} />
				<ParametersSection
					preset={draft}
					reviewPresetName={savedPreset.name}
					updatePreset={stageChanges}
					plugin={plugin}
				/>
				<UsageSection preset={savedPreset} />
			</div>

			<div class="ep-modal-footer ep:shrink-0 ep:flex ep:items-center ep:justify-between ep:gap-2 ep:pt-3 ep:mt-2 ep:border-t ep:border-obs-border ep:bg-obs-primary">
				{hasChildProjects && context?.contextPath ? (
					<label class="ep:flex ep:items-center ep:gap-2 ep:cursor-pointer ep:text-ui-small ep:text-obs-muted">
						<input
							type="checkbox"
							checked={applyToChildren}
							disabled={isSaving}
							onChange={(e) =>
								setApplyToChildren((e.target as HTMLInputElement).checked)
							}
						/>
						Apply to child projects
					</label>
				) : (
					<div />
				)}
				<div class="ep:flex ep:items-center ep:gap-2">
					{nameError ? (
						<span class="ep:text-ui-smaller ep:text-obs-red">{nameError}</span>
					) : (
						isDirty && (
							<span class="ep:text-ui-smaller ep:text-obs-muted">
								Unsaved changes
							</span>
						)
					)}
					<ActionButton
						label="Cancel"
						variant="outline"
						disabled={isSaving}
						onClick={() => void handleCancel()}
					/>
					<ActionButton
						label={isSaving ? "Saving..." : "Save"}
						variant="primary"
						disabled={isSaving || !canSave}
						onClick={() => void handleSave()}
					/>
				</div>
			</div>
		</div>
	);
}
