## UI Component Patterns

### Composition

- Prefer composition over conditional rendering. Break complex UIs into small, focused components instead of large components with many branches.
- Use children and render props over config objects when the caller controls layout.
- Keep component files under 150 lines. If a component needs more, extract sub-components into the same directory.

### Props

- Extend native element attributes when wrapping HTML elements (`extends JSX.HTMLAttributes<HTMLDivElement>`).
- Use `Omit` and `Pick` to compose props from existing types instead of redefining fields.
- Destructure props with defaults in the function signature.
- Do not spread unfiltered props onto DOM elements — pick known attributes explicitly.

### Variants

- When a component has 3+ visual variants, use a variant map object instead of inline ternaries.
- Variant keys should be string literals, not booleans, for readability and extensibility.
- Use `cn()` or equivalent for conditional class merging — never manual string concatenation.

### Hooks in components

- Extract side effects and derived state into custom hooks when they obscure the component's render logic.
- Name hooks after what they provide (`useCardState`, `useReviewTimer`), not what they do internally.
- Keep hook return values minimal — return only what the consumer uses.

### Signals and reactivity (Preact-specific)

- Use signals for shared reactive state that multiple components observe.
- Do not mix signals and `useState` for the same piece of state.
- Keep signal derivations simple — complex transformations should live in computed signals or derived functions.
