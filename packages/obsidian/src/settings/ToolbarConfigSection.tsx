import { useCallback, useRef, useState } from "preact/hooks";

import type { ToolbarButtonConfig } from "@true-recall/core/types";

import { Clickable, FormCard } from "@true-recall/obsidian/components";
import {
	BUILTIN_BUTTONS,
	extractPresetId,
	getButtonLabel,
	isBuiltinButton,
	isPresetButton,
} from "@true-recall/obsidian/editor/ai/toolbar-buttons";
import { useIcon, usePlugin } from "@true-recall/obsidian/preact";

import { BUTTON_PLUGIN_MAP } from "@true-recall/plugins";

interface ToolbarConfigListProps {
	title: string;
	description: string;
	buttons: ToolbarButtonConfig[];
	onChange: (buttons: ToolbarButtonConfig[]) => void;
	context: "editor" | "global";
}

export function ToolbarConfigSection({
	title,
	description,
	buttons,
	onChange,
	context,
}: ToolbarConfigListProps) {
	const plugin = usePlugin();
	const pluginStates = plugin.settings.pluginStates ?? {};
	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
	const dragNodeRef = useRef<HTMLDivElement | null>(null);

	const handleToggle = useCallback(
		(index: number) => {
			const btn = buttons[index];
			if (!btn) return;
			const next = [...buttons];
			next[index] = { ...btn, enabled: !btn.enabled };
			onChange(next);
		},
		[buttons, onChange],
	);

	const handleRemove = useCallback(
		(index: number) => {
			const next = buttons.filter((_, i) => i !== index);
			onChange(next);
		},
		[buttons, onChange],
	);

	const handleDragStart = useCallback((e: DragEvent, index: number) => {
		setDragIndex(index);
		dragNodeRef.current = e.currentTarget as HTMLDivElement;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData("text/plain", String(index));
		}
	}, []);

	const handleDragOver = useCallback((e: DragEvent, index: number) => {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
		setDragOverIndex(index);
	}, []);

	const handleDrop = useCallback(
		(e: DragEvent, dropIndex: number) => {
			e.preventDefault();
			if (dragIndex === null || dragIndex === dropIndex) return;
			const moved = buttons[dragIndex];
			if (!moved) return;
			const next = buttons.filter((_, i) => i !== dragIndex);
			next.splice(dropIndex, 0, moved);
			onChange(next);
			setDragIndex(null);
			setDragOverIndex(null);
		},
		[buttons, dragIndex, onChange],
	);

	const handleDragEnd = useCallback(() => {
		setDragIndex(null);
		setDragOverIndex(null);
	}, []);

	const handleAddCommand = useCallback(async () => {
		const { CommandSuggestModal } = await import(
			"@true-recall/obsidian/modals/shared/CommandSuggestModal"
		);
		const existingIds = buttons.map((b) => b.id);
		const modal = new CommandSuggestModal(plugin.app, existingIds);
		const result = await modal.openAndWait();
		if (result) {
			onChange([...buttons, { id: result.id, enabled: true }]);
		}
	}, [buttons, onChange, plugin.app]);

	const handleAddPreset = useCallback(async () => {
		const { PresetSuggestModal } = await import(
			"@true-recall/obsidian/modals/shared/PresetSuggestModal"
		);
		const existingIds = buttons.map((b) => b.id);
		const presets = plugin.settings.generationPresets ?? [];
		const modal = new PresetSuggestModal(plugin.app, presets, existingIds);
		const result = await modal.openAndWait();
		if (result) {
			onChange([...buttons, { id: `preset:${result.id}`, enabled: true }]);
		}
	}, [buttons, onChange, plugin.app, plugin.settings.generationPresets]);

	const getLabel = useCallback(
		(id: string) => {
			if (isBuiltinButton(id)) return getButtonLabel(id);
			if (isPresetButton(id)) {
				const presetId = extractPresetId(id);
				const preset = plugin.settings.generationPresets?.find(
					(p) => p.id === presetId,
				);
				return preset?.name ?? "Deleted preset";
			}
			const commands = (plugin.app as any).commands.commands as Record<
				string,
				{ name: string }
			>;
			return commands[id]?.name ?? id;
		},
		[plugin.app, plugin.settings.generationPresets],
	);

	return (
		<FormCard title={title} description={description}>
			<div class="ep:flex ep:flex-col ep:gap-0.5">
				{buttons.map((btn, i) => {
					const isEditorOnly =
						context === "global" &&
						BUILTIN_BUTTONS.some((b) => b.id === btn.id && b.editorOnly);

					const pluginInfo = BUTTON_PLUGIN_MAP.get(btn.id);
					const isPluginDisabled =
						pluginInfo !== undefined &&
						pluginStates[pluginInfo.pluginId] === false;
					const isPreset = isPresetButton(btn.id);
					const presetExists = isPreset
						? (plugin.settings.generationPresets?.some(
								(p) => p.id === extractPresetId(btn.id),
							) ?? false)
						: true;
					const isOrphan = isPreset && !presetExists;
					const isProButton = pluginInfo?.requiresPro;
					const isDisabled = isEditorOnly || isPluginDisabled || isOrphan;

					return (
						<ToolbarButtonRow
							key={`${btn.id}-${i}`}
							label={getLabel(btn.id)}
							enabled={btn.enabled}
							isCustom={!isBuiltinButton(btn.id)}
							isDragging={dragIndex === i}
							isDragOver={dragOverIndex === i}
							disabled={isDisabled}
							disabledReason={
								isOrphan
									? "Preset deleted"
									: isPluginDisabled
										? "Plugin disabled"
										: isEditorOnly
											? "Only available in editor"
											: undefined
							}
							showProBadge={isProButton}
							onToggle={() => handleToggle(i)}
							onRemove={() => handleRemove(i)}
							onDragStart={(e) => handleDragStart(e, i)}
							onDragOver={(e) => handleDragOver(e, i)}
							onDrop={(e) => handleDrop(e, i)}
							onDragEnd={handleDragEnd}
						/>
					);
				})}
			</div>

			<div class="ep:flex ep:gap-2 ep:mt-2">
				<Clickable
					class="ep-btn ep-btn-outline ep:text-xs"
					onClick={() => void handleAddCommand()}
				>
					+ Add command
				</Clickable>
				<Clickable
					class="ep-btn ep-btn-outline ep:text-xs"
					onClick={() => void handleAddPreset()}
				>
					+ Add preset
				</Clickable>
			</div>
		</FormCard>
	);
}

