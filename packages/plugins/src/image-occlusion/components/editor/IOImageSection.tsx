import { Clickable } from "@true-recall/obsidian/components";

import type { IOEditorController } from "../../hooks/useIOEditorController";
import { IconToolButton } from "../IOIconToolButton";

interface IOImageSectionProps {
	image: IOEditorController["image"];
}

export function IOImageSection({ image }: IOImageSectionProps) {
	const showPicker = !image.path || (image.panelExpanded && !image.hasRegions);

	return (
		<section class="true-recall-io-side-section">
			<div class="ep:flex ep:items-center ep:justify-between ep:gap-2">
				<h3 class="ep:text-ui-small ep:font-medium">Image</h3>
				{image.path ? (
					<Clickable
						class="true-recall-io-inline-link"
						onClick={image.onTogglePanel}
						disabled={image.hasRegions}
						title={
							image.hasRegions
								? "Remove all regions before replacing image"
								: undefined
						}
					>
						{image.panelExpanded ? "Collapse" : "Replace image"}
					</Clickable>
				) : null}
			</div>

			<div
				class="ep:flex ep:items-center ep:gap-2"
				title={image.path || "No image selected"}
			>
				<div class="ep:text-ui-smaller ep:text-obs-muted ep:flex-1">
					{image.shortPath}
				</div>
				{image.path ? (
					<IconToolButton
						icon="copy"
						label="Copy image path"
						onClick={() => void image.onCopyPath(image.path)}
					/>
				) : null}
			</div>

			{showPicker ? (
				<>
					<select
						class="ep:w-full ep:px-2 ep:py-1.5 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded"
						value={image.selectedVaultPath}
						onChange={(event) =>
							image.onSelectedVaultPathChange(event.currentTarget.value)
						}
					>
						<option value="">Select image from vault…</option>
						{image.vaultImages.map((file) => (
							<option key={file.path} value={file.path}>
								{file.path}
							</option>
						))}
					</select>
					<Clickable
						class="ep:px-3 ep:py-1.5 ep:text-ui-small ep:border ep:border-obs-border ep:rounded ep:text-obs-muted ep:hover:bg-obs-hover ep:hover:text-obs-normal ep:transition-colors ep:text-center ep:justify-center"
						onClick={image.onApplySelected}
						disabled={!image.selectedVaultPath}
					>
						Use selected image
					</Clickable>
				</>
			) : null}
		</section>
	);
}
