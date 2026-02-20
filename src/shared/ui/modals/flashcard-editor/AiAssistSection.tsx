import { setIcon } from "obsidian";
import { useEffect, useRef } from "preact/hooks";

export interface AiAssistSectionProps {
	isExpanded: boolean;
	onToggle: () => void;
	value: string;
	onChange: (value: string) => void;
}

export function AiAssistSection({
	isExpanded,
	onToggle,
	value,
	onChange,
}: AiAssistSectionProps) {
	const iconRef = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		if (iconRef.current) {
			setIcon(iconRef.current, isExpanded ? "chevron-down" : "chevron-right");
		}
	}, [isExpanded]);

	return (
		<div class="ep:mb-4 ep:pb-4 ep:border-b ep:border-obs-border">
			<button
				type="button"
				class="ep:flex ep:items-center ep:gap-2 ep:cursor-pointer ep:text-obs-muted ep:hover:text-obs-normal ep:transition-colors ep:bg-transparent ep:border-none ep:p-0"
				aria-expanded={isExpanded}
				onClick={onToggle}
			>
				<span ref={iconRef} class="ep:w-4 ep:h-4 ep:transition-transform" />
				<span class="ep:text-ui-smaller ep:font-medium">AI Assist</span>
			</button>
			{isExpanded && (
				<div class="ep:mt-2">
					<textarea
						class="ep:w-full ep:min-h-20 ep:p-3 ep:border ep:border-obs-border ep:rounded-lg ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:resize-y ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted"
						placeholder="np. stw&oacute;rz podobne fiszki, rozwi&#324; temat, dodaj wi&#281;cej przyk&#322;ad&oacute;w..."
						value={value}
						onInput={(e) => onChange((e.target as HTMLTextAreaElement).value)}
					/>
				</div>
			)}
		</div>
	);
}
