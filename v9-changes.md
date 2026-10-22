# Amphora 9

Amphora 9 is a maintenance release. Apart from the changes listed under Breaking, sites get the same responses as on 8.x.

## Breaking

- **Node 24 or newer.** `engines` is now `>=24` and CI runs on Node 24, the current LTS (Node 20 reached end of life in April 2026).
- **Smaller install.** Dependencies amphora never used were removed: `basic-auth`, `eventify`, `express-flash`, `express-session`, `js-yaml`, `template2env` and `vhost`, plus the `handlebars` peer dependency. If your site `require`s any of these, add them to your own `package.json` (nymag/sites already declares the ones it uses, and gets `handlebars` through `clayhandlebars`).
- **Published files.** The package now ships only `index.js`, `lib/` (without tests), `README.md` and `LICENSE`. Deep requires of `amphora/lib/...` keep working.
- **Urls with an invalid host.** `references.isUrl()` is now `false` for a url whose host `URL` rejects (it has a space, a control character, `%`, `|`, `^`, `<`, `>` or a bad port, for example) and for `host:port/path` without a protocol, so a page can't be published at such a url. For these urls `references.urlToUri()` throws `Invalid url`, and `references.uriToUrl()` throws `Invalid uri`. 8.x accepted them and moved the invalid part of the host into the path. If your site passes user-entered urls to `urlToUri()`, check them with `isUrl()` first. Urls with a valid host give exactly the same results as on 8.x.

## Improved

- No `url.parse()` deprecation warning (DEP0169). Amphora parses urls with WHATWG `URL` and escapes paths the way `url.parse()` did, so `res.locals.url`, published `_uris` and redirects are unchanged. The warning used to show up in sites that load amphora through `npm link` or a `file:` dependency.
- `listDeepObjects` (used to compose every page) no longer copies arrays as it walks: same output, about 19x faster at 2,000 references.
- `uriToUrl` no longer throws for an `https` site without a port.
- Dependency floors raised within their major versions (express 4.21, body-parser 1.20, lodash 4.17.21, bluebird 3.7, ioredis 4.28, clay-log 1.5, amphora-auth 2.1); `node-fetch` 1 → 2 (only used for publish webhooks, same behavior). Production `npm audit` advisories drop from 36 to 19. All 19 come from amphora-auth's dependencies or from js-yaml 3, which amphora-fs and clayutils pull in through nymag-fs. None of them can be fixed in amphora itself.
- Tooling: mocha 11, c8, chai 4, sinon 21, supertest 7 and ESLint 9. The flaky test failures caused by port collisions are gone.
