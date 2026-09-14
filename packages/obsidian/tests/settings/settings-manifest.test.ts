import { describe, expect, it } from "vitest";

import manifest from "../../../../manifest.json";
import versions from "../../../../versions.json";

describe("settings API compatibility", () => {
	it("requires Obsidian 1.13 for declarative settings pages", () => {
		expect(manifest.minAppVersion).toBe("1.13.0");
		expect(versions[manifest.version as keyof typeof versions]).toBe(
			manifest.minAppVersion,
		);
	});
});
