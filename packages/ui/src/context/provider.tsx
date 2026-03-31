import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { TrueRecallContext } from "./context";

const Ctx = createContext<TrueRecallContext>(
	null as unknown as TrueRecallContext,
);

export const TrueRecallProvider = Ctx.Provider;

export function useTrueRecall(): TrueRecallContext {
	const ctx = useContext(Ctx);
	if (!ctx) {
		throw new Error(
			"useTrueRecall() called outside <TrueRecallProvider>. " +
				"Wrap your component tree with a provider.",
		);
	}
	return ctx;
}
