# Amphora 9

Amphora 9 is a maintenance release plus one new, opt-in feature. Apart from the changes listed under Breaking, sites that don't turn the feature on get the same responses as on 8.x.

## Breaking

- **Node 24 or newer.** `engines` is now `>=24` and CI runs on Node 24, the current LTS (Node 20 reached end of life in April 2026).
- **Smaller install.** Dependencies amphora never used were removed: `basic-auth`, `eventify`, `express-flash`, `express-session`, `js-yaml`, `template2env` and `vhost`, plus the `handlebars` peer dependency. If your site `require`s any of these, add them to your own `package.json` (nymag/sites already declares the ones it uses, and gets `handlebars` through `clayhandlebars`).
- **Published files.** The package now ships only `index.js`, `lib/` (without tests), `README.md` and `LICENSE`. Deep requires of `amphora/lib/...` keep working.
- **Urls with an invalid host or without `//`.** `references.isUrl()` is now `false` for a url whose host `URL` rejects and for a url without `//` after its protocol, so a page can't be published at such a url. For these urls `references.urlToUri()` throws `Invalid url`. If your site passes user-entered or stored urls to `urlToUri()`, check them with `isUrl()` first.
  - `URL` rejects a host with a space, a control character, `|`, `^`, `<`, `>`, a `%` escape that doesn't decode to a valid host (`%20`, `%zz`), a bad port, or a last label that is a number when the host isn't a valid IPv4 address (`nymag.123`, `1.2.3.256`), for example. 8.x accepted these hosts and moved the invalid part into the path (`http://nymag.com /x` gave the uri `nymag.com /x`). `references.uriToUrl()` throws `Invalid uri` for a uri with such a host.
  - Without `//`, 8.x read what followed any protocol as the host, except lower-case http, https, ftp, gopher, file, ws and wss, and javascript in any case. So `foo:bar/baz`, `news:comp.lang/x`, `data:text/html,<p>hi</p>`, `Https:www.nymag.com/x` (host `www.nymag.com`) and `nymag.com:3333/path` (protocol `nymag.com:`, host `3333`) were urls, while `https:www.nymag.com/x` was not.
- **Hosts that `URL` rewrites.** Http and https urls whose host is a domain name (IDN included), `localhost`, a dotted IPv4 address or an IPv6 address in its shortest form give the same results as on 8.x. Other hosts that `URL` accepts now come out the way `URL` writes them, in `references.urlToUri()` (the `_uris` a page is published under), `references.uriToUrl()` (`res.locals.url`), the redirects written on publish and the 301 for a `_uris` redirect:
  - A short, hex, octal or zero-padded IPv4 address is written in full (`127.1` and `0x7f.1` become `127.0.0.1`, `010.0.0.1` becomes `8.0.0.1`), and an IPv6 address is shortened (`[0:0::1]` becomes `[::1]`, `[::ffff:1.2.3.4]` becomes `[::ffff:102:304]`).
  - Percent escapes in the host are decoded (`nym%41g.com` becomes `nymag.com`).
  - A host with `"`, `'`, `;`, `` ` ``, `{` or `}` keeps that character and is lower-cased as a whole. 8.x cut the host at the character and moved the rest into the path.
  - Some urls that 8.x rejected are now valid, so `isUrl()` is `true` and a page can be published at them: a host name longer than 255 characters or a host that starts with one of the characters above or a `%` escape, right after `//` or `user@` (`http://;/x` gives the uri `;/x`, `http://%6e%79mag.com/x` gives `nymag.com/x`), where 8.x treated the url as having no host, and a user name or password with an invalid `%` escape (`http://user%@nymag.com/x`), where 8.x threw `URIError`.
  - `uriToUrl()` drops a `user@` in front of the host.

  Urls with other protocols can differ in more edge cases. `javascript:` urls are still never valid.

## New

- **Real-time collaboration for editors (opt-in).** Presence, live updates and merging of simultaneous saves, used by clay-kiln 10.3+. Off unless you pass `collaboration` to `amphora()`. See [docs/advanced/collaboration.md](docs/advanced/collaboration.md).

## Improved

- No `url.parse()` deprecation warning (DEP0169). Amphora parses urls with WHATWG `URL` and escapes paths the way `url.parse()` did, so apart from the hosts listed under Breaking, `res.locals.url`, published `_uris` and redirects are unchanged. The warning used to show up in sites that load amphora through `npm link` or a `file:` dependency.
- `listDeepObjects` (used to compose every page) no longer copies arrays as it walks: same output, about 19x faster at 2,000 references.
- `uriToUrl` no longer throws for an `https` site without a port.
- Dependency floors raised within their major versions (express 4.21, body-parser 1.20, lodash 4.17.21, bluebird 3.7, ioredis 4.28, clay-log 1.5, amphora-auth 2.1); `node-fetch` 1 → 2 (only used for publish webhooks, same behavior). Production `npm audit` advisories drop from 36 to 19. All 19 come from amphora-auth's dependencies or from js-yaml 3, which amphora-fs depends on directly and clayutils pulls in through nymag-fs. None of them can be fixed in amphora itself.
- Tooling: mocha 11, c8, chai 4, sinon 21, supertest 7 and ESLint 9. The flaky test failures caused by port collisions are gone.
