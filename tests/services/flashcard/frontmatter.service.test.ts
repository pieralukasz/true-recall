/**
 * Tests for FrontmatterService.extractProjectsFromFrontmatter
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FrontmatterService } from "../../../src/services/flashcard/frontmatter.service";

// Mock Obsidian App
const mockApp = {
	vault: {
		read: vi.fn(),
		modify: vi.fn(),
	},
} as unknown as Parameters<typeof FrontmatterService>[0]["app"];

describe("FrontmatterService", () => {
	let service: FrontmatterService;

	beforeEach(() => {
		service = new FrontmatterService(mockApp);
	});

	describe("extractProjectsFromFrontmatter", () => {
		it("extracts from array format: projects: [\"A\", \"B\"]", () => {
			const content = `---
projects: ["Project A", "Project B"]
---

Some content here.`;

			const result = service.extractProjectsFromFrontmatter(content);

			expect(result).toEqual(["Project A", "Project B"]);
		});

		it("extracts from array format with single quotes", () => {
			const content = `---
projects: ['Project A', 'Project B']
---

Content`;

			const result = service.extractProjectsFromFrontmatter(content);

			expect(result).toEqual(["Project A", "Project B"]);
		});

		it("extracts from list format: projects:\\n  - A", () => {
			const content = `---
title: My Note
projects:
  - Project A
  - Project B
  - Project C
tags: [test]
---

Content`;

			const result = service.extractProjectsFromFrontmatter(content);

			expect(result).toEqual(["Project A", "Project B", "Project C"]);
		});

		it("strips wiki links: [[Name]] -> Name", () => {
			const content = `---
projects: ["[[My Project]]", "[[Another Project]]"]
---

Content`;

			const result = service.extractProjectsFromFrontmatter(content);

			expect(result).toEqual(["My Project", "Another Project"]);
		});

		it("strips wiki links in list format", () => {
			const content = `---
projects:
  - [[Project One]]
  - [[Project Two]]
---

Content`;

			const result = service.extractProjectsFromFrontmatter(content);

			expect(result).toEqual(["Project One", "Project Two"]);
		});

		it("returns [] for missing field", () => {
			const content = `---
title: My Note
tags: [test]
---

Content without projects.`;

			const result = service.extractProjectsFromFrontmatter(content);

			expect(result).toEqual([]);
		});

		it("returns [] for no frontmatter", () => {
			const content = `# Just a heading

Some content without any frontmatter.`;

			const result = service.extractProjectsFromFrontmatter(content);

			expect(result).toEqual([]);
		});

		it("handles empty array", () => {
			const content = `---
projects: []
---

Content`;

			const result = service.extractProjectsFromFrontmatter(content);

			expect(result).toEqual([]);
		});

		it("handles mixed quotes and wiki links", () => {
			const content = `---
projects: ["Normal", '[[Wiki Link]]', "[[Another Wiki]]"]
---

Content`;

			const result = service.extractProjectsFromFrontmatter(content);

			expect(result).toEqual(["Normal", "Wiki Link", "Another Wiki"]);
		});

		it("handles whitespace in array format", () => {
			const content = `---
projects: [  "Project A"  ,  "Project B"  ]
---

Content`;

			const result = service.extractProjectsFromFrontmatter(content);

			expect(result).toEqual(["Project A", "Project B"]);
		});

		it("handles quoted items in list format", () => {
			const content = `---
projects:
  - "Quoted Project"
  - 'Single Quoted'
  - Unquoted Project
---

Content`;

			const result = service.extractProjectsFromFrontmatter(content);

			expect(result).toEqual(["Quoted Project", "Single Quoted", "Unquoted Project"]);
		});

		it("filters out empty strings", () => {
			const content = `---
projects: ["Project A", "", "Project B", ""]
---

Content`;

			const result = service.extractProjectsFromFrontmatter(content);

			expect(result).toEqual(["Project A", "Project B"]);
		});

		it("handles frontmatter with other fields before and after", () => {
			const content = `---
title: My Note
date: 2024-01-01
projects: ["[[Test Project]]"]
tags: [important]
status: active
---

Content here`;

			const result = service.extractProjectsFromFrontmatter(content);

			expect(result).toEqual(["Test Project"]);
		});
	});
});
