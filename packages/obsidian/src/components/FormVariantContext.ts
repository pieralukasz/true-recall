import { createContext } from "preact";
import { useContext } from "preact/hooks";

export type FormVariant = "card" | "native";

const FormVariantContext = createContext<FormVariant>("card");

export const FormVariantProvider = FormVariantContext.Provider;

export function useFormVariant(): FormVariant {
	return useContext(FormVariantContext);
}
