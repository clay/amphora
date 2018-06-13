# Hooks

> #### warning::API Notice
> Plugin functionality will change in Amphora v7.0.0, with many of the methods being deprecated in favor of using the [Event Bus](../topics/event-bus.md). Please upgrade to Amphora v6.6.0 as soon as possible and transition to using Event Bus topics.

Below are details about the plugin hooks in Amphora. Plugin hooks are fired on each plugin supplied to Amphora at instantiation time. A plugin should expose a property whose name corresponds to one of the hooks below and is a function that expects the arguments detailed below.

---

### Routes (`routes`)

A hook that gets called with the argument of the [Express Router](https://expressjs.com/en/4x/api.html#express.router) for each site in a Clay instance. This hook allows a plugin to attach a route to a site that can then be called from a client.

**Arguments:**
  - `router`. An instance of the [Express Router](https://expressjs.com/en/4x/api.html#express.router) for a site

---

### Save (`save`)

A hook that is called with an Array of DB operations that were just processed from Clay data structure(s) being saved.

**Arguments:**
  - `ops`: an array of DB operations

---

### Delete (`delete`)
a hook that is called with an Array of DB operations that were just processed from a Clay data structure being deleted.

**Arguments:**
  - `ops`: an array of DB operations

---

### Publish (`publish`)
A hook that is called whenever a page is published whose argument is an object with two properties contain all the data for the published page.

**Arguments:**
  - `uri`: the uri of the page being published
  - `ops`: an array of DB operations that were just processed for all components on the page, including the page's own data
---

### Publish Page (`publishPage`)
Similar to the `publish` hook with slightly different properties

**Arguments:**
  - `uri`: the same as `uri` for the `publish` hook
  - `data`: the page's data object
  - `user`: the data for the user who triggered the action

---

### Create Page (`createPage`)

A hook fired when a page is created

**Arguments:**
  - `uri`: the new page uri
  - `data`: the data object of the new page
  - `user`: the user who created the new page
---

### Schedule Page (`schedulePage`)

A hook fired when a page is scheduled

**Arguments:**
  - `uri`: the uri for the page
  - `data`: an object who contains data about when the page is scheduled for and which page it is
  - `user`: the user who scheduled the page
---

### Unschedule Page

A hook fired when a page is unscheduled

**Arguments:**
  - `uri`: the uri for the page
  - `data`: an object who contains data about the page that was unscheduled as well as when the original scheduled time was
  - `user`: the user who unscheduled the page

---

### Unpublish (`unpublish`)

A hook that's fired when a page is unpublished

**Arguments:**
  - `url`: the publicly accessible url the page existed at
  - `uri`: the page uri
---

### Unpublish Page (`unpublishPage`)

A hook fired when a page is unpublished that contains the `user` object as well

**Arguments:**
  - `url`: the publicly accessible url the page existed at
  - `uri`: the page uri
  - `user`: the user who unpublished the page
