export const OLLAMA_CHAT_URL = "http://localhost:11434/api/chat";
export const QWEN_MODEL = "qwen2.5:7b";
export const FOCUS_STATE_KEY = "start.focus.state";
export const ASSIGNMENTS_STATE_KEY = "start.assignments";
export const GITHUB_CONFIG_KEY = "start.github.config";

export const seedTasks = [
  {
    id: "t1",
    label: "Ship auth refresh-token rotation",
    project: "orbit-api",
    estimate: "2h",
    due: "2026-09-02",
    description:
      "Rotate refresh tokens on every exchange and keep the existing session invalidation path intact.",
    timeline: [
      "Review the current token exchange flow",
      "Implement rotation and persistence",
      "Add coverage for reuse and expiry",
      "Open the PR and request review",
    ],
    done: false,
  },
  {
    id: "t2",
    label: "Review Priya’s scheduler PR",
    project: "orbit-api",
    estimate: "30m",
    due: "2026-09-01",
    description:
      "Check the retry budget behavior and make sure failed jobs cannot create an unbounded retry loop.",
    timeline: [
      "Read the diff and existing scheduler tests",
      "Run the retry-related test suite",
      "Leave review notes or approve",
    ],
    done: false,
  },
  {
    id: "t3",
    label: "Draft CS-441 project proposal",
    project: "school",
    estimate: "45m",
    due: "2026-09-03",
    description:
      "Turn the project idea into a one-page proposal with the problem, approach, and a realistic scope.",
    timeline: [
      "Write a rough problem statement",
      "Choose the smallest useful scope",
      "Add milestones and proofread",
    ],
    done: false,
  },
  {
    id: "t4",
    label: "Fix flaky snapshot tests on CI",
    project: "dashboard",
    estimate: "1h",
    due: "2026-09-04",
    description:
      "Find the source of the intermittent snapshot mismatch and make the test deterministic in CI.",
    timeline: [
      "Reproduce the failure locally",
      "Trace the source of the unstable output",
      "Update the fixture and rerun CI",
    ],
    done: true,
  },
  {
    id: "t5",
    label: "Morning inbox + standup notes",
    project: "admin",
    estimate: "20m",
    due: "2026-08-31",
    description:
      "Clear the highest-signal messages and capture anything that should become a task later.",
    timeline: [
      "Scan unread messages",
      "Capture follow-ups",
      "Write the standup update",
    ],
    done: true,
  },
];

export const fallbackWeather = {
  location: "Current location",
  temp: 20,
  feelsLike: 19,
  condition: "Locating weather",
  high: 23,
  low: 13,
  windKmh: 11,
  humidity: 48,
  hourly: [
    { hour: "15", temp: 70 },
    { hour: "16", temp: 71 },
    { hour: "17", temp: 69 },
    { hour: "18", temp: 66 },
    { hour: "19", temp: 62 },
    { hour: "20", temp: 59 },
  ],
};
