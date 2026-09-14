import { Notice, TFile } from "obsidian";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";

import { isImageExtension } from "@true-recall/core/types";
import { formatFileSize } from "@true-recall/core/utils/format.utils";

import { ImageService } from "@true-recall/obsidian/features/integration/services/ImageService";
import {
	useApp,
	usePlugin,
} from "@true-recall/obsidian/preact/ObsidianContext";

import { shouldImagePanelStartExpanded } from "../utils/ui-helpers";

interface UseIOEditorImageOptions {
	initialImagePath: string;
	hasRegions: boolean;
}

export function useIOEditorImage({
	initialImagePath,
	hasRegions,
}: UseIOEditorImageOptions) {
	const app = useApp();
	const plugin = usePlugin();
	const [path, setPath] = useState(initialImagePath);
	const [panelExpanded, setPanelExpanded] = useState(() =>
		shouldImagePanelStartExpanded(initialImagePath),
	);
	const [vaultImages, setVaultImages] = useState<TFile[]>([]);
	const [selectedVaultPath, setSelectedVaultPath] = useState("");
	const imageService = useMemo(
		() => new ImageService(app, () => plugin.settings),
		[app, plugin],
	);

	useEffect(() => {
		const files = app.vault
			.getFiles()
			.filter((file) => isImageExtension(file.extension))
			.sort((a, b) => b.stat.mtime - a.stat.mtime);
		setVaultImages(files);
		setSelectedVaultPath((current) => current || files[0]?.path || "");
	}, [app]);

	const url = useMemo(() => {
		if (!path) return null;
		const file = app.vault.getAbstractFileByPath(path);
		return file instanceof TFile ? app.vault.getResourcePath(file) : null;
	}, [app, path]);

	const selectImage = useCallback((imagePath: string) => {
		setPath(imagePath);
		setSelectedVaultPath(imagePath);
	}, []);

	const persistBlob = useCallback(
		async (blob: Blob) => {
			if (!blob.type.startsWith("image/")) {
				new Notice("Only image files are supported");
				return;
			}
			if (imageService.isBlobTooLarge(blob)) {
				new Notice(
					`Image too large (max 5MB, got ${formatFileSize(blob.size)})`,
				);
				return;
			}

			selectImage(await imageService.saveImageFromClipboard(blob));
			new Notice("Image saved to vault");
		},
		[imageService, selectImage],
	);

	useEffect(() => {
		const handlePaste = (event: ClipboardEvent) => {
			for (const item of Array.from(event.clipboardData?.items ?? [])) {
				if (!item.type.startsWith("image/")) continue;
				const file = item.getAsFile();
				if (!file) continue;

				event.preventDefault();
				void persistBlob(file);
				return;
			}
		};

		window.addEventListener("paste", handlePaste);
		return () => window.removeEventListener("paste", handlePaste);
	}, [persistBlob]);

	useEffect(() => {
		if (!path) setPanelExpanded(true);
		else if (hasRegions) setPanelExpanded(false);
	}, [hasRegions, path]);

	const applySelectedVaultImage = useCallback(() => {
		if (selectedVaultPath) selectImage(selectedVaultPath);
	}, [selectImage, selectedVaultPath]);
	const togglePanel = useCallback(() => {
		setPanelExpanded((current) => !current);
	}, []);

	return {
		path,
		url,
		panelExpanded,
		vaultImages,
		selectedVaultPath,
		setSelectedVaultPath,
		togglePanel,
		applySelectedVaultImage,
	};
}
