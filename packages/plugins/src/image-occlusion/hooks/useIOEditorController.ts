import { Notice } from "obsidian";
import { useCallback, useState } from "preact/hooks";

import {
	useApp,
	usePlugin,
} from "@true-recall/obsidian/preact/ObsidianContext";
import { notify } from "@true-recall/obsidian/services/notification.service";

import { detectRegions } from "../services/io-ai.service";
import type {
	IODrawingTool,
	IOEditorMode,
	IOEditorResult,
	IOEditorTool,
} from "../types";
import { deleteRegion } from "../utils/canvas-interactions";
import {
	appendDetectedRegions,
	createIOEditorInitialState,
	patchRegion,
} from "../utils/editor-state";
import { truncateMiddlePath } from "../utils/ui-helpers";
import { useIOEditorImage } from "./useIOEditorImage";
import { useIOEditorShortcuts } from "./useIOEditorShortcuts";
import { useIOEditorSource } from "./useIOEditorSource";

interface UseIOEditorControllerOptions {
	mode: IOEditorMode;
	onDone: (result: IOEditorResult) => void;
}

export function useIOEditorController({
	mode,
	onDone,
}: UseIOEditorControllerOptions) {
	const app = useApp();
	const plugin = usePlugin();
	const [initialState] = useState(() => createIOEditorInitialState(mode));

	const [definition, setDefinition] = useState(initialState.definition);
	const [tool, setTool] = useState<IOEditorTool>(initialState.tool);
	const [lastDrawingTool, setLastDrawingTool] = useState<IODrawingTool>("rect");
	const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [zoom, setZoom] = useState(1);
	const [panX, setPanX] = useState(0);
	const [panY, setPanY] = useState(0);
	const [aiLoading, setAiLoading] = useState(false);
	const [aiPromptVisible, setAiPromptVisible] = useState(false);
	const [aiCustomHint, setAiCustomHint] = useState("");

	const hasRegions = definition.regions.length > 0;
	const image = useIOEditorImage({
		initialImagePath: initialState.imagePath,
		hasRegions,
	});
	const source = useIOEditorSource(mode);
	const resolveSourceUid = source.resolveUid;
	const activeTool = tool === "select" && !hasRegions ? lastDrawingTool : tool;

	const selectedRegion =
		definition.regions.find((region) => region.id === selectedRegionId) ?? null;

	const updateSelectedRegion = useCallback(
		(patch: Parameters<typeof patchRegion>[2]) => {
			if (!selectedRegionId) return;
			setDefinition((current) => patchRegion(current, selectedRegionId, patch));
		},
		[selectedRegionId],
	);

	const deleteSelectedRegion = useCallback(() => {
		setSelectedRegionId((currentId) => {
			if (!currentId) return null;
			setDefinition((current) => deleteRegion(current, currentId));
			return null;
		});
	}, []);

	useIOEditorShortcuts({
		hasRegions,
		selectedRegionId,
		onDeleteSelected: deleteSelectedRegion,
		onToolChange: setTool,
		onDrawingToolChange: setLastDrawingTool,
	});

	const detectImageRegions = useCallback(
		async (hint?: string) => {
			if (!image.path || aiLoading) return;
			setAiLoading(true);
			setAiPromptVisible(false);
			try {
				const settings = plugin.settings;
				const regions = await detectRegions(
					app,
					image.path,
					settings,
					hint,
					settings.aiIODetectionPrompt,
				);
				if (regions.length === 0) {
					new Notice("AI could not detect any regions in this image");
					return;
				}

				setDefinition((current) => appendDetectedRegions(current, regions));
				setTool("select");
				new Notice(
					`AI detected ${regions.length} region${regions.length === 1 ? "" : "s"}`,
				);
			} catch (error) {
				notify().operationFailed("detect image regions", error);
			} finally {
				setAiLoading(false);
			}
		},
		[aiLoading, app, image.path, plugin],
	);

	const copyPath = useCallback(async (value: string) => {
		if (!value) return;
		try {
			await navigator.clipboard.writeText(value);
			new Notice("Path copied to clipboard");
		} catch {
			new Notice("Failed to copy path");
		}
	}, []);

	const save = useCallback(async () => {
		if (saving) return;
		if (!image.path) {
			new Notice("Select an image first");
			return;
		}
		if (definition.regions.length === 0) {
			new Notice("Add at least one occlusion region");
			return;
		}
		if (!plugin.flashcardManager?.hasStore()) {
			new Notice("Database not initialized");
			return;
		}

		setSaving(true);
		try {
			if (mode.mode === "edit") {
				const result = plugin.flashcardManager.updateImageOcclusionNote(
					mode.noteId,
					{ imagePath: image.path, definition },
				);
				new Notice(
					`Updated ${result.updatedCardIds.length} image occlusion card${result.updatedCardIds.length === 1 ? "" : "s"}`,
				);
				onDone({
					cancelled: false,
					imagePath: image.path,
					definition,
					updatedCardIds: result.updatedCardIds,
				});
				return;
			}

			const sourceUid = await resolveSourceUid();
			if (!sourceUid) {
				new Notice("Select source note to save image occlusion cards");
				setSaving(false);
				return;
			}

			const result = plugin.flashcardManager.createImageOcclusionNote({
				imagePath: image.path,
				definition,
				sourceUid,
				createdVia: "manual",
			});
			new Notice(
				`Created ${result.cards.length} image occlusion card${result.cards.length === 1 ? "" : "s"}`,
			);
			onDone({
				cancelled: false,
				imagePath: image.path,
				definition,
				createdNote: result.note,
				createdCards: result.cards,
			});
		} catch (error) {
			new Notice(
				error instanceof Error
					? error.message
					: "Failed to save image occlusion",
			);
			setSaving(false);
		}
	}, [
		definition,
		image.path,
		mode,
		onDone,
		plugin.flashcardManager,
		resolveSourceUid,
		saving,
	]);

	const setPan = useCallback((x: number, y: number) => {
		setPanX(x);
		setPanY(y);
	}, []);
	const setMaskMode = useCallback((maskMode: "solo" | "all") => {
		setDefinition((current) => ({ ...current, maskMode }));
	}, []);
	const toggleAiPrompt = useCallback(() => {
		setAiPromptVisible((current) => !current);
	}, []);
	const cancel = useCallback(() => {
		onDone({ cancelled: true });
	}, [onDone]);

	return {
		canvas: {
			imageUrl: image.url,
			definition,
			tool: activeTool,
			selectedRegionId,
			zoom,
			panX,
			panY,
			onDefinitionChange: setDefinition,
			onToolChange: setTool,
			onSelectRegion: setSelectedRegionId,
			onZoomChange: setZoom,
			onPanChange: setPan,
		},
		source: {
			app,
			showPicker: source.showPicker,
			selectedNote: source.selectedNote,
			onSelectNote: source.setSelectedNote,
			label: source.label,
			shortLabel: truncateMiddlePath(source.label),
			path: source.path,
			onCopyPath: copyPath,
		},
		image: {
			path: image.path,
			shortPath: truncateMiddlePath(image.path || "No image selected"),
			panelExpanded: image.panelExpanded,
			vaultImages: image.vaultImages,
			selectedVaultPath: image.selectedVaultPath,
			hasRegions,
			onSelectedVaultPathChange: image.setSelectedVaultPath,
			onTogglePanel: image.togglePanel,
			onApplySelected: image.applySelectedVaultImage,
			onCopyPath: copyPath,
		},
		tools: {
			tool: activeTool,
			hasRegions,
			selectedRegionId,
			aiPromptVisible,
			aiLoading,
			aiCustomHint,
			hasAIKey: Boolean(plugin.settings.proKey),
			hasImage: Boolean(image.path),
			onToolChange: setTool,
			onDrawingToolChange: setLastDrawingTool,
			onDeleteSelected: deleteSelectedRegion,
			onToggleAiPrompt: toggleAiPrompt,
			onAiCustomHintChange: setAiCustomHint,
			onAiDetect: detectImageRegions,
		},
		maskMode: definition.maskMode,
		onMaskModeChange: setMaskMode,
		regions: definition.regions,
		selectedRegion,
		onSelectRegion: setSelectedRegionId,
		onDeleteSelectedRegion: deleteSelectedRegion,
		onUpdateSelectedRegion: updateSelectedRegion,
		isEdit: mode.mode === "edit",
		saving,
		onCancel: cancel,
		onSave: save,
	};
}

export type IOEditorController = ReturnType<typeof useIOEditorController>;
