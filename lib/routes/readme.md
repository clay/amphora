Routes
======

This is a technical document about how routing in Byline is performed.  It also informs any further technical decisions about the growth of the library, and contains any ideas that we're adhering to for consistency.

For a broader and less specific overview of routing, please see the [project's   readme document](../.)

## Table of Contents

- [Components](#components)
- [Pages](#pages)
- [URIs](#uris)
- [Lists](#lists)
- [Versions](#Versions)
- [RESTful API](#restful-api)
- [Errors](#errors)


## Components

### Overview

```
/components
/components/:name
/components/:name@:version
/components/:name.html
/components/:name@:version.html
/components/:name/instances
/components/:name/instances/:id
/components/:name/intsances/:id.html
/components/:name/instances/:id@:version
/components/:name/instances/:id@:version.html
```

### List of components
`GET /components` will return a list of the available known components.  This will be all the components defined in the `/components` folder of the current application, and also any components installed through the node package manager (npm).  

Example: `GET /components`
```json
[
  "text",
  "image",
  "paragraph",
  "story"
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


### Modifying components
`GET /components/:name[/instances/:id][@:version[.:extension]]` will return a component.  The form the data is based on the extension (.html, .json, .yaml), or the Accepts header of the request.  

Requesting data without a version will return the latest saved version.  Some versions have special rules (see Propagating Versions), but any other version name can be used to specially tag any particular version.  Some versions are also created automatically to create an audit trail when saving to latest (see Timestamped Versions).

`PUT /components/:name[/instances/:id][@version]` will save the data such that `GET`ing the same uri will return exactly what was put there.

### Server logic
Some components want special server-side logic.  This can be done by creating a `server.js` or `index.js` file in their component's folder.

```js
module.exports = function () {
  //return a Promise with whatever data should be returned on a GET
};
```

Other server-side logic can be overridden as well.  This is especially useful for performing logic on a `PUT` instead of a `GET`.

```js
module.exports = function () {
  //return Promise with data
  return Promise.resolve({"hey": "hey"});
};
module.exports.put = function () {
  //return Promise with operations to be performed in a batch
  return Promise.resolve([{
    type: 'put',
    key: '/components/text',
    value:'{"hey": "hey"}'}
  ]);
};
module.exports.del = function () {
  //return Promise with data;
  return Promise.resolve({"hey": "hey"});
};
module.exports.list = function() {
  //return Promise or pipeable Stream
  return fs.createReadStream('some file');
};
```

## Pages

### Overview
```
/pages
/pages/:name
/pages/:name@:version
/pages/:name@:version.html
/pages/:name/schedule
/pages/:name/schedule/:event
```

Pages consist of a layout and a list of areas.  Each area defined in a page maps to a area in the layout template.  For example:
```json
{
  "layout": "/components/vulture-layout-2015",
  "center": ["/components/story/instances/3vf3"],
  "side": [
    "/components/share",
    "/components/newsletter"
  ]
}
```
The layout component in this example has two areas: center and side.  When the page is displayed, the components listed here will be placed into the matching areas in the layout.

### Schedule

Whenever a page is published, an event is added to its schedule with the current time and version that was published.  `PUT`ing an event with a future time will schedule a publication of that particular version in the future.

## URIs

```
/uris/<base64(:path)>
```

A URI represents a `redirect`.  They are used to redirect some slug or URI to another page or component.  They can also redirect to other uris, or several uris can point to the same resource.  URIs are stored as Base64, so:

- `example.com` is `/uris/ZXhhbXBsZS5jb20=` => `/pages/jdskla@published`
- `example.com/other/` is `/uris/ZXhhbXBsZS5jb20vb3RoZXI=` => `/pages/4revd3s@published`

## Lists

```
/lists
/lists/:id
```

Lists are a _temporary_ solution until search functionality is discussed.  It is currently used for the tags component and the autocomplete behaviour as a temporary place to store lists of information.  It can store any list of data on a `PUT`, and return back the same list of data with a `GET`.

## Versions

### Propagating Versions

Some versions have a special behaviour called _propagating_, which any reference within their data is changed to be the same version as itself.

The current propagating versions are:
* published
* latest

### Timestamped Versions

When new data is saved to a component or a page, a new _version_ is automatically created based on the current time and server instance such that if these versions are sorted in alphanumerical order, they will be in order of creation.

## RESTful API

We try to follow the [REST](https://en.wikipedia.org/wiki/Representational_state_transfer) standard when making decisions about changes to the API.  In particular, we are adhering to

1.  _Individual resources are identified by URI._  Therefore, there is no need to return an id as part of the data of a request if that id was used to fetch the data.  In many environments (production, development, staging) hostnames can be dynamic, so we can optionally omit the hostname and assume that the resource is available at the same host as a referring resource.

2.  _When a client holds a representation of a resource,
it has enough information to modify the resource._  Any random ordering of `GET` and `PUT` requests to the same uri with the returned data will not result in any change of state (beyond the separate audit trail that such operations took place).

3.  _Messages always include enough information to process a resource, including MIME type and cacheability._  All resources are returned with appropriate Content-Type, Cache, and Vary headers.  That means resources that should be cached, like published content, are marked appropriately as cacheable.

4.  _HATEOAS: no assumptions about additional actions are made without being described in the resource itself._  Excluding the basic HTTP method calls, we tell the client about additional resources available related to the current resource.  

    Currently, we link to child resources with `{ _ref: '/full/resource/uri' }`. There is no assumption that the client knows about these child resources implicitly.  More importantly, we don't expect the client to know about where resources are, their types, or that they should be linked together in any particular way, so we always reference to linked resources with an absolute uri.

### Namespacing

It might be a good idea to namespace this API behind versions, such as `/v1/` or `/v2/`, or `/services/`, or even `/byline/`.  This can be done by adjusting the hostname, or through a reverse proxy like Varnish.  Putting different versions behind Varnish might be particularly useful so that previous versions of an application can be run at the same time as newer versions to service old and new clients until previous versions can be deprecated.

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
