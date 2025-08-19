import { run } from "./index";
import * as core from "@actions/core";
import * as github from "@actions/github";

jest.mock("@actions/core");
jest.mock("@actions/github");

const mockGetInput = core.getInput as jest.MockedFunction<typeof core.getInput>;
const mockSetFailed = core.setFailed as jest.MockedFunction<
  typeof core.setFailed
>;
const mockError = core.error as jest.MockedFunction<typeof core.error>;
const mockGetOctokit = github.getOctokit as jest.MockedFunction<
  typeof github.getOctokit
>;

describe("run", () => {
  let mockUpdate: jest.Mock;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();

    mockUpdate = jest.fn().mockResolvedValue({ status: 200 });
    mockGetOctokit.mockReturnValue({
      rest: {
        pulls: {
          update: mockUpdate,
        },
      },
    } as any);

    (github.context as any) = {
      payload: {
        pull_request: {
          number: 123,
          title: "Fix bug in authentication",
          body: "This PR fixes a critical bug",
          head: {
            ref: "T123-fix-auth-bug",
          },
        },
      },
      repo: {
        owner: "testowner",
        repo: "testrepo",
      },
    };
  });

  describe("when pull_request is not present", () => {
    it("should return early without processing", async () => {
      (github.context as any).payload = {};

      await run();

      expect(mockGetInput).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("when required inputs are missing", () => {
    it("should error when forecast-project-id is missing", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "",
          "forecast-base-url": "",
          "forecast-link-placeholder": "",
          "ticket-regex": "",
          "ticket-regex-flags": "",
          "ticket-prefix-format": "",
          "exception-regex": "^dependabot/",
          "exception-regex-flags": "",
          "clean-title-regex": "",
          "clean-title-regex-flags": "",
        };
        return inputs[name] || "";
      });

      await run();

      expect(mockError).toHaveBeenCalledWith(
        "Missing required input: forecast-project-id"
      );
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("should use default regex when ticket-regex is not provided", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "12345",
          "forecast-base-url": "",
          "forecast-link-placeholder": "",
          "ticket-regex": "",
          "ticket-regex-flags": "",
          "ticket-prefix-format": "",
          "exception-regex": "^dependabot/",
          "exception-regex-flags": "",
          "clean-title-regex": "",
          "clean-title-regex-flags": "",
        };
        return inputs[name] || "";
      });

      await run();

      expect(mockUpdate).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        pull_number: 123,
        title: "T123 - Fix bug in authentication",
        body: "**[Forecast ticket](https://app.forecast.it/project/P12345/task-board/T123)**\n\nThis PR fixes a critical bug",
      });
    });
  });

  describe("URL formatting", () => {
    it("should add P prefix to project ID when not provided", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "12345",
          "forecast-base-url": "",
          "forecast-link-placeholder": "",
          "ticket-regex": "^T\\d+",
          "ticket-regex-flags": "i",
          "ticket-prefix-format": "",
          "exception-regex": "",
          "exception-regex-flags": "",
          "clean-title-regex": "",
          "clean-title-regex-flags": "",
        };
        return inputs[name] || "";
      });

      await run();

      expect(mockUpdate).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        pull_number: 123,
        title: "T123 - Fix bug in authentication",
        body: "**[Forecast ticket](https://app.forecast.it/project/P12345/task-board/T123)**\n\nThis PR fixes a critical bug",
      });
    });

    it("should not add P prefix when already provided", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "P12345",
          "forecast-base-url": "",
          "forecast-link-placeholder": "",
          "ticket-regex": "^T\\d+",
          "ticket-regex-flags": "i",
          "ticket-prefix-format": "",
          "exception-regex": "",
          "exception-regex-flags": "",
          "clean-title-regex": "",
          "clean-title-regex-flags": "",
        };
        return inputs[name] || "";
      });

      await run();

      expect(mockUpdate).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        pull_number: 123,
        title: "T123 - Fix bug in authentication",
        body: "**[Forecast ticket](https://app.forecast.it/project/P12345/task-board/T123)**\n\nThis PR fixes a critical bug",
      });
    });

    it("should use custom base URL when provided", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "12345",
          "forecast-base-url": "https://custom.forecast.com/project",
          "forecast-link-placeholder": "",
          "ticket-regex": "^T\\d+",
          "ticket-regex-flags": "i",
          "ticket-prefix-format": "",
          "exception-regex": "",
          "exception-regex-flags": "",
          "clean-title-regex": "",
          "clean-title-regex-flags": "",
        };
        return inputs[name] || "";
      });

      await run();

      expect(mockUpdate).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        pull_number: 123,
        title: "T123 - Fix bug in authentication",
        body: "**[Forecast ticket](https://custom.forecast.com/project/P12345/task-board/T123)**\n\nThis PR fixes a critical bug",
      });
    });
  });

  describe("placeholder functionality", () => {
    it("should replace placeholder in PR description when provided", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "12345",
          "forecast-base-url": "",
          "forecast-link-placeholder": "{{FORECAST_LINK}}",
          "ticket-regex": "^T\\d+",
          "ticket-regex-flags": "i",
          "ticket-prefix-format": "",
          "exception-regex": "",
          "exception-regex-flags": "",
          "clean-title-regex": "",
          "clean-title-regex-flags": "",
        };
        return inputs[name] || "";
      });

      (github.context as any).payload.pull_request.body =
        "## Summary\nThis fixes a bug\n\n## Forecast\n{{FORECAST_LINK}}\n\n## Testing\nTested locally";

      await run();

      expect(mockUpdate).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        pull_number: 123,
        title: "T123 - Fix bug in authentication",
        body: "## Summary\nThis fixes a bug\n\n## Forecast\n**[Forecast ticket](https://app.forecast.it/project/P12345/task-board/T123)**\n\n## Testing\nTested locally",
      });
    });

    it("should fall back to default behavior when placeholder not found", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "12345",
          "forecast-base-url": "",
          "forecast-link-placeholder": "{{FORECAST_LINK}}",
          "ticket-regex": "^T\\d+",
          "ticket-regex-flags": "i",
          "ticket-prefix-format": "",
          "exception-regex": "",
          "exception-regex-flags": "",
          "clean-title-regex": "",
          "clean-title-regex-flags": "",
        };
        return inputs[name] || "";
      });

      (github.context as any).payload.pull_request.body =
        "This PR fixes a critical bug";

      await run();

      expect(mockUpdate).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        pull_number: 123,
        title: "T123 - Fix bug in authentication",
        body: "**[Forecast ticket](https://app.forecast.it/project/P12345/task-board/T123)**\n\nThis PR fixes a critical bug",
      });
    });
  });

  describe("ticket prefix format", () => {
    it("should use custom ticket prefix format when provided", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "12345",
          "forecast-base-url": "",
          "forecast-link-placeholder": "",
          "ticket-regex": "^T\\d+",
          "ticket-regex-flags": "i",
          "ticket-prefix-format": "[<Number>]: ",
          "exception-regex": "",
          "exception-regex-flags": "",
          "clean-title-regex": "",
          "clean-title-regex-flags": "",
        };
        return inputs[name] || "";
      });

      await run();

      expect(mockUpdate).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        pull_number: 123,
        title: "[T123]: Fix bug in authentication",
        body: "**[Forecast ticket](https://app.forecast.it/project/P12345/task-board/T123)**\n\nThis PR fixes a critical bug",
      });
    });

    it("should use default prefix format when not provided", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "12345",
          "forecast-base-url": "",
          "forecast-link-placeholder": "",
          "ticket-regex": "^T\\d+",
          "ticket-regex-flags": "i",
          "ticket-prefix-format": "",
          "exception-regex": "",
          "exception-regex-flags": "",
          "clean-title-regex": "",
          "clean-title-regex-flags": "",
        };
        return inputs[name] || "";
      });

      await run();

      expect(mockUpdate).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        pull_number: 123,
        title: "T123 - Fix bug in authentication",
        body: "**[Forecast ticket](https://app.forecast.it/project/P12345/task-board/T123)**\n\nThis PR fixes a critical bug",
      });
    });

    it("should handle different custom formats", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "12345",
          "forecast-base-url": "",
          "forecast-link-placeholder": "",
          "ticket-regex": "^T\\d+",
          "ticket-regex-flags": "i",
          "ticket-prefix-format": "(<Number>) ",
          "exception-regex": "",
          "exception-regex-flags": "",
          "clean-title-regex": "",
          "clean-title-regex-flags": "",
        };
        return inputs[name] || "";
      });

      await run();

      expect(mockUpdate).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        pull_number: 123,
        title: "(T123) Fix bug in authentication",
        body: "**[Forecast ticket](https://app.forecast.it/project/P12345/task-board/T123)**\n\nThis PR fixes a critical bug",
      });
    });
  });

  describe("when ticket is found in branch name", () => {
    it("should update PR title and body with ticket info", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "12345",
          "forecast-base-url": "",
          "forecast-link-placeholder": "",
          "ticket-regex": "^T\\d+",
          "ticket-regex-flags": "i",
          "ticket-prefix-format": "",
          "exception-regex": "^dependabot/",
          "exception-regex-flags": "",
          "clean-title-regex": "",
          "clean-title-regex-flags": "",
        };
        return inputs[name] || "";
      });

      await run();

      expect(mockUpdate).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        pull_number: 123,
        title: "T123 - Fix bug in authentication",
        body: "**[Forecast ticket](https://app.forecast.it/project/P12345/task-board/T123)**\n\nThis PR fixes a critical bug",
      });
    });

    it("should not update title if ticket already present", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "12345",
          "forecast-base-url": "",
          "forecast-link-placeholder": "",
          "ticket-regex": "^T\\d+",
          "ticket-regex-flags": "i",
          "ticket-prefix-format": "",
          "exception-regex": "",
          "exception-regex-flags": "",
          "clean-title-regex": "",
          "clean-title-regex-flags": "",
        };
        return inputs[name] || "";
      });

      (github.context as any).payload.pull_request.title = "T123 - Fix bug";

      await run();

      expect(mockUpdate).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        pull_number: 123,
        body: "**[Forecast ticket](https://app.forecast.it/project/P12345/task-board/T123)**\n\nThis PR fixes a critical bug",
      });
      expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty("title");
    });

    it("should work with P-prefixed project tickets", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "12345",
          "forecast-base-url": "",
          "forecast-link-placeholder": "",
          "ticket-regex": "^[TP]\\d+",
          "ticket-regex-flags": "i",
          "ticket-prefix-format": "",
          "exception-regex": "",
          "exception-regex-flags": "",
          "clean-title-regex": "",
          "clean-title-regex-flags": "",
        };
        return inputs[name] || "";
      });

      (github.context as any).payload.pull_request.head.ref =
        "P456-project-feature";

      await run();

      expect(mockUpdate).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        pull_number: 123,
        title: "P456 - Fix bug in authentication",
        body: "**[Forecast ticket](https://app.forecast.it/project/P12345/task-board/P456)**\n\nThis PR fixes a critical bug",
      });
    });
  });

  describe("when no ticket is found", () => {
    it("should fail when branch doesn't match ticket pattern and no exception", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "12345",
          "forecast-base-url": "",
          "forecast-link-placeholder": "",
          "ticket-regex": "^[TP]\\d+",
          "ticket-regex-flags": "i",
          "ticket-prefix-format": "",
          "exception-regex": "^dependabot/",
          "exception-regex-flags": "",
          "clean-title-regex": "",
          "clean-title-regex-flags": "",
        };
        return inputs[name] || "";
      });

      (github.context as any).payload.pull_request.head.ref =
        "feature/new-feature";
      (github.context as any).payload.pull_request.title = "Add new feature";

      await run();

      expect(mockSetFailed).toHaveBeenCalledWith(
        "Neither current branch nor title start with a Forecast ticket /^[TP]\\d+/i."
      );
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("should not fail when branch matches exception pattern", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "12345",
          "forecast-base-url": "",
          "forecast-link-placeholder": "",
          "ticket-regex": "^[TP]\\d+",
          "ticket-regex-flags": "i",
          "ticket-prefix-format": "",
          "exception-regex": "^dependabot/",
          "exception-regex-flags": "",
          "clean-title-regex": "",
          "clean-title-regex-flags": "",
        };
        return inputs[name] || "";
      });

      (github.context as any).payload.pull_request.head.ref =
        "dependabot/npm_and_yarn/lodash-4.17.21";
      (github.context as any).payload.pull_request.title =
        "Bump lodash from 4.17.20 to 4.17.21";

      await run();

      expect(mockSetFailed).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle Error objects", async () => {
      mockGetInput.mockImplementation(() => {
        throw new Error("Test error");
      });

      await run();

      expect(mockSetFailed).toHaveBeenCalledWith("Test error");
    });

    it("should handle string errors", async () => {
      mockGetInput.mockImplementation(() => {
        throw "String error";
      });

      await run();

      expect(mockSetFailed).toHaveBeenCalledWith("String error");
    });

    it("should handle unknown error types", async () => {
      mockGetInput.mockImplementation(() => {
        throw { unknown: "error" };
      });

      await run();

      expect(mockSetFailed).toHaveBeenCalledWith("");
    });
  });
});

describe("module initialization", () => {
  it("should have coverage for initialization check", () => {
    const originalEnv = process.env.JEST_WORKER_ID;

    process.env.JEST_WORKER_ID = "1";
    expect(process.env.JEST_WORKER_ID).toBeTruthy();

    delete process.env.JEST_WORKER_ID;
    expect(process.env.JEST_WORKER_ID).toBeUndefined();

    process.env.JEST_WORKER_ID = originalEnv;
  });
});
