# Routing

{% hint style="info" %}
These docs describe an API for routes that is current as of `v6.2.0`. Documentation for routing prior to this version will not be included because it will be deprecated in the future.
{% endhint %}

## Basic Routing

The `routes` API allows you to define routes to for your site within the site's controller \(`index.js`\) file. By exporting an array of route objects, Amphora will attach each route to the Express Router under a `get` handler. Previous versions of Amphora exposed the whole router to a developer to attach routes, but this has been updated in favor of greater stability/feature set in Amphora.

To assign routes for your site, export an Array like the one below at the `routes` property of your site's controller. Routing patterns should be [Express compatible](https://expressjs.com/en/guide/routing.html#route-paths).

```javascript
module.exports.routes = [
  { path: '/'},
  { path: '/:name'},
  { path: '/:year/:month/:slug' }
];
```

## Redirects

The router can handle redirects if you choose to handle these in Clay. Simply add the `redirect` property to your path object with the destination being the path you'd like to redirect users to. Make sure the destination path exists before adding in a redirect.

```javascript
// Redirects to the trailing slash of version of the `/blog/` path
module.exports.routes = [
  { path: '/'},
  { path: '/blog/'},
  { path: '/blog', redirect: '/blog/'}
];
```

## Dynamic Pages

One of the problems the router aims to solve is `dynamic pages`. In Clay there is a 1-1 relationship between a `_uri` and a a `_page`, which makes it extremely hard to build a dynamic system which doesn't require a single page for every public url.

An example of this would be building an archive page of blog posts that have a certain characteristic or tag. Ideally you'd have one page who would parse the url, find the value the user expects and then render a page with that value filled in all the places you would expect.

To do this in Clay you can use a `dynamic page`, which allows you to define ONE page to resolve all requests at a given route. For example:

```javascript
// All requests to `/archive/:tag` will be directed to `/_pages/someUniquePageId`
module.exports.routes = [
  { path: '/'},
  { path: '/archive/:tag', dynamicPage: 'someUniquePageId'}
];
```

By adding this path object into your `routes` object you'll be able to create one page to handle all the requests to the `/archive/*` route. **Make sure your** [**dynamic page is published**](publishing.md#dynamic-pages--publishing) **or else this won't work!**
