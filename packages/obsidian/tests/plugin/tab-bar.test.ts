import { describe, expect, it } from "vitest";

import { applyTabBarClass, HIDE_TAB_BAR_CLASS } from "../../src/plugin/tab-bar";

/**
 * Minimal body stand-in — the obsidian test env is `node` with no DOM, so we
 * back `classList` with a Set that mirrors DOMTokenList.toggle(class, force).
 */
function makeBody(): { el: HTMLElement; has: (c: string) => boolean } {
	const classes = new Set<string>();
	const el = {
		classList: {
			toggle(token: string, force?: boolean): boolean {
				const shouldHave = force === undefined ? !classes.has(token) : force;
				if (shouldHave) classes.add(token);
				else classes.delete(token);
				return shouldHave;
			},
		},
	} as unknown as HTMLElement;
	return { el, has: (c) => classes.has(c) };
}

describe("applyTabBarClass", () => {
	it("adds the hide class when hidden is true", () => {
		const { el, has } = makeBody();
		applyTabBarClass(el, true);
		expect(has(HIDE_TAB_BAR_CLASS)).toBe(true);
	});

	it("removes the hide class when hidden is false", () => {
		const { el, has } = makeBody();
		applyTabBarClass(el, true);
		applyTabBarClass(el, false);
		expect(has(HIDE_TAB_BAR_CLASS)).toBe(false);
	});

	it("is idempotent when applied repeatedly with the same value", () => {
		const { el, has } = makeBody();
		applyTabBarClass(el, true);
		applyTabBarClass(el, true);
		expect(has(HIDE_TAB_BAR_CLASS)).toBe(true);
		applyTabBarClass(el, false);
		applyTabBarClass(el, false);
		expect(has(HIDE_TAB_BAR_CLASS)).toBe(false);
	});

	it("exposes a stable class name shared with styles.css", () => {
		expect(HIDE_TAB_BAR_CLASS).toBe("tr-hide-tab-bar");
	});
});
