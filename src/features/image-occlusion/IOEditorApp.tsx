import { ImageService } from "@features/integration/services/ImageService";
import { createEmptyIODefinition, parseIODefinition } from "@features/image-occlusion/io-definition";
import { IOCanvas } from "@features/image-occlusion/IOCanvas";
import type {
	IODefinition,
	IOEditorMode,
	IOEditorResult,
	IORegion,
} from "@features/image-occlusion/types";
import { Clickable } from "@shared/ui/components/Clickable";
import { NotePickerCombobox } from "@shared/ui/components/NotePickerCombobox";
import { PasteDropZone } from "@shared/ui/components/PasteDropZone";
import { useApp, usePlugin } from "@shared/ui/preact/ObsidianContext";
import { isDesktop } from "@shared/utils/platform";
import { isImageExtension } from "@shared/types";
import { Notice, TFile } from "obsidian";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";

type Tool = "select" | "rect" | "ellipse";

interface IOEditorAppProps {
	mode: IOEditorMode;
	onDone: (result: IOEditorResult) => void;
}

function buildInitialDefinition(mode: IOEditorMode): IODefinition {
	if (mode.mode === "edit") {
		const parsed = parseIODefinition(mode.note.fields["Regions"]);
		return parsed ?? createEmptyIODefinition("solo");
	}
	return createEmptyIODefinition("solo");
}

function buildInitialImagePath(mode: IOEditorMode): string {
	if (mode.mode === "edit") {
		return mode.note.fields["Image"] ?? "";
	}
	return "";
}