interface ToolbarButtonRowProps {
	label: string;
	enabled: boolean;
	isCustom: boolean;
	isDragging: boolean;
	isDragOver: boolean;
	disabled?: boolean;
	disabledReason?: string;
	showProBadge?: boolean;
	onToggle: () => void;
	onRemove: () => void;
	onDragStart: (e: DragEvent) => void;
	onDragOver: (e: DragEvent) => void;
	onDrop: (e: DragEvent) => void;
	onDragEnd: () => void;
}

function ToolbarButtonRow({
	label,
	enabled,
	isCustom,
	isDragging,
	isDragOver,
	disabled,
	disabledReason,
	showProBadge,
	onToggle,
	onRemove,
	onDragStart,
	onDragOver,
	onDrop,
	onDragEnd,
}: ToolbarButtonRowProps) {
	const trashRef = useIcon("trash-2");

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: draggable row needs drag handlers
		<div
			draggable
			onDragStart={onDragStart}
			onDragOver={onDragOver}
			onDrop={onDrop}
			onDragEnd={onDragEnd}
			class={`ep:flex ep:items-center ep:gap-2 ep:px-2 ep:py-1.5 ep:rounded ep:transition-colors ${
				isDragging ? "ep:opacity-40" : ""
			} ${isDragOver ? "ep:bg-obs-bg-hover" : ""}`}
			title={disabledReason}
		>
			<span class="ep:cursor-grab ep:text-obs-text-faint ep:select-none">
				&#x2261;
			</span>

			<span
				class={`ep:flex-1 ep:text-sm ep:flex ep:items-center ep:gap-1.5 ${disabled ? "ep:text-obs-text-faint" : ""}`}
			>
				{label}
				{showProBadge && (
					<span class="ep:text-[10px] ep:px-1 ep:py-0.5 ep:rounded ep:font-medium ep:bg-obs-accent/10 ep:text-obs-accent ep:leading-none">
						PRO
					</span>
				)}
			</span>

			{isCustom && (
				<Clickable
					class="ep:text-obs-text-faint ep:hover:text-obs-text-normal ep:w-4 ep:h-4"
					onClick={onRemove}
					title="Remove"
				>
					<div ref={trashRef} class="ep:w-4 ep:h-4" />
				</Clickable>
			)}

			<div
				class={`checkbox-container${enabled && !disabled ? " is-enabled" : ""} ${disabled ? "ep:opacity-30 ep:cursor-not-allowed" : ""}`}
				role="switch"
				tabIndex={0}
				aria-checked={enabled && !disabled}
				onClick={() => {
					if (!disabled) onToggle();
				}}
				onKeyDown={(e) => {
					if (!disabled && (e.key === "Enter" || e.key === " ")) {
						e.preventDefault();
						onToggle();
					}
				}}
			/>
		</div>
	);
}
