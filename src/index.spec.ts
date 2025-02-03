import { run } from "./index";
import { getInput, setFailed } from "@actions/core";
import { context, getOctokit } from "@actions/github";

// Mock getInput and setFailed functions
jest.mock("@actions/core", () => ({
  getInput: jest.fn(),
  setFailed: jest.fn(),
}));

// Mock context and getOctokit functions
jest.mock("@actions/github", () => ({
  context: {
    payload: {
      pull_request: {
        number: 1,
      },
    },
    repo: {
      owner: "owner",
      repo: "repo",
    },
  },
  getOctokit: jest.fn(),
}));

describe("run", () => {
  beforeEach(() => {
    // Clear all mock function calls and reset mock implementation
    jest.clearAllMocks();
  });

  it("should set a failure message if the required inputs are missing", async () => {
    // Mock the return values for getInput
    (getInput as jest.Mock).mockReturnValueOnce("");
    expect(getInput).toHaveBeenCalledTimes(2);
  });
});
