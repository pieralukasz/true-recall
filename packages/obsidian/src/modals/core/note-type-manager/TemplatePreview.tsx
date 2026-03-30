import { renderTemplate } from "@true-recall/core/services/cards/template-engine";
import type { CardTemplate } from "@true-recall/core/types/note.types";
import { Clickable } from "@true-recall/obsidian/components";
import { MarkdownContent } from "@true-recall/obsidian/components/MarkdownContent";
import { useMemo, useState } from "preact/hooks";

interface TemplatePreviewProps {
	template: CardTemplate;
	fields: string[];
	noteTypeType: 0 | 1;
}

export function TemplatePreview({
	template,
	fields,
	noteTypeType,
}: TemplatePreviewProps) {
	const [showPreview, setShowPreview] = useState(false);

	const sampleFields = useMemo(() => {
		const result: Record<string, string> = {};
		for (const f of fields) {
			result[f] = noteTypeType === 1 ? `{{c1::sample ${f} text}}` : `(${f})`;
		}
		return result;
	}, [fields, noteTypeType]);

	const renderedFront = useMemo(
		() =>
			renderTemplate(template.qfmt, {
				fields: sampleFields,
				clozeIndex: 1,
			}),
		[template.qfmt, sampleFields],
	);

	const renderedBack = useMemo(
		() =>
			renderTemplate(template.afmt, {
				fields: sampleFields,
				frontSide: "",
				clozeIndex: 1,
			}),
		[template.afmt, sampleFields],
	);

	return (
		<div class="ep:mt-2">
			<Clickable
				class="ep:text-ui-smaller ep:text-obs-accent ep:hover:text-obs-accent/80"
				onClick={() => setShowPreview((v) => !v)}
			>
				{showPreview ? "Hide preview" : "Show preview"}
			</Clickable>
			{showPreview && (
				<div class="ep:mt-2 ep:border ep:border-obs-border ep:rounded-md ep:p-3 ep:bg-obs-primary/50">
					<div class="ep:text-ui-smaller ep:text-obs-muted ep:mb-1 ep:uppercase ep:tracking-wider">
						Front
					</div>
					<MarkdownContent
						markdown={renderedFront}
						class="ep:mb-3 ep:text-ui-small"
					/>
					<div class="ep:border-t ep:border-obs-border ep:my-2" />
					<div class="ep:text-ui-smaller ep:text-obs-muted ep:mb-1 ep:uppercase ep:tracking-wider">
						Back
					</div>
					<MarkdownContent markdown={renderedBack} class="ep:text-ui-small" />
				</div>
			)}
		</div>
	);
}
