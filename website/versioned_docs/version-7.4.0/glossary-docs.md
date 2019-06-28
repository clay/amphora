---
id: version-7.4.0-glossary-docs
title: Glossary
sidebar_label: Glossary
original_id: glossary-docs
---
## bootstrap

An instantiation argument that defaults to `true`. If set to `false`, the internal [bootstrap](bootstrap) process will be skipped.

## locals.publishUrl

Property that only is available to components during the save of an `@published` instance of a component. This value is determined by whatever url is determined during [publishing](publish#setting-publish-rules).

## _version

A data property managed by Amphora when using the [Data Versioning](data_versioning) feature. This property should not be overwritten to by any `model.js` or external source. If it is, data upgrades will be re-run. Please see the _Data Versioning_ page for more information.
