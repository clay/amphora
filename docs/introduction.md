---
id: intro
title: Introduction
sidebar_label: Introduction
---

![illustration of an amphora](/amphora/img/amphora-logo.svg)

_"A new way to organize, edit, and deliver the web, one component at a time."_

Powering [New York Magazine](http://nymag.com/), [Vulture](http://www.vulture.com/), [The Cut](https://www.thecut.com/), [Grub Street](http://www.grubstreet.com/).  
Created by New York Media.

## Table of Contents

* [Introduction](#introduction)
* [Installation](#installation)
* [Usage](#usage)
* [Contribution](#contribution)
* [Advanced Topics](#advanced-topics)

## Introduction

Amphora is a mixin for [Express](https://github.com/strongloop/express) that:

* Composes components into renderable pages
* Uses any key-value store of your choice \(e.g., Mongo, Redis, LevelDB, etc.\)
* Provides an API for managing instances of components, uris, and pages

[Components are reusable, configurable, self-contained bits of the web.](https://docs.clayplatform.com/docs/components)

Amphora is a core part of New York Media's Clay project, an open-source content management system.

It follows semver and is stable as of `v1.0.0`.

## Installation

```text
npm install --save amphora
```

## Usage

Clay separates concerns into two main areas: components and sites. Create two new directories in your project:

```text
/components  (where your custom components live)
/sites       (for site-specific settings, routes, and assets)
```

In your project's main server file \(e.g. `app.js`\), instantiate a new Amphora instance.

```javascript
var amphora = require('amphora'),
  port = process.env.PORT || 3000;

return amphora()
  .then(function (server) {
    server.listen(port);
  });
```

For additional configuration, you may pass in an Express app/router. You can also override the default templating engine\(s\) with your own.

```javascript
var app = require('express')(),
  amphora = require('amphora'),
  amphoraHtml = require('amphora-html'),
  port = process.env.PORT || 3000,
  env;

// add project-specific settings to your app
app.set('strict routing', true);
app.set('trust proxy', 1);

// add custom settings to your templating engine
env.addGlobal('projectName', process.env.PROJECT_NAME);

return amphora({
  app: app,
  renderers: {
    default: 'html',
    html: amphoraHtml
  }
}).then(function (server) {
  server.listen(port);
});
```

### How to create a component

Components in Clay have the following structure:

```text
/component-name     unique name of your component
    template.handlebars   your template
    schema.yml            describes how the component's data is edited
```

All of these files are optional.

### How to create a template

The template you create is dependent on whichever renderer you'd like to use. The Clay Core team supports an [HTML renderer](https://github.com/clay/amphora-html) using [Handlebars](http://handlebarsjs.com/) template, but the choice is yours. Either request a renderer or build one on your own!

### How to create a schema

[Kiln](https://github.com/nymag/clay-kiln) uses a component's schema.yml to determine how it is edited.

## Contribution

Fork the project and submit a PR on a branch that is not named `master`. We use linting tools and unit tests, which are built constantly using continuous integration. If you find a bug, it would be appreciated if you could also submit a branch with a failing unit test to show your case.

## Advanced Topics

* [New Concepts For Developers and Designers](https://github.com/nymag/amphora/wiki#for-developers-and-designers)
* [Bootstrapping Data](bootstrap)
* [Routing](routes)
* [Plugins](publish)
