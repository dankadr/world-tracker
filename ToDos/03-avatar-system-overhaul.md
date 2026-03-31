# ToDo: Avatar System Overhaul — Template Architecture & AI Generation

**Date:** 2026-02-24
**Status:** Partially complete — the avatar system is shipped, but the template-based overhaul has not started
**Priority:** High
**Scope:** Redesign the avatar system with a scalable template/skeleton architecture and AI-generated parts

---

## Overview

The current avatar system uses hand-coded 16×16 pixel art defined as row-strings in `src/config/avatarParts.js` (1,059 lines). This works but is extremely tedious to expand — every new hairstyle, shirt, or pet requires manually typing 16 rows of palette characters. The goal is to create a template/skeleton system where:

1. A standard template defines layers, z-order, anchor points, and size constraints
2. Any new avatar part just needs to follow the template spec
3. AI can mass-generate parts using consistent prompts
4. Adding 100 new hairstyles is as easy as dropping files into a folder

## Reality Check (2026-03-25)

- `AvatarCanvas.jsx`, `AvatarEditor.jsx`, `useAvatar.js`, and `src/config/avatarParts.js` are all live
- The current system is functional and already supports unlockable parts, color picking, and persistence
- None of the 32×32 template architecture, conversion scripts, or AI-generation workflow from this plan exists yet

## Current State

### Architecture
- **Parts definition:** `src/config/avatarParts.js` — 1,059 lines
  - Each part = `{ id, name, requires, palette: { char: hex }, rows: [16 strings of 16 chars] }`
  - `'.'` = transparent pixel, characters `0-9, a-f` map to palette colors
- **Renderer:** `src/components/AvatarCanvas.jsx` — draws on `<canvas>` at 16×16 then scales up with `imageRendering: pixelated`
- **Editor:** `src/components/AvatarEditor.jsx` — modal with tabbed category selector, preview, level badge
- **State:** `src/hooks/useAvatar.js` — manages selected parts per category
- **Level badge:** `src/components/LevelBadge.jsx` — circular overlay

### 12 Current Categories
| Category | Parts | Lock |
|----------|-------|------|
| background | 7 | None |
| body | 5 (skin tones) | None |
| hair | 8 + color picker | None |
| eyes | 6 | None |
| shirt | 8 | None |
| hat | 7 | Some require achievements |
| accessory | 5 | Some require achievements |
| shoes | 5 | None |
| glasses | 4 | Level 5 |
| cape | 3 | Level 10 |
| badge | 3 | Level 15 |
| pet | 4 | Level 20 |

### Pixel Art Format Example
```javascript
{
  id: 'hair-short',
  name: 'Short',
  requires: null,
  palette: { '0': '#4a3728', '1': '#5c4433', '2': '#3a2a1c' },
  rows: [
    '..00022200000...',
    '.002222220000...',
    '0022222222000...',
    // ... 13 more rows
  ],
}
```

## Goals

### 3.1 — Template/Skeleton Architecture
Design a layered template system:

```
Layer Stack (bottom to top):
┌─────────────────────────┐
│  8. Pet (companion)     │  ← beside/near body
│  7. Badge/Emblem        │  ← on chest area
│  6. Cape                │  ← behind body, behind hair
│  5. Accessory           │  ← on hand/around neck
│  4. Glasses             │  ← over eyes
│  3. Hat                 │  ← on top of head
│  2. Hair                │  ← around head
│  1. Shirt/Outfit        │  ← torso area
│  0. Body (skin + eyes)  │  ← base layer
│  BG. Background         │  ← full canvas fill
└─────────────────────────┘
```

Each layer has:
- **Anchor zone:** the rectangular region of the 16×16 (or 32×32) canvas where this layer's content sits
- **Z-index:** rendering order
- **Mask/transparency:** parts outside the anchor zone must be transparent
- **Required layer:** body is always required; all others optional

