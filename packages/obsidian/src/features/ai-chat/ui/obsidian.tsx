/** @jsxImportSource react */
import {
	MarkdownRenderer,
	Component as ObsidianComponent,
	setIcon,
} from "obsidian";
import {
	createContext,
	memo,
	useContext,
	useEffect,
	useRef,
	useSyncExternalStore,
} from "react";

import type TrueRecallPlugin from "../../../main";
import type { AiChatController, ChatSession } from "../chat-controller";

export const PluginContext = createContext<TrueRecallPlugin | null>(null);

export function usePlugin(): TrueRecallPlugin {
	const plugin = useContext(PluginContext);
	if (!plugin) throw new Error("PluginContext missing");
	return plugin;
}

export const ControllerContext = createContext<AiChatController | null>(null);

/** The chat controller; re-renders when any chat changes. */
export function useController(): AiChatController {
	const controller = useContext(ControllerContext);
	if (!controller) throw new Error("ControllerContext missing");
	useSyncExternalStore(controller.subscribe, controller.getVersion);
	return controller;
}

export const SessionContext = createContext<ChatSession | null>(null);

export function useSession(): ChatSession {
	const session = useContext(SessionContext);
	if (!session) throw new Error("SessionContext missing");
	return session;
}

/** Obsidian's own Markdown renderer, so bold, math and wikilinks look like the vault. */
export const ObsidianMarkdown = memo(function ObsidianMarkdown({
	markdown,
	className,
}: {
	markdown: string;
	className?: string;
}) {
	const plugin = usePlugin();
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.empty();
		const owner = new ObsidianComponent();
		owner.load();
		void MarkdownRenderer.render(plugin.app, markdown, el, "", owner);
		return () => owner.unload();
	}, [markdown, plugin]);
	return <div ref={ref} className={`tr-ai-chat__md ${className ?? ""}`} />;
});

/** A Lucide icon from Obsidian's own set. */
export function Icon({
	name,
	className,
}: {
	name: string;
	className?: string;
}) {
	const ref = useRef<HTMLSpanElement>(null);
	useEffect(() => {
		if (ref.current) setIcon(ref.current, name);
	}, [name]);
	return (
		<span
			ref={ref}
			aria-hidden="true"
			className={`tr-ai-chat__icon ${className ?? ""}`}
		/>
	);
}
