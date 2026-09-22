import en from "./locales/en.json";
import zhCN from "./locales/zh-CN.json";

export type Locale = "en" | "zh-CN";
export type LanguagePreference = "auto" | Locale;
const messages: Record<Locale, Record<string, string>> = { en, "zh-CN": zhCN };

export function resolveLocale(
	preference: unknown,
	appLanguage: string,
): Locale {
	if (preference === "en" || preference === "zh-CN") return preference;
	return /^(zh|zh-cn|zh-hans(?:-.+)?|zh-sg)$/i.test(
		appLanguage.replaceAll("_", "-"),
	)
		? "zh-CN"
		: "en";
}

export function translate(
	locale: Locale,
	key: string,
	values: readonly unknown[] = [],
): string {
	const source = messages[locale][key] ?? messages.en[key] ?? key;
	return source.replace(/\{(\d+)\}/g, (placeholder, index: string) =>
		Number(index) < values.length ? String(values[Number(index)]) : placeholder,
	);
}
