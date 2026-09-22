import { signal } from "@preact/signals";
import { getLanguage } from "obsidian";

import type { LanguagePreference, Locale } from "./translate";
import { resolveLocale, translate } from "./translate";

export const settingsLocale = signal<Locale>("en");
export function setLanguagePreference(
	preference: LanguagePreference | undefined,
): void {
	settingsLocale.value = resolveLocale(
		preference,
		typeof getLanguage === "function" ? getLanguage() : "en",
	);
}
export function t(key: string, values?: readonly unknown[]): string {
	return translate(settingsLocale.value, key, values);
}
