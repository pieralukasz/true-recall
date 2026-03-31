import { createContext } from "preact";
import { useContext } from "preact/hooks";
const PanelScrollContext = createContext(null);
export const PanelScrollProvider = PanelScrollContext.Provider;
export function usePanelScroll() {
    const ctx = useContext(PanelScrollContext);
    if (!ctx)
        throw new Error("usePanelScroll must be used within PanelScrollProvider");
    return ctx;
}
