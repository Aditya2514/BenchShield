# Superpowers Active Guidelines

This workspace is equipped with **Superpowers** (https://github.com/obra/superpowers).

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.
IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.
This is not negotiable. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

## The Superpowers Rule
- **Invoke relevant or requested skills BEFORE any response or action** — including clarifying questions, exploring the codebase, or checking files.
- **Before entering plan mode or creative/feature work:** Always invoke the `brainstorming` skill first (`.agents/skills/brainstorming/SKILL.md`).
- Announce `"Using [skill] to [purpose]"` and follow the skill instructions.

## Key Process Skills
- `brainstorming`: Explores user intent, requirements, and design before implementation.
- `writing-plans`: Creates comprehensive implementation plans with TDD steps.
- `executing-plans`: Guides step-by-step implementation of planned tasks.
- `subagent-driven-development`: Drives autonomous task completion using parallel/sequential subagents.
- `test-driven-development`: Red-Green-Refactor testing discipline.
- `systematic-debugging`: Multi-phase disciplined root cause investigation.
- `verification-before-completion`: Rigorous verification before concluding a task.

---

## UI/UX & Design Intelligence Rules (Mandatory Auto-Invocation)

Whenever a task touches **frontend, user interface (web/mobile/desktop), component styling, landing pages, dashboards, banners, or visual presentation**, you MUST automatically apply the corresponding design skills without waiting for the user to specify `/ui-ux-pro-max` or slash commands:

### 1. Skill Selection Matrix
- **UI Architecture, Style & UX Best Practices**: Always invoke `ui-ux-pro-max` (`.agents/skills/ui-ux-pro-max/SKILL.md`).
  - Search data before designing: Run `python "c:\D-Drive\TinyFish\.agents\skills\ui-ux-pro-max\scripts\search.py" "<query>" --domain <domain>` (or `--design-system`, `--stack <stack>`).
- **Component Styling & Tailwind/shadcn**: Invoke `ui-styling` (`.agents/skills/ui-styling/SKILL.md`) for Tailwind CSS utility classes, Radix/shadcn primitives, dark mode, and responsive cards/dialogs/tables.
- **Tokens & CSS Variables**: Invoke `design-system` (`.agents/skills/design-system/SKILL.md`) for systematic color/spacing scales (primitive → semantic → component).
- **Brand Identity & Creative Assets**: Invoke `brand` and `design` for logos, CIP, icons, and visual branding guidelines.
- **Banners & Marketing Creatives**: Invoke `banner-design` (`.agents/skills/banner-design/SKILL.md`) for social media graphics, ads, and website hero sections.
- **Presentations & Pitch Decks**: Invoke `slides` (`.agents/skills/slides/SKILL.md`) for HTML/Chart.js slide decks.

### 2. Mandatory UI/UX Standards (Enforced across all frontend output)
- **Search First**: Before generating UI code, query `search.py` for the exact product category, palette, typography pairing, and stack rules.
- **Strict Accessibility**: Minimum contrast 4.5:1 for body text (3:1 for large text/borders), keyboard focus rings must never be removed, all interactive elements must have visible labels or `aria-label`.
- **Touch & Click Targets**: Minimum 44×44px hit areas with ≥8px spacing.
- **Clean Iconography**: Use SVG icons (Lucide / Heroicons / Tabler); **NEVER use raw emojis** as UI icons or action buttons.
- **Zero CLS & Responsive**: Mobile-first layout, reserve space for images/media to prevent layout shifts, no horizontal viewport overflows.
- **Systematic Colors**: Use semantic design tokens (CSS variables / Tailwind tokens), never hardcode arbitrary magic hex values in random elements.

See detailed skills in `.agents/skills/` and `.agents/plugins/superpowers/`.
