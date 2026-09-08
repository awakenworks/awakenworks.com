# AwakenWorks brand marks

`@awaken/ui/brand` is the single geometry and palette owner for the
AwakenWorks, Agents, Objects, and Workforce marks. `ProductMark.astro` renders
that source in site chrome and product surfaces; `pnpm brand:generate` produces
the downloadable SVG files and adaptive favicon. Do not copy path data into a
page component or maintain a separate light/dark drawing. The source lives in
`awaken-ui/src/brand/marks.ts`; the website and React products pin the same UI
artifact. Cloud uses the Works master mark with the Awaken Cloud name.

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

## Family appearance

The website and consoles consume `@awaken/ui/brand/family.css` for their light
and dark palettes, font stacks and control metrics. `Base.astro` selects the
canonical route identity; `global.css` only maps it to Tailwind tokens.
`brand/appearance` owns the prepaint stored-or-system decision and subsequent
changes. The native `AppearanceSelect.astro` supplies localized markup to that
controller; it does not store or resolve theme state itself. Legacy `theme`
preferences migrate to `awaken.theme` within this website origin.

## Functional icons

Functional icons use the Lucide nodes and SVG defaults from
`@awaken/ui/icons/data`, the same geometry used by React consoles.
`FunctionalIcon.astro` only renders those nodes as native SVG elements; it adds
no icon paths, dependencies, persistence or event handling. Page components keep
link destinations, actions and labels. Decorative icons stay out of accessible
names; standalone meaningful images receive an explicit label.

## Console capture provenance

The five `public/awaken/assets/console-current` PNGs are actual local Console
captures from Agents revision `cadf3816ab4003e977387be2f700ce03c0455e04`, using
`@awaken/ui` 0.8.0. The existing Agents `web/e2e/ui-inventory.spec.ts` owns the
capture procedure: desktop Overview, Deployments, Models & providers, API &
protocols, plus the Agent configuration case. Images are extracted unchanged
from its Playwright JSON attachments after those five cases pass. The browser
uses the real local production backend and Vite-rendered source with controlled
initial setup data. These images establish appearance, not customer activity,
completed work, deployed-release status or provider interoperability.
