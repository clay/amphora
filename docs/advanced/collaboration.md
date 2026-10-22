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
| `store` | — | A custom store (same interface as `lib/collab/stores/memory.js`, including `gap()`, `newGap()` and `beat()`). |
| `keyPrefix` | `clay:collab` | Prefix for every Redis key. Keys of a site share a hash tag, so Redis Cluster works. |
| `pollInterval` | `2000` | ms between syncs while others are on the page. |
| `soloPollInterval` | `4000` | ms between syncs while nobody else is. |
| `hiddenPollInterval` | `20000` | ms between syncs from background tabs. |
| `idlePollInterval` | `30000` | ms between syncs after 5 minutes without input. |
| `presenceTtl` | `45000` | ms without a sync before an editor disappears (kept longer than the slowest poll). |
| `hiddenPresenceTtl` | `150000` | Same, for background tabs (browsers slow their timers to about once a minute). |
| `takeoverAfter` | `60000` | ms a field someone has open must go without changes before someone else can take it over (see [one person per field](#one-person-per-field)). |
| `lockTtl` | `15000` | ms a write may hold its uri, in case its instance dies mid-write. |
| `lockWait` | `5000` | ms a write waits for another write to the same uri before going ahead unchecked. |
| `feedSize` / `feedTtl` | `200` / `3600` s | Change-feed events kept per page/layout, and for how long. |
| `revisionTtl` | `604800` s | How long an untouched revision is kept (an expired revision just costs one extra merge). |
| `timeout` | `500` | ms to wait for the store before carrying on without it. |
| `retryAfter` | `10000` | ms to leave the store alone after a failure (at most: see `probeInterval`). |
| `probeInterval` | `1000` | ms between checks on a store that failed, so collaboration resumes about a second after it's back. |
| `heartbeatInterval` | `10000` | ms between each instance's stamps on the store (see [the gap](#catching-up-after-the-store-was-unreachable-the-gap)). |

## How it works

### Transport: short polling

Each editor tab sends one small request, `POST /_collab/sync`, every couple of seconds (slower when alone, in a background tab or idle). It carries a heartbeat (who's here, what they have open, whether they're typing) and returns everyone's presence plus everything saved, published or changed on the page (and its layout) since the tab's last sync. Typical payloads are ~0.2 KB up and ~0.5 KB down.

Plain HTTP was chosen over WebSockets or server-sent events on purpose: it goes through any CDN, load balancer and proxy unchanged, needs no sticky sessions or pub/sub fan-out between instances, and degrades gracefully. (WordPress's real-time collaboration made the same choice for the same reasons.) When a tab closes, kiln sends `POST /_collab/leave` with `sendBeacon`; presence also expires on its own.

### Revisions and the 412 response

Amphora keeps a revision number for every component, layout and page. With collaboration on:

* Every write to the latest version (`PUT`/`PATCH`/`DELETE` of a component, layout or page) gets a new revision, returned in the `X-Clay-Rev` response header.
* Revisions are two-phase. A write holds its uri (a short lock) while it runs, and its new revision only becomes visible once the write succeeded. A second write to the same uri waits for the first, so nobody can see a new revision paired with data that isn't written yet. Check, lock and publish are atomic Redis scripts, so two simultaneous saves can't both pass.
* A write that sends `X-Clay-Rev: <n>` is only applied if `n` is still the current revision. Otherwise amphora answers **`412 Precondition Failed`** with the current revision and data (read after that revision was published), and the client merges and retries. `X-Clay-Rev: -1` means "I don't know my base revision": the answer is always a 412 with the current data to merge. When nothing is saved there, the 412 says `missing: true`; when the data can't be read, amphora answers 503 rather than an empty 412.
* Writes without `X-Clay-Rev` (scripts, importers, other tools) are unconditional, as before, but still move the revision on, so a stale kiln save can't overwrite them. (Child components created by a nested save aren't revisioned until they're saved on their own; they're new, so nobody else has them open.)
* `GET`s from a collaborating client (`X-Clay-Collab-Session` header) also return `X-Clay-Rev`.

### Starting over (resync)

Each sync response carries the store's `epoch`, a random id created with its data. Amphora tells a client to start over (`resync: true`) when the epoch it saw has changed (Redis lost its data), its cursor is ahead of the feed, or events it hadn't seen yet were trimmed from the feed. Kiln then re-learns every revision on the page and refreshes whatever changed; it does the same after 20 minutes without a successful sync (a sleeping laptop).

### Catching up after the store was unreachable (the gap)

Revisions only protect writes the store saw. A save made while the store was unreachable goes through unchecked, and if the instance that made it stops before the store is back (a deploy, a crash, a scale-in), nothing remembers it: its revision never moves on, and an editor with an older copy could overwrite it without a 412. Three things close that hole:

* **The gap.** Each sync response (and `locals.collaboration`) carries the store's `gap`, a random id. Any instance that fails to reach the store, or can't reach it as it starts up (the process before it may have saved without the store and been stopped), starts a new gap as soon as the store answers again; while it can't, it checks every `probeInterval`, so that's about a second after the store is back.
* **Nobody left to tell.** Every instance stamps the store every `heartbeatInterval`. If an instance finds the stamp more than three intervals old, nothing could reach the store for a while (it was unreachable, or every instance was down), so writes may have gone around it on instances that are gone now: it starts a new gap. Rolling deploys keep the stamp fresh; this doesn't need instances to shut down cleanly (they don't, today). A client that sees the gap change can't be sure it heard about every save, so it re-reads everything on its page (kiln calls this catching up).
* **Saves name their gap.** Kiln sends the gap its revisions come from (`X-Clay-Collab-Gap`) with every save. A revision from before the current gap is treated as unknown (`-1`): the answer is a 412 with the current data and the current `gap`, so a tab that hasn't synced since the store came back (a background tab, say) merges instead of overwriting, and learns that it has to catch up.
* **Revisions move on.** Each instance remembers the writes it made without the store (up to 2,000 uris, with who made them) and, once the store is back, moves their revisions on and records them in the feed under that person's name. If it fails to, it keeps them and tries again.
* **The writer's tab remembers too.** A save whose response has no `X-Clay-Rev` went through unchecked. Kiln reports those (`unguarded: [{ uri, doc }]` in its next successful sync); amphora moves their revisions on and records them in the feed for everyone else, so they're covered even if the instance that took them is gone. A sync that can't do this answers 503, and the tab reports them again next time.

Kiln also catches up when a sync answered 503 (the store was unreachable, so the feed may be missing saves) and when a page was rendered without a feed position. Until it has, it forgets the revisions it knows, so its saves send `X-Clay-Rev: -1` and merge with whatever the server has instead of overwriting it.

### Change feed and presence

Successful writes from kiln are recorded in a short feed for the page or layout they belong to (`X-Clay-Collab-Doc` header; writes to a page or layout always go to its own feed), with who made them. Publishing, unpublishing (`DELETE /_uris/...`), scheduling (`/_schedule`) and page-meta changes are recorded too. Presence is stored per page, per user and tab: an editor can only update or remove their own entry. Other editors only see a display name, avatar, color and an opaque id: user ids are keyed hashes (HMAC with a secret kept in the store), so they can't be matched back to usernames or email addresses, and tab ids are opaque too (a tab's session id is never sent to anyone else). `/_collab/sync` only accepts JSON from the site's own origin.

