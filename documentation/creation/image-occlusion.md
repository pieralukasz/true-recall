# Image Occlusion

**Image Occlusion** lets you create flashcards from images by hiding specific regions. Perfect for anatomy diagrams, maps, charts, and any visual learning.

## How It Works

1. Select an image in your note
2. Define regions to hide (manually or with AI)
3. Each region becomes a separate card
4. During review, one region is hidden while others remain visible

## Creating Image Occlusion Cards

### Method 1: From Selection Toolbar

1. Click on an image in your note
2. Selection Toolbar appears with **IO** button
3. Click **IO** to open the Image Occlusion editor

### Method 2: From Command

1. Command Palette → "Create image occlusion card"
2. Select an image from your vault
3. Image Occlusion editor opens

### Method 3: From Flashcard Panel

1. Open Flashcard Panel for a note with images
2. Click **Add Image Occlusion**
3. Select an image

## The Image Occlusion Editor

### Interface Overview

```
┌─────────────────────────────────────┐
│  [AI Detect] [Rectangle] [Ellipse]  │  ← Tools
├─────────────────────────────────────┤
│                                     │
│         [Image Preview]             │
│                                     │
│      ┌─────────┐                    │
│      │ Region 1│  ← Drawn regions   │
│      └─────────┘                    │
│                                     │
├─────────────────────────────────────┤
│  Regions: [1] [2] [3]    [Save]     │  ← Region list
└─────────────────────────────────────┘
```

### Drawing Tools

| Tool | Description |
|------|-------------|
| **Rectangle** | Draw rectangular regions |
| **Ellipse** | Draw elliptical regions |
| **Polygon** | Draw custom shapes (coming soon) |
| **AI Detect** | Auto-detect regions with AI |

### Drawing Regions

1. Select a tool (Rectangle or Ellipse)
2. Click and drag on the image
3. Region appears with a number
4. Repeat for additional regions

Each region becomes a separate card.

### AI Region Detection

Click **AI Detect** to automatically identify regions:

1. AI analyzes the image
2. Detects labels, annotations, structures
3. Creates regions automatically
4. You can adjust or delete AI regions

Works best with:
- Anatomy diagrams
- Labeled charts
- Maps with clear boundaries

### Region Properties

For each region, you can set:

| Property | Description |
|----------|-------------|
| **Label** | Text shown on hover |
| **Hint** | Optional hint for review |
| **Group** | Group related regions |

### Region Groups

Group regions to test them together:

1. Select multiple regions
2. Click **Group**
3. Grouped regions appear on the same card

Useful for testing multiple related areas at once.

## Card Generation

### One Region = One Card

By default, each region generates one card:

| Card | Hidden | Visible |
|------|--------|---------|
| Card 1 | Region 1 | Regions 2, 3, 4... |
| Card 2 | Region 2 | Regions 1, 3, 4... |
| Card 3 | Region 3 | Regions 1, 2, 4... |

### Grouped Regions

Grouped regions are hidden together:

| Card | Hidden | Visible |
|------|--------|---------|
| Card 1 | Regions 1, 2 (grouped) | Regions 3, 4... |

## During Review

### Question Side

- Image with one region hidden (covered)
- Other regions visible
- Label/hint if configured

### Answer Side

- Full image with all regions visible
- Hidden region highlighted

### Image Occlusion Modes

| Mode | Description |
|------|-------------|
| **Hide One** | Hide one region per card (default) |
| **Hide All** | Hide all regions, reveal one at a time |
| **Hide All Group** | Hide all, reveal by group |

## Syntax in Notes

Image occlusion cards are stored in your notes:

```markdown
![[anatomy-diagram.png]]
#flashcard-io
regions: [{"id":"r1","shape":"rect","bounds":[100,100,200,180],"label":"Hippocampus"}]
```

You can edit this manually, but using the editor is recommended.

## Supported Image Formats

- PNG
- JPEG/JPG
- GIF (first frame)
- WebP
- SVG (converted to PNG)

## Tips for Best Results

### 1. Use High-Quality Images

- Clear labels and annotations
- Good contrast
- Appropriate size (not too small)

### 2. Keep Regions Consistent

- Similar size regions
- Clear boundaries
- Avoid overlapping regions

### 3. Add Labels

Labels help during review:
- Hover to see label
- Provides context for what's being tested

### 4. Use AI Detection First

Let AI find regions, then:
- Adjust boundaries
- Add labels
- Remove irrelevant regions

### 5. Group Related Areas

For complex images, group related regions to test together.

## Common Use Cases

| Subject | Example |
|---------|---------|
| Anatomy | Label body parts, organs, bones |
| Geography | Countries, capitals, landmarks |
| Chemistry | Molecular structures, reactions |
| Biology | Cell structures, organisms |
| Art | Artist techniques, periods |
| Engineering | Diagrams, schematics |

## Troubleshooting

### AI Detection Not Working

1. Ensure AI is configured (API key or subscription)
2. Try a clearer image
3. Use manual drawing instead

### Regions Not Saving

1. Check file permissions
2. Ensure note is saved
3. Try a simpler image

### Images Not Displaying in Review

1. Check image path is correct
2. Ensure image exists in vault
3. Try re-adding the image

## Related Topics

- [AI Generation](./ai-generation.md) — AI-powered card creation
- [Note Types](../concepts/note-types.md) — Image Occlusion note type
- [Review Interface](../review/review-interface.md) — How cards appear in review
