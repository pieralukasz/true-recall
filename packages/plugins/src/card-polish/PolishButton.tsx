import { useState } from "preact/hooks";

interface PolishButtonProps {
	onClick: (anchor: HTMLElement) => void;
}

export function PolishButton({ onClick }: PolishButtonProps) {
	const [hovered, setHovered] = useState(false);
	return (
		<button
			type="button"
			className="tr-card-polish-button"
			title={hovered ? "Polish this card (AI)" : ""}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			onClick={(e) => onClick(e.currentTarget as HTMLElement)}
			aria-label="Polish this card"
		>
			✨
		</button>
	);
}