### One person per field

Kiln lets only one person edit a field at a time, and amphora only relays what it needs for that through presence: each tab's `focus` says what it has open, how long since it last changed it (`quiet`, ms), whether it has changes it hasn't saved (`unsaved`), whether it's asking whoever has it open to hand it over (`claim: true`), and the tabs it took it over from without them handing it over (`over`, up to 8 tab ids: those tabs drop what they hadn't saved), and each presence entry carries `seen`, when that tab last synced (server time, comparable with the response's `now`). Everything else happens in the editors' tabs: someone who changed a field in the last `takeoverAfter` ms (and is connected, with the tab in front) keeps it; otherwise another editor can take it over, and the holder's own tab saves what they typed and closes it before the newcomer's form opens. If the holder's tab can't be reached and has unsaved changes, the newcomer is told their version replaces them, and the holder's tab, once back, closes its form without saving and offers its user a copy. Amphora doesn't enforce any of it: it's a courtesy between kiln tabs, and saves are still checked and merged as usual if two people do end up changing the same thing.

### Edit mode

When an authenticated user opens a page in edit mode, amphora adds `locals.collaboration` (settings plus the feed position the page was rendered at), which is how kiln knows to turn collaboration on and catch anything saved while the page was loading. View mode, public pages and API responses are unchanged.

## Failure modes

Collaboration never stands between an editor and a save:

* Every store call has a short timeout (`timeout`), and after a failure amphora leaves the store alone (checking on it every `probeInterval`) until it answers, at most `retryAfter` ms. While it's unavailable, saves go through unchecked (exactly as without collaboration) and `/_collab/sync` answers 503; kiln shows "Reconnecting…" and keeps retrying. Once the store is back, those writes' revisions move on, other editors hear about them, and every editor re-reads their page (see [the gap](#catching-up-after-the-store-was-unreachable-the-gap)), so nobody overwrites them from an older copy, even if the instance that took them has restarted.
* While the store is down, two editors saving the same component both go through unchecked: the later save wins, as without collaboration.
* A page opened in edit mode while the store is down still turns collaboration on, without a feed position or gap; kiln re-reads the page once the store is back, and its saves merge with the server's data until then.
* Redis connection errors are logged at most once a minute.

## Endpoints

| | |
| --- | --- |
| `POST /_collab/sync` | `{ page, session, docs?, cursor, epoch?, focus?, state?, uris?, unguarded? }` → `{ now, epoch, gap, cursor, resync, pollInterval, hiddenPollInterval, presence, events, revs? }`. Requires a logged-in user; JSON only, same origin. `focus` is `{ uri, path?, label?, typing?, quiet?, unsaved?, claim?, over? }`; each `presence` entry is `{ tab, self, user, focus, state, seen }`. `unguarded` (up to 100 `{ uri, doc }`) lists the client's saves that came back without a revision. |
| `POST /_collab/leave` | `{ page, session }` → 204. Accepts `text/plain` (for `sendBeacon`). |

Request headers kiln sends with every write: `X-Clay-Collab-Session` (the tab), `X-Clay-Collab-Doc` (page or layout uri), `X-Clay-Rev` (base revision) and `X-Clay-Collab-Gap` (the gap that revision comes from). A 412 body is `{ code, message, uri, rev, gap, by, data, missing }`; `by` (`{ user }`, as other editors see them, or `null`) is who last saved it according to the page's or layout's feed, so the client can say "Ada also changed Headline".
