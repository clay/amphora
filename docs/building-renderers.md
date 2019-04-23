---
id: building-renderers
title: Building Custom Renderers
sidebar_label: Building Custom Renderers
---

The docs address the renderer API as of Amphora v6.x.

A custom renderer can do anything your needs might require when it comes to transforming JSON data from Amphora. All that is required is that your renderer export a `render` function. This function will receive the arguments described below:

* `data` \(Object\): The composed data for the page or component. This data will have passed through complete data composition, including `model.js` files and renderer specific models. This is the data you'll send to your templating language or formatting logic.
* `meta` \(Object\): This object contains three crucial properties:
  * `locals` \(Object\): The [Express locals object](https://expressjs.com/en/api.html#res.locals) that has also been annotated by Amphora. This is the same `locals` object passed to component's `model.js` files during composition.
  * `_ref` \(String\): This is the uri that was requested to be rendered. If you're rendering a `page` or an Express route, this will be the page uri. If you're rendering a component directly, this will be the component's uri.
  * `_layoutRef` \(String\): This is only provided when rendering a `page` and its value corresponds to the `layout` uri on the page. This is needed for finding the root template when rendering with different templating languages, such as Handlebars.
* `res` \(Object\): Simply the [Express Response](https://expressjs.com/en/4x/api.html#res) object. This means **it is the responsibility of the renderer to terminate the response**.

An example renderer:

```javascript
module.exports.render = function (state, res) {
  var htmlResponse = ...; // Use state object to construct some HTML response..

  res.html(htmlResponse);
};
```

Having access to the Express Response object \(`res`\) means a renderer can attach custom headers, choose the response type and any other task you might need.
