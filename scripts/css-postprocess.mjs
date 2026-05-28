#!/usr/bin/env bun
/**
 * Strip Tailwind v4's `@supports (color: color-mix(in lab, red, red))` wrappers.
 *
 * Obsidian (Electron 30+, Chrome 124+) supports color-mix natively. The wrapper
 * is dead weight: emits a fallback rule + an @supports duplicate, triggering
 * Obsidian reviewer warnings for @supports usage and duplicate selectors.
 *
 * This pass:
 *   1. Finds each @supports block matching the sentinel condition.
 *   2. Removes matching selectors from the preceding fallback sibling rules.
 *   3. Promotes the modern rules to the @supports parent.
 *   4. Removes the @supports wrapper.
 */
import { readFileSync, writeFileSync } from "node:fs";
import postcss from "postcss";

const SENTINEL_RE =
	/^\s*\(\s*color\s*:\s*color-mix\(\s*in\s+lab\s*,\s*red\s*,\s*red\s*\)\s*\)\s*$/;

// Lightning CSS minifies 6-digit hex to 3-digit. Plugin reviewer flags short hex.
// Expand 3-digit and 4-digit hex back to 6/8 form on declaration values.
const SHORT_HEX_RE = /#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])(?:([0-9a-fA-F]))?(?![0-9a-fA-F])/g;

function expandShortHex(css) {
	const root = postcss.parse(css);
	let expanded = 0;
	root.walkDecls((decl) => {
		if (!decl.value.includes("#")) return;
		const next = decl.value.replace(SHORT_HEX_RE, (match, r, g, b, a) => {
			expanded++;
			return a !== undefined
				? `#${r}${r}${g}${g}${b}${b}${a}${a}`
				: `#${r}${r}${g}${g}${b}${b}`;
		});
		if (next !== decl.value) decl.value = next;
	});
	return { css: root.toString(), expanded };
}

function unwrapColorMixSupports(css) {
	const root = postcss.parse(css);
	let unwrapped = 0;
	let fallbackRulesPruned = 0;
	let fallbackRulesDropped = 0;

	root.walkAtRules("supports", (rule) => {
		if (!SENTINEL_RE.test(rule.params)) return;

		const modernSelectors = new Set();
		rule.walkRules((child) => {
			for (const sel of child.selectors) modernSelectors.add(sel);
		});

		// Walk backwards through siblings; strip matching selectors from fallback rules.
		let prev = rule.prev();
		while (prev && prev.type === "rule") {
			const remaining = prev.selectors.filter((s) => !modernSelectors.has(s));
			const stripped = remaining.length < prev.selectors.length;
			if (remaining.length === 0 && stripped) {
				const toRemove = prev;
				prev = prev.prev();
				toRemove.remove();
				fallbackRulesDropped++;
			} else if (stripped) {
				prev.selectors = remaining;
				prev = prev.prev();
				fallbackRulesPruned++;
			} else {
				break;
			}
		}

		const promoted = [];
		rule.each((child) => promoted.push(child.clone()));
		for (const node of promoted) rule.parent.insertBefore(rule, node);
		rule.remove();
		unwrapped++;
	});

	return {
		css: root.toString(),
		unwrapped,
		fallbackRulesPruned,
		fallbackRulesDropped,
	};
}

const file = process.argv[2];
if (!file) {
	console.error("Usage: css-postprocess.mjs <styles.css>");
	process.exit(1);
}

const input = readFileSync(file, "utf8");
const { css: unwrapped, unwrapped: unwrapCount, fallbackRulesPruned, fallbackRulesDropped } =
	unwrapColorMixSupports(input);
const { css: final, expanded: hexExpanded } = expandShortHex(unwrapped);
writeFileSync(file, final);
const beforeKB = (Buffer.byteLength(input, "utf8") / 1024).toFixed(1);
const afterKB = (Buffer.byteLength(final, "utf8") / 1024).toFixed(1);
console.log(
	`✓ CSS postprocess: unwrapped ${unwrapCount} @supports color-mix blocks, ` +
		`pruned ${fallbackRulesPruned} fallback rules, dropped ${fallbackRulesDropped}, ` +
		`expanded ${hexExpanded} short hex values; ${beforeKB}KB → ${afterKB}KB`,
);
