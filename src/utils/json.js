export function extractJson(text) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start >= 0 && end >= start)
    return JSON.parse(cleaned.slice(start, end + 1));
  const parsed = JSON.parse(cleaned);
  return parsed.assignments || parsed.tasks || [];
}
