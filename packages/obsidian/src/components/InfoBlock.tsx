import type { ComponentChildren } from "preact";
import { cn } from "@true-recall/obsidian/utils/cn";

export interface InfoBlockProps {
	children: ComponentChildren;
	class?: string;
}

export function InfoBlock({ children, class: cls }: InfoBlockProps) {
	return (
		<div
			class={cn(
				"ep:text-ui-smaller ep:text-obs-muted ep:leading-relaxed ep:py-2",
				cls,
			)}
		>
			{children}
		</div>
	);
}
