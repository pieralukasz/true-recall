import type { App } from "obsidian";
import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type TrueRecallPlugin from "../../main";

interface ObsidianContextValue {
	app: App;
	plugin: TrueRecallPlugin;
}

const ObsidianContext = createContext<ObsidianContextValue>(
	null as unknown as ObsidianContextValue,
);

export const ObsidianProvider = ObsidianContext.Provider;

export function useApp(): App {
	return useContext(ObsidianContext).app;
}

export function usePlugin(): TrueRecallPlugin {
	return useContext(ObsidianContext).plugin;
}
