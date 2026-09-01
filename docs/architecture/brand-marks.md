# AwakenWorks brand marks

`src/lib/brandMarks.mjs` is the single geometry and palette owner for the
AwakenWorks, Agents, Objects, and Workforce marks. `ProductMark.astro` renders
that source in site chrome and product surfaces; `pnpm brand:generate` produces
the downloadable SVG files and adaptive favicon. Do not copy path data into a
page component or maintain a separate light/dark drawing.

## Meaning

The original filled Awaken `A` is the master mark. AwakenWorks and Agents use
exactly the same geometry; their full names and surface palettes distinguish the
company from its flagship product. Objects and Workforce inherit the same
filled-ribbon weight, diagonal cuts, and circular point of human direction. The
A, O, or W silhouette must remain recognizable without color or a product
label.

| Mark | Structure | Product meaning |
| --- | --- | --- |
| AwakenWorks | the original filled `A` with its circular direction point | every product begins from a direction people set |
| Agents | the same original `A`, locked up with the Awaken Agents name | the flagship execution product inherits the company mark |
| Objects | two related `O` forms meeting at the direction point | business facts remain bounded while their relationships stay visible |
| Workforce | a filled `W` whose paths meet around the direction point | people, rules, and Agents move one accountable job to acceptance |

The circular point must serve the geometry, not sit on it as decoration. Avoid
adding robot heads, sparkles, brains, target symbols, refresh arrows, or generic
completion checks.

## Palette intent

The dark surface provides depth and technical focus; the warm light surface
provides editorial calm. Gold gives AwakenWorks direction and maturity, cyan
gives Agents precision, amber gives Objects permanence, coral gives Workforce
human energy, and violet carries human judgment across the family. In the
traditional five-element color metaphor this reads as water beneath the system,
wood growing into execution, fire creating movement, earth retaining facts, and
neutral lines supplying metal-like order. This is an emotional design check,
not a product or scientific claim.

## Surface variants

Every mark has one `on-dark` and one `on-light` palette. Geometry does not vary
between themes. Page components default to `scheme="auto"`, rendering both
variants and letting the document theme expose the matching one. Use an explicit
scheme only when the containing surface cannot follow the document theme.

Generated assets live at
`public/brand/{awakenworks|awaken-agents|awaken-objects|awaken-workforce}-{on-dark|on-light}.svg`.
The favicon uses the same AwakenWorks geometry and switches its surface and
palette through `prefers-color-scheme`.

## Use

- Keep the `32 × 32` view box and at least five units of clear space.
- Use the supplied 16, 24, 32, or larger rendering; do not redraw details for a
  local component.
- Keep the full product name beside the mark on a reader's first encounter.
- Do not use color as the only product distinction.
- Review all four marks together at 16, 24, and 48 pixels, in both palettes,
  before changing geometry or optical weight.
