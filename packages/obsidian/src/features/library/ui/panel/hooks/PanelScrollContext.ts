import type { RefObject } from "preact";
import { createContext } from "preact";
import { useContext } from "preact/hooks";

interface PanelScrollApi {
	preserveScroll: (action: () => void) => void;
	captureScroll: () => () => void;
	scrollRef: RefObject<HTMLDivElement>;
}

const PanelScrollContext = createContext<PanelScrollApi | null>(null);

export const PanelScrollProvider = PanelScrollContext.Provider;

export function usePanelScroll(): PanelScrollApi {
	const ctx = useContext(PanelScrollContext);
	if (!ctx)
		throw new Error("usePanelScroll must be used within PanelScrollProvider");
	return ctx;
}
