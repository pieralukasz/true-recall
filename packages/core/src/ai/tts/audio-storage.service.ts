import type { IPersistence } from "../../interfaces/persistence";
import { getTTSAudioFilename, TTS_AUDIO_DIR } from "./tts.service";

export class AudioStorageService {
	constructor(private persistence: IPersistence) {}

	getAudioPath(text: string, languageCode: string): string {
		const filename = getTTSAudioFilename(text, languageCode);
		return `${TTS_AUDIO_DIR}/${filename}`;
	}

	async audioExists(text: string, languageCode: string): Promise<boolean> {
		const path = this.getAudioPath(text, languageCode);
		return this.persistence.exists(path);
	}

	async saveAudio(
		audioBuffer: ArrayBuffer,
		text: string,
		languageCode: string,
	): Promise<string> {
		const path = this.getAudioPath(text, languageCode);
		await this.persistence.mkdir(TTS_AUDIO_DIR);
		await this.persistence.writeBinary(path, audioBuffer);
		return path;
	}

	async loadAudio(
		text: string,
		languageCode: string,
	): Promise<Uint8Array | null> {
		const path = this.getAudioPath(text, languageCode);
		const hasFile = await this.persistence.exists(path);
		if (!hasFile) return null;
		return this.persistence.readBinary(path);
	}
}
