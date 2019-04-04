---
id: storage
title: Storage API
sidebar_label: Storage API
---

The Storage API for Amphora is meant to provide a bridge between Amphora's composition layer and how data for sites in Clay is persisted. At its core, Amphora maintains six top-level data structures (Components, Layouts, Pages, Users, Uris, Lists) and it's the responsibility of the storage module to store and compose the data.

Currently, it is possible to write any storage module that best fits the needs of your Clay instance, but the platform officially supports a Postgres storage module that [can be found here](https://github.com/clay/amphora-storage-postgres).

For more information in writing your own storage module, you can refer to this module as an example.

---

## Setup

The function in which the storage module should connect to a database as well as perform any other instantiation operations, such as setting up required tables/collections.

**Returns:** `Promise`

---

## Put

This function is a simple write to the DB for any of the Clay data structures. It should be able to handle writing one individual component/layout/page/list/uri/user. The return value should

**Arguments:** `key` (String), `value` (Object)

**Returns:** `Promise<Object|String>`

---

## Get

This function should return one individual instance of any of the data types.

**Arguments:** `key` (String)

**Returns:** `Promise<Object|String>`

---

## Del

This function should delete one individual instance of any of the data types. The value of the item that was just deleted should be returned.

**Arguments:** `key` (String)

**Returns:** `Promise<Object|String>`

---

## Batch

A function which accepts an array of objects (operations), with each object representing one "save" action for any of the supported data structures. An operation is an object with the following structure:

- `key` (String): the id of the individual component/layout/page/uri/list/user instance
- `value` (Object): the value to be saved for the key

```javascript
// Example operations array
[{
  key: 'domain.com/_components/foo/instances/bar',
  value: {
    foobar: 'baz'
  }
}, {
  key: 'domain.com/_pages/foobarbaz',
  value: {
    layout: 'domain.com/_layouts/layout/instances/default',
    main: [
      'domain.com/_components/foo/instances/bar'
    ]
  }
}]
```

**Arguments:** `ops` (Array)

**Returns:** `Promise`

---

## Get Meta

Retrieves the metadata for a page/layout. The function will always be called with the raw page/layout uri, not a uri ending in `/meta`.

For example, Amphora will respond to a request for `domain.com/_pages/foo/meta` by making the following invoking the `getMeta` function of the storage module with a key of `domain.com/_pages/foo` and then returning the data to the client. If no data is returned, Amphora will return an empty object.

**Arguments:** `key` (String)

**Returns:** `Promise<Object>`

---

## Put Meta

Saves the metadata for a page/layout. The function will always be called with the raw page/layout uri, not a uri ending in `/meta`.

**Arguments:** `key` (String), `value` (Object)

**Returns:** `Promise<Object>`

---

## Patch Meta

Updates properties on the metadata object with the values passed into the request. This method should _never_ update the entire metadata object with what's passed to the function or metadata will be destroyed when users edit data.

If the storage solution does not support partial updates to the data then the function will need to request the full object from the database, merge the old data with the new data and then save the merged object.

**Arguments:** `key` (String), `value` (Object)

**Returns:** `Promise<Object>`

---

## Create Read Stream

Amphora responds to certain requests with a Stream of data, such as a request to `domain.com/_components/foo/instances`. In this case, Amphora will read all the instances of the `foo` component from the database and send back an array of component uris. To handle this in the most memory efficient way, Amphora processes the data from the DB as a Stream, and the `createReadStream` function should return a Read Stream for Amphora to act on.

The function will receive an object of options with three properties:

- `prefix` (String): the string which should prefix all of the keys that Amphora needs to display data for
- `keys` (Boolean): if `true`, the stream should return the uri of all data matching the prefix
- `values` (Boolean): if `true`, the stream should return the values of all uris matching the prefix

Using the example from earlier, if a request comes in for `domain.com/_components/foo/instances`, Amphora will pass an `options` object to the `createReadStream` function like so:

```javascript
// Example `options` object for the createReadStream function
{
  prefix: 'domain.com/_components/foo/instances',
  keys: true,
  values: false
}
```

Amphora would expect a Read Stream (in object mode) where each item in the stream is an object with the following signature:

- `key` (String)[Optional]: the uri of the component/layout/page/uri/user/list
- `value` (Object)[Optional]: the object/string value of the uri

Amphora will then take this data and make sure it's a properly formatted response to the client that initiated the request.

---

## Raw

The `raw` function is the most ambiguous function of the API but is the crux of plugins. To ensure that plugins can add in their own data to the database that your Clay instance is using, the db client is passed to each plugin included in your instance.

This puts a lot of responsibility on plugins to manage their own data properly but allows developers to write their own plugins to accomplish anything with Clay.

This function should simply be a pass through to the client that connects to the data store being used and should return a Promise for any executed action.

**Returns:** `Promise`
