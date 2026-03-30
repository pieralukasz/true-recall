import { animate } from "motion/mini";
import { spring } from "motion-dom";
import { useEffect, useRef } from "preact/hooks";
/**
 * Imperatively animates new word spans using Motion mini (WAAPI + spring physics).
 * Tracks animated indices in a ref to avoid re-triggering on Preact re-renders.
 * Each word span must have a `data-wi="<index>"` attribute for DOM selection.
 * New words must start with inline `opacity: 0; filter: blur(4px); transform: translateY(4px)`.
 */
export function useWordReveal(containerRef, words) {
    const animatedSet = useRef(new Set());
    // Reset when words drop (new card started — useStreamingText cleared visible count)
    const prevLenRef = useRef(0);
    if (words.length < prevLenRef.current) {
        animatedSet.current.clear();
    }
    prevLenRef.current = words.length;
    useEffect(() => {
        var _a;
        const container = containerRef.current;
        if (!container)
            return;
        const toAnimate = [];
        for (let i = 0; i < words.length; i++) {
            if (((_a = words[i]) === null || _a === void 0 ? void 0 : _a.isNew) && !animatedSet.current.has(i)) {
                animatedSet.current.add(i);
                const el = container.querySelector(`[data-wi="${i}"]`);
                if (el)
                    toAnimate.push(el);
            }
        }
        if (toAnimate.length === 0)
            return;
        // Blur-fade-rise with spring physics + 30ms micro-stagger between batch words
        for (let i = 0; i < toAnimate.length; i++) {
            animate(toAnimate[i], { opacity: 1, filter: "blur(0px)", transform: "translateY(0px)" }, { type: spring, stiffness: 380, damping: 22, delay: i * 0.03 });
        }
    });
}
