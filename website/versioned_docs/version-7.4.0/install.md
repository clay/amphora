---
id: version-7.4.0-install
title: Instantiation Arguments
sidebar_label: Instantiation Arguments
original_id: install
---

The most basic Amphora instantiation might look something like the following code:

```javascript
const express = require('express'),
  amphora = require('amphora'),
  app = express();


amphora({
  app: app // An Express instance
})
.then(function (router) {
  router.listen(port, ip);
  console.log(`Clay listening on ${ip}:${port}`);
})
.catch(function (error) {
  console.error(error);
});
```

Here we create a new Express app, pass it into Amphora and then Amphora will return an Express instance that has been modified with Clay core routes for each site you have created. Once that Express instance is returned \(`router` in this example\), we call the `listen` function, [just like an Express app would](http://expressjs.com/en/api.html#app.listen).

Assuming you have configured your sites properly and have some components, you'll now be able to access any Clay core routes and any data included in [internal bootstrap files](bootstrap) for components and sites will have been added.

## Instantiation Arguments

At instantiation time Amphora accepts a config object which contains properties that affect everything from user sessions to plugins for enhanced functionality. Below is a quick list of arguments with references to further documentation resources on the subjects.

* `app`: an Express instance. If one is not passed in, Amphora will create one during startup. The advantage of passing an instance into Amphora is the ability to add any middleware or other configuration necessary for your specific setup.
* `providers`: an Array of strings which correspond to the supported authentication services in Amphora: `apikey`, `ldap`, `google`, `slack`, and `twitter`.
* `sessionStore`: used for session management with user sessions when a provider is configured. For more information see the [Authentication](https://github.com/clay/amphora/tree/3a300d4ec7af113afd102b4506e7566eb617c9c8/docs/lifecycle/startup/authentication.md) page.
* `renderers`: an Object that references modules that can be used to transform component data into different formats. For example, [Amphora HTML](https://github.com/clay/amphora-html) is a module that renders component data to HTML using Handlebars templates. Renderers abide by an API that Amphora sets forth. The `renderers` Object should contain properties whose names correspond to request extensions and whose properties are the handlers for those extensions. A `default` property is used to specify the renderer to be used when no extension is specified in a request. For more information, see the [Renderers](building-renderers) documentation.
* `plugins`: an Array of Objects that have handlers for different plugin hooks that Amphora exposes. Different hooks are exposed for the startup, request and publish life cycles. For more information see the [Plugins](https://github.com/clay/amphora/tree/3a300d4ec7af113afd102b4506e7566eb617c9c8/docs/lifecycle/startup/plugins.md) page.
* `env`: an accommodation for renderers to expose environment variables used in `model.js` files on the client-side for [Kiln](https://github.com/clay/clay-kiln). These are only rendered in edit mode for a page. For a more thorough understanding of when/how these values are gathered and used, please see the [Component Models](renderer-models) documentation.
* `bootstrap`: a Boolean value which defaults to `true`. When set to `false` the internal [bootstrapping process](bootstrap#skipping-bootstrapping) will be skipped entirely. **It's advised not to set the value to** `false` **for production instances.**

