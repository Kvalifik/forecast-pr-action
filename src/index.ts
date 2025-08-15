import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";

const INPUT_GITHUB_TOKEN = "github-token";
const INPUT_FORECAST_PROJECT_ID = "forecast-project-id";
const INPUT_TICKET_REGEX = "ticket-regex";
const INPUT_TICKET_REGEX_FLAGS = "ticket-regex-flags";
const INPUT_EXCEPTION_REGEX = "exception-regex";
const INPUT_EXCEPTION_REGEX_FLAGS = "exception-regex-flags";
const INPUT_CLEAN_TITLE_REGEX = "clean-title-regex";
const INPUT_CLEAN_TITLE_REGEX_FLAGS = "clean-title-regex-flags";

const FORECAST_LINK_TEXT = "Forecast ticket";

function cleanPullRequestTitle(title: string, cleanTitleRegex?: RegExp) {
  return cleanTitleRegex ? title.replace(cleanTitleRegex, "") : title;
}

export async function run(): Promise<void> {
  try {
    if (!context.payload.pull_request) return;

    const token = core.getInput(INPUT_GITHUB_TOKEN);
    const forecastProjectId = core.getInput(INPUT_FORECAST_PROJECT_ID);
    const ticketRegexInput = core.getInput(INPUT_TICKET_REGEX);
    const ticketRegexFlags = core.getInput(INPUT_TICKET_REGEX_FLAGS);
    const exceptionRegex = core.getInput(INPUT_EXCEPTION_REGEX);
    const exceptionRegexFlags = core.getInput(INPUT_EXCEPTION_REGEX_FLAGS);
    const cleanTitleRegexInput = core.getInput(INPUT_CLEAN_TITLE_REGEX);
    const cleanTitleRegexFlags = core.getInput(INPUT_CLEAN_TITLE_REGEX_FLAGS);

    // Check for missing required inputs
    if (!forecastProjectId) {
      core.error(`Missing required input: ${INPUT_FORECAST_PROJECT_ID}`);
      return;
    }

    // Use default regex if not provided (matches T123 or P123 patterns)
    const finalTicketRegex = ticketRegexInput || "^[TP]\\d+";
    const finalTicketRegexFlags = ticketRegexFlags || "i";

    const github = getOctokit(token);
    const ticketRegex = new RegExp(finalTicketRegex, finalTicketRegexFlags);
    const cleanTitleRegex = cleanTitleRegexInput
      ? new RegExp(cleanTitleRegexInput, cleanTitleRegexFlags)
      : undefined;

    const prNumber = context.payload.pull_request.number;
    const prTitle = cleanPullRequestTitle(
      context.payload.pull_request.title || /* istanbul ignore next */ "",
      cleanTitleRegex
    );
    const prBody =
      context.payload.pull_request.body || /* istanbul ignore next */ "";

    const request: Parameters<typeof github.rest.pulls.update>[0] = {
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: prNumber,
    };

    let ticketLine = "";
    const headBranch = context.payload.pull_request.head.ref;
    const [ticketInBranch] =
      headBranch.match(ticketRegex) ||
      context.payload.pull_request.title.match(ticketRegex) ||
      [];

    if (ticketInBranch) {
      const forecastLink = `https://app.forecast.it/project/${forecastProjectId}/ticket/${ticketInBranch}`;
      ticketLine = `**[${FORECAST_LINK_TEXT}](${forecastLink})**\n`;

      if (!ticketRegex.test(prTitle))
        request.title = `${ticketInBranch} - ${prTitle}`;
    } else {
      const isException = new RegExp(exceptionRegex, exceptionRegexFlags).test(
        headBranch
      );

      if (!isException) {
        const regexStr = ticketRegex.toString();
        core.setFailed(
          `Neither current branch nor title start with a Forecast ticket ${regexStr}.`
        );
      }
    }
    if (ticketLine) {
      let hasBodyChanged = false;
      const updatedBody = prBody.replace(
        new RegExp(`(\\*\\*\\[${FORECAST_LINK_TEXT}\\][^\\n]+\\n)?\\n?`),
        (match) => {
          const replacement = `${ticketLine}\n`;
          hasBodyChanged = match !== replacement;
          return replacement;
        }
      );
      if (hasBodyChanged) request.body = updatedBody;
    }
    if (request.title || request.body) {
      const response = await github.rest.pulls.update(request);

      if (response.status !== 200) {
        core.error(
          `Updating the pull request has failed with ${response.status}`
        );
      }
    }
  } catch (error) {
    /* istanbul ignore next */
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "";
    core.setFailed(message);
  }
}

if (!process.env.JEST_WORKER_ID) {
  run();
}
