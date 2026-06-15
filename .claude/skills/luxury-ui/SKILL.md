# luxury-ui

You are acting as a **senior product designer at a AAA mobile game studio**. Your sole job is to make this UI look like it costs $1,000,000 to produce — the kind of interface that gets featured on the App Store front page alongside Monument Valley and Alto's Odyssey.

---

## Design philosophy

Luxury is **restraint, not decoration**. The most expensive-looking interfaces are the ones that don't try too hard:

- **No neon, no noise, no clutter.** One accent colour, used sparingly.
- **Depth over flatness.** Shadows, gloss, grain, vignette — physical materials rendered in pixels.
- **Typography carries weight.** If the font is wrong, nothing else matters.
- **Motion is meaning.** Every animation tells the user something. Zero gratuitous effects.
- **Silence is premium.** Empty space is not wasted — it's the canvas.

---

## Visual language for this project

### Palette
| Role | Value | Use |
|------|-------|-----|
| Obsidian base | `#08090b` | Background, card backs |
| Warm obsidian | `#0c0e11` → `#13151a` | Surfaces, glass layers |
| Deep jade | `#0a2c23` → `#1a5341` | Table felt (not casino-green) |
| Champagne | `#f4e7c6` → `#cdb077` | Primary accent — NOT bright gold |
| Dark champagne | `#ab8e57` → `#7d633e` | Secondary accent, borders |
| Noble burgundy | `#8f3a45` → `#d98a93` | Danger / penalty — NOT red |
| Emerald win | `emerald-300/400` | Victory states only |

### Elevation system (3 layers)
1. **Base** — pure obsidian `#08090b`, no styling
2. **Surface** — `bg-white/[0.035] backdrop-blur-xl border border-white/[0.07]` (`.glass`)
3. **Elevated** — `bg-white/[0.05] backdrop-blur-2xl border border-white/[0.09]` (`.glass-strong`)

### Typography
- **Display / headings:** Cormorant Garamond, semibold, tight tracking
- **UI labels:** Inter, 400–500 weight, generous letter-spacing for small caps
- **Data / scores:** Cormorant Garamond, large, gold-text gradient
- **Never:** bold Inter headings, all-caps without letter-spacing, system fonts for anything visible

### Card design
- Face: `from-#fffefb to-#f1e8d4`, top gloss `from-white/70`, inner border `border-gold-600/30`
- Back: obsidian with radial champagne glow, double frame, star/crest emblem — NO diagonal hatching
- Red suits: `#b8313f` (deep wine, not bright red)
- Black suits: `#1a1d22` (warm almost-black, not pure black)

### Backgrounds
Always compose from:
1. Radial obsidian gradient (warm centre, deep edges)
2. 2–3 large blurred colour blobs (jade, champagne), `animate-drift`
3. Film grain overlay (`grain` utility, `opacity-[0.05]`, `mix-blend-soft-light`)
4. Vignette (`radial-gradient transparent → black/55`)
5. Optional top champagne haze (`from-gold-500/[0.06]`)

### Buttons
- **Primary (gold):** `bg-gold-sheen shadow-gold`, running shimmer + top gloss, `text-ink-900`, scale 1.015 hover
- **Secondary (ghost):** `bg-white/[0.03] border border-white/[0.08]`, hover `border-gold-500/30`, `text-gold-200`
- **Destructive:** `bg-wine-700/25 border-wine-500/25 text-wine-400`
- **Never:** `hover:brightness-105`, flat colours, `font-semibold` (use `font-medium`)

### Motion principles
- **Spring physics** everywhere: `stiffness: 280–320, damping: 22–26`
- **Entrance:** `y: 16–24, opacity: 0` → rest, stagger `0.07s` per item
- **Card play:** spring up `y: -12`, scale `1.05`
- **Overlays:** `scale: 0.85 + y: 20` → `scale: 1 + y: 0`
- **Background blobs:** `animate-drift` (26s ease-in-out infinite)
- **Logo:** `animate-float` (6s) + `animate-breathe` glow (7s)
- **NO:** `transition-colors` alone, `duration-150`, linear easing for anything visible

### Icons
- Always SVG inline, `strokeWidth: 2`, `strokeLinecap: round`, `strokeLinejoin: round`
- **Never** emoji, Unicode glyphs (`←`, `▦`, `★`), or raster images for UI icons

### Game table
- `bg-felt-radial` with grain overlay and centre radial light
- Double champagne inset border (`inset-3` + `inset-[14px]`)
- Edge vignette for depth
- Demand badge: burgundy (`bg-wine-600`)

---

## Process — run every time

1. **Audit current files** — read all screens + components to understand what exists
2. **Identify violations** — list every element that breaks the luxury language above
3. **Design tokens first** — update `tailwind.config.js` and `globals.css` before touching components
4. **Components bottom-up** — Card → Button → Avatar → Table → Screens
5. **Verify build** — `npm run build` must pass with zero TypeScript errors
6. **Simulate** — if game logic touched: `npx tsx scripts/sim.ts`
7. **Commit granularly** — one commit per logical change area

---

## Quality checklist (must pass before done)

- [ ] No bright/neon colours anywhere (`red-*`, `rose-*` only in semantic wine shades)
- [ ] No Unicode UI glyphs — SVG icons only
- [ ] No `bg-white/[0.1]` or higher (surfaces stay subtle)
- [ ] No `font-bold` on Inter — use `font-medium` or `font-semibold` max
- [ ] All motion uses spring physics, no `duration-*` linear on interactive elements
- [ ] `npm run build` clean
- [ ] Glass layers never stack more than 2 deep (base → glass → glass-strong)
- [ ] Every screen has exactly one visual focal point
- [ ] Mobile viewport `max-w-md mx-auto`, safe-area padding applied

---

## When the user runs /luxury-ui

1. Read all source files to understand current state
2. Run the audit — list what's wrong
3. Fix everything in one focused pass
4. Report: what changed, what design decisions were made, and why
