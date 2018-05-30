Plugins
=======

This is a technical document on plugins in Amphora.

For a broader overview, please see the [project's readme document](https://github.com/nymag/amphora)

## Registering plugins with Amphora

Plugins are given when amphora is called. For example:

```javascript
const amphora = require('amphora'),
  app = require('express')(),
  yourPlugin = require('yourPlugin');

amphora({
  app: app,
  plugins: [
    yourPlugin
  ]
});
```

## API

A plugin can add the following to its `module.exports`:

`module.exports.init`
   - runs once when the plugin is registered
   - given no params

`module.exports.routes`
   - runs once when amphora adds routes for each site
   - given one param: express router

`module.exports.save`
   - hook triggered on db put or db batch containing put(s)
   - given db operations in one param: `[{type: string, key: string, value: string}]`

`module.exports.delete`
   - hook triggered on db delete or db batch containing delete(s)
   - given db operations in one param: `[{type: string, key: string, value: string}]`

`module.exports.publish`
   - hook triggered on page publish (db batch with page@published)
   - _note:_ when `publish` is triggered, `save` is also triggered
   - given one param with uri and ops: `{ uri: pageUri, ops: [{type: put|del, key: string, value: string}] }`

`module.exports.unpublish`
   - hook triggered on page unpublish
   - _note:_ when `unpublish` is triggered, `delete` is also triggered
   - given one param: `{ url: pageUrl, uri: pageUri }`

### Page-specific Methods

Note that `publish` and `unpublish` are used by certain plugins, but they will be deprecated in a future major Amphora version in favor of `publishPage` and `unpublishPage` (which have more standardized arguments).

`module.exports.createPage`
  - hook triggered on page creation
  - _note:_ when `createPage` is triggered, `save` is also triggered
  - given one param with uri, data, and user: `{ uri: pageUri, data: pageData, user: req.user }`

`module.exports.publishPage`
  - hook triggered on page publish (db batch with page@published)
  - _note:_ when `publishPage` is triggered, `save` and `publish` are also triggered
  - given one param with uri, data, and user: `{ uri: pageUri, data: pageData, user: req.user }`

`module.exports.unpublishPage`
  - hook triggered on page unpublish
  - _note:_ when `unpublishPage` is triggered, `delete` and `unpublish` are also triggered
  - given one param with uri, url (that was just removed), and user: `{ uri: pageUri, url: pageURL, user: req.user }`

`module.exports.schedulePage`
  - hook triggered on page scheduling
  - _note:_ when `schedulePage` is triggered, `save` is also triggered
  - given one param with uri, data, and user: `{ uri: scheduledItemUri, data: { at: timestamp, publish: pageUri }, user: req.user }`

`module.exports.unschedulePage`
  - hook triggered on page unscheduling
  - _note:_ when `unschedulePage` is triggered, `save` is also triggered
  - given one param with uri, data, and user: `{ uri: scheduledItemUri, data: { at: timestamp, publish: pageUri }, user: req.user }`

### Layout-specific Methods

Layouts only have one hook, called `publishLayout`. It is called with the same arguments as `publishPage`, namely `{ uri, data, user }`.
