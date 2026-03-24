# Design System Specification: The Architectural Infographic

## 1. Overview & Creative North Star
The "Creative North Star" for this design system is **The Editorial Curator**. This system moves beyond the rigid, utilitarian nature of standard dashboards to create a workspace that feels like a premium digital publication. We are blending the structured clarity of Notion with the vibrant, information-dense "block" logic of Lark.

To break the "template" look, we prioritize **Intentional Asymmetry**. Instead of perfectly centered grids, we use weighted layouts where visualization cards vary in scale and "visual gravity." By leveraging high-contrast typography scales and overlapping surface layers, we create a sense of depth and curated intent that feels custom-built for every data point.

---

## 2. Colors: Tonal Depth & The "No-Line" Rule
Our palette is rooted in a sophisticated range of blues and neutrals. We use color to define structure, not decoration.

### The "No-Line" Rule
**Explicit Instruction:** Prohibit the use of 1px solid borders for sectioning or containment. Boundaries must be defined solely through background color shifts or subtle tonal transitions. For example, a `surface-container-low` component should sit on a `surface` background to create a "soft edge."

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of fine paper.
- **Base Level:** `surface` (#f7f9ff)
- **Secondary Level:** `surface-container-low` (#edf4ff) for sidebar or background grouping.
- **Active Level:** `surface-container-lowest` (#ffffff) for primary visualization cards to provide maximum "lift" and clarity.
- **Nesting:** When placing a child element inside a card, use `surface-container` (#e6effb) to create a recessed, "punched-in" look.

### The "Glass & Gradient" Rule
To elevate the "Infographic" style, use **Glassmorphism** for floating elements (modals, popovers, or floating action bars). 
- **Effect:** Apply `surface-container-lowest` at 80% opacity with a `20px` backdrop-blur.
- **Signature Textures:** For primary CTAs or Hero Visualization headers, use a linear gradient: `primary` (#004493) to `primary-container` (#005bc0). This adds "soul" and professional polish that flat blocks lack.

---

## 3. Typography: Editorial Authority
We utilize a dual-font strategy to balance character with readability.

*   **Display & Headlines (Manrope):** High geometric clarity. Use `display-lg` to `headline-sm` for data storytelling titles. The tight kerning and modern letterforms convey authority.
*   **Body & Labels (Inter):** Maximum legibility for dense data. Use `body-md` for standard descriptions and `label-sm` for metadata.

**Hierarchy Strategy:** 
Use `on-surface-variant` (#424753) for secondary labels to create a clear visual gap between the "Headline" (the story) and the "Body" (the data). This contrast is the engine of our editorial feel.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are often a crutch for poor contrast. In this system, depth is earned through layering.

*   **The Layering Principle:** Stack `surface-container` tiers. A `surface-container-lowest` card placed on a `surface-dim` background creates a natural, soft lift without a single pixel of shadow.
*   **Ambient Shadows:** When a card *must* float (e.g., a dragged card or an active modal), use a "Long Shadow": `0px 12px 32px rgba(20, 28, 37, 0.06)`. The shadow color is a tinted version of `on-surface`, mimicking natural light.
*   **The "Ghost Border":** If a boundary is required for accessibility, use `outline-variant` (#c2c6d5) at **15% opacity**. Never use a 100% opaque border.

---

## 5. Components: Blocks of Truth

### Visualization Cards
*   **Structure:** No dividers. Use `Spacing-6` (1.5rem) to separate the header from the content body.
*   **Corner Radius:** Use `xl` (1.5rem) for the outer card and `md` (0.75rem) for nested data blocks (charts/stats).
*   **Layout:** Use CSS Grid to create asymmetrical internal layouts—e.g., a large metric (Left) paired with a small sparkline (Right).

### Primary Buttons
*   **Style:** `primary` fill with `on-primary` text.
*   **Rounding:** `full` (9999px) to contrast with the more structured card corners, making them feel like interactive "pills."

### Data Chips
*   **Style:** Use `primary-fixed` (#d8e2ff) backgrounds with `on-primary-fixed-variant` (#004493) text. 
*   **Visual Polish:** A 2px horizontal padding increase (relative to standard) creates a "spacious" infographic look.

### Form Inputs
*   **Style:** `surface-container-highest` background. No border. 
*   **State:** On focus, transition the background to `surface-container-lowest` and apply a 2px "Ghost Border" using `primary`.

### Navigation Rails
*   **Layout:** Vertical, slim. Use `surface-container-low` to distinguish the navigation from the main workspace `surface`.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use vertical white space (`Spacing-8` or `12`) to define new sections instead of lines.
*   **Do** mix font weights—use `manrope-bold` for headlines and `inter-regular` for body text.
*   **Do** use "Color Blocks": use `secondary-container` (#fe932c) as a background for high-alert data points to create an infographic "callout."

### Don’t:
*   **Don’t** use a black shadow. It kills the sophisticated blue-wash of the theme.
*   **Don’t** use 1px dividers between list items. Use a `4px` gap and a subtle background hover state.
*   **Don’t** center-align everything. Align to the left to maintain the "Editorial/Notion" aesthetic.
*   **Don’t** use high-contrast borders. If the background shift isn't enough, your layout is likely too cluttered.

---

## 7. Accessibility Note
Ensure that all text on `primary-container` or `secondary-container` backgrounds uses the corresponding `on-container` token to maintain a minimum 4.5:1 contrast ratio. When using Glassmorphism, ensure the background blur is sufficient to keep text legible over shifting background data.