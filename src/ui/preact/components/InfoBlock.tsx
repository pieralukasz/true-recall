import type { ComponentChildren } from "preact";

export interface InfoBlockProps {
	children: ComponentChildren;
	class?: string;
}

export function InfoBlock({ children, class: cls }: InfoBlockProps) {
	return (
		<div class={`setting-item-description ep:py-2 ${cls ?? ""}`}>
			{children}
		</div>
	);
}
