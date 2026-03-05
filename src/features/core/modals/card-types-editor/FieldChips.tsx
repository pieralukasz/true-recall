interface FieldChipsProps {
	fields: string[];
	noteTypeType: 0 | 1;
}

export function FieldChips({ fields, noteTypeType }: FieldChipsProps) {
	return (
		<div class="ep:flex ep:flex-wrap ep:gap-1.5 ep:pt-2">
			<span class="ep:text-ui-smaller ep:text-obs-muted ep:mr-1">
				Insert:
			</span>
			{fields.map((f) => (
				<Chip key={f} label={`{{${f}}}`} />
			))}
			{noteTypeType === 1 &&
				fields.map((f) => (
					<Chip key={`cloze-${f}`} label={`{{cloze:${f}}}`} />
				))}
		</div>
	);
}

function Chip({ label }: { label: string }) {
	return (
		<span
			class="ep:text-ui-smaller ep:px-1.5 ep:py-0.5 ep:bg-obs-accent/10 ep:text-obs-accent ep:rounded ep:cursor-default ep:select-all"
			title={`Copy: ${label}`}
		>
			{label}
		</span>
	);
}
