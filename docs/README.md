# Clay Documentation

On this directory, we have the pre-release documentation written using markdown. This file has the `.md` extension and as we mentioned before, these are pre-release files if you don't add a documentation version yet.

## Markdown options

These files have the following structure at the beginning of the file:

```
---
id: idOftheFile
title: Title of your file
sidebar_label: Title of the sidebar
---

My new content here..
```

The previous example has a couple of the most important part to identify the content that you wish to add to your documentation. Here is a more detailed explanation  on the [Markdown feature](https://docusaurus.io/docs/en/doc-markdown) that you can use.

## Test documentation page

We have a local server that we use to test your current docs content. Here are the steps on how to set the [local server](https://github.com/clay/amphora/tree/master/website#run-the-local-server). Normally you will have access on your browser with a url like this:

`http://localhost:3000/amphora/docs/idOfTheDocs`

But if you already have a [version](https://github.com/clay/amphora/tree/master/website#versioning-the-code) on your docs you will need to add `next` on your url

`http://localhost:3000/amphora/docs/next/idOfTheDocs`

[Here](https://docusaurus.io/docs/en/versioning) are more insights about what to do when you already have documentation with version.
