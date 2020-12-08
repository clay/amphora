#!/bin/bash
set -e -o pipefail

BUCKET=docs.clayplatform.io

green(){
    printf "\e[32m$1\e[39m\n"
}

red(){
    >&2 printf "\e[31m$1\e[39m\n"
}

export PROJECT_NAME="${PROJECT_NAME:-$CIRCLE_PROJECT_REPONAME}"
if [[ -z "$PROJECT_NAME" ]]; then
    red "PROJECT_NAME not set and could not be derived from CIRCLE_PROJECT_REPONAME"
    exit 1
fi
green "PROJECT_NAME: $PROJECT_NAME"

export BUILD_DIR="${BUILD_DIR:-website}"
green "BUILD_DIR: $BUILD_DIR"

green "Building documentation..."
cd "$BUILD_DIR"
npm install --quiet
npm run build

green "Uploading documentation to $BUCKET..."
aws s3 sync --delete --acl=public-read "build/$PROJECT_NAME/" "s3://$BUCKET/$PROJECT_NAME/"

green "Documentation updated."
