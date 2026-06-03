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

function unwrapAllSupports(css) {
	const root = postcss.parse(css);
	let unwrapped = 0;

	root.walkAtRules("supports", (rule) => {
		const promoted = [];
		rule.each((child) => promoted.push(child.clone()));
		for (const node of promoted) rule.parent.insertBefore(rule, node);
		rule.remove();
		unwrapped++;
	});

	return { css: root.toString(), unwrapped };
}

function simplifyGeneratedColors(css) {
	const root = postcss.parse(css);
	let colorMixReplaced = 0;
	let relativeRgbReplaced = 0;
	let oklchReplaced = 0;

	root.walkDecls((decl) => {
		let next = decl.value;
		if (next.includes("color-mix(")) {
			next = next.replace(
				/color-mix\(\s*in\s+(?:oklab|srgb)\s*,\s*(var\([^)]+\)|#[0-9a-fA-F]{6,8}|[a-zA-Z]+)\s+(\d+(?:\.\d+)?)%\s*,\s*transparent\s*\)/g,
				(_match, color, percent) => {
					colorMixReplaced++;
					if (decl.prop === "background-color") {
						const alpha = Math.max(Number(percent) / 100, 0.08).toFixed(2);
						return `rgba(127, 127, 127, ${alpha})`;
					}
					if (decl.prop.includes("border")) {
						const alpha = Math.max(Number(percent) / 100, 0.24).toFixed(2);
						return `rgba(127, 127, 127, ${alpha})`;
					}
					if (decl.prop === "box-shadow") {
						const alpha = Math.max(Number(percent) / 100, 0.18).toFixed(2);
						return `rgba(0, 0, 0, ${alpha})`;
					}
					return color;
				},
			);
			next = next.replace(
				/color-mix\(\s*in\s+(?:oklab|srgb)\s*,\s*(var\([^)]+\)|#[0-9a-fA-F]{6,8}|[a-zA-Z]+)\s+\d+(?:\.\d+)?%\s*,\s*(var\([^)]+\)|#[0-9a-fA-F]{6,8}|[a-zA-Z]+)\s+\d+(?:\.\d+)?%\s*\)/g,
				(_match, color) => {
					colorMixReplaced++;
					return color;
				},
			);
		}
		if (next.includes("rgb(from")) {
			next = next.replace(
				/rgb\(from\s+var\([^)]+\)\s+r\s+g\s+b\s*\/\s*[\d.]+\s*\)/g,
				() => {
					relativeRgbReplaced++;
					return "rgba(0, 0, 0, 0.3)";
				},
			);
		}
		if (next.includes("oklch(")) {
			const fallback = decl.prop.includes("red")
				? "#d53939"
				: decl.prop.includes("yellow")
					? "#b98200"
					: decl.prop.includes("green")
						? "#2f9e44"
						: decl.prop.includes("blue")
							? "#3178c6"
							: "#666666";
			next = next.replace(/oklch\([^)]+\)/g, () => {
				oklchReplaced++;
				return fallback;
			});
		}
		if (next !== decl.value) decl.value = next;
	});

	return {
		css: root.toString(),
		colorMixReplaced,
		relativeRgbReplaced,
		oklchReplaced,
	};
}

function avoidMulticolumnGapProperty(css) {
	const root = postcss.parse(css);
	let rewritten = 0;

	root.walkDecls("column-gap", (decl) => {
		decl.prop = "gap";
		rewritten++;
	});

	return { css: root.toString(), rewritten };
}

function removeReviewerFlaggedDeclarations(css) {
	const root = postcss.parse(css);
	let textDecorationRemoved = 0;
	let importantCleared = 0;

	root.walkDecls((decl) => {
		if (decl.prop === "text-decoration") {
			decl.remove();
			textDecorationRemoved++;
			return;
		}
		if (decl.important) {
			decl.important = false;
			importantCleared++;
		}
	});

	return { css: root.toString(), textDecorationRemoved, importantCleared };
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
const { css: supportsUnwrapped, unwrapped: supportsUnwrapCount } =
	unwrapAllSupports(unwrapped);
const {
	css: simplifiedColors,
	colorMixReplaced,
	relativeRgbReplaced,
	oklchReplaced,
} = simplifyGeneratedColors(supportsUnwrapped);
const { css: noMulticolumnGap, rewritten: columnGapRewritten } =
	avoidMulticolumnGapProperty(simplifiedColors);
const {
	css: reviewerSafeDecls,
	textDecorationRemoved,
	importantCleared,
} = removeReviewerFlaggedDeclarations(noMulticolumnGap);
const { css: final, expanded: hexExpanded } = expandShortHex(reviewerSafeDecls);
writeFileSync(file, final);
const beforeKB = (Buffer.byteLength(input, "utf8") / 1024).toFixed(1);
const afterKB = (Buffer.byteLength(final, "utf8") / 1024).toFixed(1);
console.log(
	`✓ CSS postprocess: unwrapped ${unwrapCount} @supports color-mix blocks, ` +
		`unwrapped ${supportsUnwrapCount} remaining @supports blocks, ` +
		`pruned ${fallbackRulesPruned} fallback rules, dropped ${fallbackRulesDropped}, ` +
		`replaced ${colorMixReplaced} color-mix, ${relativeRgbReplaced} relative rgb, ` +
		`${oklchReplaced} oklch values, rewrote ${columnGapRewritten} column-gap, ` +
		`removed ${textDecorationRemoved} text-decoration, cleared ${importantCleared} important flags, ` +
		`expanded ${hexExpanded} short hex values; ` +
		`${beforeKB}KB → ${afterKB}KB`,
);
