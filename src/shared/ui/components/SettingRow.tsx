import type { ComponentChildren } from "preact";

export interface SettingRowProps {
	name: string;
	description?: string | ComponentChildren;
	heading?: boolean;
	class?: string;
	children?: ComponentChildren;
}

export function SettingRow({
	name,
	description,
	heading,
	class: cls,
	children,
}: SettingRowProps) {
	if (heading) {
		return (
			<div class={`setting-item setting-item-heading ${cls ?? ""}`}>
				<div class="setting-item-info">
					<div class="setting-item-name">{name}</div>
					{description && (
						<div class="setting-item-description">{description}</div>
					)}
				</div>
			</div>
		);
	}

	return (
		<div class={`setting-item ${cls ?? ""}`}>
			<div class="setting-item-info">
				<div class="setting-item-name">{name}</div>
				{description && (
					<div class="setting-item-description">{description}</div>
				)}
			</div>
			<div class="setting-item-control">{children}</div>
		</div>
	);
}
