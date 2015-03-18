Codename: New York Byline
=========================

📰 _"Catchy super fun slogan here!"_

A full-stack framework for creating the web.
The tools to bring devs, designers and creators together to make great things online.

Powering [New York Magazine](http://nymag.com/), [Vulture](http://www.vulture.com/), [The Cut](http://thecut.com/), [Grub Street](http://www.grubstreet.com/), and [The Science of Us](http://www.scienceofus.com/).  
Created by New York Media.

## Installation
```
npm install --save ny-byline
```
TK: Yeoman for init options.

## Table of Contents
* [Introduction]()
* [Organization]()
* [Components]()
* [Layouts]()
* [Sites]()
* [Global]()
* [Compilation]()
* [Tooling]()
* [Advanced Topics]()
* [Configuration]()

## Introduction
Byline is a new way to organize and ship your web creations, guided by two principles:

1. [Organize](##organization) in a maintainable way – to preserve developer sanity.
2. [Compile](##compilation) in a performant way – to make the web a better place.

By separating how we organize our work from how we deliver it, we can let each priority have a clear focus. As web performance best practices change (as they inevitably will), your organizational structure does not.

Finally, by having a clear standard for organizing and compiling our work, we can create [Tooling](##tooling) that makes our goals easier to achieve. Tooling is optional, so use what's useful to you and ignore the rest.


## Organization
Byline eschews the typical MVC folder structure, separating concerns into four areas.

### The Four Scopes of Byline
```
/components  (web components)
/layouts     (the grids on which components live)
/sites       (site-level routing, settings, and assets)
/global      (global settings and assets)
```

Each scope has a clear purpose, allowing us to smartly organize around their specific needs. Let's jump into what each scope is capable of.

## Components
Web Components are reusable, configurable, and self-contained, but the open standard around them is still evolving.

Byline offers a way to embrace the philosophy of tomorrow's web components with the tools of today. No need to wait for browsers to implement a common standard or to endlessly shim on the client-side, to the detriment of performance.

### Byline Components are Future Compatible.
As the open standard for web components emerges, Byline will evolve to support them, giving creations in Byline an upgrade path in the years ahead.

### Creating a Web Component in Byline
The pillars of a webpage are HTML, CSS, and Javascript. We let each language perform the job it was built for, and we've structured Byline to exercise the strengths of each.

How components are organized:
```
/components
  /component-name   (unique name of your web component)
    /media          (JPG, PNG, GIF, and SVG assets)
    template.html   (HTML, preferably semantic)
    all.css         (CSS, w/support for Responsive Design via filename-breakpoints)
    client.js       (javascript delivered to the client)
    schema.json     (data and settings)
```

All files shown here are optional. Use what's useful. Ignore the rest.

### HTML in Web Components (template.html)
Components in Byline have three requirements:

1. Wrap your markup in a semantically appropriate tag.  
2. Add a data-component attribute with the name of the component as its value.  
(The value should be unique, lowercase, with words hyphen-separated.)

Example:
```HTML
<article data-component="my-component">
  Put your component's markup here.
</article>
```

That's all Byline needs to identify a component.

TK: templating options
TK: should we automatically place the class and data-component on compilation?

### Good Markup Matters
Writing HTML in Byline is the same as writing good markup anywhere:
- Keep it semantic: Use the right tag for the right job.
- Keep it accessible. [Apps for All by Heydon Pickering](https://shop.smashingmagazine.com/apps-for-all-coding-accessible-web-applications.html) is an excellent resource on the subject.
- Keep it simple. Don't wrap something in two (or three, or seven) tags when one will do.

### CSS in Web Components (all.css)
There's only one hard rule to writing CSS for web components in Byline:
1. Start every rule with the unique name of your component as its class.

For Example, if your component is called my-component:
```HTML
<aside data-component="my-component" class="my-component">
```

Every css rule should start with .my-component:
```CSS
.my-component a {
  /* anchor styles for my-component */
}
```

### Responsive Components Made Easy with filename-breakpoints
Byline uses [filename-breakpoints]() so that every component can have its own set of responsive breakpoints. Put simply, filename-breakpoints wrap a file's CSS in a mediaquery derived from its filename.

Breakpoints can be defined as number ranges, as well as by keywords, like print TK
```
all.css        -> no media query
0-600.css      -> @media (min-width: 599.9px) { ... }
600-1024.css   -> @media (min-width: 600px) and (max-width: 1023.9px) { ... }
1024+.css      -> @media (min-width: 1024px) { ... }
print.css      -> @media print { ... }
```

By default, all components get the following print style unless you specify differently with a print.css file.
```
  @media print {
    display: none;
  }
```

TK: Should we support other media queries? combo queries? (tv, resolution, device-aspect-ratio, others? http://www.w3.org/TR/css3-mediaqueries/

### The Media Folder
Place image assets for your component in this folder.  
On compilation, JPG, PNG, GIF and SVG assets will be optimized and copied to:
```
/publish/media/component-name/
```

And are available at:
```
//localhost/media/component-name/file.jpg
```

You can include these assets in your HTML like so:
```HTML
<img src="/media/component-name/file.jpg" alt="">
```

### Client-Side Javascript (client.js)
Any javascript you write in client.js gets minified and delivered with any page that has that component. How you write your javascript is up to you.

TK: Illustrate typical choices as well as dollar-slice.

[Dollar Slice](https://github.com/nymag/dollar-slice)

### Viewing and Testing Your Component
- TK: easy component view
- TK: easy json view
- TK: sandbox
- TK: styleguide
- TK: per-component linting/tests

TK: Component Namespacing
byline-* for default packages
yourname-* for your install?

## Sites in Byline
TK

## Layouts in Byline
TK

## Global in Byline
TK

## Compilation
TK

## Tooling in Byline
TK

## Configuration
TK

## Advanced Options
TK
### Advanced Component Options
```
/your-component
  server.js (server-side javascript. Perfect for grabbing data from outside APIs.)
  import.js (one-time import and data normalization)
  /sites    (site-specific settings and styles, if you have more than one site.)
```
#### server.js
#### import.js
#### TK: Cross Component Communication
#### TK: Reaching out to other parts of the document. (dns pre-fetch as example)

## The Modules of Byline
- [dollar-slice](https://www.npmjs.com/package/dollar-slice): 🍕 *"Cheap and easy."* Client-side micro-framework with heavy inspiration from Angular and Backbone.
- filename-breakpoints: 📄📲💻📺 *"Sugar for Media Queries."*
