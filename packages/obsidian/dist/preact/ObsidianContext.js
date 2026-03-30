import { createContext } from "preact";
import { useContext } from "preact/hooks";
const ObsidianContext = createContext(null);
export const ObsidianProvider = ObsidianContext.Provider;
export function useApp() {
    return useContext(ObsidianContext).app;
}
export function usePlugin() {
    return useContext(ObsidianContext).plugin;
}
