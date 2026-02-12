# Shared fixtures

This folder exists to reduce duplication in tests **while API and frontend live in the same repository**.

## Separation-first rule

Do not create runtime shared code between API and frontend unless it is explicitly being lifted as part of a separation effort.

If logic is needed on both sides during separation:

1. Move the test/ folder intentionally as part of the separation process.
2. Copy the test/ folder into both codebases.
3. Let each side evolve independently after the split.

This means we accept some duplication later to preserve clean boundaries between systems.

## Fixture guidance

- Keep fixtures in this folder only when they are genuinely neutral (usable by both API and frontend tests).
- If a fixture is specific to one side, keep it next to that side's tests.
- Avoid imports from API runtime code or frontend runtime code into shared fixtures.
- Treat this folder as test data/helpers only, not a place for shared production abstractions.
