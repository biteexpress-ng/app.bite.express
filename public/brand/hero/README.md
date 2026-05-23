# Hero floating-card images

Drop the 6 PNGs listed below into this folder. The hero immediately
renders them in place of the styled icon placeholders — no code
change required (FloatingServiceCard detects load success at runtime).

## Files expected

| Path                                   | Used in                  | Suggested size |
| -------------------------------------- | ------------------------ | -------------- |
| `food.png`                             | Floating "Food" card     | ≥ 512×410      |
| `grocery.png`                          | Floating "Grocery" card  | ≥ 512×410      |
| `pharmacy.png`                         | Floating "Pharmacy" card | ≥ 512×410      |
| `parcel.png`                           | Floating "Parcel" card   | ≥ 512×410      |
| `petrol.png`                           | Floating "Petrol" card   | ≥ 512×410      |
| `order-thumbnail.png`                  | Phone order-card thumb   | ≥ 128×128      |

## Notes

- Aspect ratio for the 5 floating cards is **5:4** (landscape-ish).
  Square images crop cleanly too.
- Transparent or dark backgrounds work best — the cards are dark
  glass. Subjects with a slight stylistic edge (warm light, slight
  drop shadow) read more "premium" than pure product cut-outs.
- `order-thumbnail.png` is a square 1:1 crop of a hot meal — used as
  the small thumbnail on the phone's order card.
- Files are served via `next/image` with `unoptimized` so missing
  files don't crash the build — they just keep the placeholder.

When real photography lands, no code change is required.
