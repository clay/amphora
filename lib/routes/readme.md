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