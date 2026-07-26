/** Body class that hides the main-window tab bar (see styles.css). */
export const HIDE_TAB_BAR_CLASS = "tr-hide-tab-bar";

/** Reflect the hide-tab-bar preference onto a document body element. */
export function applyTabBarClass(body: HTMLElement, hidden: boolean): void {
	body.classList.toggle(HIDE_TAB_BAR_CLASS, hidden);
}
