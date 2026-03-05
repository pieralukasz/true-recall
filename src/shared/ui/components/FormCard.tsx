import type { ComponentChildren } from "preact";

export interface FormCardProps {
	title?: string;
	description?: string;
	children: ComponentChildren;
	class?: string;
}

export function FormCard({
	title,
	description,
	children,
	class: cls,
}: FormCardProps) {
	return (
		<div class={`ep:p-4 ep:rounded-lg ep:bg-obs-secondary ${cls ?? ""}`}>
			{title && (
				<div class="ep:flex ep:items-center ep:justify-between ep:mb-3 ep:pb-2.5 ep:border-b ep:border-obs-border">
					<div>
						<span class="ep:text-ui-medium ep:font-semibold ep:text-obs-normal ep:tracking-tight">
							{title}
						</span>
						{description && (
							<p class="ep:text-ui-smaller ep:text-obs-muted ep:mt-0.5">
								{description}
							</p>
						)}
					</div>
				</div>
			)}
			{children}
		</div>
	);
}
