import { createContext } from "preact";
import { useContext } from "preact/hooks";

export interface PanelScrollApi {
	preserveScroll: (action: () => void) => void;
	captureScroll: () => () => void;
}

const PanelScrollContext = createContext<PanelScrollApi | null>(null);

export const PanelScrollProvider = PanelScrollContext.Provider;

export function usePanelScroll(): PanelScrollApi {
	const ctx = useContext(PanelScrollContext);
	if (!ctx)
		throw new Error("usePanelScroll must be used within PanelScrollProvider");
	return ctx;
}
