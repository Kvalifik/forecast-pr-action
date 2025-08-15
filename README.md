# Forecast Pull Request Action

A GitHub Action that automatically updates pull request titles and descriptions with [Forecast](https://www.forecast.app/) project ticket information. When developers create branches with Forecast ticket numbers, this action enriches PRs with ticket links and proper formatting.

This action is designed and built with a lot of inspiration from the great work done in the [https://github.com/onrunning/jira-pr-action](https://github.com/onrunning/jira-pr-action).

## Features

- Automatically extracts Forecast ticket numbers from branch names or PR titles
- Adds ticket number to PR title (e.g., "ABC-123 - Original PR Title")
- Inserts clickable Forecast ticket links in PR descriptions
- Gracefully handles branches without ticket numbers (won't block workflow)
- Supports Dependabot and other automated tool exceptions
- Cleans PR titles by removing specified patterns (e.g., [WIP])

## Installation

Add this action to your workflow by creating `.github/workflows/forecast-pr.yml`:

```yaml
name: Update PR with Forecast Info
on:
  pull_request:
    types: [opened, reopened, synchronize]

jobs:
  update-pr:
    runs-on: ubuntu-latest
    steps:
      - uses: kvalifik/forecast-pr-action@v1
        with:
          forecast-project-id: "YOUR_FORECAST_PROJECT_ID"
          ticket-regex: "^[A-Z]+-\\d+"
```

## Configuration

### Inputs

| Input                     | Description                                     | Required | Default               |
| ------------------------- | ----------------------------------------------- | -------- | --------------------- |
| `github-token`            | GitHub token for API access                     | No       | `${{ github.token }}` |
| `forecast-project-id`     | Your Forecast project ID                        | **Yes**  | -                     |
| `ticket-regex`            | Regular expression to match ticket numbers      | **Yes**  | -                     |
| `ticket-regex-flags`      | Regex flags (e.g., "i" for case-insensitive)    | No       | `i`                   |
| `exception-regex`         | Pattern for branches to skip (e.g., Dependabot) | No       | `^dependabot/`        |
| `exception-regex-flags`   | Flags for exception regex                       | No       | -                     |
| `clean-title-regex`       | Pattern to remove from PR titles                | No       | -                     |
| `clean-title-regex-flags` | Flags for clean title regex                     | No       | -                     |

## Examples

### Basic Usage

```yaml
- uses: kvalifik/forecast-pr-action@v1
  with:
    forecast-project-id: "12345"
    ticket-regex: "^T-\\d+"
```

### With Title Cleaning

Remove [WIP] tags from PR titles:

```yaml
- uses: kvalifik/forecast-pr-action@v1
  with:
    forecast-project-id: "12345"
    ticket-regex: "^PROJ-\\d+"
    clean-title-regex: "\\[WIP\\]\\s*"
    clean-title-regex-flags: "i"
```

### Custom Exceptions

Skip certain branch patterns:

```yaml
- uses: kvalifik/forecast-pr-action@v1
  with:
    forecast-project-id: "12345"
    ticket-regex: "^PROJ-\\d+"
    exception-regex: "^(dependabot|renovate|release)/"
    exception-regex-flags: "i"
```

### Complete Example

```yaml
name: Update PR with Forecast Info
on:
  pull_request:
    types: [opened, reopened, synchronize]

jobs:
  update-pr:
    if: github.actor != 'dependabot[bot]'
    runs-on: ubuntu-latest
    steps:
      - uses: kvalifik/forecast-pr-action@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          forecast-project-id: "12345"
          ticket-regex: "^PROJ-\\d+"
          ticket-regex-flags: "i"
          exception-regex: "^(dependabot|renovate)/"
          exception-regex-flags: "i"
          clean-title-regex: "\\[WIP\\]\\s*"
          clean-title-regex-flags: "i"
```

## How It Works

1. **Branch Creation**: Developer creates a branch with a Forecast ticket number (e.g., `T123123-fix-auth`)
2. **PR Opened**: When a pull request is opened, the action runs automatically
3. **Ticket Extraction**: The action searches for ticket numbers in:
   - Branch name (primary source)
   - PR title (fallback)
4. **PR Update**: If a ticket is found, the action:
   - Adds ticket number to PR title (if not already present)
   - Inserts a Forecast link at the top of the PR description
5. **Error Handling**: If no ticket is found:
   - Checks if branch matches exception patterns
   - Fails with error message (won't block PR)

## User Flow

1. Create a branch with ticket number: `git checkout -b t12312312-new-feature`
2. Make your changes and commit
3. Open a pull request
4. Action automatically updates:
   - Title: `T123 - Add new feature`
   - Description: Adds `**[Forecast ticket](https://app.forecast.it/project/12345/ticket/t123123)**` link

## Development

### Setup

```bash
npm install
```

### Testing

```bash
npm test
npm run test:coverage
```

### Building

```bash
npm run build
```

## License

MIT

## Support

For issues or questions, please open an issue in the [GitHub repository](https://github.com/kvalifik/forecast-pr-action).
