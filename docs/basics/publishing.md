# Publishing

When setting up a site in your Clay instance you add a controller \(`index.js` file\) to define the rules around your sites. One of the rules you can define is _how to determine what url to publish a page to_. This can be done in a number of ways, whether it's just using the current date or analyzing the data in the content of the page. The implementation is your decision \(as long as the url matches a defined Express route\).

## Setting Publish Rules

To add publishing rules simply export an Array of functions under the `resolvePublishUrl` property in your site's controller.

```javascript
module.exports.resolvePublishUrl = [...];
```

The functions will receive the same arguments as a `model.js`/`upgrade.js`:

* `uri`: corresponds to the uri for the page being published
* `data`: the data for the page. Is not fully resolved page data, simply any references in page areas
* `locals`: information around the request, including the site it's being published to

Each function in the Array should return a Promise which only resolves a single string value, the url to be published to. The functions will be executed in order, but the _first one that resolves a value_ will be accepted and the rest will be ignored. This is "reject quickly/resolve slowly" pattern, meaning each of the functions should reject quickly if the data doesn't match a format they want.

```javascript
module.exports.resolvePublishUrl = [
  // regular dated articles
  function (uri, data, locals) {
    // ...do some logic with the data
    return Promise.resolve(`${http://coolsite.com/2017/01/cool-content.html}`);
  }
];
```

The value that the functions return should be the full url \(protocol, host, path, etc\). This value will be used when creating `uris` to map vanity urls to proper instances of `pages`.

## Dynamic Pages & Publishing

[Dynamic pages](routes.md#dynamic-pages) allow one page template to render data in a variety of ways by letting you build pages that take an input a url and use that to render data. Because a dynamic page's url can be anything the usual 1-to-1 relationship of uri to page instance cannot work. For that reason, publishing a dynamic page is slightly different than other pages. All you have to do is make sure that your page has the `_dynamic` property set to `true` and Amphora will handle the rest. For example:

```javascript
{
  "_dynamic": true,
  "layout": "domain.com/_components/layout/instances/example",
  "main": [
    ...
  ]
}
```

With this property set Amphora will publish the page without generating a uri. As long as your router properly defines the page to use for the route, the page will render its dynamic content.

## Modifying Page Data

Sometimes you'll want to modify the `@published` instance of page data when publishing. Rather than increasing the complexity of `resolvePublishUrl` to handle this task, a separate API is provided purely for this process.

```javascript
module.exports.modifyPublishedData = [...];
```

Exporting an Array in `modifyPublishedData` will signify to Amphora that page data should be modified before being saved. A common use case for this is adding a "last modified" property to the page data for site maps or other uses. Using this API, your controller might include the following:

```javascript
/**
 * Adds lastModified to page object
 * @param {object} pageData
 * @returns {object}
 */
function addLastModified(pageData) {
  pageData.lastModified = Date.now();
  return pageData;
}

module.exports.modifyPublishedData = [
  addLastModified
];
```

Each function in the `modifyPublishedData` will only recieve the page data, not the `locals` or `uri` of the page. The purpose of this is to discourage complex/time consuming modifications of the data. While functions in this Array can be both synchronous or asynchronous, it's advised to keep these functions simple.

## `publishUrl`

The question often arises of how to determine the vanity url of a page inside of a component's `model.js`. When a page is published, a `@published` instance of the page and every component instance is created. During this process, the `publishUrl` property is added to the `locals` object sent to each component. This essentially allows you to know when a `save` is being run on publish or not and is handy if the vanity url is needed in your component.

