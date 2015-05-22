Routes
======

Containers for routing, so it's not all in one big file.

## Ordering

The API must follow a specific ordering for the priority of errors to return.  Even though _multiple_ things might be
wrong with a request, consistent testability requires that the type of error returned for any particular request should
not change without deliberate thought.  The current order of errors are:

1. Component invalid: There is no resource (component) by that name returns 404 for the _entire_ route (including all sub-routes).
2. Allow header: That method is not allowed
3. Accept header: The request's acceptable data type is not supported by this route.
4. Resource missing: A resource with this specific identifier does not exist.

## Vary

We should always include the Vary header for any route that does not have an extension (like .html), because we do
return proper 406s if they are not expecting the right data-type.  If the Vary header is not included, reverse caches
like Varnish will cache both errors and successes inappropriately.

## 304

We are not going to support returning 304s for several reasons:

1. Most people will have a reverse cache like Varnish in front of byline endpoints in production.
2. The ROI for supporting 304s is very low for non-browser non-html clients.