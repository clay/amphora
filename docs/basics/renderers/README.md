# Renderers

{% hint style="info" %}
This page discusses renderer purpose and affordances, but once a renderer is written it enables you to write renderer specific `model.js` files. If you already have a functional renderer and are looking for information on renderer models, [see this page](https://claycms.gitbook.io/amphora/advanced/renderer-models).
{% endhint %}

The main concern of Amphora is JSON, but to serve content on the web we need to support HTML, XML and any other format that might arise in the future.

Rather than hardcoding support for different formats or supporting different rendering engines, Amphora provides an API that allows you to simply plug in any type of renderer. At instantiation time, Amphora can be passed a renderer object:

```javascript
amphora({
  ... // other instantiation properties
  renderers: {
    ...
  }
})
```

## The Renderers Object

The object that is passed in as the `renderers` value should be key value pairs where the key represents the extension of the request \(`.html`, `.rss`, etc.\) and the value is the renderer that should handle the formatting of the JSON to the expected output. Let's use [Amphora HTML](https://github.com/clay/amphora-html) as an example:

```javascript
const amphora = require('amphora'),
  amphoraHtml = require('amphora-html');

return amphora({
  ...
  renderers: {
    html: amphoraHtml
  }
})
```

Whenever any request comes into Amphora with a `.html` extension, the JSON data that Amphora composes will be passed to Amphora HTML for rendering. For information on how to write your own renders you can read [this doc on writing a custom renderer](https://github.com/clay/amphora/tree/3a300d4ec7af113afd102b4506e7566eb617c9c8/docs/topics/custom-renderers.html).

## `default` Renderer

The renderers object also accepts a `default` property which is used to define the renderer for a route whose request extension is not defined. For example, say you were making a request to `foobar.com`. The request does not explicitly declare the content type of the asset that lives at this url so Amphora would not know what format the user expects. By defining the `default` property in the renderers object you can explicitly tell Amphora which renderer to pass by specifying an extension.

```javascript
const amphora = require('amphora'),
  amphoraHtml = require('amphora-html');

return amphora({
  ...
  renderers: {
    html: amphoraHtml,
    default: 'html'
  }
})
```



