export function ProjectDropZone({
	position,
	label,
	onDrop,
}: {
	position: "top" | "bottom";
	label: string;
	onDrop: (e: DragEvent) => void;
}) {
	const spacing = position === "top" ? "ep:mb-1" : "ep:mt-1";
	return (
		<div
			role="listitem"
			class={`ep:h-10 ep:mx-2 ${spacing} ep:border-2 ep:border-dashed ep:border-obs-border ep:rounded-lg ep:flex ep:items-center ep:justify-center ep:text-xs ep:text-obs-muted ep:transition-colors`}
			onDragOver={(e) => {
				e.preventDefault();
				if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
				(e.currentTarget as HTMLElement).classList.add("ep-drop-root-zone");
			}}
			onDragLeave={(e) => {
				(e.currentTarget as HTMLElement).classList.remove("ep-drop-root-zone");
			}}
			onDrop={onDrop}
		>
			{label}
		</div>
	);
}
