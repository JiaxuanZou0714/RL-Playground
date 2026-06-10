# Product

## Register

product

## Users

RL-Playground is for students, researchers, and reinforcement-learning learners who want to observe how standard algorithms behave in small browser-based control environments. They use it in a teaching, self-study, or quick demonstration context where training behavior, evaluation curves, and policy rollouts need to be visible together.

## Product Purpose

The product is a Chinese teaching lab for comparing reinforcement-learning algorithms on Flappy Bird, Pong, and 10x10 Gomoku self-play. It should make the training loop concrete: choose an environment, choose an algorithm, tune a few meaningful parameters, run training quickly, then watch the learned policy at normal speed. Success means the interface helps learners connect algorithm concepts with observable behavior without hiding the mechanics behind a decorative game shell.

## Brand Personality

Clear, technical, classroom-friendly. The voice should be precise and calm, with enough warmth for learning but enough discipline for research-adjacent use. Copy should name what the interface literally does and should avoid vague product-marketing language.

## Anti-references

Do not turn the project into a marketing landing page. Avoid arcade-heavy game styling, over-decorated analytics dashboards, generic AI/SaaS polish, glassy decorative surfaces, and visual effects that distract from the training workflow. Do not obscure algorithm differences behind playful copy or purely aesthetic charts.

## Design Principles

1. Keep the simulation, controls, and learning evidence in one readable workflow.
2. Make algorithm differences inspectable through labels, metrics, formulas, and chart behavior.
3. Prefer dense, predictable product UI over promotional storytelling.
4. Treat Chinese instructional copy as first-class interface text, not explanatory filler.
5. Use visual personality only where it clarifies the teaching lab or rewards discovery.

## Implementation Principles

**Prefer platform defaults over custom re-implementations.**
Before writing custom CSS or JS for any interactive control, check whether the browser already does it well:

- Form controls (`<input type="range">`, `<select>`, `<button>`) should use native rendering styled only with `accent-color`, `color`, `background`, and `border`. Do not override `-webkit-slider-runnable-track`, `-webkit-slider-thumb`, or `-moz-range-track` unless native rendering is provably broken for the use case.
- Focus rings should use `:focus-visible` with a single `outline` override for brand color. Never suppress the native outline without replacing it.
- Font rendering: do not add `-webkit-font-smoothing` or other vendor-prefixed rendering hints; modern browsers handle this without help.
- Avoid dead CSS: do not set the same property twice in one rule (e.g. two `margin-top` declarations).
- Before adding a layout pattern, check whether a single `display: grid` or `display: flex` with `gap` covers the need without extra wrapper elements.

## Accessibility & Inclusion

Target WCAG AA contrast for text and controls. Controls should remain keyboard reachable, focus states should be visible, and color should not be the only signal for selected state or algorithm category. Motion should respect reduced-motion preferences. Formulas, canvases, and charts should keep meaningful labels so learners using assistive technology can understand the page structure even when the visual simulation is central.
