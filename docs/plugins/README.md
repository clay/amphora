# Plugins

Plugins allow for you to extend functionality in Amphora by tapping into lifecycle hooks in Amphora to perform secondary actions on the server.

**Important:** none of the plugin hooks allow you to manipulate the data that Amphora is processing, they only provide awareness of what has already been processed.


## List of Hooks

- `routes`
- `save`
- `delete`
- `publish`
- `publishPage`
- `createPage`
- `schedulePage`
- `unschedulePage`
- `unpublish`
- `unpublishPage`

For more information about the arguments they receive, [see the hooks page](hooks.md). For an example of how to make a plugin, see the [Writing A Plugin](writing-a-plugin.md) page.
