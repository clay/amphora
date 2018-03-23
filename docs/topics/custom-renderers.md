# Custom Renderers

A custom renderer can do anything your needs might require when it comes to transforming JSON data from Amphora. All that is required is that your renderer export a `render` function. This function will receive a `state` object and an [Express Response](https://expressjs.com/en/4x/api.html#res) object, meaning **it is the responsibility of the renderer to terminate the response**.

An example renderer:

```javascript
module.exports.render = function (state, res) {
  var htmlResponse = ...; // Use state object to construct some HTML response..

  res.html(htmlResponse);
};
```
Having access to the Express response object (`res`) means a renderer can attach custom headers, choose the response type and any other task you might need.

## The `state` Object

This object's API is currently being revised for Amphora 6.x. For forward compatibility, please try to only use the following properties:

- `locals`: The same `locals` object exposed to a component in the model.js
- `_data`: The composed `JSON`
- `_layoutRef`: The layout component's uri when rendering a page
- `_ref`: The component or page uri that is being rendered
