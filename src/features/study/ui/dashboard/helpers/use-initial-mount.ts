import { useEffect, useRef } from "preact/hooks";

// true during the synchronous first render, false after useEffect fires.
// Lets virtual list items animate on mount without re-animating on scroll.
export function useInitialMount(): { readonly current: boolean } {
	const ref = useRef(true);
	useEffect(() => {
		ref.current = false;
	}, []);
	return ref;
}
