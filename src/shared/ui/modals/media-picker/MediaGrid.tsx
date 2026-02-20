import type { App, TFile } from "obsidian";
import { isVideoExtension } from "@shared/types";
import type { ImageService } from "@features/integration/services/ImageService";

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

export interface MediaGridProps {
	app: App;
	imageService: ImageService;
	mediaFiles: TFile[];
	selectedFile: TFile | null;
	onSelect: (file: TFile) => void;
}

export function MediaGrid({
	app,
	imageService,
	mediaFiles,
	selectedFile,
	onSelect,
}: MediaGridProps) {
	return (
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
								onClick={() => onSelect(file)}
								onKeyDown={(e: KeyboardEvent) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										onSelect(file);
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
	);
}
