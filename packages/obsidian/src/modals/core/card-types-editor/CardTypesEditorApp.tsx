import type { CardTemplate } from "@true-recall/core/types/note.types";
import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { Notice } from "obsidian";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { FieldManager } from "../note-type-manager/FieldManager";
import { BottomBar } from "./BottomBar";
import { CardTypeDropdown } from "./CardTypeDropdown";
import { type EditorTab, EditorTabs } from "./EditorTabs";
import { FieldChips } from "./FieldChips";
import { OptionsMenu } from "./OptionsMenu";
import { TemplateCodeEditor } from "./TemplateCodeEditor";

interface CardTypesEditorAppProps {
	noteTypeId: string;
	onClose: () => void;
	onTitleChange: (title: string) => void;
}

export function CardTypesEditorApp({
	noteTypeId,
	onClose,
	onTitleChange,
}: CardTypesEditorAppProps) {
	const plugin = usePlugin();
	const noteTypeService = plugin.noteTypeService;

	const [version, setVersion] = useState(0);
	const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);
	const [activeTab, setActiveTab] = useState<EditorTab>("front");
	const [showFields, setShowFields] = useState(false);

	const noteType = useMemo(
		() => noteTypeService.getById(noteTypeId),
		// eslint-disable-next-line react-hooks/exhaustive-deps -- version signal triggers re-fetch when note type data changes
		[noteTypeService, noteTypeId, version],
	);

	const readOnly = noteType?.isBuiltin ?? true;
	const selectedTemplate = noteType?.templates[selectedTemplateIndex] ?? null;

	useEffect(() => {
		if (noteType) {
			onTitleChange(`Card Types for "${noteType.name}"`);
		}
	}, [noteType?.name, onTitleChange]);

	const refresh = useCallback(() => setVersion((v) => v + 1), []);

	const editorValue = useMemo(() => {
		if (!selectedTemplate) return "";
		switch (activeTab) {
			case "front":
				return selectedTemplate.qfmt;
			case "back":
				return selectedTemplate.afmt;
			case "styling":
				return noteType?.css ?? "";
		}
	}, [selectedTemplate, activeTab, noteType?.css]);

	const handleEditorChange = useCallback(
		(value: string) => {
			if (!noteType || readOnly) return;
			try {
				if (activeTab === "styling") {
					noteTypeService.update(noteType.id, { css: value });
				} else {
					const templates = [...noteType.templates];
					const current = templates[selectedTemplateIndex];
					if (!current) return;
					templates[selectedTemplateIndex] = {
						...current,
						[activeTab === "front" ? "qfmt" : "afmt"]: value,
					};
					noteTypeService.update(noteType.id, { templates });
				}
				refresh();
			} catch (e) {
				new Notice((e as Error).message);
			}
		},
		[
			noteType,
			readOnly,
			activeTab,
			selectedTemplateIndex,
			noteTypeService,
			refresh,
		],
	);

	const handleAddTemplate = useCallback(() => {
		if (!noteType || readOnly) return;
		const ordinal = noteType.templates.length;
		const templates: CardTemplate[] = [
			...noteType.templates,
			{ name: `Card ${ordinal + 1}`, ordinal, qfmt: "", afmt: "" },
		];
		try {
			noteTypeService.update(noteType.id, { templates });
			setSelectedTemplateIndex(ordinal);
			refresh();
		} catch (e) {
			new Notice((e as Error).message);
		}
	}, [noteType, readOnly, noteTypeService, refresh]);

	const handleRemoveTemplate = useCallback(() => {
		if (!noteType || readOnly || noteType.templates.length <= 1) return;
		const templates = noteType.templates
			.filter((_, i) => i !== selectedTemplateIndex)
			.map((t, i) => ({ ...t, ordinal: i }));
		try {
			noteTypeService.update(noteType.id, { templates });
			setSelectedTemplateIndex(Math.max(0, selectedTemplateIndex - 1));
			refresh();
		} catch (e) {
			new Notice((e as Error).message);
		}
	}, [noteType, readOnly, selectedTemplateIndex, noteTypeService, refresh]);

	const handleRenameTemplate = useCallback(
		(newName: string) => {
			if (!noteType || readOnly) return;
			const templates = [...noteType.templates];
			const current = templates[selectedTemplateIndex];
			if (!current) return;
			templates[selectedTemplateIndex] = { ...current, name: newName };
			try {
				noteTypeService.update(noteType.id, { templates });
				refresh();
			} catch (e) {
				new Notice((e as Error).message);
			}
		},
		[noteType, readOnly, selectedTemplateIndex, noteTypeService, refresh],
	);

	const handleFlip = useCallback(() => {
		if (!noteType || readOnly) return;
		const templates = [...noteType.templates];
		const current = templates[selectedTemplateIndex];
		if (!current) return;
		templates[selectedTemplateIndex] = {
			...current,
			qfmt: current.afmt,
			afmt: current.qfmt,
		};
		try {
			noteTypeService.update(noteType.id, { templates });
			refresh();
		} catch (e) {
			new Notice((e as Error).message);
		}
	}, [noteType, readOnly, selectedTemplateIndex, noteTypeService, refresh]);

	const handleFieldsChange = useCallback(
		(fields: string[]) => {
			if (!noteType) return;
			try {
				noteTypeService.update(noteType.id, { fields });
				refresh();
			} catch (e) {
				new Notice((e as Error).message);
			}
		},
		[noteType, noteTypeService, refresh],
	);

	const handleFieldRename = useCallback(
		(oldName: string, newName: string) => {
			if (!noteType) return;
			try {
				noteTypeService.renameField(noteType.id, oldName, newName);
				refresh();
			} catch (e) {
				new Notice((e as Error).message);
			}
		},
		[noteType, noteTypeService, refresh],
	);

	if (!noteType) {
		return (
			<div class="ep:flex ep:items-center ep:justify-center ep:h-full ep:text-obs-muted">
				Note type not found
			</div>
		);
	}

	return (
		<div class="ep:flex ep:flex-col ep:h-[65vh]">
			{/* Top bar: Card Type dropdown + Options */}
			<div class="ep:flex ep:items-center ep:gap-3 ep:pb-3 ep:border-b ep:border-obs-border">
				<span class="ep:text-ui-small ep:text-obs-muted ep:shrink-0">
					Card Type:
				</span>
				<CardTypeDropdown
					templates={noteType.templates}
					selectedIndex={selectedTemplateIndex}
					onChange={setSelectedTemplateIndex}
				/>
				{!readOnly && (
					<OptionsMenu
						onAdd={handleAddTemplate}
						onRemove={handleRemoveTemplate}
						onRename={handleRenameTemplate}
						currentName={selectedTemplate?.name ?? ""}
						canRemove={noteType.templates.length > 1}
					/>
				)}
			</div>

			{/* Tabs */}
			<EditorTabs activeTab={activeTab} onTabChange={setActiveTab} />

			{/* Editor area */}
			<div class="ep:flex-1 ep:min-h-0 ep:flex ep:flex-col ep:py-3">
				{activeTab === "styling" && (
					<div class="ep:text-ui-smaller ep:text-obs-muted ep:mb-2">
						CSS styling shared across all card types
					</div>
				)}
				<div class="ep:flex-1 ep:min-h-0">
					<TemplateCodeEditor
						key={`${noteType.id}-${selectedTemplateIndex}-${activeTab}`}
						value={editorValue}
						readOnly={readOnly}
						onChange={handleEditorChange}
						tall
					/>
				</div>

				{/* Field chips (only for front/back tabs) */}
				{activeTab !== "styling" && (
					<FieldChips fields={noteType.fields} noteTypeType={noteType.type} />
				)}
			</div>

			{/* Inline field manager (expandable) */}
			{showFields && !readOnly && (
				<div class="ep:border-t ep:border-obs-border ep:pt-3 ep:pb-2 ep:max-h-[200px] ep:overflow-y-auto">
					<FieldManager
						fields={noteType.fields}
						readOnly={false}
						onFieldsChange={handleFieldsChange}
						onFieldRename={handleFieldRename}
					/>
				</div>
			)}

			{/* Bottom bar */}
			<BottomBar
				readOnly={readOnly}
				showFields={showFields}
				onToggleFields={() => setShowFields((v) => !v)}
				onFlip={handleFlip}
				onClose={onClose}
			/>
		</div>
	);
}
