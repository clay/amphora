# Bootstrapping data

When an Amphora instance is first created, it is empty except for data that is
bootstrapped.  Components, sites, and projects can have a `bootstrap.yml` file
that populates the instance whenever a server is started.  These data are always
optional, but can be useful for automated testing or pre-populating your database.

The bootstrap files are run in the following order:

1. Within components

    Each bootstrap file found in a component is copied into each site.  This is
    useful for creating default values for components, or creating instances
    specifically for automated testing.

1. Within sites

    Each bootstrap file found in a site has the site's hostname and path prepended
    to each `/uris`, `/pages`, and `/components` as well as all
    `{ _refs: '' }` that begin with a `/`.  This is useful for creating different
    uris for different environments, such as development, qa, staging, and production.

1. At the project's root

    The bootstrap at the project's root will be added last, and is therefore
    useful for adding special uris or component values that exist outside of the
    normal structure of a site.

### Components example:

This file would create three articles in each site; one base article that other
articles can be cloned from, and two normal article instances.

```yaml
#some file at /components/article/bootstrap.yml
components:
  article:
    #base component available at /components/article
    title: Some title
    image: Some image

    instances:
      #at /components/article/instances/first-article
      first-article:
        title: Some title
        image: Some image

      #at /components/article/instances/second-article
      second-article:
        title: Some title
        image: Some image
        some-feature-enabled: true
```

### Sites example:

In the following example, each item will be prefixed with the hostname and path
taken from the site's `config.yaml`, including the inner reference to the
slideshow.  If you want to not prefix a reference, then include the hostname or
path so that the value does not start with a `/`.

```yaml
#some file at /sites/my-site/bootstrap.yaml
uris:
  first-page.html: /pages/first-page

pages:
  first-page:
    layout: /components/my-layout/instances/normal-page
    content: /components/content-area/instances/first-page-content

components:
  my-layout:
    instances:
      #at /components/my-layout/instances/normal-page
      normal-page:
        header-title: Name of my site
        logo-url: Some image's url

  content-area:
    instances:
      #at /components/content-area/instances/first-page-content
      first-page-content:
        title: Some title
        words: Some words
        slideshow:
          _ref: /components/slideshow/instances/first-slideshow

  slideshow:
    instances:
      #at /components/slideshow/instances/first-slideshow
      first-slideshow:
        - first image
        - second image
        - third image
```
