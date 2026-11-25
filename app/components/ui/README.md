# Onselli UI primitives

`app/design-system.css` is the canonical source for semantic color, spacing, typography, radius, and elevation values. `app/globals.css` binds those tokens to Tailwind v4 utility names and imports the design system once.

## Shared component APIs

- `Button`: `primary`, `secondary`, `tertiary`/`ghost`/`quiet`, `destructive`/`danger`; `sm`, `md`, and `lg`; optional loading and leading/trailing icons.
- `Input`: native input props, `sm`/`md`/`lg`, optional leading/trailing icons, and an error state.
- `Select` / `WorkspaceSelect`: native option input converted to an accessible Radix select; supports disabled, required, and ARIA props.
- `Card`: `none`, `sm`, `md`, or `lg` padding; flat by default; optional hover border and explicit `elevated` treatment.
- `Surface`: semantic structural surface with flat border and background.
- `ChoiceCard`: native radio or checkbox control with visible selected and keyboard-focus states.
- `Badge`: neutral, draft, published/active/success, archived, warning, and danger/failed status variants.
- `Alert`: info, success, warning, and danger variants with appropriate status or alert live roles.
- `EmptyState`: icon, title, description, and optional action.

Use semantic utilities such as `text-ink`, `text-muted`, `border-border`, `bg-surface`, `bg-canvas`, `bg-brand`, and `text-display` when a shared component does not fit. Keep unique colors for artwork or third-party brand marks. Keep legacy route rules until every route using them has migrated and been visually verified.
