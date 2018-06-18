# Plugin vs. Renderer

> #### warning::API Notice
> Plugin functionality will change in Amphora v7.0.0, with many of the methods being deprecated in favor of using the [Event Bus](../topics/event-bus.md). Please upgrade to Amphora v6.6.0 as soon as possible and transition to using Event Bus topics.

While both plugins and renderers can be passed to Amphora, one key difference:

_Plugins are observers that are invoked based on what has already been processed by Amphora, whereas renderers are part of the request/response lifecycle for displaying data._

## When would you write a renderer vs a plugin?

**Plugin**
  - Sending data to a system outside of Clay based on some event (publish, unpublish, etc.)
  - Collecting realtime data about what components are being created/published
  - Programmatically creating other components/pages based on the content that has just been published

**Renderer**
  - You want the data from Amphora displayed in a non-JSON format when a user requests a resource (html, xml, rss)