export function IOEditorApp({ mode, onDone }: IOEditorAppProps) {
	const app = useApp();
	const plugin = usePlugin();

	const [imagePath, setImagePath] = useState(() => buildInitialImagePath(mode));
	const [definition, setDefinition] = useState<IODefinition>(() =>
		buildInitialDefinition(mode),
	);
	const [tool, setTool] = useState<Tool>("select");
	const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [zoom, setZoom] = useState(1);
	const [panX, setPanX] = useState(0);
	const [panY, setPanY] = useState(0);
	const [vaultImages, setVaultImages] = useState<TFile[]>([]);
	const [selectedVaultPath, setSelectedVaultPath] = useState("");
	const [selectedSourceNote, setSelectedSourceNote] = useState<TFile | null>(
		null,
	);

	const imageService = useMemo(() => new ImageService(app), [app]);
	const isEdit = mode.mode === "edit";
	const showSourcePicker = mode.mode === "add" && !mode.sourceUid;

	useEffect(() => {
		const files = app.vault
			.getFiles()
			.filter((file) => isImageExtension(file.extension))
			.sort((a, b) => b.stat.mtime - a.stat.mtime);
		setVaultImages(files);
		if (!selectedVaultPath && files[0]) {
			setSelectedVaultPath(files[0].path);
		}
	}, [app]);

	const imageUrl = useMemo(() => {
		if (!imagePath) return null;
		const file = app.vault.getAbstractFileByPath(imagePath);
		if (!(file instanceof TFile)) return null;
		return app.vault.getResourcePath(file);
	}, [app, imagePath]);

	const persistBlob = useCallback(
		async (blob: Blob) => {
			if (!blob.type.startsWith("image/")) {
				new Notice("Only image files are supported");
				return;
			}
			if (imageService.isBlobTooLarge(blob)) {
				new Notice(
					`Image too large (max 5MB, got ${imageService.formatFileSize(blob.size)})`,
				);
				return;
			}

			const path = await imageService.saveImageFromClipboard(blob);
			setImagePath(path);
			setSelectedVaultPath(path);
			new Notice("Image saved to vault");
		},
		[imageService],
	);

	const handlePaste = useCallback(
		(event: ClipboardEvent) => {
			const items = event.clipboardData?.items;
			if (!items?.length) return;
			for (const item of Array.from(items)) {
				if (!item.type.startsWith("image/")) continue;
				const file = item.getAsFile();
				if (!file) continue;
				event.preventDefault();
				void persistBlob(file);
				break;
			}
		},
		[persistBlob],
	);

	useEffect(() => {
		window.addEventListener("paste", handlePaste);
		return () => window.removeEventListener("paste", handlePaste);
	}, [handlePaste]);

	const selectedRegion = useMemo(
		() => definition.regions.find((region) => region.id === selectedRegionId) ?? null,
		[definition.regions, selectedRegionId],
	);

	const updateSelectedRegion = useCallback(
		(patch: Partial<Pick<IORegion, "x" | "y" | "w" | "h" | "label">>) => {
			if (!selectedRegionId) return;
			setDefinition((prev) => ({
				...prev,
				regions: prev.regions.map((region) => {
					if (region.id !== selectedRegionId) return region;
					return {
						...region,
						...patch,
					};
				}),
			}));
		},
		[selectedRegionId],
	);

	const deleteSelected = useCallback(() => {
		if (!selectedRegionId) return;
		setDefinition((prev) => ({
			...prev,
			regions: prev.regions.filter((region) => region.id !== selectedRegionId),
		}));
		setSelectedRegionId(null);
	}, [selectedRegionId]);

	const applySelectedVaultImage = useCallback(() => {
		if (!selectedVaultPath) return;
		setImagePath(selectedVaultPath);
	}, [selectedVaultPath]);

	const linkedSourceNote = useMemo(() => {
		if (mode.mode !== "add") return undefined;
		if (!mode.sourceUid) return undefined;
		return plugin.flashcardManager
			.getSourceNoteService()
			.resolveSourceNote(mode.sourceUid);
	}, [mode, plugin.flashcardManager]);

	const sourceTargetLabel = useMemo(() => {
		if (mode.mode === "edit") {
			const sourceUid = mode.note.sourceUid;
			if (!sourceUid) return "Source: not linked";
			const source = plugin.flashcardManager
				.getSourceNoteService()
				.resolveSourceNote(sourceUid);
			if (source.notePath) return `Source: ${source.notePath}`;
			if (source.noteName) return `Source: ${source.noteName}`;
			return `Source UID: ${sourceUid}`;
		}
		if (showSourcePicker) {
			return selectedSourceNote
				? `Source: ${selectedSourceNote.path}`
				: "Source: select note before saving";
		}
		if (linkedSourceNote?.notePath) {
			return `Source: ${linkedSourceNote.notePath}`;
		}
		if (linkedSourceNote?.noteName) {
			return `Source: ${linkedSourceNote.noteName}`;
		}
		return "Source: linked note";
	}, [linkedSourceNote, mode, plugin.flashcardManager, selectedSourceNote, showSourcePicker]);

	const resolveSourceUid = useCallback(async (): Promise<string | undefined> => {
		if (mode.mode === "edit") return mode.note.sourceUid;
		if (mode.sourceUid) return mode.sourceUid;
		if (!selectedSourceNote) return undefined;

		const fmService = plugin.flashcardManager.getFrontmatterService();
		let uid = await fmService.getSourceNoteUid(selectedSourceNote);
		if (!uid) {
			uid = fmService.generateUid();
			await fmService.setSourceNoteUid(selectedSourceNote, uid);
		}
		return uid;
	}, [mode, plugin.flashcardManager, selectedSourceNote]);

	const handleSave = useCallback(async () => {
		if (saving) return;
		if (!imagePath) {
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
			if (isEdit) {
				const result = plugin.flashcardManager.updateImageOcclusionNote(
					mode.noteId,
					{
						imagePath,
						definition,
					},
				);
				new Notice(
					`Updated ${result.updatedCardIds.length} image occlusion card${result.updatedCardIds.length !== 1 ? "s" : ""}`,
				);
				onDone({
					cancelled: false,
					imagePath,
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
				imagePath,
				definition,
				sourceUid,
				createdVia: "manual",
			});
			new Notice(
				`Created ${result.cards.length} image occlusion card${result.cards.length !== 1 ? "s" : ""}`,
			);

			onDone({
				cancelled: false,
				imagePath,
				definition,
				createdNote: result.note,
				createdCards: result.cards,
			});
		} catch (error) {
			new Notice(
				error instanceof Error ? error.message : "Failed to save image occlusion",
			);
			setSaving(false);
		}
	}, [
		definition,
		imagePath,
		isEdit,
		mode,
		onDone,
		plugin.flashcardManager,
		resolveSourceUid,
		saving,
	]);

	if (!isDesktop()) {
		return (
			<div class="ep:text-obs-muted ep:py-6">
				Image occlusion editor is available on desktop only.
			</div>
		);
	}

	return (
		<div class="true-recall-io-editor-modal ep:flex ep:flex-col ep:gap-3">
			<div class="true-recall-io-editor-layout">
				<div class="true-recall-io-editor-left">
					<IOCanvas
						imageUrl={imageUrl}
						definition={definition}
						tool={tool}
						onToolChange={setTool}
						selectedRegionId={selectedRegionId}
						zoom={zoom}
						panX={panX}
						panY={panY}
						onDefinitionChange={setDefinition}
						onSelectRegion={setSelectedRegionId}
						onZoomChange={setZoom}
						onPanChange={(x, y) => {
							setPanX(x);
							setPanY(y);
						}}
					/>
				</div>

				<div class="true-recall-io-editor-right">
					<div class="true-recall-io-side-section">
						<div class="ep:text-ui-small ep:font-medium ep:mb-1">Source</div>
						{showSourcePicker && (
							<div class="ep:flex ep:items-center ep:gap-2">
								<div class="ep:flex-1">
									<NotePickerCombobox
										app={app}
										selectedNote={selectedSourceNote}
										onSelect={setSelectedSourceNote}
									/>
								</div>
								{selectedSourceNote && (
									<Clickable
										class="ep:text-ui-smaller ep:text-obs-muted ep:hover:text-obs-normal"
										onClick={() => setSelectedSourceNote(null)}
									>
										Clear
									</Clickable>
								)}
							</div>
						)}
						<div class="ep:text-ui-smaller ep:text-obs-muted">
							{sourceTargetLabel}
						</div>
					</div>

					<div class="true-recall-io-side-section">
						<div class="ep:text-ui-small ep:font-medium ep:mb-1">Image</div>
						<select
							class="ep:w-full ep:px-2 ep:py-1.5 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded"
							value={selectedVaultPath}
							onChange={(event) =>
								setSelectedVaultPath(
									(event.target as HTMLSelectElement).value,
								)
							}
						>
							<option value="">Select image from vault…</option>
							{vaultImages.map((file) => (
								<option key={file.path} value={file.path}>
									{file.path}
								</option>
							))}
						</select>
						<button
							type="button"
							class="ep-btn ep-btn-outline"
							onClick={applySelectedVaultImage}
						>
							Use selected image
						</button>
						<PasteDropZone
							onFileDrop={(file) => void persistBlob(file)}
							label="Paste or drag image"
							hint="Ctrl/Cmd+V or drag & drop"
						/>
						<div class="ep:text-ui-smaller ep:text-obs-muted ep:truncate">
							{imagePath || "No image selected"}
						</div>
					</div>

					<div class="true-recall-io-side-section">
						<div class="ep:text-ui-small ep:font-medium ep:mb-1">Tools</div>
						<div class="true-recall-io-tool-row">
							<button
								type="button"
								class={`ep-btn ep-btn-ghost ${tool === "select" ? "is-active" : ""}`}
								onClick={() => setTool("select")}
							>
								Select
							</button>
							<button
								type="button"
								class={`ep-btn ep-btn-ghost ${tool === "rect" ? "is-active" : ""}`}
								onClick={() => setTool("rect")}
							>
								Rect
							</button>
							<button
								type="button"
								class={`ep-btn ep-btn-ghost ${tool === "ellipse" ? "is-active" : ""}`}
								onClick={() => setTool("ellipse")}
							>
								Ellipse
							</button>
							<button
								type="button"
								class="ep-btn ep-btn-ghost"
								onClick={deleteSelected}
								disabled={!selectedRegionId}
							>
								Delete
							</button>
						</div>
					</div>

					<div class="true-recall-io-side-section">
						<div class="ep:text-ui-small ep:font-medium ep:mb-1">Mask mode</div>
						<div class="ep:flex ep:gap-2">
							<button
								type="button"
								class={`ep-btn ep-btn-outline ${definition.maskMode === "solo" ? "is-active" : ""}`}
								onClick={() =>
									setDefinition((prev) => ({ ...prev, maskMode: "solo" }))
								}
							>
								Solo
							</button>
							<button
								type="button"
								class={`ep-btn ep-btn-outline ${definition.maskMode === "all" ? "is-active" : ""}`}
								onClick={() =>
									setDefinition((prev) => ({ ...prev, maskMode: "all" }))
								}
							>
								All
							</button>
						</div>
					</div>

					<div class="true-recall-io-side-section">
						<div class="ep:text-ui-small ep:font-medium ep:mb-1">
							Regions ({definition.regions.length})
						</div>
						<div class="true-recall-io-region-list">
							{definition.regions.length === 0 && (
								<div class="ep:text-ui-smaller ep:text-obs-muted">
									No regions yet
								</div>
							)}
							{definition.regions.map((region) => (
								<button
									type="button"
									key={region.id}
									class={`true-recall-io-region-item ${selectedRegionId === region.id ? "is-selected" : ""}`}
									onClick={() => setSelectedRegionId(region.id)}
								>
									<span>#{region.groupKey}</span>
									<span>{region.shape}</span>
								</button>
							))}
						</div>
					</div>

					{selectedRegion && (
						<div class="true-recall-io-side-section ep:flex ep:flex-col ep:gap-2">
							<div class="ep:text-ui-small ep:font-medium">Selected region</div>
							<label class="true-recall-io-field">
								X
								<input
									type="number"
									min={0}
									max={1}
									step={0.01}
									value={selectedRegion.x}
									onInput={(event) =>
										updateSelectedRegion({
											x: Number((event.target as HTMLInputElement).value),
										})
									}
								/>
							</label>
							<label class="true-recall-io-field">
								Y
								<input
									type="number"
									min={0}
									max={1}
									step={0.01}
									value={selectedRegion.y}
									onInput={(event) =>
										updateSelectedRegion({
											y: Number((event.target as HTMLInputElement).value),
										})
									}
								/>
							</label>
							<label class="true-recall-io-field">
								W
								<input
									type="number"
									min={0.01}
									max={1}
									step={0.01}
									value={selectedRegion.w}
									onInput={(event) =>
										updateSelectedRegion({
											w: Number((event.target as HTMLInputElement).value),
										})
									}
								/>
							</label>
							<label class="true-recall-io-field">
								H
								<input
									type="number"
									min={0.01}
									max={1}
									step={0.01}
									value={selectedRegion.h}
									onInput={(event) =>
										updateSelectedRegion({
											h: Number((event.target as HTMLInputElement).value),
										})
									}
								/>
							</label>
						</div>
					)}
				</div>
			</div>

			<div class="ep-modal-footer ep:flex ep:justify-end ep:gap-2">
				<button
					type="button"
					class="ep-btn ep-btn-ghost"
					onClick={() => onDone({ cancelled: true })}
				>
					Cancel
				</button>
				<button
					type="button"
					class="mod-cta ep-btn"
					onClick={() => void handleSave()}
					disabled={saving}
				>
					{isEdit ? "Save changes" : "Create cards"}
				</button>
			</div>
		</div>
	);
}
