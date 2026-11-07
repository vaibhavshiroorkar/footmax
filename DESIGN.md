# FootMax design

The look is a floodlit matchday at night: a dark sky over the stadium,
chalk lines, pitch green, numbers that read like a stadium scoreboard.
It should feel like a football game made by people who love football,
not a template.

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

Tokens live in `src/ui/theme.ts`. The palette follows common dark-mode
guidance:

- `bg` is a deep slate navy, not pure black. Pure black makes light text
  smear and leaves no room to show depth. Cards sit one step lighter
  (`card`, `cardAlt`) with a solid `border`.
- `text` is a soft off-white, not pure white, which vibrates on a dark
  background.
- `accent` is pitch green: a slightly softened lime, because fully
  saturated colours shimmer on dark. It marks the one thing to do on a
  screen (the main button, the selected tab, the Play button) and nothing
  else.
- `gold` is the warm colour for rewards and big moments. Warm colours read
  as energy and competition, and green as calm.
- Status: `green` good, `red` bad, `blue` info. About one man in twelve
  has trouble telling red from green, so status always comes with an
  icon, a word or a lightness difference too.
- Body text keeps at least 4.5:1 contrast with its background.
- `paper` and `paperInk` are for the rare printed-programme moment (the
  player card, a headline), not for whole screens.

## Shape and depth

- Corners: 12 for cards, 10 for buttons, 6 for tags. Never fully round
  except avatars, shirts and the Play button.
- Depth is a solid lip under buttons (`lip`), not a blurred shadow. No
  glows, no glass, no gradient fills on buttons.
- Section labels are chalk lines: a short label and a dashed rule.

## Layout

- Each screen has one main action, and it is the first thing you see.
- At most three blocks before you scroll.
- No paragraphs that explain the screen. Help lives in the first-run tips.
- Numbers, icons and short labels over sentences.
- Match rewards use four equal columns: Rating, XP, Fame and Bonus.
  Keep zero values visible. Place match badges below the row.
- Interaction buttons show action names without explanatory subtitles or recommendation highlights.
- Training names all affected attributes in both the drill card and active session.
- Cards use small rectangular markers on the pitch and in match statistics.
  Sent-off players stay visible in grey rows, with a red-card marker and accessible label.

## Scenes

Short scenes (a goal, a referee's call, a set piece, a flare-up) play inside the
pitch's own block, over the pitch. They never move the page and they are not modals.
The live pitch keeps its numbered dots in normal play; people are jointed figures
in the match's real kits, and the user's figure has their look. Anything that plays
for more than a moment can be skipped with a tap, and reduced motion shortens it.

## Do not

- Inter, Roboto or system fonts.
- Pure black or purple backgrounds, full-strength neon, gradient buttons,
  glow shadows.
- Centred screen titles with an empty side; titles sit on the left.
- Cards inside cards. A card holds content, not more cards.
- Bouncy entrance animations. Things appear where they stay.

## Shared ordinary-shot camera

Capture the camera behind the actual ball, looking toward the attacked goal.
Keep that camera fixed during the attempt. Project all forward-visible players.
Use metres and one perspective scale for figures, ball, aim marker and goal frame.
Depth sorting lets nearby bodies cover a farther ball. Do not cap the player count.
Input controls submit an attempt. They never supply its outcome.
