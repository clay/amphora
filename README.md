Byline
=========================

📰 _"A new way to organize, edit, and deliver the web, one component at a time"_

[![Coverage Status](https://coveralls.io/repos/nymag/byline/badge.svg?branch=master&t=cQ880T)](https://coveralls.io/r/nymag/byline?branch=master)

Powering [New York Magazine](http://nymag.com/), [Vulture](http://www.vulture.com/), [The Cut](http://thecut.com/), [Grub Street](http://www.grubstreet.com/), and [The Science of Us](http://www.scienceofus.com/).  
Created by New York Media.

## Installation
```
npm install --save byline
```

## Table of Contents
* [Introduction](#introduction)
* [Organization](#organization)
  * [Components](#components)
  * [Sites](#sites)
* [Tools](#tools)
* [Compilation](#compilation)
* [Configuration](#configuration)
* [Advanced Topics](#advanced-topics)

## Introduction
Byline is guided by three principles:

1. [Organize your code](##organize) in a maintainable way – to keep Developers sane.
// Developers...
2. [Edit your content](##edit) with friendly tools - so Creators are a button away from publishing.
// Creators...
// Users...
3. [Compile your website](##compile) for performance – so Users have a fast and happy experience.

Byline is a set of guidelines and tools that optimizes to the needs of each scope.

Most of Byline is optional. Use what's useful to you. Ignore the rest.

## Organizing with Byline
Byline helps you organize your website's code and assets with a focus on long-term maintainability through components. We start by discarding the typical MVC folder structure, and instead separate concerns into two areas that better map to the needs of web development: components and sites.

A typical folder structure of a Byline instance might look like this:
```
/components  (Web Components)
/sites       (site-level settings, routes, and assets)
```

## Web Components in Byline
### What are Web Components?
Web Components are reusable, configurable, self-contained pieces of the web. An official standard is still evolving, but Web Components aim to make development dramatically more maintainable.

### How does Byline Support Web Components?
Byline offers a way to embrace tomorrow's Web Components today, by combining today's Web Standards with tomorrow's philosophy of Web Components. No need to wait for browsers to implement a new common standard. Nor do you need to shim on the client-side, to the detriment of performance.

### Byline Components are Present and Future Compatible
As the official standard for Web Components emerges, Byline will evolve to support it, giving creations in Byline an upgrade path as browsers evolve.

### How to create a component in Byline
1. Make a new directory in `/components`.
2. Create the following structure:
```
/component-name   (unique name of your web component)
      /media          (JPG, PNG, GIF, and SVG assets)
      template.html   (HTML, preferably semantic)
      all.css         (CSS specific to your component)
      client.js       (client-side javascript)
      schema.yml      (describes the data specific to your component)
```

All files are optional. Use what's useful. Ignore the rest.

### Template Language Support
Byline Components can be made with over 30+ templating languages using [multiplex-templates](https://github.com/nymag/multiplex-templates), such as [jade](https://github.com/jadejs/jade), [mustache](https://github.com/mustache/mustache.github.com),
[handlebars](https://github.com/wycats/handlebars.js/),
[nunjucks](https://github.com/mozilla/nunjucks),
[react](https://github.com/facebook/react).
Simply end your template file with an identifying extension and Byline will process it in the appropriate engine.
For example, `template.jade` will compile from Jade, and `template.html` will simply output unprocessed html.

### Component-scoped CSS

(In the future, we will link to the [yo byline]() repo to justify the next paragraph.  We should keep it because we talk about Web Components so much, and this is how we mimick their scoping.)

Styles written in a component's CSS file will be scoped to that component on compilation.  To style the anchors of your component, simply write:
```CSS
a {
  /* anchor styles */
}
```

Byline plays well with [filename-breakpoints](https://github.com/nymag/responsive-filenames), so that every component be made responsive by wrapping CSS in a `@media` block derived from its filename.

Breakpoints can be defined as number ranges as well as by keywords.  For example:
```
all.css        -> no media query
0-600.css      -> @media (min-width: 599.9px) { ... }
600-1024.css   -> @media (min-width: 600px) and (max-width: 1023.9px) { ... }
1024+.css      -> @media (min-width: 1024px) { ... }
print.css      -> @media print { ... }
```

#### Client-side Javascript (client.js)
Any javascript you write in client.js gets minified and delivered with any page that has that component. How you write your javascript is up to you. We recommend using [dollar slice](https://github.com/nymag/dollar-slice) for client-side JavaScript management.

#### Defining Data for Your Component (schema.yml)
To take advatage of Byline's built-in CMS, describe the data your component expects with a schema.yml.

Given this simple component template:
```html
<article>
  <h1>{{ title }}</h1>
  <p>{{ story }}</p>
</article>
```

Define the expected values, in this case `{{ title }}` and `{{ story }}`, with schema.yml:
```yaml
title:
  _type: text
  _required: true
  _placeholder: Type your title here
story:
  _type: textarea
  _required: true
  _placeholder: Type your life story here
```

All values are optional. If you don't define a ```_type```, if will default to ```_type: text```.

More details about schema.yml are available in the [byline-editor](https://github.com/nymag/byline-editor) component.

### Advanced Topics

- [For Developers and Designers](https://github.com/nymag/byline/tree/master/lib)
- [Routing](https://github.com/nymag/byline/tree/master/lib/routes)
