Nakna HR P7.61 - Startup Performance

Changes:
- Persistent localStorage dashboard cache (stale-while-revalidate) so closing/reopening the tab no longer starts cold every time.
- App shell appears immediately after session verification; dashboard refresh runs in background instead of blocking splash.
- Heavy loadAll is scheduled during browser idle time instead of immediately competing with first render.
- /api/me no longer performs expensive account reconciliation on every open; reconciliation is explicit after account linking.
- Membership lookup removes runtime CREATE TABLE and N+1 primary-owner queries.
- App modulepreload added.
- Startup cache is cleared on logout.

Validation: npm run check passed.
