import type { ComponentChildren } from "preact";

import { cn } from "@true-recall/obsidian/utils/cn";

import { useFormVariant } from "./FormVariantContext";

interface FormFieldProps {
	name: string;
	description?: string | ComponentChildren;
	children?: ComponentChildren;
	class?: string;
	/**
	 * "stacked" drops the control onto its own full-width line below the label,
	 * so wide controls stop squeezing the label column. Card variant only —
	 * the native variant always uses Obsidian's own setting-item row.
	 */
	layout?: "row" | "stacked";
}

function FieldLabel({
	name,
	description,
}: Pick<FormFieldProps, "name" | "description">) {
	return (
		<div class="ep:flex ep:flex-col ep:flex-1 ep:min-w-0">
			<span class="ep:text-ui-small ep:font-medium ep:text-obs-normal">
				{name}
			</span>
			{description && (
				<span class="ep:text-ui-smaller ep:text-obs-muted ep:leading-snug ep:mt-0.5">
					{description}
				</span>
			)}
		</div>
	);
}

const ROW_CLS =
	"ep:py-3 ep:border-b ep:border-obs-border ep:last:border-b-0" as const;

export function FormField({
	name,
	description,
	children,
	class: cls,
	layout = "row",
}: FormFieldProps) {
	const variant = useFormVariant();

	if (variant === "native") {
		return (
			<div
				class={cn(
					"setting-item",
					layout === "stacked" && "tr-setting-item--stacked",
					cls,
				)}
			>
				<div class="setting-item-info">
					<div class="setting-item-name">{name}</div>
					{description && (
						<div class="setting-item-description">{description}</div>
					)}
				</div>
				{children && <div class="setting-item-control">{children}</div>}
			</div>
		);
	}

	if (layout === "stacked") {
		return (
			<div class={cn("ep:flex ep:flex-col ep:gap-2", ROW_CLS, cls)}>
				<FieldLabel name={name} description={description} />
				{children && (
					<div class="ep:flex ep:items-center ep:gap-2">{children}</div>
				)}
			</div>
		);
	}

	return (
		<div
			class={cn(
				"ep:flex ep:items-center ep:justify-between ep:gap-4",
				ROW_CLS,
				cls,
			)}
		>
			<FieldLabel name={name} description={description} />
			{children && (
				<div class="ep:shrink-0 ep:flex ep:items-center ep:gap-2">
					{children}
				</div>
			)}
		</div>
	);
}
