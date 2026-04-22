import { LITELLM_URL } from "../../constants";
import type { TrueRecallSettings } from "../../types/settings.types";
import { getVoiceConfig } from "./tts-voice-map";

export interface TTSRequest {
	text: string;
	languageCode: string;
	voice?: string;
	speed?: number;
}

export interface TTSResult {
	audioBuffer: ArrayBuffer;
	contentType: string;
}

interface TTSRequestPayload {
	url: string;
	body: Record<string, unknown>;
	headers: Record<string, string>;
}

/**
 * Resolves the TTS API endpoint and request body.
 * The actual HTTP call must be done by the platform adapter since
 * IHttpClient doesn't support binary responses.
 */
export function buildTTSRequest(
	settings: TrueRecallSettings,
	request: TTSRequest,
): TTSRequestPayload {
	const voiceConfig = getVoiceConfig(request.languageCode);
	const voice = request.voice ?? settings.ttsVoice ?? voiceConfig.voice;
	const speed = request.speed ?? voiceConfig.speed;

	if (!settings.proKey) {
		throw new Error(
			"TTS requires True Recall Pro. Add your Pro key in AI settings.",
		);
	}

	return {
		url: LITELLM_URL.replace("/chat/completions", "/audio/speech"),
		body: {
			model: "tts-1",
			input: request.text,
			voice,
			speed,
			response_format: "mp3",
		},
		headers: {
			Authorization: `Bearer ${settings.proKey}`,
			"Content-Type": "application/json",
			"HTTP-Referer": "obsidian://true-recall",
			"X-Title": "True Recall",
		},
	};
}

/**
 * Generate a deterministic filename for TTS audio based on content + language.
 */
export function getTTSAudioFilename(
	text: string,
	languageCode: string,
): string {
	const input = `${text}:${languageCode}`;
	let hash = 0;
	for (let i = 0; i < input.length; i++) {
		const char = input.charCodeAt(i);
		hash = ((hash << 5) - hash + char) | 0;
	}
	const hex = Math.abs(hash).toString(16).padStart(8, "0");
	return `${hex}.mp3`;
}

export const TTS_AUDIO_DIR = ".true-recall/audio";
