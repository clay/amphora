#!/bin/bash

# This script will increment the package version in package.json.
# It will then tag the HEAD of the master branch with the version number
# and push the tag to the origin (GitHub)

set -e

OPTIONS="(prepatch|patch|preminor|minor|premajor|major)"
USAGE="usage: npm release $OPTIONS"
SEMVAR="$1"

# Releases should only be cut from the master branch.
# They can be manually cut from other branches, but that should be a very
# intentional process.
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "master" ]]; then
    >&2 echo "ERROR: Not on the master branch, will not release."
    exit 1
fi

case $SEMVAR in
    minor)
        ;;
    major)
        ;;
    patch)
        ;;
    premajor)
        ;;
    preminor)
        ;;
    prepatch)
        ;;
    *)
        SEMVAR=prepatch
        >&2 echo "WARNING: No $OPTIONS provided, defaulting to PREPATCH."
        >&2 echo "$USAGE"
        ;;
esac

git pull --rebase origin master
version="$(npm version $SEMVAR)"
git push origin master
git push origin "tags/$version"
