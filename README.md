Amphora
=========================

<img src="https://raw.githubusercontent.com/nymag/media/master/amphora-logo.png" alt="illustration of an amphora" height="150" align="left">

_"A new way to organize, edit, and deliver the web, one component at a time."_

[![CircleCI](https://circleci.com/gh/clay/amphora.svg?style=svg)](https://circleci.com/gh/clay/amphora) [![Coverage Status](https://coveralls.io/repos/nymag/amphora/badge.svg?branch=master&service=github&t=WhTOg8)](https://coveralls.io/github/nymag/amphora?branch=master)

Powering [New York Magazine](http://nymag.com/), [Vulture](http://www.vulture.com/), [The Cut](http://www,thecut.com/), [Grub Street](http://www.grubstreet.com/).  
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
* Uses any key-value store of your choice (e.g., Mongo, Redis, LevelDB, etc.)
* Provides an API for managing instances of components, uris, and pages

[Components are reusable, configurable, self-contained bits of the web.](https://github.com/nymag/amphora/wiki#clay-is-divided-into-components)

Amphora is a core part of New York Media's Clay project, an open-source content management system.

It follows semver and is stable as of v1.0.0.

## Installation

```
npm install --save amphora
```

## Usage

Clay separates concerns into two main areas: components and sites. Create two new directories in your project:

```
/components  (where your custom components live)
/sites       (for site-specific settings, routes, and assets)
```

In your project's main server file (e.g. `app.js`), instantiate a new Amphora instance.

```js
var amphora = require('amphora'),
  port = process.env.PORT || 3000;

return amphora()
  .then(function (server) {
    server.listen(port);
  });
```

For additional configuration, you may pass in an Express app / router. You can also override the default templating engine(s) with your own.

```js
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
```
/component-name     unique name of your component
    template.handlebars   your template
    schema.yml            describes how the component's data is edited
```

All of these files are optional.

### How to create a template

The template you create is dependent on whichever renderer you'd like to use. The Clay Core team supports an [HTML renderer](https://github.com/clay/amphora-html) using [Handlebars](http://handlebarsjs.com/) template, but the choice is yours. Either request a renderer or build one on your own!

### How to create a schema

[Kiln](https://github.com/nymag/clay-kiln) uses a component's schema.yml to determine how it is edited. [Visit the Kiln wiki](https://github.com/clay/clay-kiln/wiki/Schemas-and-Behaviors) for examples of how to write schema files for your components.

## Contribution

Fork the project and submit a PR on a branch that is not named `master`. We use linting tools and unit tests, which are built constantly using continuous integration. If you find a bug, it would be appreciated if you could also submit a branch with a failing unit test to show your case.

## Advanced Topics

- [New Concepts For Developers and Designers](https://github.com/nymag/amphora/wiki#for-developers-and-designers)
- [Bootstrapping Data](https://github.com/nymag/amphora/tree/master/lib/bootstrap.md)
- [Routing](https://github.com/nymag/amphora/tree/master/lib/routes)
- [Plugins](https://github.com/nymag/amphora/tree/master/lib/plugins)
