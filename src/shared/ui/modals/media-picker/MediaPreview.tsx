import type { ImageService } from "@features/integration/services/ImageService";
import { isVideoExtension } from "@shared/types";
import { type App, Component, MarkdownRenderer, type TFile } from "obsidian";
import { useCallback, useEffect, useRef } from "preact/hooks";

export interface MediaPreviewProps {
	app: App;
	imageService: ImageService;
	currentFilePath: string;
	selectedFile: TFile | null;
	selectedWidth: number;
}

export function MediaPreview({
	app,
	imageService,
	currentFilePath,
	selectedFile,
	selectedWidth,
}: MediaPreviewProps) {
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

	return (
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
	);
}
