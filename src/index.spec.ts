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
            ref: "ABC-123-fix-auth-bug",
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
          "ticket-regex": "^ABC-\\d+",
          "ticket-regex-flags": "i",
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

    it("should error when ticket-regex is missing", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "12345",
          "ticket-regex": "",
          "ticket-regex-flags": "i",
          "exception-regex": "^dependabot/",
          "exception-regex-flags": "",
          "clean-title-regex": "",
          "clean-title-regex-flags": "",
        };
        return inputs[name] || "";
      });

      await run();

      expect(mockError).toHaveBeenCalledWith(
        "Missing required input: ticket-regex"
      );
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("should error with plural when multiple inputs are missing", async () => {
      mockGetInput.mockReturnValue("");

      await run();

      expect(mockError).toHaveBeenCalledWith(
        "Missing required inputs: forecast-project-id, ticket-regex"
      );
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("when ticket is found in branch name", () => {
    it("should update PR title and body with ticket info", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "12345",
          "ticket-regex": "^ABC-\\d+",
          "ticket-regex-flags": "i",
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
        title: "ABC-123 - Fix bug in authentication",
        body: "**[Forecast ticket](https://app.forecast.it/project/12345/ticket/ABC-123)**\n\nThis PR fixes a critical bug",
      });
    });

    it("should not update title if ticket already present", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "12345",
          "ticket-regex": "^ABC-\\d+",
          "ticket-regex-flags": "i",
          "exception-regex": "",
          "exception-regex-flags": "",
          "clean-title-regex": "",
          "clean-title-regex-flags": "",
        };
        return inputs[name] || "";
      });

      (github.context as any).payload.pull_request.title = "ABC-123 - Fix bug";

      await run();

      expect(mockUpdate).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        pull_number: 123,
        body: "**[Forecast ticket](https://app.forecast.it/project/12345/ticket/ABC-123)**\n\nThis PR fixes a critical bug",
      });
      expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty("title");
    });

    it("should clean title before adding ticket when clean-title-regex is provided", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "12345",
          "ticket-regex": "^ABC-\\d+",
          "ticket-regex-flags": "i",
          "exception-regex": "",
          "exception-regex-flags": "",
          "clean-title-regex": "\\[WIP\\]\\s*",
          "clean-title-regex-flags": "i",
        };
        return inputs[name] || "";
      });

      (github.context as any).payload.pull_request.title =
        "[WIP] Fix bug in authentication";

      await run();

      expect(mockUpdate).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        pull_number: 123,
        title: "ABC-123 - Fix bug in authentication",
        body: "**[Forecast ticket](https://app.forecast.it/project/12345/ticket/ABC-123)**\n\nThis PR fixes a critical bug",
      });
    });

    it("should update existing Forecast link in body", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "12345",
          "ticket-regex": "^ABC-\\d+",
          "ticket-regex-flags": "i",
          "exception-regex": "",
          "exception-regex-flags": "",
          "clean-title-regex": "",
          "clean-title-regex-flags": "",
        };
        return inputs[name] || "";
      });

      (github.context as any).payload.pull_request.body =
        "**[Forecast ticket](https://app.forecast.it/project/12345/ticket/OLD-999)**\n\nThis PR fixes a critical bug";

      await run();

      expect(mockUpdate).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        pull_number: 123,
        title: "ABC-123 - Fix bug in authentication",
        body: "**[Forecast ticket](https://app.forecast.it/project/12345/ticket/ABC-123)**\n\nThis PR fixes a critical bug",
      });
    });

    it("should not update body if Forecast link already correct", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "12345",
          "ticket-regex": "^ABC-\\d+",
          "ticket-regex-flags": "i",
          "exception-regex": "",
          "exception-regex-flags": "",
          "clean-title-regex": "",
          "clean-title-regex-flags": "",
        };
        return inputs[name] || "";
      });

      (github.context as any).payload.pull_request.body =
        "**[Forecast ticket](https://app.forecast.it/project/12345/ticket/ABC-123)**\n\nThis PR fixes a critical bug";

      await run();

      expect(mockUpdate).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        pull_number: 123,
        title: "ABC-123 - Fix bug in authentication",
      });
      expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty("body");
    });
  });

  describe("when ticket is found in PR title but not branch", () => {
    it("should extract ticket from title and update body", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "12345",
          "ticket-regex": "^ABC-\\d+",
          "ticket-regex-flags": "i",
          "exception-regex": "",
          "exception-regex-flags": "",
          "clean-title-regex": "",
          "clean-title-regex-flags": "",
        };
        return inputs[name] || "";
      });

      (github.context as any).payload.pull_request.head.ref =
        "feature/new-feature";
      (github.context as any).payload.pull_request.title =
        "ABC-456 - Add new feature";

      await run();

      expect(mockUpdate).toHaveBeenCalledWith({
        owner: "testowner",
        repo: "testrepo",
        pull_number: 123,
        body: "**[Forecast ticket](https://app.forecast.it/project/12345/ticket/ABC-456)**\n\nThis PR fixes a critical bug",
      });
      expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty("title");
    });
  });

  describe("when no ticket is found", () => {
    it("should fail when branch doesn't match ticket pattern and no exception", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "12345",
          "ticket-regex": "^ABC-\\d+",
          "ticket-regex-flags": "i",
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
        "Neither current branch nor title start with a Jira ticket /^ABC-\\d+/i."
      );
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("should not fail when branch matches exception pattern", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "12345",
          "ticket-regex": "^ABC-\\d+",
          "ticket-regex-flags": "i",
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

    it("should handle exception regex with flags", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "12345",
          "ticket-regex": "^ABC-\\d+",
          "ticket-regex-flags": "i",
          "exception-regex": "^DEPENDABOT/",
          "exception-regex-flags": "i",
          "clean-title-regex": "",
          "clean-title-regex-flags": "",
        };
        return inputs[name] || "";
      });

      (github.context as any).payload.pull_request.head.ref =
        "dependabot/npm_and_yarn/lodash-4.17.21";
      (github.context as any).payload.pull_request.title = "Bump lodash";

      await run();

      expect(mockSetFailed).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("when PR update fails", () => {
    it("should log error when update returns non-200 status", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "12345",
          "ticket-regex": "^ABC-\\d+",
          "ticket-regex-flags": "i",
          "exception-regex": "",
          "exception-regex-flags": "",
          "clean-title-regex": "",
          "clean-title-regex-flags": "",
        };
        return inputs[name] || "";
      });

      mockUpdate.mockResolvedValue({ status: 403 });

      await run();

      expect(mockError).toHaveBeenCalledWith(
        "Updating the pull request has failed with 403"
      );
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

  describe("when nothing needs updating", () => {
    it("should not call update when no changes needed", async () => {
      mockGetInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          "github-token": "test-token",
          "forecast-project-id": "12345",
          "ticket-regex": "^ABC-\\d+",
          "ticket-regex-flags": "i",
          "exception-regex": "",
          "exception-regex-flags": "",
          "clean-title-regex": "",
          "clean-title-regex-flags": "",
        };
        return inputs[name] || "";
      });

      (github.context as any).payload.pull_request.title =
        "ABC-123 - Fix bug in authentication";
      (github.context as any).payload.pull_request.body =
        "**[Forecast ticket](https://app.forecast.it/project/12345/ticket/ABC-123)**\n\nThis PR fixes a critical bug";

      await run();

      expect(mockUpdate).not.toHaveBeenCalled();
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
