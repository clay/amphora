---
id: bootstrap
title: Bootstrapping
sidebar_label: Bootstrapping
---

Bootstrapping is the process by which Amphora will look for specific data in your implementation to add to the database. This process runs _EVERYTIME_ the server restarts.

Whenever the process first starts up, Amphora will look into each component directory and each site directory for a `bootstrap.(yml|yaml)` file. This YAML file will be converted into JSON and then the values will be written to the database for each site.

## Why is this necessary?

Bootstrapping is a great time for taking care of two actions:

* Adding default data to a component
* Adding component instances to the database _that will never change_ from user input

## Skipping Bootstrapping

As of [Amphora 4.2.0](https://github.com/clay/amphora/releases/tag/v4.2.0) the bootstrapping process can be skipped. This is useful when developing server-side services for your implementation as it allows for more rapid startups on larger Clay instances, but this can be dangerous.

As mentioned above, bootstrapping is great for seeding the default data for a component or site. If bootstrapping is turned off and you add a new component to your instance, the default data will not be added to your local database. For this reason, it's encouraged to only use this feature when you know you won't need the bootstrap process to run **and never in production environments**.

To turn off bootstrapping, simply pass the `bootstrap` property into Amphora at instantiation time with a `false` value:

```javascript
amphora({
  // ...some other args
  bootstrap: false
})
```

### Default Data

Since components and the data they hold will change and grow \(or shrink\) over time, it's necessary to update the default data that a component is created with anytime the server restarts. By including a bootstrap file in each component directory, you'll be able to make sure that changes to all aspects of the component can be changed within a single directory and that every time the server restarts you'll be working with the default data you expect.

### Slow/Never Changing Component Instances

Bootstrapping is also very handy for adding values which a user should never be able to change in the GUI. An example of this might be an ID for an analytics service. Since you would always want to have a reliable component instance to use while not allowing users to easily change this value, you might choose to have this in a `bootstrap.(yml|yaml)` file in your site's directory. If a user ever does modify a component instance that is created in this file, simply restarting the server will reset the value.

## Word of Caution

The affordances around bootstrapping mean that you can have a `bootstrap.(yml|yaml)` file in each site and each component. At startup time Amphora will try to read all of these and write the values to the database. Because of this, the more bootstrap files you have, the longer the startup time will be.
