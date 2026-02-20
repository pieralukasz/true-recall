import type { SessionLogic } from "@features/study/ui/session/SessionLogic";

interface CustomStudySectionProps {
	logic: SessionLogic;
	onAction: (
		action: "failed" | "difficult" | "study-ahead" | "most-forgotten",
	) => void;
	onOpenModal: () => void;
}

export function CustomStudySection({
	logic,
	onAction,
	onOpenModal,
}: CustomStudySectionProps) {
	const failedCount = logic.getFailedCardsCount();
	const difficultCount = logic.getDifficultCardsCount();
	const aheadCount = logic.getStudyAheadCount(3);
	const forgottenCount = logic.getMostForgottenCount(1);

	const btnCls =
		"ep:flex ep:flex-col ep:items-start ep:gap-1 ep:px-3 ep:py-3 ep:bg-obs-secondary ep:border ep:border-obs-border ep:rounded-md ep:cursor-pointer ep:text-left ep:transition-colors ep:hover:bg-obs-modifier-hover ep:hover:border-obs-interactive";
	const disabledCls = `${btnCls} ep:opacity-50 ep:cursor-not-allowed ep:hover:bg-obs-secondary ep:hover:border-obs-border`;

	return (
		<>
			<div class="ep:flex ep:items-center ep:justify-between ep:my-2">
				<div class="ep:text-ui-small ep:font-semibold ep:text-obs-normal">
					Custom study
				</div>
				<button
					type="button"
					class="ep:text-ui-smaller ep:text-obs-muted ep:bg-transparent ep:border-none ep:cursor-pointer ep:hover:text-obs-normal ep:px-1"
					aria-label="Open custom study modal"
					onClick={onOpenModal}
				>
					Advanced
				</button>
			</div>
			<div class="true-recall-custom-study ep:grid ep:grid-cols-2 ep:gap-2">
				<CustomStudyBtn
					label="Failed cards"
					count={failedCount}
					unit="cards"
					onClick={() => onAction("failed")}
					cls={btnCls}
					disabledCls={disabledCls}
				/>
				<CustomStudyBtn
					label="Difficult"
					count={difficultCount}
					unit="cards"
					onClick={() => onAction("difficult")}
					cls={btnCls}
					disabledCls={disabledCls}
				/>
				<CustomStudyBtn
					label="Study ahead"
					count={aheadCount}
					unit="cards (3d)"
					onClick={() => onAction("study-ahead")}
					cls={btnCls}
					disabledCls={disabledCls}
				/>
				<CustomStudyBtn
					label="Most forgotten"
					count={forgottenCount}
					unit="cards"
					onClick={() => onAction("most-forgotten")}
					cls={btnCls}
					disabledCls={disabledCls}
				/>
			</div>
		</>
	);
}

function CustomStudyBtn({
	label,
	count,
	unit,
	onClick,
	cls,
	disabledCls,
}: {
	label: string;
	count: number;
	unit: string;
	onClick: () => void;
	cls: string;
	disabledCls: string;
}) {
	const disabled = count === 0;
	return (
		<button
			type="button"
			class={disabled ? disabledCls : cls}
			disabled={disabled}
			onClick={disabled ? undefined : onClick}
		>
			<span class="ep:text-ui-small ep:font-medium ep:text-obs-normal">
				{label}
			</span>
			<span
				class={
					disabled
						? "ep:text-ui-smaller ep:text-obs-faint"
						: "ep:text-ui-smaller ep:text-obs-muted"
				}
			>
				{disabled ? "none" : `${count} ${unit}`}
			</span>
		</button>
	);
}
