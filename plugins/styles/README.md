# Integration of sirius-aem-styles

Styles plugin for Sirius AEM project integrating the Sirius Design System.

## Scripts Usage

### Build & Development
```bash
# Build styles
npm run build

```

## Design System Updates

### Linking the Sirius Design System Locally

1. **Link the design system package (in the design system directory):**
Sirius Design System: https://sparksource.collaboration.agilent.com/projects/ITDS/repos/sirius-design-system/browse
    ```bash
    cd path/to/sirius-design-system
    npm link
    ```

2. **Link it in the styles plugin (in the styles plugin directory):**
    ```bash
    cd plugins/styles
    npm link sirius-design-system
    ```

### Pulling Updates from Design System

3. **Update the package:**
    ```bash
    cd plugins/styles
    npm update sirius-design-system
    ```

4. **Check for new components/styles:**
    ```bash
    ls node_modules/sirius-design-system/styles/
    ls node_modules/sirius-design-system/styles/components/
    ```

5. **Update imports in `src/index.scss`:**
    ```scss
    // Add new component imports
    @use '../node_modules/sirius-design-system/styles/components/new-component' as *;
    ```

    Update the version of updated sirius design system into index.scss.

6. **Rebuild after updates:**
    ```bash
    npm run build
    ```

## Quick Start

1. Install dependencies: `npm install`
2. Edit SCSS files in `src/`
3. Start development: `npm run build`
4. Compiled CSS outputs to `../../styles/lib-style.css | fonts.css`

## Project Structure
```
src/
├── index.scss    # Main entry point
└── fonts.scss    # Font styles
```
