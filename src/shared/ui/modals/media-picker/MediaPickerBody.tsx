import type { ImageService } from "@features/integration/services/ImageService";
import { notify } from "@shared/services/notification.service";
import { isVideoExtension } from "@shared/types";
import { MediaWidthSlider } from "@shared/ui/components/MediaWidthSlider";
import { ModalFooter } from "@shared/ui/components/ModalFooter";
import { PasteDropZone } from "@shared/ui/components/PasteDropZone";
import { useClipboardPaste } from "@shared/ui/hooks/useClipboardPaste";
import { MediaGrid } from "@shared/ui/modals/media-picker/MediaGrid";
import { MediaPreview } from "@shared/ui/modals/media-picker/MediaPreview";
import { type App, TFile } from "obsidian";
import { useCallback, useState } from "preact/hooks";

export interface MediaPickerResult {
	cancelled: boolean;
	markdown: string;
}

function PasteZoneIcon() {
	return (
		<svg
			aria-hidden="true"
			xmlns="http://www.w3.org/2000/svg"
			width="32"
			height="32"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
			<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
		</svg>
	);
}

export interface MediaPickerBodyProps {
	app: App;
	imageService: ImageService;
	currentFilePath: string;
	onResolve: (result: MediaPickerResult) => void;
	onClose: () => void;
}

export function MediaPickerBody({
	app,
	imageService,
	currentFilePath,
	onResolve,
	onClose,
}: MediaPickerBodyProps) {
	const [selectedFile, setSelectedFile] = useState<TFile | null>(null);
	const [selectedWidth, setSelectedWidth] = useState(500);
	const [mediaFiles, setMediaFiles] = useState(() =>
		imageService.getRecentMedia(12),
	);

	const handlePastedImage = useCallback(
		async (blob: Blob) => {
			if (imageService.isBlobTooLarge(blob)) {
				const size = imageService.formatFileSize(blob.size);
				notify().imageTooLarge(size);
				return;
			}
			try {
				notify().imageSaving();
				const path = await imageService.saveImageFromClipboard(blob);
				const file = app.vault.getAbstractFileByPath(path);
				if (file instanceof TFile) {
					setSelectedFile(file);
					setMediaFiles(imageService.getRecentMedia(12));
					notify().imageSaved();
				}
			} catch (error) {
				console.error("[True Recall] Failed to save pasted image:", error);
				notify().operationFailed("save image", error);
			}
		},
		[app, imageService],
	);

	useClipboardPaste((blob: Blob) => void handlePastedImage(blob));

	const handleDroppedFile = useCallback(
		async (file: File) => {
			if (file.size > 5 * 1024 * 1024) {
				const size = imageService.formatFileSize(file.size);
				notify().imageTooLarge(size);
				return;
			}
			try {
				notify().imageSaving();
				const arrayBuffer = await file.arrayBuffer();
				const blob = new Blob([arrayBuffer], { type: file.type });
				const path = await imageService.saveImageFromClipboard(blob);
				const savedFile = app.vault.getAbstractFileByPath(path);
				if (savedFile instanceof TFile) {
					setSelectedFile(savedFile);
					setMediaFiles(imageService.getRecentMedia(12));
					notify().imageSaved();
				}
			} catch (error) {
				console.error("[True Recall] Failed to save dropped image:", error);
				notify().operationFailed("save image", error);
			}
		},
		[app, imageService],
	);

	const handleFileDrop = useCallback(
		(file: File) => {
			if (file.type.startsWith("image/")) {
				void handleDroppedFile(file);
			} else {
				notify().warning("Please drop an image file");
			}
		},
		[handleDroppedFile],
	);

	const handleInsert = () => {
		if (!selectedFile) return;
		const isVideo = isVideoExtension(selectedFile.extension);
		const width = selectedWidth > 0 ? selectedWidth : undefined;

		let markdown: string;
		if (isVideo) {
			markdown = imageService.buildVideoHtml(selectedFile, width);
		} else {
			markdown = imageService.buildImageMarkdown(selectedFile.path, width);
		}
		onResolve({ cancelled: false, markdown });
	};

	return (
		<div>
			<PasteDropZone
				onFileDrop={handleFileDrop}
				accept="*"
				icon={<PasteZoneIcon />}
				label="Paste image from clipboard"
				hint="Ctrl+V or drag & drop"
			/>

			<MediaGrid
				app={app}
				imageService={imageService}
				mediaFiles={mediaFiles}
				selectedFile={selectedFile}
				onSelect={setSelectedFile}
			/>

			<div class="ep:p-3 ep:bg-obs-secondary ep:rounded-md">
				<MediaWidthSlider value={selectedWidth} onChange={setSelectedWidth} />
			</div>

			<MediaPreview
				app={app}
				imageService={imageService}
				currentFilePath={currentFilePath}
				selectedFile={selectedFile}
				selectedWidth={selectedWidth}
			/>

			<ModalFooter
				onCancel={onClose}
				onConfirm={handleInsert}
				confirmLabel="Insert"
				confirmDisabled={!selectedFile}
			/>
		</div>
	);
}
