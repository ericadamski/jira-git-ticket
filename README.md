# 🎟 git-ticket

A script to lookup active JIRA tickets and create branch names.

## Setup

1. `yarn global add jira-git-ticket`
3. Log in using `git-ticket login <email> <jira_api_token>` get your token here: https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/#APItokens-CreateanAPItoken
4. Set the environment variable for your Atlassian server by adding `export JIRA_BASE_URL=https:<your-company>.atlassian.net` to your `.(bash|zsh)rc`.
5. Use `git-ticket branch` to generate a branch name for a ticket

## Usage

```
Usage: git-ticket [options] [command]

Options:
  -V, --version              output the version number
  -h, --help                 display help for command

Commands:
  login <email> <api_token>  Authorize the script to read all JIRA issues assigned to your account.
  ls                         List all your active JIRA issues
  branch                     Select a JIRA issue to create a branch name from.
  help [command]             display help for command
```
