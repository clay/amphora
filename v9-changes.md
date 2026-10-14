# Amphora 9

Amphora 9 is a maintenance release plus one new, opt-in feature. Sites that don't turn the feature on get the same responses as on 8.x.

## Breaking

- **Node 20 or newer.** `engines` is now `>=20`. CI runs on Node 20, 22 and 24 (24 is the current LTS).
- **Smaller install.** Dependencies amphora never used were removed: `basic-auth`, `eventify`, `express-flash`, `express-session`, `js-yaml`, `template2env` and `vhost`, plus the `handlebars` peer dependency. If your site `require`s any of these, add them to your own `package.json` (nymag/sites already declares the ones it uses).
- **Published files.** The package now ships only `index.js`, `lib/` (without tests), `README.md` and `LICENSE`. Deep requires of `amphora/lib/...` keep working.

## New

- **Real-time collaboration for editors (opt-in).** Presence, live updates and merging of simultaneous saves, used by clay-kiln 10.3+. Off unless you pass `collaboration` to `amphora()`. See [docs/advanced/collaboration.md](docs/advanced/collaboration.md).

## Improved

- `listDeepObjects` (used to compose every page) no longer copies arrays as it walks: same output, about 19x faster at 2,000 references.
- `uriToUrl` no longer throws for an `https` site without a port.
- Dependency floors raised within their major versions (express 4.21, body-parser 1.20, lodash 4.17.21, bluebird 3.7, ioredis 4.28, clay-log 1.5, amphora-auth 2.1); `node-fetch` 1 → 2 (only used for publish webhooks, same behavior). Production `npm audit` advisories drop from 36 to the ones inside amphora-auth's own dependencies.
- Tooling: mocha 11, c8, chai 4, sinon 21, supertest 7 and ESLint 9. The flaky test failures caused by port collisions are gone.
