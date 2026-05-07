---
title: Use Ternary, Not && for Conditional Rendering
impact: MEDIUM
impactDescription: prevents accidental rendering of "0" or "NaN" in the DOM
tags: preact, jsx, conditional-rendering, ternary, anti-pattern
---

## Use Ternary, Not && for Conditional Rendering

The `&&` operator returns the left operand when it is falsy — meaning if it is `0` or `NaN`, Preact will render that number literally in the DOM. Ternary (`? :`) always evaluates to one of two explicit values and is immune to this class of bug.

**Incorrect (&& with numeric condition renders "0"):**

```tsx
function MessageList({ messages }: { messages: Message[] }) {
  return (
    <div>
      {/* ❌ When messages.length is 0, renders literal "0" in the DOM */}
      {messages.length && <List items={messages} />}

      {/* ❌ NaN renders as "NaN" */}
      {unreadCount && <Badge count={unreadCount} />}
    </div>
  )
}
```

**Correct (ternary returns null for the falsy branch):**

```tsx
function MessageList({ messages }: { messages: Message[] }) {
  return (
    <div>
      {/* ✅ Renders null (nothing) when empty */}
      {messages.length > 0 ? <List items={messages} /> : null}

      {/* ✅ Explicit boolean guard */}
      {unreadCount > 0 ? <Badge count={unreadCount} /> : null}
    </div>
  )
}
```

**When && is safe:** Only when the left operand is a guaranteed boolean expression:

```tsx
{/* ✅ Safe — typeof comparison always returns boolean */}
{isLoggedIn && <UserMenu />}

{/* ✅ Safe — Boolean() cast */}
{Boolean(items.length) && <ItemList items={items} />}
```

**Prefer converting to boolean explicitly when the source is numeric:**

```tsx
const hasMessages = messages.length > 0
return hasMessages ? <List items={messages} /> : null
```

Reference: [JSX — Preact Guide](https://preactjs.com/guide/v10/components/)
