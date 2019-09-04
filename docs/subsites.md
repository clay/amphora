---
id: subsites
title: Creating Subsites
sidebar_label: Creating Subsites
---

## Creating a Subsite

Subsites are versions of a main site, that has a different host/path configuration and different content, but the site as a whole is a duplicate. This feature works great with locale support. 

There might be a time when you want to expand your site, whether regionally, categorically, or for a variety of other reasons. For instance, say you have a sports site. In the US, you'd want your site to use a .com TLD and have its content focused on the American sports of Baseball, Football, etc. Now, if you want to expand into the UK, you might want to use a .co.uk domain, and have content more geared toward Football (Soccer), Rugby, and Cricket. Subsites give you this ability, while allowing for shared logic in components, styles, etc.

### Dependencies
- [`amphora`](https://github.com/clay/amphora): v7.6.0
- [`amphora-search`](https://github.com/clay/amphora-search): v7.4.0
- [`clay-kiln`](https://github.com/clay/clay-kiln): v8.13.0
- [`claycli`](https://github.com/clay/claycli): v3.11.0

### Configuration
Subsites fall underneath a parent site inside of its own `/sites/site-name/subsites/subsite-name` directory. All sites/subsites inside of the `/sites/site-name` directory share the same `site.slug` property, but they all have a unique `site.subsiteSlug` property that is generated from the concatination of the subsite name & parent site name in the format: `site/subsite`.

A subsite by default copies all configurations, media assets, and bootstrapping from the parent site. The subsite config then *overrides* any parent properties provided in the `config.yaml`, `index.js`, or `/media` directory. 

A sample file structure for a subsite:

```
.sites
|   +-- site
|   |   +-- bootstrap.yml
|   |   +-- config.yml
|   |   +-- index.js
|   |   +-- subsites
|   |   |   +-- subsite
|   |   |   |   +-- bootstrap.yml
|   |   |   |   +-- config.yml
|   |   |   |   +-- index.js
|   |   |   |   +-- media
|   |   |   |   |   +-- icon.120x120.png
```

#### Required Config.yml properties
- protocol
- path
- host
- port
- assetPath