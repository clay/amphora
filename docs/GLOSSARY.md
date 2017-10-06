# Glossary


## `bootstrap`

An instantiation argument that defaults to `true`. If set to `false`, internal [bootstrap](./lifecycle/startup/bootstrap.md) process will be skipped.

## `_version`

A data property managed by Amphora when using the [Data Versioning](./upgrade.md) feature. This property should not be overwritten to by any `model.js` or external source. If it is, data upgrades will be re-run. Please see the _Data Versioning_ page for more information.
