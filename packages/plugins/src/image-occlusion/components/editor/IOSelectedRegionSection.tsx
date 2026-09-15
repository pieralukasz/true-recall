import type { IORegion } from "../../types";
import type { EditableRegionFields } from "../../utils/editor-state";

type NumericRegionField = "x" | "y" | "w" | "h";

interface RegionNumberFieldProps {
	field: NumericRegionField;
	region: IORegion;
	onChange: (patch: Partial<EditableRegionFields>) => void;
}

function RegionNumberField({
	field,
	region,
	onChange,
}: RegionNumberFieldProps) {
	const isSize = field === "w" || field === "h";
	return (
		<label class="true-recall-io-field">
			{field.toUpperCase()}
			<input
				type="number"
				min={isSize ? 0.01 : 0}
				max={1}
				step={0.01}
				value={region[field]}
				onInput={(event) =>
					onChange({
						[field]: Number(event.currentTarget.value),
					})
				}
			/>
		</label>
	);
}

interface IOSelectedRegionSectionProps {
	region: IORegion;
	onChange: (patch: Partial<EditableRegionFields>) => void;
}

export function IOSelectedRegionSection({
	region,
	onChange,
}: IOSelectedRegionSectionProps) {
	return (
		<section class="true-recall-io-side-section ep:flex ep:flex-col ep:gap-2">
			<h3 class="ep:text-ui-small ep:font-medium">Selected region</h3>
			{(["x", "y", "w", "h"] as const).map((field) => (
				<RegionNumberField
					key={field}
					field={field}
					region={region}
					onChange={onChange}
				/>
			))}
		</section>
	);
}
