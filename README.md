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
* [Tooling]()
* [Compilation]()
* [Configuration]()
* [Advanced Topics]()

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

TK: Illustration of scopes.

Each scope has a clear purpose, allowing us to smartly organize around their specific needs. Let's jump into what each scope is capable of.

### Components
Web Components are reusable, configurable, and self-contained, but the open standard around them is still evolving.

TK: Illustration of component scope.

Byline offers a way to embrace the philosophy of tomorrow's web components with the tools of today. No need to wait for browsers to implement a common standard or to endlessly shim on the client-side, to the detriment of performance.

#### Byline Components are Future Compatible.
As the open standard for web components emerges, Byline will evolve to support them, giving creations in Byline an upgrade path in the years ahead.

#### Creating a Web Component in Byline
The pillars of a webpage are HTML, CSS, and Javascript. We let each language perform the job it was built for, and we've structured Byline to exercise the strengths of each.

How components are organized:
```
/components
  /component-name   (unique name of your web component)
    /media          (JPG, PNG, GIF, and SVG assets)
    template.html   (HTML, preferably semantic)
    all.css         (CSS, w/support for Responsive Design via filename-breakpoints)
    client.js       (javascript delivered to the client)
    schema.yaml     (data and settings)
```

All files shown here are optional. Use what's useful. Ignore the rest.

#### HTML in Web Components (template.html)
Components in Byline have one requirement:

1. Wrap your markup in a semantically appropriate tag.  

Example:
```HTML
<article>
  Put your component's markup here.
</article>
```

#### Template Language Support
Byline supports numorous templating languages. Simply end your template file with the appropriate extension.

- template.html (no templating)
- [nunjucks](https://github.com/mozilla/nunjucks)
- [jade](https://github.com/jadejs/jade)
- [mustache](https://github.com/mustache/mustache.github.com)

#### CSS in Web Components (all.css)
Styles written in a component's CSS file will be scoped to that component on compilation.

For example, to style the anchors of your component, simply write:
```CSS
a {
  /* anchor styles */
}
```

#### Using CSS Preprocessors
TK

#### Responsive Components Made Easy with filename-breakpoints
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
```css
  @media print {
    display: none;
  }
```

TK: Should we support other media queries? combo queries? (tv, resolution, device-aspect-ratio, others? http://www.w3.org/TR/css3-mediaqueries/

#### The Media Folder
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
```html
<img src="/media/component-name/file.jpg" alt="">
```

#### Client-Side Javascript (client.js)
Any javascript you write in client.js gets minified and delivered with any page that has that component. How you write your javascript is up to you.

TK: Illustrate typical choices as well as dollar-slice.

[Dollar Slice](https://github.com/nymag/dollar-slice)

#### Defining Data for Your Component (schema.yml)
To take advatage of Byline's built-in CMS, describe the data your component expects with a schema.yml.

Given this simple component template:
```html
<article>
  <h1>{{ title }}</h1>
  <p>{{ story }}</p>
</article>
```

Define the expected values, in this case ```{{ title }}```, ```{{ published }}``` and ```{{ story }}```, with schema.yml:
```yaml
title:
  _type: text
  _required: true
  _placeholder: Type your title here
story:
  _type: text
  _required: true
  _placeholder: Type your life story here
  _multiline: true
```

All values are optional. If you don't define a ```_type```, if will default to ```_type: text```.

##### General Attributes
```yaml
  _value: default value   #-> <input value="default value"...
  _label: First Name      #-> <label>First Name <input...
  _placeholder: Jane Doe  #-> <input placeholder="Jane Doe"...
  _required: true         #-> <input required...
  _pattern: [a-zA-Z0-9]+  #-> <input pattern="[a-zA-Z0-9]+"...
```

##### Strings
```yaml
  # Text Types
  _type: text     #-> <input type="text"...
  _type: url      #-> <input type="url"...
  _type: email    #-> <input type="email"...
  _type: tel      #-> <input type="tel"...
  _type: color    #-> <input type="color"...

  # Text Attributes (optional)
  _minlength: 1   #-> <input minLength="1"...
  _maxlength: 10  #-> <input maxLength="1"...
```

##### Numbers
```yaml
  # Number Types
  _type: number   #-> <input type="number"...
  _type: range    #-> <input type="range"...

  # Number Attributes (optional)
  _min: 1     #-> <input min="1"...
  _max: 100   #-> <input min="100"...
  _step: 10   #-> <input min="10"...
```

##### Dates
```yaml
  # Date Types
  _type: date           #-> <input type="date"...
  _type: datetime       #-> <input type="datetime"...
  _type: datetime-local #-> <input type="datetime-local"...
  _type: time           #-> <input type="time"...
  _type: month          #-> <input type="month"...
  _type: week           #-> <input type="week"...

  # Date Attributes (optional)
  _min: 1     #-> <input min="1"...
  _max: 100   #-> <input max="100"...
  _step: 10   #-> <input step="10"...
```

##### Files and Binary Data
```yaml
_type: file   #-> <input type="file"...
```

TODO:
- lists
- autocomplete?
- autosave?
- disabled?
- spellcheck?
- customer _type: image, etc?
- list -> datalist?

#### Viewing and Testing Your Component
- TK: easy component view
- TK: easy json view
- TK: sandbox
- TK: styleguide
- TK: per-component linting/tests

TK: Component Namespacing
byline-* for default packages
yourname-* for your install?

### Sites in Byline
TK

### Layouts in Byline
TK

### Global in Byline
TK

## Tooling in Byline
TK

## Compilation
TK

## Configuration
TK

## Advanced Topics
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
