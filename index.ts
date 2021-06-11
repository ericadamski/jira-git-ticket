#! /usr/bin/env node

import { until } from "@open-draft/until"
import * as Commander from "commander"
import fetch from "isomorphic-unfetch"
import * as fs from "fs"
import * as path from "path"
import * as inquirer from "inquirer"
import { homedir } from "os"
import { promisify } from "util"

import { version } from "./package.json"

const PROGRAM_NAME = "git-ticket"
const CONFIG_ROOT = homedir()
const CONFIG_FILE_PATH = path.join(CONFIG_ROOT, `.${PROGRAM_NAME}`)
const BASE_URI: string | undefined = process.env.JIRA_BASE_URL
const API_URI = `${BASE_URI}/rest/api/3`

if (BASE_URI == null || !API_URI.startsWith("https")) {
  console.log(
    'Please export your Jira URI from your .bashrc or .zshrc. \n\n eg. export JIRA_BASE_URL="https://<company-name>.atlassian.net"'
  )

  process.exit()
}

const writeFile = promisify(fs.writeFile)
const readFile = promisify(fs.readFile)

const program = new Commander.Command()
program.version(version)

program
  .command("login <email> <api_token>")
  .description(
    "Authorize the script to read all JIRA issues assigned to your account."
  )
  .action(handleAuthentication)

program
  .command("ls")
  .description("List all your active JIRA issues")
  .action(handleListAllIssues)

program
  .command("branch")
  .description("Select a JIRA issue to create a branch name from.")
  .action(handleCreateBranch)

program.parse(process.argv)

async function handleAuthentication(email: string, token: string) {
  const t = Buffer.from(`${email}:${token}`).toString("base64")
  const content = JSON.stringify({
    t,
    u: email.split("@").shift(),
  })

  const err = await writeAuthConfigFile(content)

  if (err != null) {
    console.error("Oops, there was an issues storing your authentication.")
  }
}

type JiraIssue = {
  key: string
  fields: {
    summary: string
    status: {
      name: string
    }
  }
}

type Config = {
  t?: string
  u?: string
}

async function handleListAllIssues() {
  const issues = await getAllOpenIssues()

  if (issues == null) {
    return
  }

  issues.forEach((issue) => {
    console.log(`${issue.link} : ${issue.displayName}`)
  })
}

async function handleCreateBranch() {
  const issues = await getAllOpenIssues()

  if (issues == null) {
    return
  }

  const issuesAsChoices = issues.map((issue, index) => ({
    value: index,
    name: issue.displayName,
  }))

  const { issue } = await inquirer.prompt([
    {
      type: "list",
      name: "issue",
      message: "Select the issue you want to create a branch for",
      choices: issuesAsChoices,
    },
  ])

  const { u: username } = await getConfigFromFileFile()

  const branchName = `${username}/${issues[issue].branch}`

  console.log(`

git checkout -b ${branchName}

`)
}

async function writeAuthConfigFile(
  content: string
): Promise<Error | undefined> {
  const [writeError] = await until(() => writeFile(CONFIG_FILE_PATH, content))

  return writeError
}

async function getConfigFromFileFile(): Promise<Config> {
  const [readError, content] = await until(() =>
    readFile(CONFIG_FILE_PATH, { encoding: "utf8" })
  )

  if (readError != null) {
    return {}
  }

  try {
    return JSON.parse(content)
  } catch {
    return {}
  }
}

async function getAllOpenIssues() {
  const rawIssues = await requestJsonResource<JiraIssue[]>(
    "/search?jql=assignee=currentuser()"
  )

  if (rawIssues == null) {
    return
  }

  return rawIssues
    .filter((issue) => issue.fields.status.name != "Closed")
    .map((issue) => {
      const displayName = `[${issue.key}] - ${issue.fields.summary}`
      const link = `${BASE_URI}/browse/${issue.key}`
      const branch = [
        issue.key,
        ...issue.fields.summary.split(" ").slice(0, 5),
      ].join("-")

      return {
        key: issue.key,
        branch,
        displayName,
        link,
        status: issue.fields.status.name,
      }
    })
}

async function requestJsonResource<T>(
  resource: string,
  options: RequestInit = {}
): Promise<T | undefined> {
  const { t: token } = await getConfigFromFileFile()

  if (token == null) {
    // OOPS!
    console.error(
      `There was an issue with your authentication, please run ${PROGRAM_NAME} login.`
    )
    return
  }

  const [resourceRequestError, response] = await until(() =>
    fetch(`${API_URI}${resource}`, {
      ...options,
      headers: {
        ...(options?.headers ?? {}),
        Authorization: `Basic ${token}`,
      },
    })
  )

  if (resourceRequestError != null || !response.ok) {
    console.error({ error: resourceRequestError, response })

    return
  }

  const [parseError, data] = await until(() => response.json())

  if (parseError != null || data == null) {
    console.error({ error: parseError, data })

    return
  }

  return data.issues
}
