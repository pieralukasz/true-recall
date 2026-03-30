import { cn } from "../utils/cn";
import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";

export interface PasteDropZoneProps {
	onFileDrop: (file: File) => void;
	accept?: string;
	icon?: ComponentChildren;
	label?: string;
	hint?: string;
	onClick?: () => void;
}

export function PasteDropZone({
	onFileDrop,
	accept = "image/",
	icon,
	label = "Paste from clipboard",
	hint = "Ctrl+V or drag & drop",
	onClick,
}: PasteDropZoneProps) {
	const [dragActive, setDragActive] = useState(false);

	return (
		<div
			role="button"
			tabIndex={0}
			class={cn(
				"ep:flex ep:flex-col ep:items-center ep:justify-center ep:p-6 ep:mb-4 ep:border-2 ep:border-dashed ep:rounded-lg ep:cursor-pointer ep:transition-all ep:hover:border-obs-interactive ep:bg-transparent ep:font-inherit ep:w-full",
				dragActive ? "true-recall-paste-zone-active" : "ep:border-obs-border",
			)}
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
					if (file && (accept === "*" || file.type.startsWith(accept))) {
						onFileDrop(file);
					}
				}
			}}
			onClick={onClick}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onClick?.();
				}
			}}
		>
			{icon && <div class="ep:text-obs-muted">{icon}</div>}
			<div class="ep:text-ui-small ep:font-medium ep:text-obs-normal">
				{label}
			</div>
			<div class="ep:text-ui-smaller ep:text-obs-muted">{hint}</div>
		</div>
	);
}
