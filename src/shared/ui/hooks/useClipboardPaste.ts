import { useCallback, useEffect } from "preact/hooks";

/**
 * Listens for clipboard paste events and extracts image blobs.
 * Replaces the duplicated `document.addEventListener("paste", ...)` pattern
 * in ImagePickerModal and MediaPickerModal.
 */
export function useClipboardPaste(
	onBlob: (blob: Blob) => void,
	mimePrefix = "image/",
): void {
	const onBlobRef = useCallback(onBlob, [onBlob]);

	useEffect(() => {
		const handler = (e: ClipboardEvent) => {
			const items = e.clipboardData?.items;
			if (!items) return;
			for (let i = 0; i < items.length; i++) {
				const item = items[i]!;
				if (item.type.startsWith(mimePrefix)) {
					e.preventDefault();
					const blob = item.getAsFile();
					if (blob) onBlobRef(blob);
					return;
				}
			}
		};
		document.addEventListener("paste", handler);
		return () => document.removeEventListener("paste", handler);
	}, [onBlobRef, mimePrefix]);
}
