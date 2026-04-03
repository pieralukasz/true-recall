import { describe, expect, it } from "vitest";
import { migrateContent } from "../../src/flashcard/lifecycle/migration.service";

describe("migrateContent", () => {
	it("should convert basic :: line to block format", () => {
		const input = "What is X? :: Y";
		const result = migrateContent(input);
		expect(result).toContain("#type/basic");
		expect(result).toContain("Front: What is X?");
		expect(result).toContain("Back: Y");
		expect(result).toContain("---");
	});

	it("should convert cloze :: line to block format", () => {
		const input = "{{c1::Tokyo}} is in Japan :: Geography";
		const result = migrateContent(input);
		expect(result).toContain("#type/cloze");
		expect(result).toContain("Text: {{c1::Tokyo}} is in Japan");
		expect(result).toContain("Extra: Geography");
	});

	it("should convert standalone cloze line", () => {
		const input = "{{c1::Paris}} is the capital of {{c2::France}}";
		const result = migrateContent(input);
		expect(result).toContain("#type/cloze");
		expect(result).toContain(
			"Text: {{c1::Paris}} is the capital of {{c2::France}}",
		);
	});

	it("should return null when no :: lines exist", () => {
		const input = "Just regular text\nNo flashcards here";
		expect(migrateContent(input)).toBeNull();
	});

	it("should preserve YAML frontmatter", () => {
		const input = "---\ntitle: My Note\n---\nWhat is X? :: Y";
		const result = migrateContent(input)!;
		expect(result).toMatch(/^---\ntitle: My Note\n---/);
		expect(result).toContain("#type/basic");
	});

	it("should handle multiple lines", () => {
		const input = "Some text\nQ1 :: A1\nMore text\nQ2 :: A2";
		const result = migrateContent(input)!;
		expect(result).toContain("Front: Q1");
		expect(result).toContain("Front: Q2");
		expect(result).toContain("Some text");
		expect(result).toContain("More text");
	});

	it("should skip lines already in block format", () => {
		const input = "#type/basic\nFront: Q\nBack: A\n---";
		expect(migrateContent(input)).toBeNull();
	});

	it("should handle mixed content: block + inline", () => {
		const input = "#type/basic\nFront: Q1\nBack: A1\n---\nQ2 :: A2";
		const result = migrateContent(input)!;
		expect(result).toContain("Front: Q1");
		expect(result).toContain("Front: Q2");
	});
});
