workflow "Deploy to GitHub Pages" {
  on = "push"
  resolves = ["Build and push docs"]
}

action "Filter branch" {
  uses = "actions/bin/filter@master"
  args = "branch master"
}

action "Install" {
  needs = ["Filter branch"]
  uses = "actions/npm@master"
  args = "install --prefix ./website"
}

action "Update version" {
  needs = ["Install"]
  uses = "clay/docusaurus-github-action@master"
  args = "version"
}

action "Build and push docs" {
  needs = ["Update version"]
  uses = "clay/docusaurus-github-action@master"
  args = "deploy"
  secrets = ["DEPLOY_SSH_KEY"]
}
