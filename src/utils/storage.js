import {
  ASSIGNMENTS_STATE_KEY,
  FOCUS_STATE_KEY,
  GITHUB_CONFIG_KEY,
  seedTasks,
} from "../constants/config.js";
import { dayKey } from "./dates.js";
export function readFocusState(date) {
  const today = dayKey(date);
  try {
    const saved = JSON.parse(localStorage.getItem(FOCUS_STATE_KEY));
    if (!saved || !Array.isArray(saved.tasks))
      return { day: today, tasks: seedTasks, shouldDraft: false };
    if (saved.day === today)
      return { day: today, tasks: saved.tasks, shouldDraft: false };
    return {
      day: today,
      tasks: saved.tasks.filter((task) => !task.done),
      shouldDraft: true,
    };
  } catch {
    return { day: today, tasks: seedTasks, shouldDraft: false };
  }
}
export function writeFocusState(day, tasks) {
  try {
    localStorage.setItem(FOCUS_STATE_KEY, JSON.stringify({ day, tasks }));
  } catch {
    /* Session state remains available. */
  }
}
export function readAssignments() {
  try {
    const saved = JSON.parse(localStorage.getItem(ASSIGNMENTS_STATE_KEY));
    if (!Array.isArray(saved)) return [];
    return saved
      .map((item, index) => ({
        id: String(item?.id || `assignment-${index}`),
        course: String(item?.course || "").trim(),
        title: String(item?.title || "").trim(),
        kind: String(item?.kind || "assignment").trim(),
        dueInHours:
          item?.dueInHours !== undefined &&
          item?.dueInHours !== null &&
          item?.dueInHours !== "" &&
          Number.isFinite(Number(item.dueInHours))
            ? Number(item.dueInHours)
            : null,
        dueAt: String(item?.dueAt || "").trim(),
        weight: String(item?.weight || "").trim(),
        source: String(item?.source || "").trim(),
      }))
      .filter((item) => item.title && !item.id.startsWith("google-"));
  } catch {
    return [];
  }
}
export function writeAssignments(value) {
  try {
    localStorage.setItem(ASSIGNMENTS_STATE_KEY, JSON.stringify(value));
  } catch {
    /* Session state remains available. */
  }
}
export function clearStoredAssignments() {
  localStorage.removeItem(ASSIGNMENTS_STATE_KEY);
}
export function readGitHubConfig() {
  try {
    return (
      JSON.parse(localStorage.getItem(GITHUB_CONFIG_KEY)) || {
        username: "",
        token: "",
      }
    );
  } catch {
    return { username: "", token: "" };
  }
}
export function writeGitHubConfig(value) {
  localStorage.setItem(GITHUB_CONFIG_KEY, JSON.stringify(value));
}
export function clearGitHubConfig() {
  localStorage.removeItem(GITHUB_CONFIG_KEY);
}
