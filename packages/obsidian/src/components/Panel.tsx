import type { ComponentChildren } from "preact";

import { cn } from "@true-recall/obsidian/utils/cn";

interface PanelProps {
	showFooter?: boolean;
	disableScroll?: boolean;
	children: ComponentChildren;
	footer?: ComponentChildren;
}

export function Panel({ disableScroll, children, footer }: PanelProps) {
	return (
		<div class="ep:h-full ep:flex ep:flex-col ep:overflow-hidden">
			<div
				class={cn(
					"ep:flex-1 ep:min-h-0",
					!disableScroll && "ep:overflow-y-auto",
				)}
			>
				{children}
			</div>
			{footer && <div class="ep:shrink-0">{footer}</div>}
		</div>
	);
}