### Template Specification Format
```javascript
// src/config/avatarTemplate.js
export const AVATAR_TEMPLATE = {
  canvasSize: 32,  // upgrade from 16 to 32 for more detail
  layers: [
    {
      id: 'background',
      zIndex: 0,
      anchor: { x: 0, y: 0, w: 32, h: 32 },  // full canvas
      required: false,
      defaultPart: 'bg-sky',
    },
    {
      id: 'body',
      zIndex: 1,
      anchor: { x: 8, y: 4, w: 16, h: 28 },  // centered body area
      required: true,
      defaultPart: 'body-light',
      supportsColorPicker: true,  // skin tone
    },
    {
      id: 'shirt',
      zIndex: 2,
      anchor: { x: 6, y: 16, w: 20, h: 14 },  // torso
      required: false,
    },
    {
      id: 'cape',
      zIndex: 3,  // behind hair but over body
      anchor: { x: 2, y: 10, w: 28, h: 20 },
      required: false,
      unlockLevel: 10,
    },
    {
      id: 'hair',
      zIndex: 4,
      anchor: { x: 4, y: 0, w: 24, h: 18 },  // head area
      required: false,
      supportsColorPicker: true,  // hair color
    },
    {
      id: 'eyes',
      zIndex: 5,
      anchor: { x: 10, y: 8, w: 12, h: 6 },  // eye area
      required: false,
    },
    {
      id: 'glasses',
      zIndex: 6,
      anchor: { x: 8, y: 7, w: 16, h: 8 },
      required: false,
      unlockLevel: 5,
    },
    {
      id: 'hat',
      zIndex: 7,
      anchor: { x: 2, y: 0, w: 28, h: 14 },  // top of head
      required: false,
    },
    {
      id: 'accessory',
      zIndex: 8,
      anchor: { x: 0, y: 12, w: 32, h: 20 },  // around neck/body
      required: false,
    },
    {
      id: 'badge',
      zIndex: 9,
      anchor: { x: 18, y: 18, w: 10, h: 10 },  // chest area
      required: false,
      unlockLevel: 15,
    },
    {
      id: 'pet',
      zIndex: 10,
      anchor: { x: 22, y: 20, w: 10, h: 12 },  // beside body
      required: false,
      unlockLevel: 20,
    },
  ],
};
```

### Part File Format (new)
```javascript
// Each part is a standalone object that references the template layer
export const part = {
  id: 'hair-curly-auburn',
  layer: 'hair',           // maps to template layer
  name: 'Curly Auburn',
  requires: null,           // achievement ID or null
  preview: 'hair-curly-auburn.png',  // small preview for editor
  palette: {
    '0': '#8B4513',
    '1': '#A0522D',
    '2': '#6B3410',
    '3': '#D2691E',
  },
  rows: [
    // 32×32 grid — only the anchor zone has non-transparent pixels
    // Everything outside anchor { x:4, y:0, w:24, h:18 } must be '.'
    '....00001111000000110000....',
    // ... 31 more rows
  ],
};
```

### 3.2 — AI Prompts for Every Avatar Part

#### Base Prompt Preamble (all parts)
```
Create a pixel art avatar part for a 32×32 character.
Style: cute, chibi-style pixel art with clean edges.
Color limit: maximum 4 colors per part + transparent background.
The part must fit within the specified anchor zone.
Output as a pixel grid on a transparent background.
No anti-aliasing. Hard pixel edges only.
```

#### Hair Parts (Target: 30+ styles)
```
[Base Preamble]
Category: Hair
Anchor zone: top-left (4,0) to bottom-right (28,18) — 24×18 pixel area
Create the following hairstyles:
1. Short messy — spiky top, short sides
2. Long straight — falls past shoulders
3. Curly — tight curls all around
4. Ponytail — pulled back with tail to one side
5. Bun — top knot
6. Mohawk — center spike strip
7. Braids — two long braids
8. Afro — large rounded shape
9. Bob — chin-length straight
10. Pixie — very short, textured
11. Dreadlocks — long rope-like strands
12. Mullet — short front, long back
13. Side shave — shaved one side, long other
14. Wavy — medium length, wavy
15. Bangs — heavy front fringe
Each style should be provided in 4 base colors: black, brown, blonde, red.
The hair color can be overridden by a color picker, so design in a single hue.
```

