import { LITELLM_URL } from "../../constants";
import type { TrueRecallSettings } from "../../types/settings.types";
import { OPENROUTER_URL } from "../clients/openrouter-client";
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

	const isPro = !!settings.proKey;
	const apiKey = isPro ? settings.proKey : settings.openRouterApiKey;
	const baseUrl = isPro
		? LITELLM_URL.replace("/chat/completions", "/audio/speech")
		: OPENROUTER_URL.replace("/chat/completions", "/audio/speech");

	if (!apiKey) {
		throw new Error(
			"No AI key configured. Add your Pro key or OpenRouter API key in settings.",
		);
	}

	return {
		url: baseUrl,
		body: {
			model: isPro ? "tts-1" : "openai/tts-1",
			input: request.text,
			voice,
			speed,
			response_format: "mp3",
		},
		headers: {
			Authorization: `Bearer ${apiKey}`,
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
