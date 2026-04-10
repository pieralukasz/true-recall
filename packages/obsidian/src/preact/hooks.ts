import { setIcon } from "obsidian";
import { useEffect, useRef } from "preact/hooks";

export function useIcon(iconId: string): preact.RefObject<HTMLDivElement> {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (ref.current instanceof HTMLElement) {
			setIcon(ref.current, iconId);
		}
	}, [iconId]);

	return ref;
}