#### Hat Parts (Target: 20+ styles)
```
[Base Preamble]
Category: Hat
Anchor zone: top-left (2,0) to bottom-right (30,14) — 28×14 pixel area
Create the following hat styles:
1. Baseball cap — front-facing with brim
2. Beanie — snug winter hat
3. Top hat — tall formal hat
4. Crown — golden royal crown (achievement unlock: "Completionist")
5. Cowboy hat — wide brim western
6. Beret — French-style flat cap
7. Wizard hat — tall pointed with stars
8. Viking helmet — horned metal helmet (achievement unlock: "Nordic Complete")
9. Turban — wrapped fabric
10. Pirate hat — tricorn with skull (achievement unlock: "Island Master")
11. Sombrero — wide brim Mexican hat
12. Swiss alpine hat — with feather (achievement unlock: "Swiss Complete")
13. Samurai helmet — Japanese kabuto (achievement unlock: Japan complete)
14. Ranger hat — flat brim park ranger (achievement unlock: "Every Park")
15. Ushanka — Russian fur hat
```

#### Shirt/Outfit Parts (Target: 25+ styles)
```
[Base Preamble]
Category: Shirt/Outfit
Anchor zone: top-left (6,16) to bottom-right (26,30) — 20×14 pixel area
Create the following outfits:
1. Plain t-shirt (multiple colors)
2. Hoodie — with hood outline
3. Suit jacket — formal with lapels
4. Hawaiian shirt — pattern with flowers
5. Swiss jersey — red with white cross
6. Hiking vest — outdoor gear
7. Astronaut suit — space theme (achievement unlock)
8. Explorer jacket — khaki with pockets
9. Kimono — Japanese traditional (Japan tracker)
10. Norwegian sweater — patterned wool (Norway tracker)
```

#### Pet Parts (Target: 15+ pets)
```
[Base Preamble]
Category: Pet
Anchor zone: top-left (22,20) to bottom-right (32,32) — 10×12 pixel area
Small companion animal sitting beside the avatar:
1. Cat — sitting, tail curled
2. Dog — small, sitting
3. Bird — perched, colorful
4. Penguin — small, standing (achievement: "Bottom of the World")
5. Red panda — cute, curled
6. Fox — sitting, bushy tail
7. Rabbit — small, ears up
8. Owl — small, round
9. Bear cub — tiny bear (achievement: "Park Master")
10. Parrot — on shoulder variant
11. Swiss cow — tiny with bell
12. Kangaroo — baby joey (achievement: Australia complete)
13. Shiba Inu — Japanese dog (Japan tracker)
14. Moose — tiny moose (Canada/Norway)
15. Eagle — perched bald eagle (USA tracker)
```

#### Accessory Parts (Target: 15+)
```
[Base Preamble]
Category: Accessory
Anchor zone: varies by item (around neck, on body)
1. Camera — around neck / in hand
2. Backpack straps — visible on shoulders
3. Scarf — around neck
4. Necklace — simple chain
5. Bow tie — formal
6. Medal — hanging from neck (achievement unlock)
7. Headphones — around neck
8. Compass — in hand
9. Map — in hand
10. Passport — in hand
11. Binoculars — around neck
12. Swiss army knife — in hand
13. Flag — holding a small flag
14. Suitcase — beside body
15. Hiking poles — in hands
```

### 3.3 — Style Choice & Base Prompt

**Recommended: Upgrade from 16×16 to 32×32 pixel art**
- More detail for hats, pets, accessories
- Still pixel art (crispy, no anti-aliasing)
- `imageRendering: pixelated` still works perfectly
- Canvas component needs size update (minor change)

