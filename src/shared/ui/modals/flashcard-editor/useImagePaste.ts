import { useCallback } from "preact/hooks";
import { notify } from "@shared/services/notification.service";
import { ImageService } from "@features/integration/services/ImageService";
import { insertAtTextareaCursor } from "@features/library/ui/editor/edit-toolbar.utils";

export function useImagePaste(
	imageService: ImageService,
	setQuestionValue: (v: string) => void,
	setAnswerValue: (v: string) => void,
) {
	return useCallback(
		async (e: ClipboardEvent, textarea: HTMLTextAreaElement) => {
			const items = e.clipboardData?.items;
			if (!items) return;

			for (let i = 0; i < items.length; i++) {
				const item = items[i];
				if (item?.type.startsWith("image/")) {
					e.preventDefault();
					const blob = item.getAsFile();
					if (!blob) return;

					if (imageService.isBlobTooLarge(blob)) {
						const size = imageService.formatFileSize(blob.size);
						notify().imageTooLarge(size);
						return;
					}

					try {
						notify().imageSaving();
						const path = await imageService.saveImageFromClipboard(blob);
						const markdown = imageService.buildImageMarkdown(path);
						insertAtTextareaCursor(textarea, markdown);
						textarea.focus();

						const field = textarea.getAttribute("data-field");
						if (field === "question") setQuestionValue(textarea.value);
						else if (field === "answer") setAnswerValue(textarea.value);

						notify().success("Image inserted");
					} catch (error) {
						console.error("[True Recall] Failed to save pasted image:", error);
						notify().operationFailed("save image", error);
					}
					return;
				}
			}
		},
		[imageService, setQuestionValue, setAnswerValue],
	);
}
