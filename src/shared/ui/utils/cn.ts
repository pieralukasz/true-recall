import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]): string {
	return clsx(inputs);
}
