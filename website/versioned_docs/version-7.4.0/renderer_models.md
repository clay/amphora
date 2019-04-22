---
id: version-7.4.0-renderer-models
title: Renderer Models
sidebar_label: Renderer Models
original_id: renderer-models
---

## Problem

A common issue that anyone publishing content to the web faces is how to get their data into different formats than how the data is already stored in their system. For example, Clay stores JSON data but needs to be able to serve RSS feeds, publish content in a format compatible with Apple News or Google Newsstand, all while not duplicating and mutating the data for rendering HTML. 

## Solution

It's important to remember that Clay is a "webpage first" platform. The supported edit interface \([Kiln](https://claycms.gitbook.io/kiln)\) allows Clay data component editing through an HTML page, so generally components are always built with HTML rendering in mind. For that reason, the `model.js` file for a component can modify component/layout data for either a JSON or HTML formats. But what if you request a component with a `.xml` extension? [You'll need a renderer](https://claycms.gitbook.io/amphora/~/drafts/-LJUeZikGqO4SPbtu-9G/primary/basics/renderers) to handle the request, but what if that renderer expects a different input than the component's data?

That's where a renderer specific model comes in. It's exactly like a regular `model.js` file except that it's run _after_ the default regular `model.js` file and gives you a chance to modify data for a component to meet your renderers needs. The format for a renderer model is a filename in the following format:`<RENDERER EXTENSION>.model.js`

If your request is to `domain.com/_components/foo/instances/bar.rss`, then your model file will need to be named `rss.model.js`.

### Renderer Model Caveat

This does not work for requests to `.html` extensions, i.e. there is no support for `html.model.js` files. Your regular `model.js` file should do everything necessary to support displaying the component in HTML pages.
