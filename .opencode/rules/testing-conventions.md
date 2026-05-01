## Testing Conventions

These extend the global testing baseline with repo-specific patterns.

### Mock factories

- Use `createMock*` factory functions (e.g., `createMockFlashcard`, `createMockReviewResult`) instead of inline object literals.
- Factories should accept a partial override object and merge it with sensible defaults.
- Keep factories in `tests/mocks/` co-located with the test layer they serve.
- When a factory grows beyond 5 optional fields, document the defaults.

### Parametrized tests

- Use `it.each` / `test.each` for testing the same behavior across multiple inputs (state transitions, edge cases, boundary values).
- Structure the data table as an array of `[description, input, expected]` tuples.
- Prefer parametrized tests over duplicated test bodies with different values.

### Time-dependent tests

- Always use `vi.useFakeTimers()` in `beforeEach` and `vi.useRealTimers()` in `afterEach`.
- Pin the fake clock to a specific date for reproducibility (`vi.setSystemTime(new Date("2024-01-15T10:00:00Z"))`).
- Never rely on `Date.now()` in assertions without controlling the clock.

### Test file organization

- One `describe` block per public function or behavior group.
- Nest `describe` blocks for distinct scenarios (happy path, error path, edge cases).
- Keep `beforeEach` scoped to the narrowest `describe` that needs it — avoid global setup when only a subset of tests requires it.

### Module mocking

- Mock at module boundaries, not internal functions.
- When mocking a module, mock the minimum surface — prefer partial mocks (`vi.mock` with factory) over blanket `vi.fn()` on every export.
- Clean up mocks in `afterEach` with `vi.restoreAllMocks()` unless the test suite intentionally shares mock state.

### Assertion style

- Prefer specific matchers (`toBe`, `toEqual`, `toContain`) over generic `toBeTruthy` / `toBeFalsy`.
- Assert on the specific field that changed, not the entire object, unless the full shape matters.
- For async operations, use `await expect(promise).resolves` or `.rejects` instead of try-catch.
