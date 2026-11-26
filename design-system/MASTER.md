# Puskola design system

Puskola (පුස්කොළ) is named after the palm-leaf manuscripts Sinhala books were first written on.
The look borrows from them: warm leaf-coloured pages, ink-dark text, Kandyan lacquer red and
temple gold. Content first, calm, made for long reading sessions in Sinhala.

## Colour tokens

Use the CSS variables only. No raw hex values in components.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #FBF7EF | #14100C | Page background (palm-leaf parchment / night ink) |
| `--surface` | #FFFDF8 | #1D1813 | Cards, header, dialogs |
| `--soft` | #F4EADA | #2A221A | Subtle fills, selected nav, pills |
| `--line` | #E7DCC8 | #3A3027 | Borders, dividers |
| `--ink` | #221B14 | #F4EDE2 | Body text (15.9:1 / 16.3:1) |
| `--muted` | #6B5F52 | #B9AD9C | Secondary text (5.8:1 / 8.6:1) |
| `--accent` | #8E2A1C | #EC8A70 | Brand lacquer red: primary actions, links, focus (7.9:1 / 7.6:1) |
| `--accent-ink` | #FFF8F0 | #2A0E07 | Text on accent (8.0:1 / 7.3:1) |
| `--gold` | #7A5200 | #E5B85C | "New", premium, bookmarks (5.8:1 on soft) |
| `--leaf` | #2F6150 | #86C7AE | "Free", success (6.0:1 on soft) |
| `--danger` | #B3261E | #F2988A | Destructive actions, errors |

Colour never carries meaning alone: every pill also has a word ("Free", "New", "Subscription").

## Type

- Display (Latin): Fraunces 600/700. Display (Sinhala): Noto Serif Sinhala 600/700.
- Body: Figtree + Noto Sans Sinhala, 16px, line-height 1.6.
- Reading: Noto Serif Sinhala (reader controls size, line height and width).
- Scale: 12 / 14 / 16 / 18 / 22 / 28 / 40.

## Space, shape, depth

- Spacing on a 4/8 rhythm: 4 8 12 16 24 32 48.
- Radius: 8 (inputs), 12 (cards), 16 (panels, hero), full (buttons, pills).
- Elevation: e1 border only; e2 small shadow (cards); e3 lifted (hover on covers).

## Motion

- 120ms press, 180ms hover, 240ms enter, ease `cubic-bezier(.2,.7,.2,1)`.
- Transform and opacity only. Everything is reduced or instant under `prefers-reduced-motion`.

## Interaction rules

- Touch targets at least 44px on touch screens (40px with a mouse).
- One primary button per view. Visible focus ring (2px accent, 2px offset).
- Icons: lucide-react, 1.75 stroke, 18 to 20px, never emoji. Icon-only buttons carry an aria-label.
- Phones: a bottom tab bar (Home, Browse, Library, Audio, Account) replaces the top nav row.

## Audiobook player

- Full-screen listening view (`/listen/<book>`): top bar (back, title and chapter, Read along / Cover switch, Chapters), content, player docked at the bottom.
- Read along: the spoken paragraph gets the soft fill and an accent rule on the left; the spoken word gets an accent underline. Tapping any line or word seeks there. Scrolling by hand stops auto-follow and shows "Back to the narration".
- Cover mode: large cover, chapter and section, and the current passage in muted text.
- Player: seek bar with elapsed and remaining time, previous chapter, back 15 s, play (64px, the one primary control), forward 30 s, next chapter; speed and sleep timer menus; volume on wide screens.
- Keys: Space or K play and pause, J or Left back 15 s, L or Right forward 30 s, [ and ] speed, M mute, Esc closes menus.
