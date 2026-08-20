import type { ComponentChildren, RefObject } from "preact";
import { createContext, createElement } from "preact";
import { useContext, useMemo } from "preact/hooks";

import { useScrollPreservation } from "./useScrollPreservation";

interface PanelScrollApi {
	preserveScroll: (action: () => void) => void;
	captureScroll: () => () => void;
	scrollRef: RefObject<HTMLDivElement>;
}

const PanelScrollContext = createContext<PanelScrollApi | null>(null);

export function PanelScrollProvider({
	children,
}: {
	children: ComponentChildren;
}) {
	const { contentRef, preserveScroll, captureScroll } = useScrollPreservation();
	const value = useMemo(
		() => ({ preserveScroll, captureScroll, scrollRef: contentRef }),
		[preserveScroll, captureScroll, contentRef],
	);

	return createElement(PanelScrollContext.Provider, { value }, children);
}

export function usePanelScroll(): PanelScrollApi {
	const ctx = useContext(PanelScrollContext);
	if (!ctx)
		throw new Error("usePanelScroll must be used within PanelScrollProvider");
	return ctx;
}
