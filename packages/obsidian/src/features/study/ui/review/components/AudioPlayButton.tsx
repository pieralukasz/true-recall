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
			// NotAllowedError (autoplay blocked pre-interaction) is expected and
			// silently retried on the next click; anything else is worth surfacing
			// for diagnosing real playback failures.
			if (
				!(error instanceof DOMException && error.name === "NotAllowedError")
			) {
				console.warn("[Audio] Playback failed", error);
			}
		}
	}, [audioPath, isPlaying]);

	// Ref mirror so the autoplay effect can call the latest `play` without
	// depending on it directly — `play`'s identity changes with `isPlaying`,
	// and re-running this effect on every play/pause would re-trigger autoplay
	// in a loop once each playback ends.
	const playRef = useRef(play);
	playRef.current = play;

	useEffect(() => {
		if (autoplay) {
			void playRef.current();
		}
	}, [autoplay, audioPath]);

	return (
		<button
			class={cn(
				"ep:inline-flex ep:items-center ep:justify-center ep:p-1 ep:rounded ep:border-0",
				"ep:bg-transparent ep:cursor-pointer ep:text-obs-muted ep:hover:text-obs-accent",
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
				fill="currentColor"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				role="img"
				aria-label={isPlaying ? "Pause audio" : "Play audio"}
			>
				{isPlaying ? (
					<>
						<rect x="6" y="5" width="4" height="14" rx="1" />
						<rect x="14" y="5" width="4" height="14" rx="1" />
					</>
				) : (
					<path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.29-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14z" />
				)}
			</svg>
		</button>
	);
}
