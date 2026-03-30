import { __awaiter } from "tslib";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
import { deleteRegion } from "./canvas-interactions";
import { IOCanvas } from "./IOCanvas";
import { IconToolButton } from "./IOIconToolButton";
import { IORegionList } from "./IORegionList";
import { IOToolsPanel } from "./IOToolsPanel";
import { detectRegions } from "./io-ai.service";
import { createEmptyIODefinition, getNextIOGroupKey, parseIODefinition, } from "@true-recall/core/utils/io-definition";
import { shouldImagePanelStartExpanded, truncateMiddlePath, } from "./ui-helpers";
import { ImageService } from "../integration/services/ImageService";
import { isImageExtension } from "@true-recall/core/types";
import { Clickable } from "@true-recall/obsidian/components/Clickable";
import { NotePickerCombobox } from "@true-recall/obsidian/components/NotePickerCombobox";
import { useApp, usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { cn } from "@true-recall/ui/utils/cn";
import { isDesktop } from "../../utils/platform";
import { Notice, TFile } from "obsidian";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
function buildInitialDefinition(mode) {
    if (mode.mode === "edit") {
        const parsed = parseIODefinition(mode.note.fields.Regions);
        return parsed !== null && parsed !== void 0 ? parsed : createEmptyIODefinition("solo");
    }
    return createEmptyIODefinition("solo");
}
function buildInitialImagePath(mode) {
    var _a, _b;
    if (mode.mode === "edit") {
        return (_a = mode.note.fields.Image) !== null && _a !== void 0 ? _a : "";
    }
    return (_b = mode.imagePath) !== null && _b !== void 0 ? _b : "";
}
function buildInitialTool(mode) {
    const definition = buildInitialDefinition(mode);
    return definition.regions.length > 0 ? "select" : "rect";
}
export function IOEditorApp({ mode, onDone }) {
    const app = useApp();
    const plugin = usePlugin();
    const [imagePath, setImagePath] = useState(() => buildInitialImagePath(mode));
    const [definition, setDefinition] = useState(() => buildInitialDefinition(mode));
    const [tool, setTool] = useState(() => buildInitialTool(mode));
    const [lastNonSelectTool, setLastNonSelectTool] = useState("rect");
    const [selectedRegionId, setSelectedRegionId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const [vaultImages, setVaultImages] = useState([]);
    const [selectedVaultPath, setSelectedVaultPath] = useState("");
    const [selectedSourceNote, setSelectedSourceNote] = useState(null);
    const [isImagePanelExpanded, setIsImagePanelExpanded] = useState(() => shouldImagePanelStartExpanded(buildInitialImagePath(mode)));
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
        if (!imagePath)
            return null;
        const file = app.vault.getAbstractFileByPath(imagePath);
        if (!(file instanceof TFile))
            return null;
        return app.vault.getResourcePath(file);
    }, [app, imagePath]);
    const persistBlob = useCallback((blob) => __awaiter(this, void 0, void 0, function* () {
        if (!blob.type.startsWith("image/")) {
            new Notice("Only image files are supported");
            return;
        }
        if (imageService.isBlobTooLarge(blob)) {
            new Notice(`Image too large (max 5MB, got ${imageService.formatFileSize(blob.size)})`);
            return;
        }
        const path = yield imageService.saveImageFromClipboard(blob);
        setImagePath(path);
        setSelectedVaultPath(path);
        new Notice("Image saved to vault");
    }), [imageService]);
    const handlePaste = useCallback((event) => {
        var _a;
        const items = (_a = event.clipboardData) === null || _a === void 0 ? void 0 : _a.items;
        if (!(items === null || items === void 0 ? void 0 : items.length))
            return;
        for (const item of Array.from(items)) {
            if (!item.type.startsWith("image/"))
                continue;
            const file = item.getAsFile();
            if (!file)
                continue;
            event.preventDefault();
            void persistBlob(file);
            break;
        }
    }, [persistBlob]);
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
    const selectedRegion = useMemo(() => {
        var _a;
        return (_a = definition.regions.find((region) => region.id === selectedRegionId)) !== null && _a !== void 0 ? _a : null;
    }, [definition.regions, selectedRegionId]);
    const updateSelectedRegion = useCallback((patch) => {
        if (!selectedRegionId)
            return;
        setDefinition((prev) => (Object.assign(Object.assign({}, prev), { regions: prev.regions.map((region) => {
                if (region.id !== selectedRegionId)
                    return region;
                return Object.assign(Object.assign({}, region), patch);
            }) })));
    }, [selectedRegionId]);
    const deleteSelected = useCallback(() => {
        // Functional updater always reads the latest state — no stale closure risk
        setSelectedRegionId((currentId) => {
            if (!currentId)
                return null;
            setDefinition((prev) => deleteRegion(prev, currentId));
            return null;
        });
    }, []);
    useEffect(() => {
        const onKeyDown = (event) => {
            var _a;
            const tag = (_a = event.target) === null || _a === void 0 ? void 0 : _a.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT")
                return;
            if ((event.key === "Delete" || event.key === "Backspace") &&
                selectedRegionId) {
                event.preventDefault();
                deleteSelected();
                return;
            }
            switch (event.key.toLowerCase()) {
                case "v":
                    if (hasRegions)
                        setTool("select");
                    break;
                case "r":
                    setLastNonSelectTool("rect");
                    setTool("rect");
                    break;
                case "e":
                    setLastNonSelectTool("ellipse");
                    setTool("ellipse");
                    break;
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [selectedRegionId, deleteSelected, hasRegions]);
    const hasAIKey = Boolean(plugin.settings.proKey || plugin.settings.openRouterApiKey);
    const handleAIDetect = useCallback((hint) => __awaiter(this, void 0, void 0, function* () {
        if (!imagePath || aiLoading)
            return;
        setAiLoading(true);
        setAiPromptVisible(false);
        try {
            const newRegions = yield detectRegions(app, imagePath, plugin.settings, hint, plugin.settings.aiIODetectionPrompt);
            if (newRegions.length === 0) {
                new Notice("AI could not detect any regions in this image");
                return;
            }
            setDefinition((prev) => {
                let nextKey = Number(getNextIOGroupKey(prev));
                const regionsWithKeys = newRegions.map((region) => (Object.assign(Object.assign({}, region), { groupKey: String(nextKey++) })));
                return Object.assign(Object.assign({}, prev), { regions: [...prev.regions, ...regionsWithKeys] });
            });
            setTool("select");
            new Notice(`AI detected ${newRegions.length} region${newRegions.length !== 1 ? "s" : ""}`);
        }
        catch (error) {
            new Notice(error instanceof Error ? error.message : "AI detection failed");
        }
        finally {
            setAiLoading(false);
        }
    }), [app, imagePath, aiLoading, plugin.settings]);
    const applySelectedVaultImage = useCallback(() => {
        if (!selectedVaultPath)
            return;
        setImagePath(selectedVaultPath);
    }, [selectedVaultPath]);
    const linkedSourceNote = useMemo(() => {
        if (mode.mode !== "add")
            return undefined;
        if (!mode.sourceUid)
            return undefined;
        return plugin.flashcardManager
            .getSourceNoteService()
            .resolveSourceNote(mode.sourceUid);
    }, [mode, plugin.flashcardManager]);
    const sourceTargetLabel = useMemo(() => {
        if (mode.mode === "edit") {
            const sourceUid = mode.note.sourceUid;
            if (!sourceUid)
                return "Source: not linked";
            const source = plugin.flashcardManager
                .getSourceNoteService()
                .resolveSourceNote(sourceUid);
            if (source.notePath)
                return `Source: ${source.notePath}`;
            if (source.noteName)
                return `Source: ${source.noteName}`;
            return `Source UID: ${sourceUid}`;
        }
        if (showSourcePicker) {
            return selectedSourceNote
                ? `Source: ${selectedSourceNote.path}`
                : "Source: select note before saving";
        }
        if (linkedSourceNote === null || linkedSourceNote === void 0 ? void 0 : linkedSourceNote.notePath) {
            return `Source: ${linkedSourceNote.notePath}`;
        }
        if (linkedSourceNote === null || linkedSourceNote === void 0 ? void 0 : linkedSourceNote.noteName) {
            return `Source: ${linkedSourceNote.noteName}`;
        }
        return "Source: linked note";
    }, [
        linkedSourceNote,
        mode,
        plugin.flashcardManager,
        selectedSourceNote,
        showSourcePicker,
    ]);
    const truncatedSourceTargetLabel = useMemo(() => truncateMiddlePath(sourceTargetLabel), [sourceTargetLabel]);
    const truncatedImagePath = useMemo(() => truncateMiddlePath(imagePath || "No image selected"), [imagePath]);
    const sourcePathForCopy = useMemo(() => {
        var _a, _b, _c;
        if (mode.mode === "edit") {
            const sourceUid = mode.note.sourceUid;
            if (!sourceUid)
                return "";
            const source = plugin.flashcardManager
                .getSourceNoteService()
                .resolveSourceNote(sourceUid);
            return (_a = source.notePath) !== null && _a !== void 0 ? _a : "";
        }
        if (showSourcePicker) {
            return (_b = selectedSourceNote === null || selectedSourceNote === void 0 ? void 0 : selectedSourceNote.path) !== null && _b !== void 0 ? _b : "";
        }
        return (_c = linkedSourceNote === null || linkedSourceNote === void 0 ? void 0 : linkedSourceNote.notePath) !== null && _c !== void 0 ? _c : "";
    }, [
        linkedSourceNote,
        mode,
        plugin.flashcardManager,
        selectedSourceNote,
        showSourcePicker,
    ]);
    const resolveSourceUid = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        if (mode.mode === "edit")
            return mode.note.sourceUid;
        if (mode.sourceUid)
            return mode.sourceUid;
        if (!selectedSourceNote)
            return undefined;
        const fmService = plugin.flashcardManager.getFrontmatterService();
        let uid = yield fmService.getSourceNoteUid(selectedSourceNote.path);
        if (!uid) {
            uid = fmService.generateUid();
            yield fmService.setSourceNoteUid(selectedSourceNote.path, uid);
        }
        return uid;
    }), [mode, plugin.flashcardManager, selectedSourceNote]);
    const copyPathToClipboard = useCallback((value) => __awaiter(this, void 0, void 0, function* () {
        if (!value)
            return;
        try {
            yield navigator.clipboard.writeText(value);
            new Notice("Path copied to clipboard");
        }
        catch (_a) {
            new Notice("Failed to copy path");
        }
    }), []);
    const handleSave = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (saving)
            return;
        if (!imagePath) {
            new Notice("Select an image first");
            return;
        }
        if (definition.regions.length === 0) {
            new Notice("Add at least one occlusion region");
            return;
        }
        if (!((_a = plugin.flashcardManager) === null || _a === void 0 ? void 0 : _a.hasStore())) {
            new Notice("Database not initialized");
            return;
        }
        setSaving(true);
        try {
            if (isEdit) {
                const result = plugin.flashcardManager.updateImageOcclusionNote(mode.noteId, {
                    imagePath,
                    definition,
                });
                new Notice(`Updated ${result.updatedCardIds.length} image occlusion card${result.updatedCardIds.length !== 1 ? "s" : ""}`);
                onDone({
                    cancelled: false,
                    imagePath,
                    definition,
                    updatedCardIds: result.updatedCardIds,
                });
                return;
            }
            const sourceUid = yield resolveSourceUid();
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
            new Notice(`Created ${result.cards.length} image occlusion card${result.cards.length !== 1 ? "s" : ""}`);
            onDone({
                cancelled: false,
                imagePath,
                definition,
                createdNote: result.note,
                createdCards: result.cards,
            });
        }
        catch (error) {
            new Notice(error instanceof Error
                ? error.message
                : "Failed to save image occlusion");
            setSaving(false);
        }
    }), [
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
        return (_jsx("div", { class: "ep:text-obs-muted ep:py-6", children: "Image occlusion editor is available on desktop only." }));
    }
    return (_jsxs("div", { class: "true-recall-io-editor-modal ep:flex ep:flex-col ep:gap-3", children: [_jsxs("div", { class: "true-recall-io-editor-layout", children: [_jsx("div", { class: "true-recall-io-editor-left", children: _jsx(IOCanvas, { imageUrl: imageUrl, definition: definition, tool: tool, onToolChange: setTool, selectedRegionId: selectedRegionId, zoom: zoom, panX: panX, panY: panY, onDefinitionChange: setDefinition, onSelectRegion: setSelectedRegionId, onZoomChange: setZoom, onPanChange: (x, y) => {
                                setPanX(x);
                                setPanY(y);
                            } }) }), _jsxs("div", { class: "true-recall-io-editor-right", children: [_jsxs("div", { class: "true-recall-io-side-section", children: [_jsx("div", { class: "ep:text-ui-small ep:font-medium ep:mb-1", children: "Source" }), showSourcePicker && (_jsxs("div", { class: "ep:flex ep:items-center ep:gap-2", children: [_jsx("div", { class: "ep:flex-1", children: _jsx(NotePickerCombobox, { app: app, selectedNote: selectedSourceNote, onSelect: setSelectedSourceNote }) }), selectedSourceNote && (_jsx(Clickable, { class: "ep:text-ui-smaller ep:text-obs-muted ep:hover:text-obs-normal", onClick: () => setSelectedSourceNote(null), children: "Clear" }))] })), _jsxs("div", { class: "ep:flex ep:items-center ep:gap-2", children: [_jsx("div", { class: "ep:text-ui-smaller ep:text-obs-muted ep:flex-1", title: sourceTargetLabel, children: truncatedSourceTargetLabel }), sourcePathForCopy && (_jsx(IconToolButton, { icon: "copy", label: "Copy source path", onClick: () => void copyPathToClipboard(sourcePathForCopy) }))] })] }), _jsxs("div", { class: "true-recall-io-side-section", children: [_jsxs("div", { class: "ep:flex ep:items-center ep:justify-between ep:gap-2", children: [_jsx("div", { class: "ep:text-ui-small ep:font-medium", children: "Image" }), imagePath && (_jsx(Clickable, { class: "true-recall-io-inline-link", onClick: () => setIsImagePanelExpanded((v) => !v), disabled: hasRegions, title: hasRegions
                                                    ? "Remove all regions before replacing image"
                                                    : undefined, children: isImagePanelExpanded ? "Collapse" : "Replace image" }))] }), _jsxs("div", { class: "ep:flex ep:items-center ep:gap-2", title: imagePath || "No image selected", children: [_jsx("div", { class: "ep:text-ui-smaller ep:text-obs-muted ep:flex-1", children: truncatedImagePath }), imagePath && (_jsx(IconToolButton, { icon: "copy", label: "Copy image path", onClick: () => void copyPathToClipboard(imagePath) }))] }), (!imagePath || (isImagePanelExpanded && !hasRegions)) && (_jsxs(_Fragment, { children: [_jsxs("select", { class: "ep:w-full ep:px-2 ep:py-1.5 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded", value: selectedVaultPath, onChange: (event) => setSelectedVaultPath(event.target.value), children: [_jsx("option", { value: "", children: "Select image from vault\u2026" }), vaultImages.map((file) => (_jsx("option", { value: file.path, children: file.path }, file.path)))] }), _jsx(Clickable, { class: "ep:px-3 ep:py-1.5 ep:text-ui-small ep:border ep:border-obs-border ep:rounded ep:text-obs-muted ep:hover:bg-obs-hover ep:hover:text-obs-normal ep:transition-colors ep:text-center ep:justify-center", onClick: () => applySelectedVaultImage(), children: "Use selected image" })] }))] }), _jsx(IOToolsPanel, { tool: tool, hasRegions: hasRegions, selectedRegionId: selectedRegionId, aiPromptVisible: aiPromptVisible, aiLoading: aiLoading, aiCustomHint: aiCustomHint, hasAIKey: hasAIKey, hasImage: !!imagePath, onToolChange: setTool, onSetLastNonSelectTool: setLastNonSelectTool, onDeleteSelected: deleteSelected, onToggleAiPrompt: () => setAiPromptVisible((v) => !v), onAiCustomHintChange: setAiCustomHint, onAiDetect: (hint) => void handleAIDetect(hint) }), _jsxs("div", { class: "true-recall-io-side-section", children: [_jsx("div", { class: "ep:text-ui-small ep:font-medium ep:mb-1", children: "Mask mode" }), _jsxs("div", { class: "ep:flex ep:gap-2", children: [_jsx(Clickable, { class: cn("ep:px-3 ep:py-1.5 ep:text-ui-small ep:rounded ep:border ep:border-obs-border ep:transition-colors", definition.maskMode === "solo"
                                                    ? "ep:bg-obs-accent/10 ep:text-obs-accent ep:border-obs-accent"
                                                    : "ep:text-obs-muted ep:hover:bg-obs-hover"), onClick: () => setDefinition((prev) => (Object.assign(Object.assign({}, prev), { maskMode: "solo" }))), children: "Solo" }), _jsx(Clickable, { class: cn("ep:px-3 ep:py-1.5 ep:text-ui-small ep:rounded ep:border ep:border-obs-border ep:transition-colors", definition.maskMode === "all"
                                                    ? "ep:bg-obs-accent/10 ep:text-obs-accent ep:border-obs-accent"
                                                    : "ep:text-obs-muted ep:hover:bg-obs-hover"), onClick: () => setDefinition((prev) => (Object.assign(Object.assign({}, prev), { maskMode: "all" }))), children: "All" })] })] }), _jsx(IORegionList, { regions: definition.regions, selectedRegionId: selectedRegionId, onSelectRegion: setSelectedRegionId, onDeleteSelected: deleteSelected }), selectedRegion && (_jsxs("div", { class: "true-recall-io-side-section ep:flex ep:flex-col ep:gap-2", children: [_jsx("div", { class: "ep:text-ui-small ep:font-medium", children: "Selected region" }), _jsxs("label", { class: "true-recall-io-field", children: ["X", _jsx("input", { type: "number", min: 0, max: 1, step: 0.01, value: selectedRegion.x, onInput: (event) => updateSelectedRegion({
                                                    x: Number(event.target.value),
                                                }) })] }), _jsxs("label", { class: "true-recall-io-field", children: ["Y", _jsx("input", { type: "number", min: 0, max: 1, step: 0.01, value: selectedRegion.y, onInput: (event) => updateSelectedRegion({
                                                    y: Number(event.target.value),
                                                }) })] }), _jsxs("label", { class: "true-recall-io-field", children: ["W", _jsx("input", { type: "number", min: 0.01, max: 1, step: 0.01, value: selectedRegion.w, onInput: (event) => updateSelectedRegion({
                                                    w: Number(event.target.value),
                                                }) })] }), _jsxs("label", { class: "true-recall-io-field", children: ["H", _jsx("input", { type: "number", min: 0.01, max: 1, step: 0.01, value: selectedRegion.h, onInput: (event) => updateSelectedRegion({
                                                    h: Number(event.target.value),
                                                }) })] })] }))] })] }), _jsxs("div", { class: "ep-modal-footer true-recall-io-footer ep:flex ep:justify-end ep:gap-2", children: [_jsx(Clickable, { class: "ep:px-3 ep:py-1.5 ep:text-ui-small ep:border ep:border-obs-border ep:rounded ep:text-obs-muted ep:hover:bg-obs-hover ep:hover:text-obs-normal ep:transition-colors", onClick: () => onDone({ cancelled: true }), children: "Cancel" }), _jsx(Clickable, { class: "mod-cta ep-btn", onClick: () => void handleSave(), disabled: saving, children: isEdit ? "Save changes" : "Create cards" })] })] }));
}
