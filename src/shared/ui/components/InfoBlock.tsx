import type { ComponentChildren } from "preact";

export interface InfoBlockProps {
	children: ComponentChildren;
	class?: string;
}

export function InfoBlock({ children, class: cls }: InfoBlockProps) {
	return (
		<div class={`ep:text-ui-smaller ep:text-obs-muted ep:leading-relaxed ep:py-2 ${cls ?? ""}`}>
			{children}
		</div>
	);
}
