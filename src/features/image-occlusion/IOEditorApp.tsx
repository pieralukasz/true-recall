import { ImageService } from "@features/integration/services/ImageService";
import { createEmptyIODefinition, getNextIOGroupKey, parseIODefinition } from "@features/image-occlusion/io-definition";
import { IOCanvas } from "@features/image-occlusion/IOCanvas";
import { detectRegions } from "@features/image-occlusion/io-ai.service";
import {
	shouldImagePanelStartExpanded,
	truncateMiddlePath,
} from "@features/image-occlusion/ui-helpers";
import type {
	IODefinition,
	IOEditorMode,
	IOEditorResult,
	IORegion,
} from "@features/image-occlusion/types";
import { Clickable } from "@shared/ui/components/Clickable";
import { NotePickerCombobox } from "@shared/ui/components/NotePickerCombobox";
import { PasteDropZone } from "@shared/ui/components/PasteDropZone";
import { useIcon } from "@shared/ui/preact/hooks";
import { useApp, usePlugin } from "@shared/ui/preact/ObsidianContext";
import { cn } from "@shared/ui/utils/cn";
import { isDesktop } from "@shared/utils/platform";
import { isImageExtension } from "@shared/types";
import { Notice, TFile } from "obsidian";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";

type Tool = "select" | "rect" | "ellipse";
type NonSelectTool = Exclude<Tool, "select">;

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
	return mode.imagePath ?? "";
}

function buildInitialTool(mode: IOEditorMode): Tool {
	const definition = buildInitialDefinition(mode);
	return definition.regions.length > 0 ? "select" : "rect";
}

interface IconToolButtonProps {
	icon: string;
	label: string;
	shortcut?: string;
	active?: boolean;
	danger?: boolean;
	disabled?: boolean;
	onClick: () => void;
}

function IconToolButton({
	icon,
	label,
	shortcut,
	active = false,
	danger = false,
	disabled = false,
	onClick,
}: IconToolButtonProps) {
	const iconRef = useIcon(icon);
	const tooltip = shortcut ? `${label} (${shortcut})` : label;

	return (
		<Clickable
			class={cn(
				"true-recall-io-icon-btn",
				active && "is-active",
				danger && "is-danger",
			)}
			aria-label={label}
			title={tooltip}
			onClick={() => onClick()}
			disabled={disabled}
		>
			<span ref={iconRef} />
		</Clickable>
	);
}

interface RegionListItemProps {
	region: IORegion;
	selected: boolean;
	onSelect: () => void;
	onDelete: () => void;
}

function RegionListItem({
	region,
	selected,
	onSelect,
	onDelete,
}: RegionListItemProps) {
	return (
		<div class={`true-recall-io-region-item ${selected ? "is-selected" : ""}`}>
			<Clickable
				class="true-recall-io-region-main"
				onClick={() => onSelect()}
				title={`Select region #${region.groupKey}`}
			>
				<span>#{region.groupKey}</span>
				<span>{region.shape}</span>
			</Clickable>
			{selected && (
				<IconToolButton
					icon="trash-2"
					label={`Delete region #${region.groupKey}`}
					shortcut="Delete"
					danger
					onClick={onDelete}
				/>
			)}
		</div>
	);
}

