import { useCallback, useEffect, useRef } from "preact/hooks";

/**
 * Returns a debounced version of the given function.
 * The timer is automatically cleared on unmount.
 */
export function useDebounce<T extends (...args: never[]) => void>(
	fn: T,
	delay: number,
): (...args: Parameters<T>) => void {
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const fnRef = useRef(fn);
	fnRef.current = fn;

	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);

	return useCallback(
		(...args: Parameters<T>) => {
			if (timerRef.current) clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => {
				fnRef.current(...args);
				timerRef.current = null;
			}, delay);
		},
		[delay],
	);
}
