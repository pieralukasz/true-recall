import { vi } from "vitest";
import { AnkiMediaService } from "../../../src/features/integration/services/anki/anki-media.service";

function createMockApp(): any {
	const files: Record<string, ArrayBuffer> = {};
	return {
		vault: {
			adapter: {
				exists: vi.fn(async (path: string) => path in files),
				writeBinary: vi.fn(async (path: string, data: ArrayBuffer) => {
					files[path] = data;
				}),
				readBinary: vi.fn(
					async (path: string) => files[path] ?? new ArrayBuffer(0),
				),
				mkdir: vi.fn(async () => {}),
			},
			getFiles: vi.fn(() => []),
		},
		_files: files,
	};
}

describe("AnkiMediaService", () => {
	describe("updateImportedContent", () => {
		let service: AnkiMediaService;

		beforeEach(() => {
			service = new AnkiMediaService(createMockApp());
		});

		it("replaces media reference with vault path", () => {
			const pathMapping = new Map([["image.png", "anki-media/image.png"]]);
			const content = "Here is ![[image.png]] in text";

			const result = service.updateImportedContent(content, pathMapping);

			expect(result).toBe("Here is ![[anki-media/image.png]] in text");
		});

		it("handles multiple media references", () => {
			const pathMapping = new Map([
				["photo.jpg", "media/photo.jpg"],
				["audio.mp3", "media/audio.mp3"],
			]);
			const content = "Image: ![[photo.jpg]] and sound: ![[audio.mp3]]";

			const result = service.updateImportedContent(content, pathMapping);

			expect(result).toBe(
				"Image: ![[media/photo.jpg]] and sound: ![[media/audio.mp3]]",
			);
		});

		it("skips replacement when name equals path", () => {
			const pathMapping = new Map([["image.png", "image.png"]]);
			const content = "Here is ![[image.png]] unchanged";

			const result = service.updateImportedContent(content, pathMapping);

			expect(result).toBe("Here is ![[image.png]] unchanged");
		});

		it("returns unchanged content when pathMapping empty", () => {
			const pathMapping = new Map<string, string>();
			const content = "No media ![[something.png]] here";

			const result = service.updateImportedContent(content, pathMapping);

			expect(result).toBe("No media ![[something.png]] here");
		});

		it("handles content with no media references", () => {
			const pathMapping = new Map([["image.png", "media/image.png"]]);
			const content = "Plain text without any embeds";

			const result = service.updateImportedContent(content, pathMapping);

			expect(result).toBe("Plain text without any embeds");
		});
	});

	describe("convertContentForExport", () => {
		let service: AnkiMediaService;

		beforeEach(() => {
			service = new AnkiMediaService(createMockApp());
		});

		it("converts image embed to img tag", () => {
			const result = service.convertContentForExport("Look at ![[photo.png]]");

			expect(result).toBe('Look at <img src="photo.png">');
		});

		it("converts image with subfolder path (uses basename)", () => {
			const result = service.convertContentForExport(
				"![[assets/images/photo.jpg]]",
			);

			expect(result).toBe('<img src="photo.jpg">');
		});

		it("converts audio embed to sound reference", () => {
			const result = service.convertContentForExport("Listen: ![[word.mp3]]");

			expect(result).toBe("Listen: [sound:word.mp3]");
		});

		it("converts audio with subfolder path", () => {
			const result = service.convertContentForExport(
				"![[audio/files/pronunciation.ogg]]",
			);

			expect(result).toBe("[sound:pronunciation.ogg]");
		});

		it("handles size syntax ![[file.png|400]]", () => {
			const result = service.convertContentForExport("![[diagram.png|400]]");

			expect(result).toBe('<img src="diagram.png">');
		});

		it("handles mixed image and audio", () => {
			const content = "Image: ![[photo.png]] and audio: ![[sound.mp3]]";

			const result = service.convertContentForExport(content);

			expect(result).toBe(
				'Image: <img src="photo.png"> and audio: [sound:sound.mp3]',
			);
		});

		it("leaves non-embed content unchanged", () => {
			const content = "Just [[a link]] and some text";

			const result = service.convertContentForExport(content);

			expect(result).toBe("Just [[a link]] and some text");
		});

		it("leaves text-only content unchanged", () => {
			const content = "No embeds here, just plain text.";

			const result = service.convertContentForExport(content);

			expect(result).toBe("No embeds here, just plain text.");
		});

		it("handles all image extensions", () => {
			const extensions = [
				"png",
				"jpg",
				"jpeg",
				"gif",
				"bmp",
				"svg",
				"webp",
				"ico",
				"tif",
				"tiff",
			];
			for (const ext of extensions) {
				const result = service.convertContentForExport(`![[file.${ext}]]`);
				expect(result).toBe(`<img src="file.${ext}">`);
			}
		});

		it("handles all audio extensions", () => {
			const extensions = [
				"mp3",
				"ogg",
				"wav",
				"m4a",
				"flac",
				"aac",
				"wma",
				"opus",
			];
			for (const ext of extensions) {
				const result = service.convertContentForExport(`![[file.${ext}]]`);
				expect(result).toBe(`[sound:file.${ext}]`);
			}
		});
	});

	describe("importMedia", () => {
		it("writes files to target folder", async () => {
			const app = createMockApp();
			const service = new AnkiMediaService(app);

			const media = new Map([["0", new ArrayBuffer(8)]]);
			const mediaMap: Record<string, string> = { "0": "photo.png" };

			await service.importMedia(media, mediaMap, "anki-media");

			expect(app.vault.adapter.writeBinary).toHaveBeenCalledWith(
				"anki-media/photo.png",
				expect.any(ArrayBuffer),
			);
		});

		it("skips existing files", async () => {
			const app = createMockApp();
			// Pre-populate the file so exists returns true
			app._files["anki-media/photo.png"] = new ArrayBuffer(4);
			const service = new AnkiMediaService(app);

			const media = new Map([["0", new ArrayBuffer(8)]]);
			const mediaMap: Record<string, string> = { "0": "photo.png" };

			await service.importMedia(media, mediaMap, "anki-media");

			expect(app.vault.adapter.writeBinary).not.toHaveBeenCalled();
		});

		it("returns correct path mapping", async () => {
			const app = createMockApp();
			const service = new AnkiMediaService(app);

			const media = new Map([
				["0", new ArrayBuffer(8)],
				["1", new ArrayBuffer(16)],
			]);
			const mediaMap: Record<string, string> = {
				"0": "photo.png",
				"1": "audio.mp3",
			};

			const result = await service.importMedia(media, mediaMap, "media-folder");

			expect(result.get("photo.png")).toBe("media-folder/photo.png");
			expect(result.get("audio.mp3")).toBe("media-folder/audio.mp3");
			expect(result.size).toBe(2);
		});

		it("skips entries without file data", async () => {
			const app = createMockApp();
			const service = new AnkiMediaService(app);

			const media = new Map<string, ArrayBuffer>();
			const mediaMap: Record<string, string> = { "0": "missing.png" };

			const result = await service.importMedia(media, mediaMap, "media");

			expect(result.size).toBe(0);
			expect(app.vault.adapter.writeBinary).not.toHaveBeenCalled();
		});

		it("handles empty mediaMap", async () => {
			const app = createMockApp();
			const service = new AnkiMediaService(app);

			const media = new Map([["0", new ArrayBuffer(8)]]);
			const mediaMap: Record<string, string> = {};

			const result = await service.importMedia(media, mediaMap, "media");

			expect(result.size).toBe(0);
		});
	});

	describe("collectExportMedia", () => {
		it("extracts media from question and answer", async () => {
			const app = createMockApp();
			// Pre-populate vault file so readVaultFile succeeds
			app._files["photo.png"] = new ArrayBuffer(10);
			app._files["sound.mp3"] = new ArrayBuffer(20);
			const service = new AnkiMediaService(app);

			const cards = [
				{ question: "Q: ![[photo.png]]", answer: "A: ![[sound.mp3]]" },
			];

			const result = await service.collectExportMedia(cards);

			expect(Object.keys(result.mediaMap).length).toBe(2);
			expect(result.mediaFiles.size).toBe(2);

			const filenames = Object.values(result.mediaMap);
			expect(filenames).toContain("photo.png");
			expect(filenames).toContain("sound.mp3");
		});

		it("deduplicates across cards", async () => {
			const app = createMockApp();
			app._files["shared.png"] = new ArrayBuffer(10);
			const service = new AnkiMediaService(app);

			const cards = [
				{ question: "Q1 ![[shared.png]]", answer: "A1" },
				{ question: "Q2 ![[shared.png]]", answer: "A2 ![[shared.png]]" },
			];

			const result = await service.collectExportMedia(cards);

			expect(Object.keys(result.mediaMap).length).toBe(1);
			expect(result.mediaFiles.size).toBe(1);
		});

		it("assigns numeric keys", async () => {
			const app = createMockApp();
			app._files["a.png"] = new ArrayBuffer(5);
			app._files["b.jpg"] = new ArrayBuffer(5);
			const service = new AnkiMediaService(app);

			const cards = [{ question: "![[a.png]] ![[b.jpg]]", answer: "" }];

			const result = await service.collectExportMedia(cards);

			expect(result.mediaMap["0"]).toBeDefined();
			expect(result.mediaMap["1"]).toBeDefined();
			expect(result.mediaFiles.has("0")).toBe(true);
			expect(result.mediaFiles.has("1")).toBe(true);
		});

		it("returns empty when no media refs", async () => {
			const app = createMockApp();
			const service = new AnkiMediaService(app);

			const cards = [{ question: "Plain question", answer: "Plain answer" }];

			const result = await service.collectExportMedia(cards);

			expect(result.mediaFiles.size).toBe(0);
			expect(Object.keys(result.mediaMap).length).toBe(0);
		});
	});
});
