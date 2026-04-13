interface VoiceConfig {
	voice: string;
	speed: number;
}

const LANGUAGE_VOICE_DEFAULTS: Record<string, VoiceConfig> = {
	en: { voice: "nova", speed: 1.0 },
	es: { voice: "nova", speed: 0.9 },
	fr: { voice: "nova", speed: 0.9 },
	de: { voice: "nova", speed: 0.9 },
	it: { voice: "nova", speed: 0.9 },
	pt: { voice: "nova", speed: 0.9 },
	ja: { voice: "nova", speed: 0.85 },
	ko: { voice: "nova", speed: 0.85 },
	"zh-CN": { voice: "nova", speed: 0.85 },
	"zh-TW": { voice: "nova", speed: 0.85 },
	ru: { voice: "nova", speed: 0.9 },
	pl: { voice: "nova", speed: 0.9 },
	ar: { voice: "onyx", speed: 0.85 },
	hi: { voice: "nova", speed: 0.9 },
};

const DEFAULT_VOICE_CONFIG: VoiceConfig = { voice: "nova", speed: 0.9 };

export function getVoiceConfig(languageCode: string): VoiceConfig {
	return LANGUAGE_VOICE_DEFAULTS[languageCode] ?? DEFAULT_VOICE_CONFIG;
}
