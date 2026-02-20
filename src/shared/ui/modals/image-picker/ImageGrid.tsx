import type { App, TFile } from "obsidian";
import type { ImageService } from "@features/integration/services/ImageService";

interface ImageGridProps {
	app: App;
	images: TFile[];
	selectedPath: string | null;
	imageService: ImageService;
	onSelect: (file: TFile) => void;
}

export function ImageGrid({
	app,
	images,
	selectedPath,
	imageService,
	onSelect,
}: ImageGridProps) {
	return (
		<div class="ep:flex ep:flex-col ep:gap-2">
			<h4 class="ep:text-ui-small ep:font-semibold ep:text-obs-muted ep:m-0">
				Recent images
			</h4>
			<div class="ep:grid ep:grid-cols-4 ep:gap-2 ep:max-h-[180px] ep:overflow-y-auto">
				{images.length === 0 ? (
					<div class="ep:text-center ep:text-obs-muted ep:py-6 ep:italic">
						No images in vault
					</div>
				) : (
					images.map((file) => (
						<div
							key={file.path}
							class={`ep:relative ep:aspect-square ep:rounded-md ep:overflow-hidden ep:cursor-pointer ep:border-2 ep:transition-all ep:hover:border-obs-interactive ep:hover:scale-[1.02] ${selectedPath === file.path ? "ep:border-obs-interactive ep:ring-2 ep:ring-obs-interactive/30" : "ep:border-transparent"}`}
							title={file.name}
							role="option"
							tabIndex={0}
							aria-selected={selectedPath === file.path}
							onClick={() => onSelect(file)}
							onKeyDown={(e: KeyboardEvent) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									onSelect(file);
								}
							}}
						>
							<img
								class="ep:w-full ep:h-full ep:object-cover"
								src={app.vault.getResourcePath(file)}
								alt={file.basename}
							/>
							{imageService.isFileTooLarge(file) && (
								<div class="ep:absolute ep:top-1 ep:right-1 ep:py-1 ep:px-2 ep:bg-obs-red ep:text-obs-on-accent ep:text-ui-smaller ep:rounded">
									Large
								</div>
							)}
						</div>
					))
				)}
			</div>
		</div>
	);
}
