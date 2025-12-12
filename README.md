# Project Sirius
Frontend code for www.agilent.com.

## Environments

### DEV1
- Preview: https://dev1--acomqa--agilent.aem.page/
- Live: https://dev1--acomqa--agilent.aem.live/ and https://devwww1.agilent.com/

### QA1
- Preview: https://qa1--acomqa--agilent.aem.page/
- Live: https://qa1--acomqa--agilent.aem.live/ and https://stgwww1.agilent.com/

### Stage
- Preview: https://stage--acomstg--agilent.aem.page/
- Live: https://stage--acomstg--agilent.aem.live/ and https://stgwww.agilent.com/

### Production
- Preview: https://main--acom--agilent.aem.page/
- Live: https://main--acom--agilent.aem.live/ and https://www.agilent.com/

## Documentation

Before using the aem-boilerplate, we recommand you to go through the documentation on https://www.aem.live/docs/ and more specifically:
1. [Developer Tutorial](https://www.aem.live/developer/tutorial)
2. [The Anatomy of a Project](https://www.aem.live/developer/anatomy-of-a-project)
3. [Web Performance](https://www.aem.live/developer/keeping-it-100)
4. [Markup, Sections, Blocks, and Auto Blocking](https://www.aem.live/developer/markup-sections-blocks)

## Development

```sh
npm install -g @adobe/aem-cli
npm run local
# or
aem up --url https://main--acomqa--agilent.aem.page/
```

### Environments

- QA: main--acomqa--agilent.aem.page
- STAGE: main--acomstg--agilent.aem.page
- PROD: main--acom--agilent.aem.page

## Installation

```sh
npm i
```

## Linting

```sh
npm run lint
```

## Testing

```sh
npm test
```

## UI Layout:
- Defined Breakpoints (per Figma):
    - Mobile: < 768px
    - Tablet: ≥ 768px and ≤ 1024px
    - Desktop: > 1024px (with layout pinned at 1688px max width)
        - What you'll see in Figma:
            375px (mobile view shown in Figma is at this size - it was selected to ensure design works at very small size, all other mobile views should follow the patterns shown but behave as indicated below in the between breakpoints section using fluid widths),
        - 768px (tablet view shown in Figma is at this size),
        - 1688px (desktop view shown in Figma is at this size).
- Between Breakpoints (Fluid Widths):
    Components should fluidly stretch (width: 100%) within their containers between breakpoints, respecting padding/margins and layout rules.
    - Apply max-width values where appropriate (e.g., max-width: 1688px for full page containers).
    - Components should scale smoothly between defined layouts unless explicitly instructed otherwise.
- Override Behavior:
If a component spec or Figma note calls for fixed width or custom layout behavior, that takes precedence over this fallback.

- Height Handling
    -Default Rule:
    Height should be auto (content-driven).
    - When to Use Min/Max/Fixed Height:
        - Use min-height only when needed for layout structure or vertical alignment.
        - Avoid fixed height unless absolutely necessary (e.g., banners, animations, carousels with locked frame sizes).

- System Rule of Thumb
    - Mobile applies below (< 768px)
    - Tablet applies between (768px and 1023px).
    - Desktop applies at (1024px+, max width 1688px - at this point we should lock the growth of the width and center the experience on a bg TBD with design during development).
    - Between breakpoints, stretch fluidly in width, and let content determine height unless specified.

## CSS special classes

### Full width

`full-width` class should be added to the element that needs to break out of the standard container size and should take the full viewport width.
The class can be added to the block using the `setBlockToFullViewportWidth` (from `aem.js`).

### Overflow container

`overflow-container--{viewport size}` class should be added to the element that needs to be displayed with the horizontal scrollbar and occupy the full viewport size. The class can be added to the element using the `setBlockToOverflowViewportWidth` (from `aem.js`).

Using the `overflow-container--mobile`, it is possible to achieve the scrollable items that take the full viewport width. Look below, the images are touching the viewport edges.

Without the class:

![overflow container mobile](docs/images/no-overflow-container.png){width=375px}

With the class:

![overflow container mobile](docs/images/overflow-container-mobile.png){width=375px}

