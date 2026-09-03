import { OLLAMA_CHAT_URL, QWEN_MODEL } from "../constants/config.js";
import {
  DAILY_FOCUS_SYSTEM_PROMPT,
  FOCUS_TASK_SYSTEM_PROMPT,
  SYLLABUS_SYSTEM_PROMPT,
  dailyFocusPrompt,
  focusTaskPrompt,
  syllabusPrompt,
} from "../constants/prompts.js";
import { dayKey, formatSyllabusDue } from "../utils/dates.js";
import { extractJson } from "../utils/json.js";
import { normalizeCourseRoute } from "./studyMemoryRuntime.js";

async function qwenJson(system, prompt, signal) {
  const response = await fetch(OLLAMA_CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      model: QWEN_MODEL,
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Qwen returned ${response.status}`);
  const data = await response.json();
  return extractJson(data.message?.content || data.response || "");
}
function normalizeDraftTasks(items) {
  return Array.isArray(items)
    ? items
        .map((item, index) => ({
          id: `qwen-${Date.now()}-${index}`,
          label: String(item?.label || "").trim(),
          project: String(item?.project || item?.course || "school").trim(),
          estimate: String(item?.estimate || "30m").trim(),
          due: String(item?.due || "").trim(),
          description: String(
            item?.description ||
              "Drafted by Qwen from the upcoming assignment queue.",
          ).trim(),
          timeline: Array.isArray(item?.timeline)
            ? item.timeline.map((step) => String(step).trim()).filter(Boolean)
            : [],
          done: false,
        }))
        .filter((task) => task.label)
    : [];
}
function normalizeAssignments(items, now, sourceNames, routeBySource = new Map()) {
  return Array.isArray(items)
    ? items
        .map((item, index) => {
          const title = String(item?.title || item?.label || "").trim();
          const dueAt = String(item?.dueAt || item?.due || "")
            .trim()
            .slice(0, 10);
          const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(dueAt)
            ? new Date(`${dueAt}T23:59:00`)
            : null;
          const sourceName = String(item?.sourceFilename || item?.sourceName || sourceNames[0] || '').trim()
          const route = routeBySource.get(sourceName) || routeBySource.get(sourceNames[0])
          return {
            id: `syllabus-${index}-${title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .slice(0, 48)}`,
            course: String(item?.course || route?.courseLabel || route?.courseId || "").trim(),
            title,
            kind: String(
              item?.kind ||
                (/midterm|exam|quiz|test/i.test(title) ? "exam" : "assignment"),
            ).trim(),
            dueInHours:
              dueDate && !Number.isNaN(dueDate.getTime())
                ? Math.max(0, Math.round((dueDate - now) / 3600000))
                : null,
            dueAt: formatSyllabusDue(dueAt),
            weight: String(item?.weight || "").trim(),
            source: sourceNames.join(", "),
            sourceFilename: sourceName,
            courseId: route?.courseId || "",
            sourceRouteEvidence: route?.evidence || "",
          };
        })
        .filter((item) => item.title)
    : [];
}

export function normalizeSyllabusResponse(payload, now, sources = []) {
  const sourceNames = sources.map((source) => source.name)
  const records = Array.isArray(payload?.sources) ? payload.sources : Array.isArray(payload?.files) ? payload.files : Array.isArray(payload?.routing) ? payload.routing : []
  const routes = sources.map((source) => {
    const record = records.find((item) => String(item?.sourceFilename || item?.sourceName || item?.filename || item?.name || '').trim() === source.name) || (records.length === 1 && sources.length === 1 ? records[0] : null) || {}
    return { sourceFilename: source.name, ...normalizeCourseRoute(record), assignments: Array.isArray(record.assignments) ? record.assignments : [] }
  })
  const routeBySource = new Map(routes.map((route) => [route.sourceFilename, route]))
  const rootAssignments = Array.isArray(payload?.assignments) ? payload.assignments : []
  const assignments = records.length === 0
    ? normalizeAssignments(rootAssignments, now, sourceNames, routeBySource)
    : routes.flatMap((route) => normalizeAssignments(route.assignments, now, [route.sourceFilename], routeBySource).map((item) => ({ ...item, source: route.sourceFilename, courseId: route.courseId, sourceFilename: route.sourceFilename })))
  return { assignments, routes }
}
export async function draftFocusTasks(
  today,
  carriedTasks,
  assignments,
  signal,
) {
  return normalizeDraftTasks(
    await qwenJson(
      DAILY_FOCUS_SYSTEM_PROMPT,
      dailyFocusPrompt({ today, carriedTasks, assignments }),
      signal,
    ),
  );
}
export async function draftTasksFromPrompt(
  prompt,
  currentTasks,
  assignments,
  signal,
) {
  return normalizeDraftTasks(
    await qwenJson(
      FOCUS_TASK_SYSTEM_PROMPT,
      focusTaskPrompt({
        today: dayKey(new Date()),
        prompt,
        currentTasks,
        assignments,
      }),
      signal,
    ),
  );
}
export async function draftAssignmentsFromSyllabi(sources, now, signal) {
  const result = await draftSyllabusImport(sources, now, signal)
  return result.assignments
}

export async function draftSyllabusImport(sources, now, signal) {
  return normalizeSyllabusResponse(
    await qwenJson(
      SYLLABUS_SYSTEM_PROMPT,
      syllabusPrompt({ today: dayKey(now), sources }),
      signal,
    ),
    now,
    sources,
  );
}
export async function streamQwenChat(messages, onChunk, signal) {
  const response = await fetch(OLLAMA_CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({ model: QWEN_MODEL, stream: true, messages }),
  });
  if (!response.ok) throw new Error(`Qwen returned ${response.status}`);
  if (!response.body) {
    const data = await response.json();
    onChunk({
      content: data.message?.content || data.response || "",
      thinking: data.message?.thinking || data.thinking || "",
    });
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    lines.forEach((line) => {
      if (!line.trim()) return;
      const data = JSON.parse(line);
      onChunk({
        content: data.message?.content || data.response || "",
        thinking: data.message?.thinking || data.thinking || "",
      });
    });
    if (done) break;
  }
  if (buffer.trim()) {
    const data = JSON.parse(buffer);
    onChunk({
      content: data.message?.content || data.response || "",
      thinking: data.message?.thinking || data.thinking || "",
    });
  }
}
