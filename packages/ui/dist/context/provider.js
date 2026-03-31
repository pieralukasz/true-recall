import { createContext } from "preact";
import { useContext } from "preact/hooks";
const Ctx = createContext(null);
export const TrueRecallProvider = Ctx.Provider;
export function useTrueRecall() {
    const ctx = useContext(Ctx);
    if (!ctx) {
        throw new Error("useTrueRecall() called outside <TrueRecallProvider>. " +
            "Wrap your component tree with a provider.");
    }
    return ctx;
}
