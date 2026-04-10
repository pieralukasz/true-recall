import type { ComponentChildren } from "preact";

import { cn } from "@true-recall/obsidian/utils/cn";

interface FormFieldProps {
	name: string;
	description?: string | ComponentChildren;
	children?: ComponentChildren;
	class?: string;
}

export function FormField({
	name,
	description,
	children,
	class: cls,
}: FormFieldProps) {
	return (
		<div
			class={cn(
				"ep:flex ep:items-center ep:justify-between ep:gap-4 ep:py-3 ep:border-b ep:border-obs-border last:ep:border-b-0",
				cls,
			)}
		>
			<div class="ep:flex ep:flex-col ep:min-w-0">
				<span class="ep:text-ui-small ep:font-medium ep:text-obs-normal">
					{name}
				</span>
				{description && (
					<span class="ep:text-ui-smaller ep:text-obs-muted ep:leading-snug ep:mt-0.5">
						{description}
					</span>
				)}
			</div>
			{children && (
				<div class="ep:shrink-0 ep:flex ep:items-center">{children}</div>
			)}
		</div>
	);
}
