import { useCallback, useEffect, useMemo, useState } from "preact/hooks";

import type { FSRSPreset, TrueRecallSettings } from "@true-recall/core/types";

import { usePlugin } from "@true-recall/obsidian/preact";

function useSettingsVersion(): number {
	const plugin = usePlugin();
	const [version, setVersion] = useState(0);

	useEffect(() => {
		return plugin.coreApp.events.on("settings:changed", () => {
			setVersion((v) => v + 1);
		});
	}, [plugin]);

	return version;
}

export function useSettings() {
	const plugin = usePlugin();
	const version = useSettingsVersion();

	const save = useCallback(
		async (patch: Partial<TrueRecallSettings>) => {
			Object.assign(plugin.settings, patch);
			await plugin.saveSettings();
		},
		[plugin],
	);

	const settings = useMemo(
		() => ({ ...plugin.settings }),
		[plugin, version],
	);

	return { settings, save, plugin } as const;
}

export function usePreset(selectedPresetId: string) {
	const plugin = usePlugin();
	const version = useSettingsVersion();

	const preset = useMemo(() => {
		void version;
		const presets = plugin.settings.fsrsPresets;
		const found = presets.find((p) => p.id === selectedPresetId) ?? presets[0];
		if (!found) throw new Error("No FSRS presets configured");
		return found;
	}, [plugin.settings.fsrsPresets, selectedPresetId, version]);

	const updatePreset = useCallback(
		async (changes: Partial<FSRSPreset>) => {
			await plugin.presetService.updatePreset(preset.id, changes);
		},
		[plugin, preset.id],
	);

	return { preset, updatePreset } as const;
}
