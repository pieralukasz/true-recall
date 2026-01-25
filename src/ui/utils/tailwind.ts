/**
 * Utility for combining Tailwind class names
 *
 * Usage:
 *   cn("ep:flex", "ep:gap-2", isActive && "ep:bg-obs-interactive")
 *   cn("ep:text-obs-normal", { "ep:font-bold": isBold })
 */
export function cn(
	...classes: (string | undefined | null | false | Record<string, boolean | undefined>)[]
): string {
	const result: string[] = [];

	for (const cls of classes) {
		if (!cls) continue;

		if (typeof cls === "string") {
			result.push(cls);
		} else if (typeof cls === "object") {
			// Handle object notation: { "class-name": boolean }
			for (const [key, value] of Object.entries(cls)) {
				if (value) {
					result.push(key);
				}
			}
		}
	}

	return result.join(" ");
}

/**
 * Prefixed class name helper for Tailwind v4 with ep: prefix
 *
 * Converts space-separated utility names to prefixed format:
 *   tw("flex gap-2 text-obs-normal") => "ep:flex ep:gap-2 ep:text-obs-normal"
 *
 * Use this when you have many utilities to apply:
 *   className={tw("flex flex-col gap-4 p-4 bg-obs-primary rounded-obs-md")}
 */
export function tw(classes: string): string {
	return classes
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.map((cls) => `ep:${cls}`)
		.join(" ");
}
