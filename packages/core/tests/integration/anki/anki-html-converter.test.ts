import {
	decodeHtmlEntities,
	htmlToMarkdown,
} from "../../../src/integration/anki/anki-html-converter";

describe("htmlToMarkdown", () => {
	describe("basic formatting (backward compat)", () => {
		it("converts br tags to newlines", () => {
			expect(htmlToMarkdown("line1<br>line2<br/>line3<br />line4")).toBe(
				"line1\nline2\nline3\nline4",
			);
		});

		it("converts bold tags to markdown", () => {
			expect(htmlToMarkdown("<b>bold</b>")).toBe("**bold**");
			expect(htmlToMarkdown("<strong>strong</strong>")).toBe("**strong**");
		});

		it("converts italic tags to markdown", () => {
			expect(htmlToMarkdown("<i>italic</i>")).toBe("*italic*");
			expect(htmlToMarkdown("<em>emphasis</em>")).toBe("*emphasis*");
		});

		it("converts img tags to obsidian embeds", () => {
			expect(htmlToMarkdown('<img src="photo.jpg">')).toBe("![[photo.jpg]]");
		});

		it("converts sound references to obsidian embeds", () => {
			expect(htmlToMarkdown("[sound:audio.mp3]")).toBe("![[audio.mp3]]");
		});

		it("converts pre tags to code blocks", () => {
			expect(htmlToMarkdown("<pre>const x = 1;</pre>")).toBe(
				"```\nconst x = 1;\n```",
			);
		});

		it("converts code tags to inline code", () => {
			expect(htmlToMarkdown("use <code>forEach</code> method")).toBe(
				"use `forEach` method",
			);
		});

		it("strips div and p tags", () => {
			const result = htmlToMarkdown("<div>inside div</div><p>inside p</p>");
			expect(result).toContain("inside div");
			expect(result).toContain("inside p");
			expect(result).not.toContain("<div>");
			expect(result).not.toContain("<p>");
		});

		it("preserves u tags", () => {
			expect(htmlToMarkdown("<u>underlined</u>")).toBe("<u>underlined</u>");
		});

		it("decodes HTML entities", () => {
			expect(htmlToMarkdown("&amp; &lt; &gt; &nbsp; &quot; &#39;")).toBe(
				"& < >   \" '",
			);
		});

		it("collapses excessive blank lines", () => {
			expect(htmlToMarkdown("line1\n\n\n\n\nline2")).toBe("line1\n\nline2");
		});

		it("trims result", () => {
			expect(htmlToMarkdown("  hello  ")).toBe("hello");
		});

		it("returns empty string for empty input", () => {
			expect(htmlToMarkdown("")).toBe("");
		});

		it("returns plain text unchanged", () => {
			expect(htmlToMarkdown("just text")).toBe("just text");
		});
	});

	describe("math / LaTeX", () => {
		it("converts MathJax inline \\(...\\) to $...$", () => {
			expect(htmlToMarkdown("The equation \\(x^2 + y^2\\) is important")).toBe(
				"The equation $x^2 + y^2$ is important",
			);
		});

		it("converts MathJax display \\[...\\] to $$...$$", () => {
			expect(htmlToMarkdown("\\[E = mc^2\\]")).toBe("$$E = mc^2$$");
		});

		it("converts Anki legacy [latex]...[/latex] to $...$", () => {
			expect(htmlToMarkdown("[latex]\\alpha + \\beta[/latex]")).toBe(
				"$\\alpha + \\beta$",
			);
		});

		it("converts Anki legacy [$]...[/$] to $...$", () => {
			expect(htmlToMarkdown("[$]x^2[/$]")).toBe("$x^2$");
		});

		it("converts Anki legacy [$$]...[/$$] to $$...$$", () => {
			expect(htmlToMarkdown("[$$]\\int_0^1 f(x) dx[/$$]")).toBe(
				"$$\\int_0^1 f(x) dx$$",
			);
		});

		it("passes through existing $...$ unchanged", () => {
			expect(htmlToMarkdown("The value $x$ is positive")).toBe(
				"The value $x$ is positive",
			);
		});

		it("passes through existing $$...$$ unchanged", () => {
			expect(htmlToMarkdown("$$E = mc^2$$")).toBe("$$E = mc^2$$");
		});

		it("protects math content from HTML processing", () => {
			// <br> inside math should NOT be converted to \n
			expect(htmlToMarkdown("\\(x<br>y\\)")).toBe("$x<br>y$");
		});

		it("handles multiple math expressions in one field", () => {
			expect(
				htmlToMarkdown("If \\(a > 0\\) and \\(b > 0\\) then \\(ab > 0\\)"),
			).toBe("If $a > 0$ and $b > 0$ then $ab > 0$");
		});

		it("handles math with HTML entities inside", () => {
			// Entities inside math get decoded after restoration (correct for Obsidian)
			expect(htmlToMarkdown("\\(a &lt; b\\)")).toBe("$a < b$");
		});

		it("handles display math with line breaks inside", () => {
			expect(htmlToMarkdown("\\[a +<br>b = c\\]")).toBe("$$a +<br>b = c$$");
		});
	});

	describe("code blocks", () => {
		it("protects code content from HTML processing", () => {
			expect(htmlToMarkdown("<code>&lt;div&gt;</code>")).toBe("`<div>`");
		});

		it("strips inner tags from pre blocks", () => {
			expect(htmlToMarkdown("<pre><span>const</span> x = 1;</pre>")).toBe(
				"```\nconst x = 1;\n```",
			);
		});

		it("does not decode entities inside code blocks", () => {
			// Entities inside code should remain (they are part of code)
			expect(htmlToMarkdown("<pre>&amp;amp;</pre>")).toBe("```\n&amp;\n```");
		});
	});

	describe("tables", () => {
		it("converts simple table with header", () => {
			const html =
				"<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>";
			const result = htmlToMarkdown(html);
			expect(result).toContain("| A | B |");
			expect(result).toContain("| --- | --- |");
			expect(result).toContain("| 1 | 2 |");
		});

		it("converts table without header", () => {
			const html =
				"<table><tr><td>1</td><td>2</td></tr><tr><td>3</td><td>4</td></tr></table>";
			const result = htmlToMarkdown(html);
			expect(result).toContain("| --- | --- |");
			expect(result).toContain("| 1 | 2 |");
			expect(result).toContain("| 3 | 4 |");
		});

		it("strips HTML from table cells", () => {
			const html =
				"<table><tr><th>Name</th></tr><tr><td><b>bold</b></td></tr></table>";
			const result = htmlToMarkdown(html);
			expect(result).toContain("| bold |");
		});
	});

	describe("lists", () => {
		it("converts unordered list", () => {
			const html = "<ul><li>Item 1</li><li>Item 2</li></ul>";
			const result = htmlToMarkdown(html);
			expect(result).toContain("- Item 1");
			expect(result).toContain("- Item 2");
		});

		it("converts ordered list", () => {
			const html = "<ol><li>First</li><li>Second</li></ol>";
			const result = htmlToMarkdown(html);
			expect(result).toContain("1. First");
			expect(result).toContain("2. Second");
		});

		it("converts nested list", () => {
			const html =
				"<ol><li>First<ul><li>Nested</li></ul></li><li>Second</li></ol>";
			const result = htmlToMarkdown(html);
			expect(result).toContain("1. First");
			expect(result).toContain("  - Nested");
			expect(result).toContain("2. Second");
		});
	});

	describe("links", () => {
		it("converts a tags to markdown links", () => {
			expect(htmlToMarkdown('<a href="https://example.com">Example</a>')).toBe(
				"[Example](https://example.com)",
			);
		});

		it("keeps text from a tags without href", () => {
			expect(htmlToMarkdown("<a>link text</a>")).toBe("link text");
		});
	});

	describe("new elements", () => {
		it("converts hr to horizontal rule", () => {
			const result = htmlToMarkdown("above<hr>below");
			expect(result).toContain("---");
			expect(result).toContain("above");
			expect(result).toContain("below");
		});

		it("preserves sup tags", () => {
			expect(htmlToMarkdown("x<sup>2</sup>")).toBe("x<sup>2</sup>");
		});

		it("preserves sub tags", () => {
			expect(htmlToMarkdown("H<sub>2</sub>O")).toBe("H<sub>2</sub>O");
		});

		it("converts strikethrough s tags", () => {
			expect(htmlToMarkdown("<s>wrong</s>")).toBe("~~wrong~~");
		});

		it("converts strikethrough del tags", () => {
			expect(htmlToMarkdown("<del>deleted</del>")).toBe("~~deleted~~");
		});

		it("converts strikethrough strike tags", () => {
			expect(htmlToMarkdown("<strike>old</strike>")).toBe("~~old~~");
		});
	});

	describe("HTML entities", () => {
		it("decodes common named entities", () => {
			expect(htmlToMarkdown("&mdash;")).toBe("\u2014");
			expect(htmlToMarkdown("&ndash;")).toBe("\u2013");
			expect(htmlToMarkdown("&hellip;")).toBe("\u2026");
			expect(htmlToMarkdown("&copy;")).toBe("\u00A9");
		});

		it("decodes numeric decimal entities", () => {
			expect(htmlToMarkdown("&#169;")).toBe("\u00A9"); // ©
			expect(htmlToMarkdown("&#8212;")).toBe("\u2014"); // —
		});

		it("decodes numeric hex entities", () => {
			expect(htmlToMarkdown("&#x00A9;")).toBe("\u00A9"); // ©
			expect(htmlToMarkdown("&#xA9;")).toBe("\u00A9"); // ©
		});
	});

	describe("edge cases", () => {
		it("handles nested formatting", () => {
			expect(htmlToMarkdown("<b><i>bold italic</i></b>")).toBe(
				"***bold italic***",
			);
		});

		it("handles mixed content", () => {
			const html =
				'<b>Bold</b> and <i>italic</i> with <img src="img.png"> and \\(x^2\\)';
			const result = htmlToMarkdown(html);
			expect(result).toContain("**Bold**");
			expect(result).toContain("*italic*");
			expect(result).toContain("![[img.png]]");
			expect(result).toContain("$x^2$");
		});

		it("handles math adjacent to HTML formatting", () => {
			expect(htmlToMarkdown("<b>\\(x^2\\)</b>")).toBe("**$x^2$**");
		});
	});
});

describe("decodeHtmlEntities", () => {
	it("decodes named entities", () => {
		expect(decodeHtmlEntities("&amp; &lt;")).toBe("& <");
	});

	it("decodes numeric decimal", () => {
		expect(decodeHtmlEntities("&#65;")).toBe("A");
	});

	it("decodes numeric hex", () => {
		expect(decodeHtmlEntities("&#x41;")).toBe("A");
	});

	it("leaves unknown entities unchanged", () => {
		expect(decodeHtmlEntities("&unknown;")).toBe("&unknown;");
	});
});
