import type {
	CardAIExecutor,
	CardAIFieldScope,
	CardFields,
} from "@true-recall/core";

function removeBacklinks(value: string): string {
	return value.replace(
		/(!)?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
		(match, embed: string | undefined, target: string, alias?: string) =>
			embed ? match : (alias ?? target),
	);
}

function shortenAttachmentPaths(value: string): string {
	const wikilinks = value.replace(
		/(!?\[\[)([^\]|]*\/)([^/|\]]+)(\|[^\]]+)?\]\]/g,
		(_match, prefix: string, _folders: string, basename: string, alias = "") =>
			`${prefix}${basename}${alias}]]`,
	);
	return wikilinks.replace(
		/(!?\[[^\]]*\]\()([^)\s]+)(\))/g,
		(match, prefix: string, target: string, suffix: string) => {
			if (!target.includes("/") || /^[a-z][a-z\d+.-]*:/i.test(target)) {
				return match;
			}
			const basename = target.slice(target.lastIndexOf("/") + 1);
			return `${prefix}${basename}${suffix}`;
		},
	);
}

export function runLocalCardTransform(
	executor: Exclude<CardAIExecutor, "ai">,
	fields: CardFields,
	fieldScope: CardAIFieldScope = "all",
): CardFields {
	const transform =
		executor === "remove-backlinks" ? removeBacklinks : shortenAttachmentPaths;
	const names = Object.keys(fields);
	const editable =
		fieldScope === "all"
			? new Set(names)
			: new Set([
					fieldScope === "question" ? names[0] : (names[1] ?? names[0]),
				]);
	return Object.fromEntries(
		Object.entries(fields).map(([name, value]) => [
			name,
			editable.has(name) ? transform(value) : value,
		]),
	);
}
