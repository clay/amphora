---
id: subsites
title: Creating Subsites
sidebar_label: Creating Subsites
---

## Creating a Subsite

Subsites are versions of a main site that have a different host/path configuration and different content, but site application code is shared. This feature works great with locale and internationalization support. 

There might be a time when you want to expand your site, whether regionally, categorically, or for a variety of other reasons. For instance, say you have a sports site. In the US, you'd want your site to use a .com TLD and have its content focused on the American sports of Baseball, Football, etc. Now, if you want to expand into the UK, you might want to use a .co.uk domain, and have content more geared toward Football (Soccer), Rugby, and Cricket. Subsites give you this ability, while allowing for shared logic in components, styles, etc.

example component model.js:
```javascript
  module.exports.render = (uri, data, locals) => {
    // shared logic between parent and subsites
    if (locals.site.slug === 'site-name') {
      // do something
    }

    // subsite specific logic
    if (locals.site.subsiteSlug === 'site-name/subsite-name') {
      // do something unique!
    }
  }
```

### Dependencies
- [`amphora`](https://github.com/clay/amphora): v7.6.0
- [`amphora-auth`](https://github.com/clay/amphora-auth): v1.2.0
- [`amphora-search`](https://github.com/clay/amphora-search): v7.4.0
- [`clay-kiln`](https://github.com/clay/clay-kiln): v8.13.0
- [`claycli`](https://github.com/clay/claycli): v3.11.0

### Configuration
Subsites fall underneath a parent site inside of its own `/sites/site-name/subsites/subsite-name` directory. All sites/subsites inside of the `/sites/site-name` directory share the same `site.slug` property, but they all have a unique `site.subsiteSlug` property that is generated from the concatenation of the subsite name & parent site name in the format: `site-name/subsite-name`.

A subsite by default copies all configurations, media assets, and bootstrapping from the parent site. The subsite config then *overrides* any parent properties provided in the `bootstrap.yml`, `config.yml`, `index.js`, or `media` directory. If these files and this directory do not exist, you can assume that the site will behave exactly like the parent site.

A sample file structure for a subsite:

```
.sites
|   +-- site-name
|   |   +-- bootstrap.yml
|   |   +-- config.yml*
|   |   +-- index.js
|   |   +-- subsites
|   |   |   +-- subsite-name
|   |   |   |   +-- bootstrap.yml
|   |   |   |   +-- config.yml
|   |   |   |   +-- index.js
|   |   |   |   +-- media
|   |   |   |   |   +-- icon.120x120.png
```
'*' = required

#### config.yml
The only requirement for a subsite is that the `host` and `path` make up a unique location. All properties are copied from the parent site, so if you need a different value for any of the properties, it will need to be overridden by including it in its `config.yml`. You can find a list of configurable site parameters here: [Configuring Your Site](https://github.com/clay/amphora/tree/master/docs/configuration.md).

#### bootstrap.yml
The parent bootstrap.yml will be run on each subsite. If there are additional components to be bootstrapped for a subsite, they will need to be provided in the subsite's `bootstrap.yml`. If there are differences between a parent and subsite component instance, it can be overridden by providing it in the `bootstrap.yml`.

#### index.js
The parent site controller is also inherited by each subsite. If you'd like to add additional functionality, such as routes, you can add them to a subsite by including them to the subsite's `index.js`

#### media
On build, `claycli` will first copy all parent media assets to the public directory, `public/media/sites/site-name/subsite-name`. Afterwards, it will copy all subsite media assets to the same directory, overriding any of the previously copied assets from the parent.
