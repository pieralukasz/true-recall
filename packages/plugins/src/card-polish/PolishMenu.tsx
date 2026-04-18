import type { CardPolishPreset } from "@true-recall/core";

interface PolishMenuProps {
	presets: CardPolishPreset[];
	onPreset: (preset: CardPolishPreset) => void;
	onCustom: () => void;
	onClose: () => void;
}

export function PolishMenu({
	presets,
	onPreset,
	onCustom,
	onClose,
}: PolishMenuProps) {
	return (
		<div className="tr-card-polish-menu" role="menu" onMouseLeave={onClose}>
			{presets.map((p) => (
				<button
					key={p.id}
					type="button"
					role="menuitem"
					className="tr-card-polish-menu-item"
					onClick={() => onPreset(p)}
				>
					<span className="tr-card-polish-menu-item-name">{p.name}</span>
					{p.autoApply ? (
						<span
							className="tr-card-polish-menu-badge"
							title="Applied automatically"
						>
							auto
						</span>
					) : (
						<span
							className="tr-card-polish-menu-badge"
							title="Shows a preview before saving"
						>
							preview
						</span>
					)}
				</button>
			))}
			<div className="tr-card-polish-menu-divider" />
			<button
				type="button"
				role="menuitem"
				className="tr-card-polish-menu-item"
				onClick={onCustom}
			>
				✏️ Custom…
			</button>
		</div>
	);
}
