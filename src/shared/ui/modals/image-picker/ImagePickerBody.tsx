import { type App, Component, MarkdownRenderer, TFile } from "obsidian";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { notify } from "@shared/services/notification.service";
import type { ImageService } from "@features/integration/services/ImageService";
import type { ImagePickerResult } from "@shared/ui/modals/ImagePickerModal";
import { PasteDropZone } from "@shared/ui/components/PasteDropZone";
import { MediaWidthSlider } from "@shared/ui/components/MediaWidthSlider";
import { ModalFooter } from "@shared/ui/components/ModalFooter";
import { useClipboardPaste } from "@shared/ui/hooks/useClipboardPaste";
import { ImageGrid } from "@shared/ui/modals/image-picker/ImageGrid";

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

export interface ImagePickerBodyProps {
	app: App;
	imageService: ImageService;
	currentFilePath: string;
	onResolve: (result: ImagePickerResult) => void;
	onClose: () => void;
}

export function ImagePickerBody({
	app,
	imageService,
	currentFilePath,
	onResolve,
	onClose,
}: ImagePickerBodyProps) {
	const [selectedImage, setSelectedImage] = useState<TFile | null>(null);
	const [selectedWidth, setSelectedWidth] = useState(0);
	const [recentImages] = useState(() => imageService.getRecentImages(12));
	const previewRef = useRef<HTMLDivElement>(null);
	const renderComponentRef = useRef<Component | null>(null);

	useEffect(() => {
		renderComponentRef.current = new Component();
		renderComponentRef.current.load();
		return () => {
			renderComponentRef.current?.unload();
			renderComponentRef.current = null;
		};
	}, []);

	const updatePreview = useCallback(
		(file: TFile | null, width: number) => {
			if (!previewRef.current || !file || !renderComponentRef.current) return;
			const el = previewRef.current;
			el.empty();

			const markdown = imageService.buildImageMarkdown(
				file.path,
				width > 0 ? width : undefined,
			);

			const _codeEl = el.createEl("code", {
				text: markdown,
				cls: "ep:block ep:py-2 ep:px-3 ep:bg-obs-primary ep:rounded-lg ep:text-ui-smaller ep:mb-2",
			});

			const previewEl = el.createDiv({
				cls: "ep:max-h-[200px] ep:overflow-auto",
			});
			void MarkdownRenderer.render(
				app,
				markdown,
				previewEl,
				currentFilePath,
				renderComponentRef.current,
			);
		},
		[app, imageService, currentFilePath],
	);

	useEffect(() => {
		updatePreview(selectedImage, selectedWidth);
	}, [selectedImage, selectedWidth, updatePreview]);

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
					setSelectedImage(file);
					notify().imageSaved();
				}
			} catch (error) {
				console.error("[True Recall] Failed to save pasted image:", error);
				notify().operationFailed("save image", error);
			}
		},
		[app, imageService],
	);

	useClipboardPaste(handlePastedImage);

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
					setSelectedImage(savedFile);
					notify().imageSaved();
				}
			} catch (error) {
				console.error("[True Recall] Failed to save dropped image:", error);
				notify().operationFailed("save image", error);
			}
		},
		[app, imageService],
	);

	const handleInsert = () => {
		if (!selectedImage) return;
		const markdown = imageService.buildImageMarkdown(
			selectedImage.path,
			selectedWidth > 0 ? selectedWidth : undefined,
		);
		onResolve({ cancelled: false, markdown });
	};

	return (
		<div>
			<PasteDropZone
				onFileDrop={handleDroppedFile}
				accept="image/"
				icon={<PasteZoneIcon />}
				label="Paste image from clipboard"
				hint="Ctrl+V or drag & drop"
			/>

			<ImageGrid
				app={app}
				images={recentImages}
				selectedPath={selectedImage?.path ?? null}
				imageService={imageService}
				onSelect={setSelectedImage}
			/>

			<MediaWidthSlider value={selectedWidth} onChange={setSelectedWidth} />

			{/* Preview */}
			<div class="ep:flex ep:flex-col ep:gap-2">
				<h4 class="ep:text-ui-small ep:font-semibold ep:text-obs-muted ep:m-0">
					Preview
				</h4>
				<div
					ref={previewRef}
					class="ep:p-3 ep:bg-obs-secondary ep:rounded-md ep:min-h-[100px] ep:overflow-hidden"
				>
					{!selectedImage && (
						<div class="ep:text-obs-muted ep:italic ep:text-center ep:py-6">
							Select or paste an image
						</div>
					)}
				</div>
			</div>

			<ModalFooter
				onCancel={onClose}
				onConfirm={handleInsert}
				confirmLabel="Insert"
				confirmDisabled={!selectedImage}
			/>
		</div>
	);
}
