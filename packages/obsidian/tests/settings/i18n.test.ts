import { describe, expect, it } from "vitest";

import en from "../../src/i18n/locales/en.json";
import zhCN from "../../src/i18n/locales/zh-CN.json";
import { resolveLocale, translate } from "../../src/i18n/translate";

describe("settings translations", () => {
	it.each([
		["auto", "zh", "zh-CN"],
		[undefined, "zh_CN", "zh-CN"],
		["auto", "zh-Hans", "zh-CN"],
		["auto", "zh-Hans-CN", "zh-CN"],
		["auto", "zh-SG", "zh-CN"],
		["auto", "zh-TW", "en"],
		["auto", "pl", "en"],
		["en", "zh-CN", "en"],
		["zh-CN", "en", "zh-CN"],
	])("resolves preference %s with Obsidian language %s", (preference, language, expected) => {
		expect(resolveLocale(preference, language)).toBe(expected);
	});
	it("keeps both catalogues complete and preserves interpolation parameters", () => {
		expect(Object.keys(zhCN).sort()).toEqual(Object.keys(en).sort());
		for (const [key, value] of Object.entries(zhCN)) {
			expect(value.trim(), key).not.toBe("");
			expect(value.match(/\{\d+\}/g)?.sort() ?? [], key).toEqual(
				key.match(/\{\d+\}/g)?.sort() ?? [],
			);
		}
	});
	it("falls back to the English key without corrupting user supplied values", () => {
		expect(translate("zh-CN", "Unknown label")).toBe("Unknown label");
		expect(translate("zh-CN", "{0} options", ["$& \\ vault"])).toContain(
			"$& \\ vault",
		);
		expect(translate("en", "{0} options")).toBe("{0} options");
		expect(translate("zh-CN", "General")).not.toBe("General");
	});
});
