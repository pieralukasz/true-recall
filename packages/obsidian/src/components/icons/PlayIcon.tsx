interface PlayIconProps {
	size?: number;
	class?: string;
}

export function PlayIcon({ size = 14, class: cls }: PlayIconProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="currentColor"
			class={cls}
			role="img"
			aria-hidden="true"
		>
			<path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.29-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14z" />
		</svg>
	);
}
