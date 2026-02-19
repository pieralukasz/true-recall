import { type App, Component, MarkdownRenderer, TFile } from "obsidian";
import { render } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { notify } from "../../services";
import { ImageService } from "../../services/image";
import { isVideoExtension } from "../../types";
import { BasePromiseModal } from "./BasePromiseModal";

export interface MediaPickerResult {
	cancelled: boolean;
	markdown: string;
}

interface MediaPickerModalOptions {
	currentFilePath: string;
}

interface MediaPickerBodyProps {
	app: App;
	imageService: ImageService;
	currentFilePath: string;
	onResolve: (result: MediaPickerResult) => void;
	onClose: () => void;
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

function VideoIcon() {
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
			<polygon points="5 3 19 12 5 21 5 3" />
		</svg>
	);
}

function MediaPickerBody({
	app,
	imageService,
	currentFilePath,
	onResolve,
	onClose,
}: MediaPickerBodyProps) {
	const [selectedFile, setSelectedFile] = useState<TFile | null>(null);
	const [selectedWidth, setSelectedWidth] = useState(500);
	const [dragActive, setDragActive] = useState(false);
	const [mediaFiles, setMediaFiles] = useState(() =>
		imageService.getRecentMedia(12),
	);
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

			const isVideo = isVideoExtension(file.extension);
			const w = width > 0 ? width : undefined;

			let markdown: string;
			if (isVideo) {
				markdown = imageService.buildVideoHtml(file, w);
			} else {
				markdown = imageService.buildImageMarkdown(file.path, w);
			}

			el.createEl("code", {
				text: markdown,
				cls: "ep:block ep:py-2 ep:px-3 ep:bg-obs-primary ep:rounded-lg ep:text-ui-smaller ep:mb-2",
			});

			const previewEl = el.createDiv({
				cls: "ep:max-h-[200px] ep:overflow-auto",
			});

			if (isVideo) {
				const video = previewEl.createEl("video", {
					attr: {
						src: app.vault.getResourcePath(file),
						controls: "true",
						...(w ? { width: String(w) } : {}),
					},
				});
				video.muted = true;
			} else {
				void MarkdownRenderer.render(
					app,
					markdown,
					previewEl,
					currentFilePath,
					renderComponentRef.current,
				);
			}
		},
		[app, imageService, currentFilePath],
	);

	useEffect(() => {
		updatePreview(selectedFile, selectedWidth);
	}, [selectedFile, selectedWidth, updatePreview]);

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

	// Global paste handler
	useEffect(() => {
		const handler = (e: ClipboardEvent) => {
			const items = e.clipboardData?.items;
			if (!items) return;
			for (let i = 0; i < items.length; i++) {
				const item = items[i];
				if (item?.type.startsWith("image/")) {
					e.preventDefault();
					const blob = item.getAsFile();
					if (blob) void handlePastedImage(blob);
					return;
				}
			}
		};
		document.addEventListener("paste", handler);
		return () => document.removeEventListener("paste", handler);
	}, [handlePastedImage]);

	const handleDroppedFile = async (file: File) => {
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
	};

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
			{/* Paste zone */}
			<button
				type="button"
				class={`ep:flex ep:flex-col ep:items-center ep:justify-center ep:p-6 ep:mb-4 ep:border-2 ep:border-dashed ep:rounded-lg ep:cursor-pointer ep:transition-all ep:hover:border-obs-interactive ep:bg-transparent ep:font-inherit ep:w-full ${dragActive ? "true-recall-paste-zone-active" : "ep:border-obs-border"}`}
				onDragOver={(e) => {
					e.preventDefault();
					setDragActive(true);
				}}
				onDragLeave={() => setDragActive(false)}
				onDrop={(e) => {
					e.preventDefault();
					setDragActive(false);
					const files = e.dataTransfer?.files;
					if (files && files.length > 0) {
						const file = files[0];
						if (file?.type.startsWith("image/")) {
							void handleDroppedFile(file);
						} else {
							notify().warning("Please drop an image file");
						}
					}
				}}
			>
				<div class="ep:text-obs-muted">
					<PasteZoneIcon />
				</div>
				<div class="ep:text-ui-small ep:font-medium ep:text-obs-normal">
					Paste image from clipboard
				</div>
				<div class="ep:text-ui-smaller ep:text-obs-muted">
					Ctrl+V or drag & drop
				</div>
			</button>

			{/* Media grid */}
			<div class="ep:flex ep:flex-col ep:gap-2">
				<h4 class="ep:text-ui-small ep:font-semibold ep:text-obs-muted ep:m-0">
					Recent media
				</h4>
				<div class="ep:grid ep:grid-cols-4 ep:gap-2 ep:max-h-[180px] ep:overflow-y-auto">
					{mediaFiles.length === 0 ? (
						<div class="ep:text-center ep:text-obs-muted ep:py-6 ep:italic">
							No media in vault
						</div>
					) : (
						mediaFiles.map((file) => {
							const isVideo = isVideoExtension(file.extension);
							const isSelected = selectedFile?.path === file.path;
							const isTooLarge = isVideo
								? imageService.isVideoTooLarge(file)
								: imageService.isFileTooLarge(file);

							return (
								<div
									key={file.path}
									class={`media-item ep:relative ep:aspect-square ep:rounded-md ep:overflow-hidden ep:cursor-pointer ep:border-2 ep:transition-all ep:hover:border-obs-interactive ep:hover:scale-[1.02] ${isVideo ? "ep:flex ep:flex-col" : ""} ${isSelected ? "ep:border-obs-interactive ep:ring-2 ep:ring-obs-interactive/30" : "ep:border-transparent"}`}
									title={file.name}
									role="option"
									tabIndex={0}
									aria-selected={isSelected}
									onClick={() => setSelectedFile(file)}
									onKeyDown={(e: KeyboardEvent) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											setSelectedFile(file);
										}
									}}
								>
									{isVideo ? (
										<>
											<div class="ep:flex ep:items-center ep:justify-center ep:w-full ep:h-[60%] ep:text-obs-muted">
												<VideoIcon />
											</div>
											<div class="ep:text-ui-smaller ep:text-obs-normal ep:text-center ep:p-1 ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap">
												{file.name}
											</div>
										</>
									) : (
										<img
											class="ep:w-full ep:h-full ep:object-cover"
											src={app.vault.getResourcePath(file)}
											alt={file.basename}
										/>
									)}
									{isTooLarge && (
										<div class="ep:absolute ep:top-1 ep:right-1 ep:py-1 ep:px-2 ep:bg-obs-red ep:text-obs-on-accent ep:text-ui-smaller ep:rounded">
											Large
										</div>
									)}
								</div>
							);
						})
					)}
				</div>
			</div>

			{/* Size control */}
			<div class="ep:flex ep:items-center ep:gap-3 ep:p-3 ep:bg-obs-secondary ep:rounded-md">
				<label
					htmlFor="media-width"
					class="ep:text-ui-small ep:font-medium ep:text-obs-normal"
				>
					Width:
				</label>
				<input
					id="media-width"
					class="ep:flex-1 ep:h-1 ep:accent-obs-interactive"
					type="range"
					min="0"
					max="800"
					step="50"
					value={selectedWidth}
					onInput={(e) =>
						setSelectedWidth(parseInt((e.target as HTMLInputElement).value, 10))
					}
				/>
				<span class="ep:text-ui-small ep:font-medium ep:text-obs-interactive ep:min-w-[50px] ep:text-right">
					{selectedWidth === 0 ? "Auto" : `${selectedWidth}px`}
				</span>
			</div>

			{/* Preview */}
			<div class="ep:flex ep:flex-col ep:gap-2">
				<h4 class="ep:text-ui-small ep:font-semibold ep:text-obs-muted ep:m-0">
					Preview
				</h4>
				<div
					ref={previewRef}
					class="ep:p-3 ep:bg-obs-secondary ep:rounded-md ep:min-h-[100px] ep:overflow-hidden"
				>
					{!selectedFile && (
						<div class="ep:text-obs-muted ep:italic ep:text-center ep:py-6">
							Select or paste media
						</div>
					)}
				</div>
			</div>

			{/* Buttons */}
			<div class="ep:flex ep:justify-end ep:gap-2 ep:pt-2 ep:border-t ep:border-obs-border">
				<button
					type="button"
					class="ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:hover:bg-obs-modifier-hover"
					onClick={onClose}
				>
					Cancel
				</button>
				<button
					type="button"
					class="mod-cta ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all"
					disabled={!selectedFile}
					onClick={handleInsert}
				>
					Insert
				</button>
			</div>
		</div>
	);
}

export class MediaPickerModal extends BasePromiseModal<MediaPickerResult> {
	private options: MediaPickerModalOptions;
	private imageService: ImageService;
	private unmountBody?: () => void;

	constructor(app: App, options: MediaPickerModalOptions) {
		super(app, {
			title: "Insert Media",
			width: "550px",
		});
		this.options = options;
		this.imageService = new ImageService(app);
	}

	protected getDefaultResult(): MediaPickerResult {
		return { cancelled: true, markdown: "" };
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("true-recall-media-picker-modal");
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<MediaPickerBody
				app={this.app}
				imageService={this.imageService}
				currentFilePath={this.options.currentFilePath}
				onResolve={(result) => this.resolve(result)}
				onClose={() => this.close()}
			/>,
			container,
		);
		this.unmountBody = () => render(null, container);
	}

	onClose(): void {
		this.unmountBody?.();
		super.onClose();
	}
}
