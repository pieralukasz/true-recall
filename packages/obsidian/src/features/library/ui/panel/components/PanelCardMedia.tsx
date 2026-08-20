import { TFile } from "obsidian";
import { memo } from "preact/compat";
import { useMemo } from "preact/hooks";

import type { FlashcardItem } from "@true-recall/core/types";
import type { FSRSFlashcardItem } from "@true-recall/core/types/fsrs/card.types";

import {
	getFirstPanelImageRef,
	isExternalPanelImageRef,
} from "@true-recall/obsidian/features/library/ui/panel/utils/panel-image.utils";
import { useApp } from "@true-recall/obsidian/preact";

interface PanelCardMediaProps {
	card: FlashcardItem;
	fsrsCard?: FSRSFlashcardItem;
	sourcePath: string;
}

export const PanelCardMedia = memo(function PanelCardMedia({
	card,
	fsrsCard,
	sourcePath,
}: PanelCardMediaProps) {
	const app = useApp();
	const imageRef =
		fsrsCard?.ioImagePath ??
		getFirstPanelImageRef(card.question, card.answer ?? "");
	const src = useMemo(() => {
		if (!imageRef) return null;
		if (isExternalPanelImageRef(imageRef)) return imageRef;
		const file = app.metadataCache.getFirstLinkpathDest(imageRef, sourcePath);
		return file instanceof TFile ? app.vault.getResourcePath(file) : null;
	}, [app, imageRef, sourcePath]);

	if (!src) return null;

	return (
		<img
			class="tr-panel-card-thumbnail"
			src={src}
			alt=""
			width={36}
			height={36}
			loading="lazy"
			draggable={false}
		/>
	);
});
