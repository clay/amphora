Routes
======

This is a technical document about how routing in Amphora is performed.  It also informs any further technical decisions about the growth of the library, and contains any ideas that we're adhering to for consistency.

For a broader and less specific overview of routing, please see the [project's readme document](https://github.com/nymag/amphora)

## Table of Contents

- [Components](#components)
- [Pages](#pages)
- [URIs](#uris)
- [Lists](#lists)
- [Users](#users)
- [Schedule](#schedule)
- [Versions](#versions)
- [RESTful API](#restful-api)
- [Errors](#errors)


## Components

### Overview

```
/components
/components/:name
/components/:name@:version
/components/:name.html
/components/:name.json
/components/:name@:version.html
/components/:name@:version.json
/components/:name/instances
/components/:name/instances/:id
/components/:name/intsances/:id.html
/components/:name/intsances/:id.json
/components/:name/instances/:id@:version
/components/:name/instances/:id@:version.html
/components/:name/instances/:id@:version.json
```

### List of components
`GET /components` will return a list of the available known components.  This will be all the components defined in the `/components` folder of the current application, and also any components installed through the node package manager (npm).  

Example: `GET /components`
```json
[
  "text",
  "image",
  "paragraph",
  "article"
]
```

`GET /components/:name/instances` will return a list of the available instances within a particular component type.

Example: `GET /components/text/instances`
```json
[
  "/components/text/instances/abc",
  "/components/text/instances/def",
  "/components/text/instances/def@published"
]
```

### Component Data

You can grab the default data for a component, data for a specific instance, or even data for a specific version (of an instance). GETs and PUTs to these endpoints behave as you would expect from a RESTful api (they return what you send them). GETs and PUTs to the `.json` and `.html` extensions also work, but they'll return the composed (i.e. a component and its children) JSON and HTML, respectively.

### Modifying components
`GET /components/:name[/instances/:id][@:version[.:extension]]` will return a component.  The form the data is based on the extension (.html, .json, .yaml), or the Accepts header of the request.  

Requesting data without a version will return the latest saved version.  Some versions have special rules (see [Propagating Versions](#propagating-versions)), but any other version name can be used to specially tag any particular version.

`PUT /components/:name[/instances/:id][@version]` will save the data such that `GET`ing the same uri will return exactly what was put there.

### Component Logic

Components may have pre-render and pre-save hooks, which do logic before rendering and saving, respectively. To add these, create a `model.js` file in the component's folder, and export `render` and/or `save` methods. Both of these methods should return objects with the component data, which may be wrapped in promises.

_Note:_ It is much better to do component logic when saving rather than every time it wants to render.

```js
module.exports.render = function (ref, data, locals) {
  // do logic
  return data; // will be sent to the template
}

module.exports.save = function (ref, data, locals) {
  // do logic
  return data; // will be sent to the database
}
```

You may pass `componenthooks=false` as a query param when doing API calls if you want to completely bypass the `model.js` (e.g. if you've already run through the logic client-side).

### Legacy Server Logic

This feature is deprecated as of amphora v2.11.0 and will be removed in the next major version (it is supplanted by the isomorphic `model.js` files). Legacy server-side logic lives in a `server.js` or `index.js` file in the component's folder, and has a few differences from the `model.js`:

* the default exported function (run on `GET`) does not automatically receive data from the database, and must fetch it manually
* the `put()` should return a database operation or array of operations (which may be wrapped in promises), rather than the component data itself
* these files are _only_ run server-side, and will not be optimised to work in kiln

```js
module.exports = function (ref, locals) {
  //return Promise with data
  return Promise.resolve({"hey": "hey"});
};
module.exports.put = function (ref, data) {
  //return Promise with operations to be performed in a batch
  return Promise.resolve([{
    type: 'put',
    key: '/components/text',
    value:'{"hey": "hey"}'}
  ]);
};
```

## Pages

### Overview
```
/pages
/pages/:name
/pages/:name.html
/pages/:name.json
/pages/:name@:version
/pages/:name@:version.html
/pages/:name@:version.json
```

Pages consist of a layout and a list of areas.  Each area defined in a page maps to a area in the layout template.  For example:
```json
{
  "layout": "/components/feature-layout",
  "center": ["/components/article/instances/3vf3"],
  "side": [
    "/components/share",
    "/components/newsletter"
  ]
}
```
The layout component in this example has two areas: center and side.  When the page is displayed, the components listed here will be placed into the matching areas in the layout.

### Page Data

GETs and PUTs to pages work similarly to components. API calls without an extension will update/return data for that page, while the `.json` and `.html` extensions will return the composed (page and layout, and their child components) JSON and HTML, respectively.

### Publishing

Publishing a page has a special convenience behavior where all components referenced by the page will also be published.  (Example: https://github.com/nymag/amphora/pull/78)

## URIs

```
/uris/<base64(:path)>
```

A URI is used to redirect some slug or URI to another page or component.  They can also redirect to other uris (establishing a 301 redirect), or several uris can point to the same resource.  URIs are stored as Base64, so:

- `example.com` is `/uris/ZXhhbXBsZS5jb20=` => `/pages/jdskla@published`
- `example.com/other/` is `/uris/ZXhhbXBsZS5jb20vb3RoZXI=` => `/pages/4revd3s@published`

A URI is assumed to be pointing at the `@published` version if another version is not provided.  Therefore, only published content or specially tagged versions can be publicly exposed through URIs.

## Lists

```
/lists
/lists/:id
```

Lists are a _temporary_ solution until search functionality is discussed.  It is currently used for the tags component and the autocomplete behavior as a temporary place to store lists of information.  It can store any list of data on a `PUT`, and return back the same list of data with a `GET`.

## Users

### Overview
```
/users
/users/:id
```

Each user has a `username` and `provider`, which determines how they authenticate over oauth. Users can also have other data, including `name`, `imageUrl`, and `title`.

## Schedule

```
/schedule
/schedule/:id
```

Schedule is a list of pages or components that will be published in the future.  Items in this list will be published when the time passes.  Each item has two properties: `at`, which is a UNIX timestamp, and the `publish` property that is a reference to what will be published after that time.

When an item is scheduled, a `@scheduled` version is created on the item that will be published.  When the item is eventually published, the `@scheduled` version will be removed.  The `@scheduled` version is a reference to the actual schedule uri that can be deleted to cancel the scheduled publication.

### List of scheduled items

`GET /schedule` will return a list of scheduled items, such as:
```json
[
  {
    "_ref": "domain.com/some-path/schedule/3f-abc",
    "at": 44392893402093,
    "publish": "abc"
  }
]
```

### Add a scheduled item

`POST /schedule` will add an item to be published in the future. The format of the item should be of
```json
{
  "at": 44392893402093,
  "publish": "<uri to be published>"
}
```
where the `at` is a UNIX timestamp and the `publish` is a ref to a page or component.  On success, it will return a 201 with a reference to the schedule uri that was created.


### Remove a scheduled item

`DELETE /schedule/:some-id` will remove the scheduling of a publish in the future.  On success, it will return a 200 with
```json
{
  "at": 44392893402093,
  "publish": "<uri that was to be published>"
}
```

## Versions

### Propagating Versions

Some versions have a special behavior called _propagating_, which any reference within their data is changed to be the same version as itself.

The current propagating versions are:
* published
* latest

## RESTful API

We try to follow the [REST](https://en.wikipedia.org/wiki/Representational_state_transfer) standard when making decisions about changes to the API.  In particular, we are adhering to

1.  _Individual resources are identified by URI._  Therefore, there is no need to return an id as part of the data of a request if that id was used to fetch the data.  In many environments (production, development, staging) hostnames can be dynamic, so we can optionally omit the hostname and assume that the resource is available at the same host as a referring resource.

2.  _When a client holds a representation of a resource, it has enough information to modify the resource._  Any random ordering of `GET` and `PUT` requests to the same uri with the returned data will not result in any change of state (beyond the separate audit trail that such operations took place).

3.  _Messages always include enough information to process a resource, including MIME type and cacheability._  All resources are returned with appropriate Content-Type, Cache, and Vary headers.  That means resources that should be cached, like published content, are marked appropriately as cacheable.

4.  _HATEOAS: no assumptions about additional actions are made without being described in the resource itself._  Excluding the basic HTTP method calls, we tell the client about additional resources available related to the current resource.  

    Currently, we link to child resources with `{ _ref: 'domain.com/full/resource/uri' }`. There is no assumption that the client knows about these child resources implicitly.  More importantly, we don't expect the client to know about where resources are, their types, or that they should be linked together in any particular way, so we always reference to linked resources with a full uri.

    For more information about the design decisions of `_ref`, see https://github.com/nymag/amphora/issues/108

### Namespacing

It might be a good idea to namespace this API behind versions, such as `/v1/` or `/v2/`, or `/services/`, or even `/clay/`.  This can be done by adjusting the hostname, or through a reverse proxy like Varnish.  Putting different versions behind Varnish might be particularly useful so that previous versions of an application can be run at the same time as newer versions to service old and new clients until previous versions can be deprecated.

## Errors

### Ordering of HTTP Errors

The API must follow a specific ordering for the priority of errors to return.  Even though _multiple_ things might be
wrong with a request, consistent testability requires that the type of error returned for any particular request should
not change without deliberate thought.  The current order of errors are:

1. Component invalid: There is no resource (component) by that name returns 404 for the _entire_ route (including all sub-routes).
2. Allow header: That method is not allowed
3. Accept header: The request's acceptable data type is not supported by this route.
4. Resource missing: A resource with this specific identifier does not exist.

### 304 HTTP Code

We are not going to support returning 304s for several reasons:

1. Most people will have a reverse cache like Varnish in front of byline endpoints in production.
2. The ROI for supporting 304s is very low for non-browser non-html clients.
