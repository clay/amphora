# Real-time collaboration

Amphora can let several editors work on the same page at the same time without overwriting each other's work. It's **off by default**: turn it on and [clay-kiln](https://github.com/clay/clay-kiln) (10.3+) picks it up automatically, with nothing to install in your site.

What editors get:

* **Presence**: avatars of everyone on the page in kiln's toolbar, a colored outline and name tag on whatever they're editing ("Ada is typing…"), and a pill at the edge of the screen pointing to people working out of view.
* **Live updates**: when someone saves a component, adds, removes or moves components, or publishes, everyone else sees it within a couple of seconds, without reloading. Nothing that you're in the middle of editing changes under you: those updates wait until you're done.
* **No lost work**: every save says which version of the data it was based on. If someone else saved in between, the two edits are merged field by field (component lists item by item), so both people's changes survive. If you both changed the *same* field, yours is kept and you get a one-click "use theirs".
* **Soft locks**: opening something someone else has open asks first ("Ada is editing this — Edit anyway?").

## Turning it on

```js
amphora({
  // ...your usual options
  collaboration: {
    redis: process.env.CLAY_COLLABORATION_REDIS // e.g. redis://my-redis:6379/4
  }
});
```

`collaboration: true` uses an in-memory store, which only works when every editor reaches the same Node process (local development, a single instance). With more than one instance, pass `redis` (a URL, or an existing [ioredis](https://github.com/redis/ioredis) client); the store is shared through Redis, so it works across any number of instances with no sticky sessions.

### Options

| Option | Default | |
| --- | --- | --- |
| `redis` | — | Redis URL or ioredis client. Required for more than one instance. |
| `store` | — | A custom store (same interface as `lib/collab/stores/memory.js`). |
| `keyPrefix` | `clay:collab` | Prefix for every Redis key. Keys of a site share a hash tag, so Redis Cluster works. |
| `pollInterval` | `2000` | ms between syncs while others are on the page. |
| `soloPollInterval` | `4000` | ms between syncs while nobody else is. |
| `hiddenPollInterval` | `20000` | ms between syncs from background tabs. |
| `idlePollInterval` | `30000` | ms between syncs after 5 minutes without input. |
| `presenceTtl` | `45000` | ms without a sync before an editor disappears (kept longer than the slowest poll). |
| `feedSize` / `feedTtl` | `200` / `3600` s | Change-feed events kept per page/layout, and for how long. |
| `revisionTtl` | `604800` s | How long an untouched revision is kept (an expired revision just costs one extra merge). |
| `timeout` | `500` | ms to wait for the store before carrying on without it. |
| `retryAfter` | `10000` | ms to leave the store alone after a failure. |

## How it works

### Transport: short polling

Each editor tab sends one small request, `POST /_collab/sync`, every couple of seconds (slower when alone, in a background tab or idle). It carries a heartbeat (who's here, what they have open, whether they're typing) and returns everyone's presence plus everything saved, published or changed on the page (and its layout) since the tab's last sync. Typical payloads are ~0.2 KB up and ~0.5 KB down.

Plain HTTP was chosen over WebSockets or server-sent events on purpose: it goes through any CDN, load balancer and proxy unchanged, needs no sticky sessions or pub/sub fan-out between instances, and degrades gracefully. (WordPress's real-time collaboration made the same choice for the same reasons.) When a tab closes, kiln sends `POST /_collab/leave` with `sendBeacon`; presence also expires on its own.

### Revisions and the 412 response

Amphora keeps a revision number for every component, layout and page. With collaboration on:

* Every write to the latest version (`PUT`/`PATCH`/`DELETE` of a component, layout or page) gets a new revision, returned in the `X-Clay-Rev` response header.
* A write that sends `X-Clay-Rev: <n>` is only applied if `n` is still the current revision. Otherwise amphora answers **`412 Precondition Failed`** with the current revision and data, and the client merges and retries. The check-and-bump is a single atomic Redis script, so two simultaneous saves can't both pass.
* Writes without `X-Clay-Rev` (scripts, importers, other tools) are unconditional, as before, but still bump the revision, so a stale kiln save can't overwrite them.
* `GET`s from a collaborating client (`X-Clay-Collab-Session` header) also return `X-Clay-Rev`.

### Change feed and presence

Successful writes from kiln are recorded in a short feed for the page or layout they belong to (`X-Clay-Collab-Doc` header), with who made them. Publishing, unpublishing, scheduling and page-meta changes are recorded too. Presence is stored per page, per user and tab: an editor can only update or remove their own entry, and other editors only ever see their display name, avatar and a color (never usernames or email addresses).

### Edit mode

When an authenticated user opens a page in edit mode, amphora adds `locals.collaboration` (settings plus the feed position the page was rendered at), which is how kiln knows to turn collaboration on and catch anything saved while the page was loading. View mode, public pages and API responses are unchanged.

## Failure modes

Collaboration never stands between an editor and a save:

* Every store call has a short timeout (`timeout`), and after a failure amphora leaves the store alone for `retryAfter` ms. While it's unavailable, saves go through unguarded (exactly as without collaboration), edit mode renders without collaboration and `/_collab/sync` answers 503. Kiln shows "Reconnecting…" and keeps retrying; nothing else changes for the editor.
* Redis connection errors are logged at most once a minute.

## Endpoints

| | |
| --- | --- |
| `POST /_collab/sync` | `{ page, session, docs?, cursor, focus?, state?, uris? }` → `{ now, cursor, pollInterval, hiddenPollInterval, presence, events, revs? }`. Requires a logged-in user. |
| `POST /_collab/leave` | `{ page, session }` → 204. Accepts `text/plain` (for `sendBeacon`). |

Request headers kiln sends with every write: `X-Clay-Collab-Session` (the tab), `X-Clay-Collab-Doc` (page or layout uri) and `X-Clay-Rev` (base revision).
