## State Management

### Zustand stores

- Create small, focused stores — one per domain concept (e.g., `useReviewSessionStore`, `useSettingsUIStore`).
- Do not create monolithic stores that mix unrelated state.
- Use selectors to extract only the fields a component needs — avoid subscribing to the entire store.
- Use `persist` middleware only for state that must survive page reloads (user preferences, session tokens). Do not persist ephemeral UI state.
- Keep store actions co-located with the store definition, not scattered across consumers.

### Zustand vs DataLayer

- DataLayer (SQL-backed signals) is the source of truth for card data, review state, and dashboard metrics.
- Zustand is for UI-only state: panel visibility, selected tabs, modal open/close, temporary form values.
- Never duplicate DataLayer data into Zustand. If a component needs card data, use `useQuery` or `getDataLayer().signal()`.

### Runtime validation

- Use Zod schemas for validating external data at system boundaries (API responses, file imports, user settings).
- Infer TypeScript types from Zod schemas (`z.infer<typeof schema>`) instead of maintaining parallel type definitions.
- Keep schemas close to where they are used — in the service or adapter that parses the data.
- For internal data that flows through trusted code paths, TypeScript types alone are sufficient.
