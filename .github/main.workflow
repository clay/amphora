workflow "Deploy to GitHub Pages" {
  on = "push"
  resolves = ["Build and push docs"]
}

action "Filter branch" {
  uses = "actions/bin/filter@master"
  args = "branch master"
}

action "Update version" {
  needs = ["Filter branch"]
  uses = "clay/docusaurus-github-action@master"
  args="version"
}

action "Build and push docs" {
  needs = ["Update version"]
  uses = "clay/docusaurus-github-action@master"
  args="deploy"
  secrets = ["DEPLOY_SSH_KEY"]
}
