# FootMax design

The look is a floodlit matchday at night: a dark pitch, chalk lines, a
flare of colour, numbers that read like a stadium scoreboard. It should
feel like a football game made by people who love football, not a
template.

## Words to design by

- **Matchday.** Pitch stripes, chalk, kit colours, crests, shirt numbers.
- **Tactile.** Buttons look pressable and move when pressed. Things have
  weight: solid edges, not glows.
- **Loud where it matters, quiet elsewhere.** Big numbers and big moments
  (goals, ratings, level-ups) get the display type; everything else stays
  calm.

## Type

- **Big Shoulders Display** (`fonts.display*`): titles, numbers, buttons,
  scores. Uppercase for buttons and screen titles.
- **Rubik** (`fonts.body`, `medium`, `semibold`, `bold`): everything you
  read. Rounded corners keep it friendly at small sizes.
- Minimum 11 px. Numbers that matter use the display face.

## Colour

Tokens live in `src/ui/theme.ts`.

- Background `bg` is a green-black night pitch, never navy. Cards sit one
  step up (`card`), with a solid `border`.
- Text is warm chalk (`text`), not pure white.
- `accent` (flare orange) is for the one thing to do on a screen: the main
  button, the selected tab, the Play button. Do not use it for status.
- Status colours: `green` good, `gold` reward, `red` bad, `blue` info.
- `paper` and `paperInk` are for the rare printed-programme moment (the
  player card, a headline), not for whole screens.

## Shape and depth

- Corners: 12 for cards, 10 for buttons, 6 for tags. Never fully round
  except avatars, shirts and the Play button.
- Depth is a solid lip under buttons (`lip`), not a blurred shadow. No
  glows, no glass, no gradient fills on buttons.
- Section labels are chalk lines: a short label and a dashed rule.

## Do not

- Inter, Roboto or system fonts.
- Navy or purple backgrounds, neon lime, gradient buttons, glow shadows.
- Centred screen titles with an empty side; titles sit on the left.
- Cards inside cards. A card holds content, not more cards.
- Bouncy entrance animations. Things appear where they stay.
