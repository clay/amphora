---
id: version-7.4.0-plugin
title: Plugin
sidebar_label: Plugin
original_id: plugin
---

Plugins allow you to extend the functionality of your site by allowing you to attach routes to each site's router in your instance. While this may not seem any different than [defining routes for your site](routes), the basic site router will assign routes that only respond to `GET` requests and will run through Amphora's composition/rendering functionality. Plugins allow you to assign routes that respond to any [Express supported request method](https://expressjs.com/en/4x/api.html#app.METHOD) with your own custom handlers.

## Anatomy of a Plugin

A plugin should be a function and will receive the following arguments:

- `router`: the router for the site. Attach listeners and handlers as you would to any Express router.
- `db`: an instance of Amphora's internal database connector.
- `bus`: a passthrough of Amphora's internal event bus publish method so that a plugin can publish to the event bus on its own.
- `sites`: the internal `sites` service, used for discovering which site in your instance a URI belongs to.

An example plugin might look like the following:

```javascript
module.exports = (router, db, bus, sites) => {
  // Attach a route that responds to PUT requests
  router.put('/_coolroute', (req, res) => {
    return db.put(req.uri, req.body)
      .then(() => {
        // Pub to the event bus that the route was called
        bus('coolRouteCalled', { body: req.body });
        // Respond to the request
        res.json({ status: 200 })
      });
  });

  // Note: we're not explicitly returning anything, but if we were
  // performing some async action we could return a Promise
}
```

You aren't required to explicitly `return` any value from your plugin, but you can return a `Promise` if needed.

## Lifecycle of Plugin

A plugin is called...

- once for every site in your Clay instance
- _after_ the storage module is instantiated
- _before_ bootstrapping happens
