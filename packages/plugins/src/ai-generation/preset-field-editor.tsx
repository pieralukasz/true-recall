import type { FieldConfig } from "@true-recall/core/types/generation-preset.types";

interface PresetFieldEditorProps {
	fieldName: string;
	config: FieldConfig;
	allFieldNames: string[];
	onChange: (config: FieldConfig) => void;
}

export function PresetFieldEditor({
	fieldName,
	config,
	allFieldNames,
	onChange,
}: PresetFieldEditorProps) {
	const otherFields = allFieldNames.filter((f) => f !== fieldName);

	const handleRoleChange = (role: string) => {
		if (role === "ai-text") {
			onChange({ role: "ai-text", instruction: "" });
		} else if (role === "image") {
			onChange({ role: "image", sourceField: otherFields[0] ?? "", style: "" });
		} else {
			onChange({ role: "manual" });
		}
	};

	return (
		<div class="ep:flex ep:flex-col ep:gap-1 ep:py-2 ep:border-b ep:border-obs-border ep:last:border-b-0">
			<div class="ep:flex ep:items-center ep:gap-3">
				<span class="ep:text-ui-small ep:font-medium ep:min-w-[80px] ep:text-obs-normal">
					{fieldName}
				</span>
				<select
					class="ep:px-2 ep:py-1 ep:text-ui-smaller ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded ep:text-obs-normal"
					value={config.role}
					onChange={(e) =>
						handleRoleChange((e.target as HTMLSelectElement).value)
					}
				>
					<option value="ai-text">AI Text</option>
					<option value="image">Image</option>
					<option value="manual">Manual</option>
				</select>
			</div>

			{config.role === "ai-text" && (
				<textarea
					class="ep:w-full ep:px-2 ep:py-1.5 ep:text-ui-smaller ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded ep:font-mono ep:resize-y"
					rows={2}
					placeholder="Instruction for AI (e.g. A clear question about the concept)"
					value={config.instruction}
					onInput={(e) =>
						onChange({
							role: "ai-text",
							instruction: (e.target as HTMLTextAreaElement).value,
						})
					}
				/>
			)}

			{config.role === "image" && (
				<div class="ep:flex ep:gap-2">
					<select
						class="ep:px-2 ep:py-1 ep:text-ui-smaller ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded ep:flex-1"
						value={config.sourceField}
						onChange={(e) =>
							onChange({
								role: "image",
								sourceField: (e.target as HTMLSelectElement).value,
								style: config.style,
							})
						}
					>
						{otherFields.map((f) => (
							<option key={f} value={f}>
								{f}
							</option>
						))}
					</select>
					<input
						type="text"
						class="ep:px-2 ep:py-1 ep:text-ui-smaller ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded ep:flex-1"
						placeholder="Style (optional)"
						value={config.style ?? ""}
						onInput={(e) =>
							onChange({
								role: "image",
								sourceField: config.sourceField,
								style: (e.target as HTMLInputElement).value || undefined,
							})
						}
					/>
				</div>
			)}

			{config.role === "manual" && (
				<span class="ep:text-ui-smaller ep:text-obs-muted ep:italic">
					(Skipped by AI)
				</span>
			)}
		</div>
	);
}
