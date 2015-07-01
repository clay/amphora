Technical Documentation
=======================

This document is for developers or designers who are creating new components.

# Byline is divided into components.

[Components should make design easier.](https://medium.com/@joshpuckett/modern-design-tools-using-real-data-62d499e97482)

Components can be _layout-level_ or _page-level_.  

Layout-level components are
_shared_ on every page that uses a certain layout.  

Page-level components are _unique_ to a certain page.

## Pages

Structure of a page:
```json
{
  "layout": "<layout>",
  "areaA": "<things in areaA>",
  "areaB": ["<things in areaB>" ,"<more things in areaB>"],
  "areaC": {
    "innerArea1": "<things in the first part of areaC>",
    "innerArea2": "<things in the second part of areaC>"
  }
}
```

Most notably, pages only contain _lists of components_.  They do not contain data.


### But then where do I put my data?

If you want data that is _shared_ between many pages, put a component in a layout.  

If you want data that is _not shared_ between pages, put a component in a page.  

Pages have components.  Components have data.

### But I really want data in the page!

Then put it in a component, and reference it.


### Example page:
```json
{
  "layout": "/components/article",
  "head": [
    "/components/title/instances/my-first-article",
    "/components/social/instances/my-first-article"
  ],
  "content": "/components/story/instances/my-first-article"
}
```

# Layouts

A layout is shared between multiple pages.  Whenever the _structure_ of a page
needs to be different, then you should create a new layout.

### Example of a layout template:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    {# areaA components will appear here! #}
    {{ embed(state.getTemplate('component-list'), areaA, state)}}
  </head>
  <body>
    <div>{{ embed(state.getTemplate('component-list'), areaB, state) }}</div>
    <div>
      <div>{{ embed(state.getTemplate('component-list'), areaC.innerArea1, state) }}</div>
      <div>{{ embed(state.getTemplate('component-list'), areaC.innerArea2, state) }}</div>
    </div>
  </body>
</html>
```

Layouts are components, so they can have data.  If the structure of a layout is
the same but the list of components are changing, then you should create multiple
instances of the same layout.

### Example of an instance of a layout component:
```json
{
  "areaA": [
    { "_ref": "/components/global-site" },
    "head"
    { "_ref": "/components/global-meta" },
    { "_ref": "/components/global-icons" }
  ],
  "areaB": [
    "content",
    { "_ref": "/components/comments" },
    { "_ref": "/components/related-stories" }
  ],
  "areaC": [
    { "_ref": "/components/copyright" }
  ]
}
```

In this example, the data from the page is placed into "head" and "content".
Any components referenced in this layout are said to be _layout-level_, and head
and content are said to be _page-level_.  That is, pages can place their components
into the spaces defined by "head" and "content".

### But I want to have a special layout for a specific page!

If you're changing the structure of a layout, create a new layout.

If you're adding or removing components from a layout, create a new instance of a layout.
