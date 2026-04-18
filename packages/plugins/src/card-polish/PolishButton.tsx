interface PolishButtonProps {
	onClick: (anchor: HTMLElement) => void;
}

export function PolishButton({ onClick }: PolishButtonProps) {
	return (
		<button
			type="button"
			className="tr-card-polish-button"
			title="Polish this card (AI)"
			onClick={(e) => onClick(e.currentTarget as HTMLElement)}
			aria-label="Polish this card"
		>
			✨
		</button>
	);
}
