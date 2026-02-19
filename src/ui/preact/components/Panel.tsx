import type { ComponentChildren } from "preact";

export interface PanelProps {
	showFooter?: boolean;
	disableScroll?: boolean;
	children: ComponentChildren;
	footer?: ComponentChildren;
}

export function Panel({ disableScroll, children, footer }: PanelProps) {
	return (
		<div class="ep:h-full ep:flex ep:flex-col ep:px-1 ep:overflow-hidden">
			<div
				class={
					disableScroll
						? "ep:flex-1 ep:min-h-0"
						: "ep:flex-1 ep:overflow-y-auto ep:min-h-0"
				}
			>
				{children}
			</div>
			{footer && <div class="ep:shrink-0">{footer}</div>}
		</div>
	);
}
