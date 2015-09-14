Amphora
=========================

📰 _"A new way to organize, edit, and deliver the web, one component at a time"_

[![Coverage Status](https://coveralls.io/repos/nymag/amphora/badge.svg?branch=master&service=github&t=WhTOg8)](https://coveralls.io/github/nymag/amphora?branch=master)

Powering [New York Magazine](http://nymag.com/), [Vulture](http://www.vulture.com/), [The Cut](http://thecut.com/), [Grub Street](http://www.grubstreet.com/), and [The Science of Us](http://www.scienceofus.com/).  
Created by New York Media.

## Table of Contents

* [Introduction](#introduction)
* [Installation](#organization)
* [Contribution](#contribution)
* [Advanced Topics](#advanced-topics)

## Introduction

Amphora is a partial-API that saves, publishes and composes data from a key-value store.  It is part of the larger Clay project, which is an open-source content management system for publications.

## Installation

```
npm install --save @nymdev/amphora
```

Clay separates concerns into two main areas: components and sites.  Create two new directories in your project:

```
/components  (where your custom components live)
/sites       (for site-level settings, routes, and site-specific assets)
```

In your project's main server file (e.g. `app.js`), instantiate a new Amphora instance by passing in an `express` app and/or the templating engines you want to use. Both of these are optional.

```js
var app = require('express')(),
  amphora = require('@nymdev/amphora'),
  nunjucks = require('nunjucks'),
  port = process.env.PORT || 3000,
  env;

// add project-specific things to your app
app.set('strict routing', true);

// instantiate templating engines if you need to add project-specific
// globals, mixins, filters, formatters, etc
env = nunjucks.configure('.', { autoescape: true });
env.addGlobal('projectName', 'MyCoolProject');

return amphora(app, { nunjucks: env })
  .then(function (server) {
    server.listen(port);
    console.log('Server listening on port ' + port);
  });
```

### How to create a component

Components in Clay have the following structure:
```
/component-name     unique name of your web component
    template.html   your template, preferably semantic
    schema.yml      describes how the component's data is edited
```

All of these files are optional.

### How to create a template

Clay Components can be made with over 30+ templating languages using [multiplex-templates](https://github.com/nymag/multiplex-templates), such as [jade](https://github.com/jadejs/jade), [mustache](https://github.com/mustache/mustache.github.com),
[handlebars](https://github.com/wycats/handlebars.js/),
[nunjucks](https://github.com/mozilla/nunjucks),
[react](https://github.com/facebook/react).
Simply end your template file with an identifying extension and Clay will process it in the appropriate engine. For example, `template.jade` will compile from Jade, and `template.html` will simply output unprocessed html.

### How to create a schema

The [Kiln](https://github.com/nymag/clay-kiln) project uses a component's schema.yml to determine how a component is edited. For example, if you want to edit the data in this template:

```html
<article>
  <h1>{{ title }}</h1>
  <p>{{ story }}</p>
</article>
```
you could create a schema.yml file that would describe how that data is edited:

```yaml
title:
  _type: text
  _required: true
  _placeholder: Type your title here
story:
  _type: textarea
  _placeholder: Type your life story here
```

The schema.yml file also works without these values; everything is optional. More details about schema.yml are available in the [Kiln](https://github.com/nymag/clay-kiln) project.

## Contribution

Fork the project and submit a PR on a branch that is not named `master`.  We use linting tools and unit tests, which are built constantly using continuous integration.  If you find a bug, it would be appreciated if you could also submit a branch with a failing unit test to show your case.

## Advanced Topics

- [New Concepts For Developers and Designers](https://github.com/nymag/amphora/wiki#for-developers-and-designers)
- [Routing](https://github.com/nymag/amphora/tree/master/lib/routes)
