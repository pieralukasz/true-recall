import type { ComponentChildren } from "preact";

import { cn } from "@true-recall/obsidian/utils/cn";

import { useFormVariant } from "./FormVariantContext";

interface InfoBlockProps {
	children: ComponentChildren;
	class?: string;
}

export function InfoBlock({ children, class: cls }: InfoBlockProps) {
	const variant = useFormVariant();

	if (variant === "native") {
		return <div class={cn("setting-item-description", cls)}>{children}</div>;
	}

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
