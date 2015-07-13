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

1. Everything is a component
2. Ease of editing
3. Performance

Most of Byline is optional. Use what's useful to you. Ignore the rest.

## Organizing with Byline
Byline helps you organize your website's code and assets with a focus on long-term maintainability through components. We start by discarding the typical MVC folder structure, and instead separate concerns into two areas that better map to the needs of web development: components and sites.

Therefore, a typical folder structure of a Byline instance might look like this:
```
/components  (Web Components)
/sites       (site-level settings, routes, and assets)
```

### How does Byline Support Web Components?
Web Components are reusable, configurable, self-contained pieces of the web. An official standard is still evolving, but Web Components aim to make development dramatically more maintainable.

Byline offers a way to embrace tomorrow's Web Components today, by combining today's Web Standards with tomorrow's philosophy of Web Components. No need to wait for browsers to implement a new common standard. Nor do you need to shim on the client-side, to the detriment of performance.

As the official standard for Web Components emerges, Byline will evolve to support it, giving creations in Byline an upgrade path as browsers evolve.

### How to create a component in Byline
Components in Byline usually have the following structure:
```
/component-name     unique name of your web component
    /media          JPG, PNG, GIF, SVG, etc.
    template.html   your template, preferably semantic
    all.css         component-scoped css
    client.js       your client-side javascript
    schema.yml      describes how the component's data is edited
```

All of these files are optional.

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

### Client-side Javascript (client.js)
We recommend using [dollar slice](https://github.com/nymag/dollar-slice) for client-side JavaScript management. Any javascript you write in client.js gets minified and delivered with any page that has that component. How you write your javascript is up to you.  (Again, reference [yo byline]())

### Defining Data for Your Component (schema.yml)

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

### Advanced Topics

- [For Developers and Designers](https://github.com/nymag/byline/tree/master/lib)
- [Routing](https://github.com/nymag/byline/tree/master/lib/routes)
