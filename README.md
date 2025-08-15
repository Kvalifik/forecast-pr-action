# Forecast Pull Request Action

A GitHub Action that automatically updates pull request titles and descriptions with Forecast project ticket information. When developers create branches with Forecast ticket numbers, this action enriches PRs with ticket links and proper formatting.

## Features

- Automatically extracts Forecast ticket numbers from branch names or PR titles
- **Supports Forecast's native patterns by default: `T123` for tickets and `P123` for projects (case-insensitive)**
- **Uses correct Forecast URL format**: `https://app.forecast.it/project/P515/task-board/T21249`
- **Auto-prefixes project ID with P** if not provided
- Adds ticket number to PR title (e.g., "T123 - Original PR Title")
- **Flexible link placement**: Use placeholders in PR description templates
- Inserts clickable Forecast ticket links in PR descriptions
- **Customizable base URL** for self-hosted or custom Forecast instances
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
          # ticket-regex defaults to ^[TP]\d+ (matches T123 or P123)
```

## Configuration

### Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token for API access | No | `${{ github.token }}` |
| `forecast-project-id` | Your Forecast project ID (P will be auto-prefixed) | **Yes** | - |
| `forecast-base-url` | Base URL for Forecast links | No | `https://app.forecast.it/project` |
| `forecast-link-placeholder` | Placeholder in PR description for Forecast link | No | - |
| `ticket-regex` | Regular expression to match ticket numbers | No | `^[TP]\d+` |
| `ticket-regex-flags` | Regex flags (e.g., "i" for case-insensitive) | No | `i` |
| `exception-regex` | Pattern for branches to skip (e.g., Dependabot) | No | `^dependabot/` |
| `exception-regex-flags` | Flags for exception regex | No | - |
| `clean-title-regex` | Pattern to remove from PR titles | No | - |
| `clean-title-regex-flags` | Flags for clean title regex | No | - |

## Examples

### Basic Usage (with Forecast's default patterns)

```yaml
- uses: kvalifik/forecast-pr-action@v1
  with:
    forecast-project-id: "12345"  # P will be auto-prefixed
    # Automatically matches T123 or P123 patterns (case-insensitive)
    # Creates links like: https://app.forecast.it/project/P12345/task-board/T123
```

### Custom Ticket Pattern

```yaml
- uses: kvalifik/forecast-pr-action@v1
  with:
    forecast-project-id: "12345"
    ticket-regex: "^PROJ-\\d+"
```

### With Custom Base URL and Title Cleaning

```yaml
- uses: kvalifik/forecast-pr-action@v1
  with:
    forecast-project-id: "12345"
    forecast-base-url: "https://custom.forecast.com/project"
    clean-title-regex: "\\[WIP\\]\\s*"
    clean-title-regex-flags: "i"
```

### With PR Description Template

Use a placeholder in your PR description template:

```yaml
- uses: kvalifik/forecast-pr-action@v1
  with:
    forecast-project-id: "12345"
    forecast-link-placeholder: "{{FORECAST_LINK}}"
```

Then in your PR description template:
```markdown
## Summary
Describe your changes here

## Forecast Ticket
{{FORECAST_LINK}}

## Testing
How to test these changes
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
          forecast-project-id: "12345"  # Will become P12345 in URLs
          forecast-base-url: "https://app.forecast.it/project"  # Optional custom URL
          forecast-link-placeholder: "{{FORECAST_LINK}}"  # Optional template placeholder
          # Uses default pattern ^[TP]\d+ (matches T123 or P123)
          exception-regex: "^(dependabot|renovate)/"
          exception-regex-flags: "i"
          clean-title-regex: "\\[WIP\\]\\s*"
          clean-title-regex-flags: "i"
```

## How It Works

1. **Branch Creation**: Developer creates a branch with a Forecast ticket number (e.g., `T123-fix-auth` or `P456-new-feature`)
2. **PR Opened**: When a pull request is opened, the action runs automatically
3. **Ticket Extraction**: The action searches for ticket numbers in:
   - Branch name (primary source)
   - PR title (fallback)
4. **PR Update**: If a ticket is found, the action:
   - Adds ticket number to PR title (if not already present)
   - Inserts a Forecast link using the correct format: `/project/P{projectId}/task-board/{ticketId}`
   - Uses placeholder replacement if specified, otherwise adds to top of description
5. **Error Handling**: If no ticket is found:
   - Checks if branch matches exception patterns
   - Fails gracefully with helpful error message (won't block PR)

## User Flow

1. Create a branch with ticket number: `git checkout -b T123-new-feature` or `git checkout -b P456-project-task`
2. Make your changes and commit
3. Open a pull request
4. Action automatically updates:
   - Title: `T123 - Add new feature` or `P456 - Project task`
   - Description: Adds `**[Forecast ticket](https://app.forecast.it/project/P12345/task-board/T123)**` link

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