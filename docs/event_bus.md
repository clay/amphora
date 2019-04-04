---
id: event-bus
title: Event Bus
sidebar_label: Event Bus
---

As of Amphora version `6.6.0` the option of using [Redis as an event bus](https://redis.io/topics/pubsub) has been introduced. This event bus is intended to make it easier to a destructure a Clay instance and supporting platform packages \(i.e. Amphora Search\). By default the Bus module is not instantiated. Only by setting the [Redis Bus Host env var](event-bus#redis-bus-host) will the Bus module be active.

The Event Bus is also intended to replace the plugin system in the next major version of Amphora \(v7\). On top of replacing the plugin system, the event bus will see some small changes to the payload of certain events as the plugin system is rearchitected. The end goal is to expose specific hooks in the Amphora lifecycle to the Bus as quickly as possible.

## Bus Topics

The following topics are published to the bus by Amphora:

* `clay:publishLayout`
* `clay:publishPage`
* `clay:createPage`
* `clay:unschedulePage`
* `clay:schedulePage`
* `clay:unpublishPage`
* `clay:save`
* `clay:delete`

## Configuring the Bus

The Bus module has two configurations options which are both controlled by environment variables.

### Redis Bus Host

As mentioned, the Bus module is turned off by default. Only by setting the `CLAY_BUS_HOST` env var to a valid Redis url \(`redis://<HOST>:<PORT>`\) will the module be instantiated and events will be published to the instance.

### Namespace

By default, all topics published to the Bus are namespaced using `clay`, i.e. `clay:<ACTION>`. This namespace can be configured by the env var `CLAY_BUS_NAMESPACE`. For example, setting `CLAY_BUS_NAMESPACE` to a value of `mysite` will publish all events as `mysite:<ACTION>`.

## Subscribing To The Bus

Provided you have setup Amphora to pub to a Redis instance, the following code will subscribe to all events from Clay using the [`redis`](https://www.npmjs.com/package/redis) NPM module.

```javascript
'use strict';

var redis = require('redis'),
  SUBSCRIBER = redis.createClient(process.env.CLAY_BUS_HOST),
  CLAY_TOPICS = [
    'publishLayout',
    'publishPage',
    'unpublishPage',
    'createPage',
    'schedulePage',
    'unschedulePage',
    'save',
    'delete'
  ];

for (let i = 0; i < CLAY_TOPICS.length; i++) {
  SUBSCRIBER.subscribe(`clay:${CLAY_TOPICS[i]}`);
}

SUBSCRIBER.on('message', (channel, payload) => {
  console.log(`Channel: ${channel}\n\n\n${payload}`);
});
```