export function IOEditorApp({ mode, onDone }: IOEditorAppProps) {
	const app = useApp();
	const plugin = usePlugin();

	const [imagePath, setImagePath] = useState(() => buildInitialImagePath(mode));
	const [definition, setDefinition] = useState<IODefinition>(() =>
		buildInitialDefinition(mode),
	);
	const [tool, setTool] = useState<Tool>(() => buildInitialTool(mode));
	const [lastNonSelectTool, setLastNonSelectTool] =
		useState<NonSelectTool>("rect");
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
	const [isImagePanelExpanded, setIsImagePanelExpanded] = useState(() =>
		shouldImagePanelStartExpanded(buildInitialImagePath(mode)),
	);
	const [aiLoading, setAiLoading] = useState(false);
	const [aiPromptVisible, setAiPromptVisible] = useState(false);
	const [aiCustomHint, setAiCustomHint] = useState("");

	const imageService = useMemo(() => new ImageService(app), [app]);
	const isEdit = mode.mode === "edit";
	const showSourcePicker = mode.mode === "add" && !mode.sourceUid;
	const hasRegions = definition.regions.length > 0;

	useEffect(() => {
		if (!hasRegions && tool === "select") {
			setTool(lastNonSelectTool);
		}
	}, [hasRegions, lastNonSelectTool, tool]);

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

	useEffect(() => {
		if (!imagePath) {
			setIsImagePanelExpanded(true);
		}
	}, [imagePath]);

	useEffect(() => {
		if (hasRegions && isImagePanelExpanded && imagePath) {
			setIsImagePanelExpanded(false);
		}
	}, [hasRegions, imagePath, isImagePanelExpanded]);

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

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Delete" && event.key !== "Backspace") return;
			if (!selectedRegionId) return;
			const tag = (event.target as HTMLElement)?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
			event.preventDefault();
			deleteSelected();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [selectedRegionId, deleteSelected]);

	const hasAIKey = Boolean(
		plugin.settings.subscriptionKey || plugin.settings.openRouterApiKey,
	);

	const handleAIDetect = useCallback(async (hint?: string) => {
		if (!imagePath || aiLoading) return;
		setAiLoading(true);
		setAiPromptVisible(false);
		try {
			const newRegions = await detectRegions(
				app, imagePath, plugin.settings, hint, plugin.settings.aiIODetectionPrompt,
			);
			if (newRegions.length === 0) {
				new Notice("AI could not detect any regions in this image");
				return;
			}
			setDefinition((prev) => {
				let nextKey = Number(getNextIOGroupKey(prev));
				const regionsWithKeys = newRegions.map((region) => ({
					...region,
					groupKey: String(nextKey++),
				}));
				return {
					...prev,
					regions: [...prev.regions, ...regionsWithKeys],
				};
			});
			setTool("select");
			new Notice(
				`AI detected ${newRegions.length} region${newRegions.length !== 1 ? "s" : ""}`,
			);
		} catch (error) {
			new Notice(
				error instanceof Error ? error.message : "AI detection failed",
			);
		} finally {
			setAiLoading(false);
		}
	}, [app, imagePath, aiLoading, plugin.settings]);

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

	const truncatedSourceTargetLabel = useMemo(
		() => truncateMiddlePath(sourceTargetLabel),
		[sourceTargetLabel],
	);

	const truncatedImagePath = useMemo(
		() => truncateMiddlePath(imagePath || "No image selected"),
		[imagePath],
	);

	const sourcePathForCopy = useMemo(() => {
		if (mode.mode === "edit") {
			const sourceUid = mode.note.sourceUid;
			if (!sourceUid) return "";
			const source = plugin.flashcardManager
				.getSourceNoteService()
				.resolveSourceNote(sourceUid);
			return source.notePath ?? "";
		}
		if (showSourcePicker) {
			return selectedSourceNote?.path ?? "";
		}
		return linkedSourceNote?.notePath ?? "";
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

	const copyPathToClipboard = useCallback(async (value: string) => {
		if (!value) return;
		try {
			await navigator.clipboard.writeText(value);
			new Notice("Path copied to clipboard");
		} catch {
			new Notice("Failed to copy path");
		}
	}, []);

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
						<div class="ep:flex ep:items-center ep:gap-2">
							<div
								class="ep:text-ui-smaller ep:text-obs-muted ep:flex-1"
								title={sourceTargetLabel}
							>
								{truncatedSourceTargetLabel}
							</div>
							{sourcePathForCopy && (
								<IconToolButton
									icon="copy"
									label="Copy source path"
									onClick={() => void copyPathToClipboard(sourcePathForCopy)}
								/>
							)}
						</div>
					</div>

					<div class="true-recall-io-side-section">
						<div class="ep:flex ep:items-center ep:justify-between ep:gap-2">
							<div class="ep:text-ui-small ep:font-medium">Image</div>
							{imagePath && (
								<Clickable
									class="true-recall-io-inline-link"
									onClick={() => setIsImagePanelExpanded((v) => !v)}
									disabled={hasRegions}
									title={hasRegions ? "Remove all regions before replacing image" : undefined}
								>
									{isImagePanelExpanded ? "Collapse" : "Replace image"}
								</Clickable>
							)}
						</div>
						<div
							class="ep:flex ep:items-center ep:gap-2"
							title={imagePath || "No image selected"}
						>
							<div class="ep:text-ui-smaller ep:text-obs-muted ep:flex-1">
								{truncatedImagePath}
							</div>
							{imagePath && (
								<IconToolButton
									icon="copy"
									label="Copy image path"
									onClick={() => void copyPathToClipboard(imagePath)}
								/>
							)}
						</div>
						{(!imagePath || (isImagePanelExpanded && !hasRegions)) && (
							<>
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
								<Clickable
									class="ep:px-3 ep:py-1.5 ep:text-ui-small ep:border ep:border-obs-border ep:rounded ep:text-obs-muted ep:hover:bg-obs-hover ep:hover:text-obs-normal ep:transition-colors ep:text-center ep:justify-center"
									onClick={() => applySelectedVaultImage()}
								>
									Use selected image
								</Clickable>
								<PasteDropZone
									onFileDrop={(file) => void persistBlob(file)}
									label="Paste or drag image"
									hint="Ctrl/Cmd+V or drag & drop"
								/>
							</>
						)}
					</div>

						<div class="true-recall-io-side-section">
							<div class="ep:text-ui-small ep:font-medium ep:mb-1">Tools</div>
							<div class="true-recall-io-tool-row">
								{hasRegions && (
									<IconToolButton
										icon="mouse-pointer-2"
										label="Select"
										shortcut="V"
										active={tool === "select"}
										onClick={() => setTool("select")}
									/>
								)}
								<IconToolButton
									icon="square"
									label="Rectangle"
									shortcut="R"
									active={tool === "rect"}
									onClick={() => {
										setLastNonSelectTool("rect");
										setTool("rect");
									}}
								/>
								<IconToolButton
									icon="circle"
									label="Ellipse"
									shortcut="E"
									active={tool === "ellipse"}
									onClick={() => {
										setLastNonSelectTool("ellipse");
										setTool("ellipse");
									}}
								/>
								<IconToolButton
									icon="sparkles"
									label="AI detect regions"
									active={aiPromptVisible}
									disabled={!imagePath || aiLoading || !hasAIKey}
									onClick={() => setAiPromptVisible((v) => !v)}
								/>
							{selectedRegionId && (
								<IconToolButton
									icon="trash-2"
									label="Delete selected region"
									shortcut="Delete"
									danger
									onClick={deleteSelected}
								/>
							)}
						</div>
						<div class="true-recall-io-hint-text">
							Shortcuts: Delete to remove, Space + drag to pan, Ctrl/Cmd+V to paste.
						</div>
						{aiPromptVisible && !aiLoading && (
							<div class="ep:flex ep:flex-col ep:gap-1.5 ep:mt-1">
								<input
									type="text"
									class="ep:w-full ep:px-2 ep:py-1.5 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded"
									placeholder="Optional hint, e.g. 'label the bones'"
									maxLength={50}
									value={aiCustomHint}
									onInput={(e) => setAiCustomHint((e.target as HTMLInputElement).value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											void handleAIDetect(aiCustomHint);
										} else if (e.key === "Escape") {
											setAiPromptVisible(false);
										}
									}}
								/>
								<div class="ep:flex ep:gap-2">
									<Clickable
										class="ep:px-3 ep:py-1 ep:text-ui-smaller ep:rounded ep:bg-obs-accent/10 ep:text-obs-accent ep:border ep:border-obs-accent ep:transition-colors"
										onClick={() => void handleAIDetect(aiCustomHint)}
									>
										Detect
									</Clickable>
									<Clickable
										class="ep:px-3 ep:py-1 ep:text-ui-smaller ep:text-obs-muted ep:hover:text-obs-normal ep:transition-colors"
										onClick={() => setAiPromptVisible(false)}
									>
										Cancel
									</Clickable>
								</div>
							</div>
						)}
						{aiLoading && (
							<div class="true-recall-io-hint-text ep:flex ep:items-center ep:gap-2">
								<svg viewBox="0 0 24 24" width="14" height="14" class="ep:text-obs-muted">
									<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4 31.4" stroke-linecap="round">
										<animateTransform attributeName="transform" type="rotate" dur="1s" from="0 12 12" to="360 12 12" repeatCount="indefinite" />
									</circle>
								</svg>
								Detecting regions…
							</div>
						)}
					</div>

					<div class="true-recall-io-side-section">
						<div class="ep:text-ui-small ep:font-medium ep:mb-1">Mask mode</div>
						<div class="ep:flex ep:gap-2">
							<Clickable
								class={cn(
									"ep:px-3 ep:py-1.5 ep:text-ui-small ep:rounded ep:border ep:border-obs-border ep:transition-colors",
									definition.maskMode === "solo"
										? "ep:bg-obs-accent/10 ep:text-obs-accent ep:border-obs-accent"
										: "ep:text-obs-muted ep:hover:bg-obs-hover",
								)}
								onClick={() =>
									setDefinition((prev) => ({ ...prev, maskMode: "solo" }))
								}
							>
								Solo
							</Clickable>
							<Clickable
								class={cn(
									"ep:px-3 ep:py-1.5 ep:text-ui-small ep:rounded ep:border ep:border-obs-border ep:transition-colors",
									definition.maskMode === "all"
										? "ep:bg-obs-accent/10 ep:text-obs-accent ep:border-obs-accent"
										: "ep:text-obs-muted ep:hover:bg-obs-hover",
								)}
								onClick={() =>
									setDefinition((prev) => ({ ...prev, maskMode: "all" }))
								}
							>
								All
							</Clickable>
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
								<RegionListItem
									key={region.id}
									region={region}
									selected={selectedRegionId === region.id}
									onSelect={() => setSelectedRegionId(region.id)}
									onDelete={deleteSelected}
								/>
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

			<div class="ep-modal-footer true-recall-io-footer ep:flex ep:justify-end ep:gap-2">
				<Clickable
					class="ep:px-3 ep:py-1.5 ep:text-ui-small ep:border ep:border-obs-border ep:rounded ep:text-obs-muted ep:hover:bg-obs-hover ep:hover:text-obs-normal ep:transition-colors"
					onClick={() => onDone({ cancelled: true })}
				>
					Cancel
				</Clickable>
				<Clickable
					class="mod-cta ep-btn"
					onClick={() => void handleSave()}
					disabled={saving}
				>
					{isEdit ? "Save changes" : "Create cards"}
				</Clickable>
			</div>
		</div>
	);
}
