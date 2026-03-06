# True Recall AI Subscription

The **True Recall AI Subscription** provides hassle-free access to AI features without managing API keys.

## What's Included

| Feature | Free | Subscription |
|---------|------|--------------|
| Basic flashcard creation | ✅ | ✅ |
| Manual review | ✅ | ✅ |
| AI flashcard generation | ❌ | ✅ |
| AI answer grading | ❌ | ✅ |
| AI image occlusion detection | ❌ | ✅ |
| Natural language queries | ❌ | ✅ |
| Priority support | ❌ | ✅ |

## Subscribing

1. Visit [truerecall.app](https://truerecall.app)
2. Create an account
3. Choose a subscription plan
4. Complete payment
5. Copy your subscription key

## Activating Your Subscription

1. Open Obsidian Settings
2. Go to True Recall → AI
3. Find "Subscription key" field
4. Paste your key (format: `tr-xxxxxxxxxxxx`)
5. Status updates automatically

## Subscription Status

After activating, you'll see:

```
┌─────────────────────────────────────────┐
│  True Recall AI                         │
│                                         │
│  Status: Active ✓                       │
│  Tier: Pro                              │
│  Generations remaining: ~450            │
│  [████████████░░░░░░░░] 75%             │
│                                         │
│  Renews: March 15, 2024                 │
└─────────────────────────────────────────┘
```

### Status Information

| Field | Description |
|-------|-------------|
| Status | Active, Expired, or Invalid |
| Tier | Your subscription level |
| Generations remaining | Approximate AI generations left |
| Usage bar | Current billing period usage |
| Renews | Next billing date |

## Generation Limits

Each AI operation uses "generations":

| Operation | Generations Used |
|-----------|------------------|
| Generate flashcards (small selection) | 1 |
| Generate flashcards (large selection) | 2-3 |
| AI answer grading | 0.1 |
| Image occlusion detection | 2 |
| Natural language query | 0.5 |

### Approximate Monthly Allowance

| Tier | Generations/Month |
|------|-------------------|
| Basic | 500 |
| Pro | 2000 |
| Unlimited | Unlimited |

*Actual numbers may vary by plan*

## Using Your Own API Key

If you have both a subscription and an API key:

1. Subscription is used first
2. API key is fallback if subscription exhausted
3. Configure in Settings → AI → API key

This provides seamless operation even if you exceed your subscription limit.

## Managing Your Subscription

### View Usage

1. Log in to [truerecall.app](https://truerecall.app)
2. Go to Dashboard
3. See detailed usage statistics

### Upgrade/Downgrade

1. Log in to [truerecall.app](https://truerecall.app)
2. Go to Subscription
3. Select new plan
4. Changes apply immediately

### Cancel

1. Log in to [truerecall.app](https://truerecall.app)
2. Go to Subscription
3. Click Cancel
4. Access continues until period ends

## Troubleshooting

### "Invalid subscription key"

1. Check key format: `tr-xxxxxxxxxxxx`
2. Copy the full key (no spaces)
3. Verify subscription is active on website

### "Subscription expired"

1. Check billing status on website
2. Update payment method if needed
3. Renew subscription

### "Generations exceeded"

1. Wait for next billing period
2. Or add API key as fallback
3. Or upgrade plan

### Key Not Working

1. Ensure no extra spaces
2. Try logging out and back in on website
3. Generate a new key from dashboard
4. Contact support if issue persists

## FAQ

### Can I use True Recall without a subscription?

Yes! All core features (flashcard creation, review, statistics) work without AI. Subscription only enables AI-powered features.

### What happens if I exceed my limit?

- With API key fallback: Continues using your API key
- Without fallback: AI features stop working until renewal

### Is my data used for training?

No. Your flashcard content is never used to train AI models. See our privacy policy for details.

### Can I share my subscription?

Subscriptions are for individual use. Sharing violates terms of service.

### How do refunds work?

Contact support within 7 days of purchase for a full refund.

## Related Topics

- [AI Flashcard Generation](./flashcard-generation.md) — Using AI generation
- [AI Answer Grading](./answer-grading.md) — AI grading feature
- [AI Settings](../configuration/ai-settings.md) — Configuration options
