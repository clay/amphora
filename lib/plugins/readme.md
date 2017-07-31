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
   - run once when the plugin is registered
   - given no params

`module.exports.routes`
   - run once when amphora adds routes for each site
   - given one param: express router

`module.exports.save`
   - hook triggered on db put or db batch containing put(s)
   - given db operations in one param: `[{type: string, key: string, value: string}]`

`module.exports.delete`
   - hook triggered on db delete or db batch containing delete(s)
   - given db operations in one param: `[{type: string, key: string, value: string}]`

`module.exports.publish`
   - hook triggered on page publish (db batch with page@published)
   - given one param with uri and ops: `{ pageUri: string, ops: [{type: string, key: string, value: string}] }`

`module.exports.unpublish`
   - hook triggered on page unpublish
   - given one param: `{ url: pageUrl, uri: oldData }`
