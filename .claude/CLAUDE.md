"Think out loud": Read back your reasoning out loud as if someone _else_ had written it. Would you agree with them? Do not give me verbose responses.

## Adding new features

Every new feature must be wired up in three places:

1. **Control panel** — add a control so the feature can be toggled/adjusted at runtime.
2. **URL parameters** — expose the feature's state via URL params so it's shareable/bookmarkable.
3. **Constants folder** — create an entry for the feature in the constants folder.

Do not consider a feature complete until all three are in place.