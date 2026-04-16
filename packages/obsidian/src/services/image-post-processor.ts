import type { App } from "obsidian";
import { requestUrl } from "obsidian";

import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";
import type { TrueRecallSettings } from "@true-recall/core/types/settings.types";

import { mutate } from "@true-recall/obsidian/data";

const IMAGE_DIR = ".true-recall/images";

const ALLOWED_IMAGE_HOSTS = new Set([
	"oaidalleapiprodscus.blob.core.windows.net", // OpenAI DALL-E
	"replicate.delivery", // Replicate
	"cdn.openai.com", // OpenAI CDN
	"storage.googleapis.com", // Google AI storage
	"fal.media", // Fal.ai
	"d3phaj0sfxyh6p.cloudfront.net", // OpenAI dev CDN
]);

function isAllowedImageUrl(url: string): boolean {
	try {
		const parsed = new URL(url);
		if (parsed.protocol !== "https:") return false;
		return ALLOWED_IMAGE_HOSTS.has(parsed.hostname);
	} catch {
		return false;
	}
}

type VaultAdapter = App["vault"]["adapter"];

export interface ImageFieldConfig {
	fieldName: string;
	sourceField: string;
	style?: string;
}

export class ImagePostProcessor {
	constructor(
		private app: App,
		private getSettings: () => TrueRecallSettings,
		private cardStore: SqliteStoreService,
	) {}

	async processCards(
		cardIds: string[],
		fields: ImageFieldConfig[],
	): Promise<void> {
		if (fields.length === 0) return;

		const adapter = this.app.vault.adapter;
		if (!(await adapter.exists(IMAGE_DIR))) {
			await adapter.mkdir(IMAGE_DIR);
		}

		let updated = false;
		for (const cardId of cardIds) {
			for (const field of fields) {
				try {
					const didUpdate = await this.processCardField(cardId, field, adapter);
					if (didUpdate) updated = true;
				} catch (e) {
					console.warn(
						`[True Recall Image] Failed for card ${cardId}, field ${field.fieldName}:`,
						e,
					);
				}
			}
		}

		if (updated) {
			mutate("card:updated", () => {});
		}
	}

	private async processCardField(
		cardId: string,
		field: ImageFieldConfig,
		adapter: VaultAdapter,
	): Promise<boolean> {
		const card = this.cardStore.cards.get(cardId);
		if (!card?.noteId) return false;

		const note = this.cardStore.notes.getById(card.noteId);
		if (!note?.fields) return false;

		const sourceText = note.fields[field.sourceField];
		if (!sourceText) return false;

		if (note.fields[field.fieldName]) return false;

		const settings = this.getSettings();
		const apiKey = settings.openRouterApiKey;
		if (!apiKey) return false;

		const prompt = field.style
			? `${sourceText}. Style: ${field.style}. No text, no words, no letters.`
			: `${sourceText}. Simple, clear illustration. No text, no words, no letters.`;

		const hash = this.hashText(`${sourceText}:${field.style ?? ""}`);
		const imagePath = `${IMAGE_DIR}/${hash}.png`;

		if (await adapter.exists(imagePath)) {
			this.updateNoteField(
				note.id,
				note.fields,
				field.fieldName,
				`![[${imagePath}]]`,
			);
			return true;
		}

		const response = await requestUrl({
			url: "https://openrouter.ai/api/v1/images/generations",
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: "openai/dall-e-3",
				prompt,
				n: 1,
				size: "1024x1024",
			}),
		});

		if (response.status !== 200) {
			throw new Error(`Image API returned ${response.status}`);
		}

		const data = response.json;
		const imageUrl = data?.data?.[0]?.url;
		if (!imageUrl) throw new Error("No image URL in response");
		if (!isAllowedImageUrl(imageUrl)) {
			throw new Error(
				`Image URL not from an allowed host: ${new URL(imageUrl).hostname}`,
			);
		}

		const imageResponse = await requestUrl({ url: imageUrl });
		await adapter.writeBinary(imagePath, imageResponse.arrayBuffer);

		this.updateNoteField(
			note.id,
			note.fields,
			field.fieldName,
			`![[${imagePath}]]`,
		);
		return true;
	}

	private updateNoteField(
		noteId: string,
		currentFields: Record<string, string>,
		fieldName: string,
		value: string,
	): void {
		const updatedFields = { ...currentFields, [fieldName]: value };
		this.cardStore.notes.update(noteId, { fields: updatedFields });
	}

	private hashText(text: string): string {
		let hash = 0;
		for (let i = 0; i < text.length; i++) {
			const char = text.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash |= 0;
		}
		return Math.abs(hash).toString(36);
	}
}