**Alternative: Vector/SVG avatars (like Notion/Slack)**
- Smoother, scalable
- Requires completely new renderer (SVG instead of canvas)
- Much more flexible but bigger rewrite
- Better for the long term if going mobile native

**Decision:** Start with 32×32 pixel art (smaller migration), keep vector as a future option.

**Master Style Prompt:**
```
All avatar parts must follow this exact style:
- 32×32 pixel art grid
- Chibi/cute proportions (large head, small body)
- Clean pixel edges, no anti-aliasing, no dithering
- Maximum 4 colors per part layer + transparent
- Warm, friendly color palette
- Consistent character proportions: head = rows 0-15, body = rows 16-31
- Eyes sit at rows 8-12, centered at columns 12-20
- Pixel-perfect alignment — no sub-pixel rendering
```

## Migration Plan

### Phase 1: Template Infrastructure
- [ ] Create `src/config/avatarTemplate.js` with layer definitions
- [ ] Upgrade canvas from 16×16 to 32×32 in `AvatarCanvas.jsx`
- [ ] Update `AvatarEditor.jsx` to use template layer metadata
- [ ] Create migration script to upscale existing 16×16 parts to 32×32 (2× each pixel)

### Phase 2: Part Generation
- [ ] Generate 30 hair styles using AI prompts
- [ ] Generate 20 hat styles
- [ ] Generate 25 shirt/outfit styles
- [ ] Generate 15 pet styles
- [ ] Generate 15 accessory styles
- [ ] Generate 10 glasses styles
- [ ] Generate 10 cape styles
- [ ] Generate 10 badge/emblem styles
- [ ] Generate 10 background styles
- [ ] Convert all generated images to row-string format (script needed)

### Phase 3: Tooling
- [ ] Create `scripts/avatar-part-converter.py` — takes a 32×32 PNG, extracts palette, outputs row-string format
- [ ] Create `scripts/avatar-part-validator.py` — validates a part against template constraints (anchor zone, max colors, transparency)
- [ ] Create avatar part preview page for reviewing generated assets

### Phase 4: Integration
- [ ] Load parts from organized folder structure instead of single monolithic file
- [ ] Add part preview images for the editor (instead of rendering each on canvas)
- [ ] Update achievement unlock references for new part IDs
- [ ] Test all existing avatar configs still render correctly after migration

## Files to Create
| File | Purpose |
|------|---------|
| `src/config/avatarTemplate.js` | Layer definitions, anchor zones, z-order |
| `scripts/avatar-part-converter.py` | PNG → row-string converter |
| `scripts/avatar-part-validator.py` | Validate parts against template |
| `src/config/avatarParts/` (directory) | Organized part files by category |
| `src/config/avatarParts/hair.js` | All hair parts |
| `src/config/avatarParts/hats.js` | All hat parts |
| `src/config/avatarParts/shirts.js` | All shirt parts |
| `src/config/avatarParts/pets.js` | All pet parts |
| `src/config/avatarParts/accessories.js` | All accessory parts |
| `src/config/avatarParts/index.js` | Aggregates all part files |

## Files to Modify
| File | Change |
|------|--------|
| `src/config/avatarParts.js` | Deprecate → replaced by `avatarParts/` directory |
| `src/components/AvatarCanvas.jsx` | Update canvas size 16→32, use template layer order |
| `src/components/AvatarEditor.jsx` | Use template metadata for categories, support new parts |
| `src/hooks/useAvatar.js` | Update default selections for new part IDs |
| `src/components/LevelBadge.jsx` | Adjust positioning for 32×32 canvas |

## Estimated Effort
- Template architecture: ~4-5 hours
- AI prompt creation & generation: ~6-8 hours
- Converter/validator scripts: ~3-4 hours
- Integration & migration: ~6-8 hours
- **Total: ~19-25 hours**
