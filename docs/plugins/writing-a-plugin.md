# Writing A Plugin

Writing a plugin is simple, all you need is to pass in an object to the [`plugins` instantiation argument](/docs/lifecycle/startup/instantiation.html#instantiation-arguments) who has properties which correspond to the hooks [listed on the hooks page](hooks.md).

An example plugin is below.

---

```javascript
// publish-plugin.js

function onPagePublish(uri, data, user) {
  console.log(`Page ${uri} was published by ${user.username}!`);
}

module.exports.pagePublish = onPagePublish;
```

```javascript
// index.js
const amphora = require('amphora'),
  myPlugin = require('publish-plugin');

// code before amphora instantiation...
amphora({
  plugins: [
    myPlugin
  ]
}).then(...)
```
---

This example leaves out the proper Amphora instantiation in favor of showing how to write a very simple plugin and pass it to Amphora. The key takeaway is that plugins are objects whose top level properties correspond to the names of [Amphora hooks](hooks.md) with the value of those properties being function handlers.
