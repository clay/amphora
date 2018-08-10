# Glossary

## `bootstrap`

An instantiation argument that defaults to `true`. If set to `false`, internal [bootstrap](startup/bootstrap.md) process will be skipped.

## `locals.publishUrl`

A propery only availble to components during the save of an `@published` instance of a component. This value is determined by whatever url is determined during [publishing](basics/publishing.md#setting-publish-rules).

## `_version`

A data property managed by Amphora when using the [Data Versioning](advanced/upgrade.md) feature. This property should not be overwritten to by any `model.js` or external source. If it is, data upgrades will be re-run. Please see the _Data Versioning_ page for more information.

