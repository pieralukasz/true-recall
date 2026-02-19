import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { App } from "obsidian";
import type TrueRecallPlugin from "../../main";

interface ObsidianContextValue {
	app: App;
	plugin: TrueRecallPlugin;
}

const ObsidianContext = createContext<ObsidianContextValue>(null!);

export const ObsidianProvider = ObsidianContext.Provider;

export function useApp(): App {
	return useContext(ObsidianContext).app;
}

export function usePlugin(): TrueRecallPlugin {
	return useContext(ObsidianContext).plugin;
}
