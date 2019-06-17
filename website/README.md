You will need to have `Node >= 8.x` and `Yarn >= 1.5`.

# Run the local server

1. Make sure all the dependencies for the website are installed:

```sh
$ yarn
```

or

```sh
$ npm install
```

2. Go to the `website` directory and run your dev server:

```sh
$ yarn start
```

or

```sh
$ npm run start
```

## Directory Structure

Your project file structure should look something like this

```
root-directory
  ├── docs
    ├── docs.md
  website/
    ├── README.md
    ├── core
      └── Footer.js
    ├── i18n
      └── en.json
    ├── package.json
    ├── pages
      └── en
        └── index.js
    ├── sidebars.json
    ├── siteConfig.js
    └── static
      ├── css
        └── custom.css
      └── img
        ├── favicon
        └── logo.svg
    └── versioned_docs
      └── version 0.0.0
        ├── docs.md
    └── versioned_sidebars
      ├── version-0.0.0-sidebars.json
```

# Versioning the Code

The first step to begin the process of versioning your documentation is to generate the `versions` script on your website directory with the following command.

```sh
yarn examples versions
```

or

```sh
npm run examples versions
```

Then you proceed to create a version of the docs that you need. In this case, it needs to match the version of your current `package.json`. To do this we will use the following command followed by the version number that you want.

```sh
$ yarn version X.X.X
```

or

```sh
$ npm version X.X.X
```

This will create all the files needed it to handle the version that you just built, but this will be necessary only in 2 cases:

1. If the documentation doesn't have a version set
2. If there is a major update on the number of the version

For other cases, we have an active call [update version](https://github.com/clay/amphora/blob/master/.github/main.workflow) that will handle the change of the version automatically.

# Publish the website

This process is automatically done by an action call [Build and push docs](https://github.com/clay/amphora/blob/master/.github/main.workflow) but you can deploy your documentation manually. You just need to run the following commands:

```sh
$ yarn build
```

or

```sh
$ npm run build
```

Then, you just need to deploy the static files generated. These files will be pushed to the `gh-page` branch.

```sh
$ yarn deploy
```

or

```sh
$ npm run deploy
```
