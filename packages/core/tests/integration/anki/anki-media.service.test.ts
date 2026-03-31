import { vi } from "vitest";
import { AnkiMediaService, type IVaultFileReader } from "../../../src/integration/anki/anki-media.service";
import type { IPersistence } from "../../../src/interfaces/persistence";

function createMockPersistence(): IPersistence & { _files: Record<string, ArrayBuffer> } {
	const files: Record<string, ArrayBuffer> = {};
	return {
		exists: vi.fn(async (path: string) => path in files),
		writeBinary: vi.fn(async (path: string, data: ArrayBuffer) => {
			files[path] = data;
		}),
		readBinary: vi.fn(async (path: string) => {
			const data = files[path];
			return data ? new Uint8Array(data) : null;
		}),
		read: vi.fn(async () => ""),
		mkdir: vi.fn(async () => {}),
		list: vi.fn(async () => ({ files: [], folders: [] })),
		remove: vi.fn(async () => {}),
		stat: vi.fn(async () => null),
		_files: files,
	};
}

function createMockFileReader(files: Record<string, ArrayBuffer>): IVaultFileReader {
	return {
		exists: vi.fn(async (path: string) => path in files),
		readBinary: vi.fn(async (path: string) => {
			const data = files[path];
			if (!data) throw new Error(`File not found: ${path}`);
			return data;
		}),
		findByName: vi.fn((filename: string) => {
			for (const path of Object.keys(files)) {
				const basename = path.split("/").pop() ?? path;
				if (basename === filename) return path;
			}
			return null;
		}),
	};
}

describe("AnkiMediaService", () => {
	describe("updateImportedContent", () => {
		let service: AnkiMediaService;

		beforeEach(() => {
			service = new AnkiMediaService(createMockPersistence());
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

		it("handles empty path mapping", () => {
			const pathMapping = new Map<string, string>();
			const content = "Keep ![[image.png]] as is";

			const result = service.updateImportedContent(content, pathMapping);

			expect(result).toBe("Keep ![[image.png]] as is");
		});

		it("handles no media references in content", () => {
			const pathMapping = new Map([["image.png", "media/image.png"]]);
			const content = "Plain text without any media";

			const result = service.updateImportedContent(content, pathMapping);

			expect(result).toBe("Plain text without any media");
		});
	});

	describe("importMedia", () => {
		it("writes files to target folder", async () => {
			const persistence = createMockPersistence();
			const service = new AnkiMediaService(persistence);
			const media = new Map([
				["0", new ArrayBuffer(10)],
				["1", new ArrayBuffer(20)],
			]);
			const mediaMap = { "0": "image.png", "1": "sound.mp3" };

			const result = await service.importMedia(media, mediaMap, "media");

			expect(persistence.writeBinary).toHaveBeenCalledTimes(2);
			expect(result.size).toBe(2);
			expect(result.get("image.png")).toBe("media/image.png");
			expect(result.get("sound.mp3")).toBe("media/sound.mp3");
		});

		it("skips existing files", async () => {
			const persistence = createMockPersistence();
			persistence._files["media/image.png"] = new ArrayBuffer(10);
			const service = new AnkiMediaService(persistence);

			const media = new Map([["0", new ArrayBuffer(10)]]);
			const mediaMap = { "0": "image.png" };

			const result = await service.importMedia(media, mediaMap, "media");

			expect(persistence.writeBinary).not.toHaveBeenCalled();
			expect(result.get("image.png")).toBe("media/image.png");
		});

		it("returns correct path mapping", async () => {
			const persistence = createMockPersistence();
			const service = new AnkiMediaService(persistence);
			const media = new Map([["0", new ArrayBuffer(10)]]);
			const mediaMap = { "0": "image.png" };

			const result = await service.importMedia(media, mediaMap, "anki-media");

			expect(result.get("image.png")).toBe("anki-media/image.png");
		});

		it("skips entries without file data", async () => {
			const persistence = createMockPersistence();
			const service = new AnkiMediaService(persistence);
			const media = new Map<string, ArrayBuffer>(); // empty
			const mediaMap = { "0": "missing.png" };

			const result = await service.importMedia(media, mediaMap, "media");

			expect(result.size).toBe(0);
		});

		it("handles empty mediaMap", async () => {
			const persistence = createMockPersistence();
			const service = new AnkiMediaService(persistence);
			const media = new Map<string, ArrayBuffer>();
			const mediaMap = {};

			const result = await service.importMedia(media, mediaMap, "media");

			expect(result.size).toBe(0);
		});
	});

	describe("collectExportMedia", () => {
		it("extracts media from question and answer", async () => {
			const files: Record<string, ArrayBuffer> = {
				"photo.png": new ArrayBuffer(10),
				"sound.mp3": new ArrayBuffer(20),
			};
			const persistence = createMockPersistence();
			const fileReader = createMockFileReader(files);
			const service = new AnkiMediaService(persistence, fileReader);

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
			const files: Record<string, ArrayBuffer> = {
				"shared.png": new ArrayBuffer(10),
			};
			const persistence = createMockPersistence();
			const fileReader = createMockFileReader(files);
			const service = new AnkiMediaService(persistence, fileReader);

			const cards = [
				{ question: "Q1 ![[shared.png]]", answer: "A1" },
				{ question: "Q2 ![[shared.png]]", answer: "A2 ![[shared.png]]" },
			];

			const result = await service.collectExportMedia(cards);

			expect(Object.keys(result.mediaMap).length).toBe(1);
			expect(result.mediaFiles.size).toBe(1);
		});

		it("assigns numeric keys", async () => {
			const files: Record<string, ArrayBuffer> = {
				"a.png": new ArrayBuffer(5),
				"b.jpg": new ArrayBuffer(5),
			};
			const persistence = createMockPersistence();
			const fileReader = createMockFileReader(files);
			const service = new AnkiMediaService(persistence, fileReader);

			const cards = [{ question: "![[a.png]] ![[b.jpg]]", answer: "" }];

			const result = await service.collectExportMedia(cards);

			expect(result.mediaMap["0"]).toBeDefined();
			expect(result.mediaMap["1"]).toBeDefined();
			expect(result.mediaFiles.has("0")).toBe(true);
			expect(result.mediaFiles.has("1")).toBe(true);
		});

		it("returns empty when no media refs", async () => {
			const persistence = createMockPersistence();
			const service = new AnkiMediaService(persistence);

			const cards = [{ question: "Plain question", answer: "Plain answer" }];

			const result = await service.collectExportMedia(cards);

			expect(result.mediaFiles.size).toBe(0);
			expect(Object.keys(result.mediaMap).length).toBe(0);
		});
	});
});
