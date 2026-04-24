import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { cn } from "@true-recall/obsidian/utils/cn";

interface AudioPlayButtonProps {
	audioPath: string;
	autoplay?: boolean;
	class?: string;
}

export function AudioPlayButton({
	audioPath,
	autoplay,
	class: className,
}: AudioPlayButtonProps) {
	const [isPlaying, setIsPlaying] = useState(false);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const blobUrlRef = useRef<string | null>(null);

	useEffect(() => {
		return () => {
			if (blobUrlRef.current) {
				URL.revokeObjectURL(blobUrlRef.current);
			}
		};
	}, []);

	const play = useCallback(async () => {
		if (isPlaying) return;

		try {
			if (!blobUrlRef.current) {
				const adapter = (window as unknown as Record<string, unknown>).app as
					| {
							vault?: {
								adapter?: {
									readBinary: (path: string) => Promise<ArrayBuffer>;
								};
							};
					  }
					| undefined;
				if (!adapter?.vault?.adapter) return;

				const buffer = await adapter.vault.adapter.readBinary(audioPath);
				const blob = new Blob([buffer], { type: "audio/mpeg" });
				blobUrlRef.current = URL.createObjectURL(blob);
			}

			const audio = new Audio(blobUrlRef.current);
			audioRef.current = audio;
			audio.onended = () => setIsPlaying(false);
			audio.onerror = () => setIsPlaying(false);
			setIsPlaying(true);
			await audio.play();
		} catch (error) {
			setIsPlaying(false);
			if (error instanceof DOMException && error.name === "NotAllowedError") {
				// Autoplay blocked by browser — this is expected on first interaction
				console.info("[Audio] Autoplay blocked; user interaction required");
			} else {
				console.warn("[Audio] Playback failed", error);
			}
		}
	}, [audioPath, isPlaying]);

	useEffect(() => {
		if (autoplay) {
			void play();
		}
	}, [autoplay, audioPath]);

	return (
		<button
			class={cn(
				"ep:inline-flex ep:items-center ep:justify-center ep:p-1 ep:rounded ep:border-0",
				"ep:bg-transparent ep:cursor-pointer ep:text-obs-muted hover:ep:text-obs-accent",
				"ep:transition-colors ep:duration-150",
				isPlaying && "ep:text-obs-accent",
				className,
			)}
			onClick={() => void play()}
			title="Play audio"
			type="button"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				role="img"
				aria-label="Play audio"
			>
				{isPlaying ? (
					<>
						<path d="M11 5L6 9H2v6h4l5 4V5z" />
						<path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
						<path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
					</>
				) : (
					<>
						<path d="M11 5L6 9H2v6h4l5 4V5z" />
						<path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
					</>
				)}
			</svg>
		</button>
	);
}
