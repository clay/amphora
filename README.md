Byline
=========================

📰 _"A new way to organize, edit, and deliver the web, one component at a time"_

[![Coverage Status](https://coveralls.io/repos/nymag/byline/badge.svg?branch=master&t=cQ880T)](https://coveralls.io/r/nymag/byline?branch=master)

Powering [New York Magazine](http://nymag.com/), [Vulture](http://www.vulture.com/), [The Cut](http://thecut.com/), [Grub Street](http://www.grubstreet.com/), and [The Science of Us](http://www.scienceofus.com/).  
Created by New York Media.

## Table of Contents
* [Introduction](#introduction)
* [Installation](#organization)
* [Contribution](#contribution)
* [Advanced Topics](#advanced-topics)

## Introduction
Byline is guided by three principles:

1. Everything is a component
2. Ease of editing
3. Performance

Most of Byline is optional. Use what's useful to you. Ignore the rest.

## Installation
```
npm install --save byline
```

Byline separate's concerns into two areas that better map to the needs of web development: components and sites.  Create two new directories:

```
/components  (for your components)
/sites       (for site-level settings, routes, and assets)
```

### How to create a component
Components in Byline have the following structure:
```
/component-name     unique name of your web component
    template.html   your template, preferably semantic
    schema.yml      describes how the component's data is edited
```

All of these files are optional.

### How to create a template
Byline Components can be made with over 30+ templating languages using [multiplex-templates](https://github.com/nymag/multiplex-templates), such as [jade](https://github.com/jadejs/jade), [mustache](https://github.com/mustache/mustache.github.com),
[handlebars](https://github.com/wycats/handlebars.js/),
[nunjucks](https://github.com/mozilla/nunjucks),
[react](https://github.com/facebook/react).
Simply end your template file with an identifying extension and Byline will process it in the appropriate engine. For example, `template.jade` will compile from Jade, and `template.html` will simply output unprocessed html.

### How to create a schema

The [byline-editor](https://github.com/nymag/byline-editor) uses a component's schema.yml to determine how a component is edited. For example, if you want to edit the data in this template:
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

The schema.yml file also works without these values; everything is optional. More details about schema.yml are available in the [byline-editor](https://github.com/nymag/byline-editor) project.

## Contribution

Fork the project and submit a PR on a branch that is not named `master`.  We use linting tools and unit tests, which are built constantly using continuous integration.  If you find a bug, it would be appreciated if you could also submit a branch with a failing unit test to show your case.

## Advanced Topics

- [New Concepts For Developers and Designers](https://github.com/nymag/byline/wiki#for-developers-and-designers)
- [Routing](https://github.com/nymag/byline/tree/master/lib/routes)
