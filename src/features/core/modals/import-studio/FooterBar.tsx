import { Clickable } from "@shared/ui/components/Clickable";

interface FooterBarProps {
	sessionCount: number;
	cardCount: number;
	saving: boolean;
	onClose: () => void;
	onSave: () => void;
}

const secondaryBtnCls = "ep-btn ep-btn-outline";

export function FooterBar({
	sessionCount,
	cardCount,
	saving,
	onClose,
	onSave,
}: FooterBarProps) {
	return (
		<div class="ep-modal-footer ep:flex ep:justify-between ep:items-center">
			<span class="ep:text-ui-smaller ep:text-obs-faint">
				{sessionCount > 0 &&
					`${sessionCount} card${sessionCount !== 1 ? "s" : ""} saved this session`}
			</span>
			<div class="ep:flex ep:items-center ep:gap-3">
				<Clickable
					class={secondaryBtnCls}
					onClick={onClose}
					stopPropagation={false}
				>
					Close
				</Clickable>
				<Clickable
					class="mod-cta ep-btn"
					onClick={onSave}
					disabled={cardCount === 0 || saving}
					stopPropagation={false}
				>
					{saving
						? "Saving..."
						: `Save ${cardCount > 0 ? `${cardCount} ` : ""}Card${
								cardCount !== 1 ? "s" : ""
							}`}
				</Clickable>
			</div>
		</div>
	);
}
