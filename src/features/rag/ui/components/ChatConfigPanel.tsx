import type { ChatConfig, ChatResponseLength } from "@shared/types";
import { Clickable, TextAreaInput } from "@shared/ui/components";
import { usePlugin } from "@shared/ui/preact";
import { useCallback, useRef, useState } from "preact/hooks";
import { CHAT_PRESETS } from "../chat-config-presets";

const LENGTHS: { value: ChatResponseLength; label: string }[] = [
	{ value: "short", label: "Short" },
	{ value: "medium", label: "Medium" },
	{ value: "detailed", label: "Detailed" },
];

interface Props {
	config: ChatConfig;
	onConfigChange: (config: ChatConfig) => void;
}

export function ChatConfigPanel({ config, onConfigChange }: Props) {
	const plugin = usePlugin();
	const [local, setLocal] = useState(config);
	const saveTimer = useRef<ReturnType<typeof setTimeout>>();

	const persist = useCallback(
		(next: ChatConfig) => {
			setLocal(next);
			clearTimeout(saveTimer.current);
			saveTimer.current = setTimeout(() => {
				Object.assign(plugin.settings, { ragChatConfig: next });
				void plugin.saveSettings();
				onConfigChange(next);
			}, 400);
		},
		[plugin, onConfigChange],
	);

	const handlePreset = useCallback(
		(presetId: string) => {
			const preset = CHAT_PRESETS.find((p) => p.id === presetId);
			if (!preset) return;
			persist({
				presetId: preset.id,
				customInstruction: preset.instruction,
				responseLength: preset.responseLength,
			});
		},
		[persist],
	);

	const handleInstruction = useCallback(
		(value: string) => {
			persist({ ...local, customInstruction: value, presetId: "custom" });
		},
		[local, persist],
	);

	const handleLength = useCallback(
		(value: ChatResponseLength) => {
			persist({ ...local, responseLength: value, presetId: "custom" });
		},
		[local, persist],
	);

	return (
		<div class="ep:border-b ep:border-obs-border ep:px-2 ep:py-3 ep:flex ep:flex-col ep:gap-3">
			<div class="ep:flex ep:flex-wrap ep:gap-1.5">
				{CHAT_PRESETS.map((preset) => (
					<Clickable
						key={preset.id}
						class={`ep:text-xs ep:px-2.5 ep:py-1 ep:rounded-lg ep:border ep:transition-colors ${
							local.presetId === preset.id
								? "ep:border-obs-accent ep:text-obs-accent ep:bg-obs-accent/10"
								: "ep:border-obs-border ep:text-obs-muted ep:hover:border-obs-interactive ep:hover:text-obs-normal"
						}`}
						onClick={() => handlePreset(preset.id)}
					>
						{preset.label}
					</Clickable>
				))}
			</div>

			<TextAreaInput
				value={local.customInstruction}
				onChange={handleInstruction}
				placeholder="Define your conversational goal, style, or role..."
				rows={2}
				class="!ep:text-xs"
			/>

			<div>
				<div class="ep:text-xs ep:text-obs-muted ep:mb-1.5">
					Response length
				</div>
				<div class="ep:flex ep:rounded-lg ep:border ep:border-obs-border ep:overflow-hidden">
					{LENGTHS.map((opt) => (
						<Clickable
							key={opt.value}
							class={`ep:flex-1 ep:text-center ep:text-xs ep:py-1.5 ep:transition-colors ${
								local.responseLength === opt.value
									? "ep:bg-obs-accent/15 ep:text-obs-accent ep:font-medium"
									: "ep:text-obs-muted ep:hover:text-obs-normal ep:hover:bg-obs-secondary"
							}`}
							onClick={() => handleLength(opt.value)}
						>
							{opt.label}
						</Clickable>
					))}
				</div>
			</div>
		</div>
	);
}
