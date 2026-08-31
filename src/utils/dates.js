export function dayKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
export function greetingFor(date) {
  const hour = date.getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
export function formatClock(date) {
  return date.toLocaleTimeString("en-US", { hour12: false });
}
export function formatDateLine(date) {
  return date
    .toLocaleDateString("en-US", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toLowerCase();
}
export function dueClock(hours, now) {
  return new Date(now.getTime() + hours * 3600000)
    .toLocaleString("en-US", {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .toLowerCase();
}
export function relativeUpdated(timestamp) {
  const hours = Math.max(
    0,
    Math.round((Date.now() - new Date(timestamp).getTime()) / 3600000),
  );
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
export function formatTaskDue(value) {
  return value
    ? new Intl.DateTimeFormat("en-CA", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(`${value}T12:00:00`))
    : "No due date set";
}
export function formatSyllabusDue(value) {
  const date = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Intl.DateTimeFormat("en-CA", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
        .format(new Date(`${date}T12:00:00`))
        .toLowerCase()
    : "";
}
