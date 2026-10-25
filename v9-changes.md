# Amphora 9

Amphora 9 is a maintenance release. Apart from the changes listed under Breaking, sites get the same responses as on 8.x.

## Breaking

- **Node 26.12.1 or newer.** `engines` is now `>=26.12.1` and CI runs on Node 26.12.1, the first 26.x with the October 2026 security fixes (Node 20 reached end of life in April 2026).
- **Smaller install.** Dependencies amphora never used were removed: `basic-auth`, `eventify`, `express-flash`, `express-session`, `js-yaml`, `template2env` and `vhost`, plus the `handlebars` peer dependency. If your site `require`s any of these, add them to your own `package.json` (nymag/sites already declares the ones it uses, and gets `handlebars` through `clayhandlebars`).
- **Published files.** The package now ships only `index.js`, `lib/` (without tests), `README.md` and `LICENSE`. Deep requires of `amphora/lib/...` keep working.

## Improved

- `listDeepObjects` (used to compose every page) no longer copies arrays as it walks: same output, about 19x faster at 2,000 references.
- `uriToUrl` no longer throws for an `https` site without a port.
- Dependency floors raised within their major versions (express 4.21, body-parser 1.20, lodash 4.17.21, bluebird 3.7, ioredis 4.28, clay-log 1.5, amphora-auth 2.1); `node-fetch` 1 → 2 (only used for publish webhooks, same behavior). Production `npm audit` advisories drop from 36 to 19. All 19 come from amphora-auth's dependencies or from js-yaml 3, which amphora-fs and clayutils pull in through nymag-fs. None of them can be fixed in amphora itself.
- Tooling: mocha 11, c8, chai 4, sinon 21, supertest 7 and ESLint 9. The flaky test failures caused by port collisions are gone.

## Known

- Amphora still parses urls with `url.parse()`, so urls, published `_uris` and redirects behave exactly as on 8.x. Node 24 and 26 print their deprecation warning for it (DEP0169) only when amphora is loaded from outside `node_modules` (`npm link` or a `file:` dependency).
