/**
 * Utility for combining Tailwind class names conditionally
 *
 * IMPORTANT: Tailwind scans source files at build time, so class names must be
 * written as complete strings (e.g., "ep:flex" not dynamically generated).
 *
 * Usage:
 *   cn("ep:flex ep:gap-2", isActive && "ep:bg-obs-interactive")
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
