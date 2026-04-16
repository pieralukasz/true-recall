import { useRef } from "preact/hooks";

import { PasteDropZone } from "@true-recall/obsidian/components";

interface FileSelectPhaseProps {
	onFile: (file: File) => void;
}

export function FileSelectPhase({ onFile }: FileSelectPhaseProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);

	return (
		<>
			<div class="ep:text-ui-small ep:text-obs-muted ep:mb-4">
				Select an .apkg file exported from Anki to import your flashcards.
			</div>

			<input
				ref={fileInputRef}
				type="file"
				accept=".apkg"
				style="display: none"
				onChange={(e) => {
					const file = (e.target as HTMLInputElement).files?.[0];
					if (file) onFile(file);
				}}
			/>

			<PasteDropZone
				onFileDrop={(file) => {
					if (file.name.endsWith(".apkg")) {
						onFile(file);
					}
				}}
				accept="*"
				label="Click to select .apkg file"
				hint="or drag & drop"
				onClick={() => fileInputRef.current?.click()}
			/>
		</>
	);
}
