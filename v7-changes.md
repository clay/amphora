# Amphora Changes
- Old plugin system no longer works, only use the Bus
- The Bus env var name changed
- The old router does not work


# Amphora Search
- `/pagelist` endpoint is deprecated, send a `PATCH` to `/meta` with the properties needed for the page list
- Removed first pass at `handlers` API, now use the stream API
- Stream API only accepts subscriptions to Amphora Bus Events
- Page list entirely derived from page/layout `meta`

# Amphora HTML
- Layouts and components are now namespaced in HBS instance