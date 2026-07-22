export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export const randomTypingDelay = () => Math.floor(1500 + Math.random() * 1501);
export function isOpen(hours: any, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: hours.timezone || "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const wd: { [k: string]: number } = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const key = wd[parts.find((p) => p.type === "weekday")?.value || "Sun"];
  const time = `${parts.find((p) => p.type === "hour")?.value}:${parts.find((p) => p.type === "minute")?.value}`;
  const range = hours.days?.[key];
  if (
    range &&
    (range[1] >= range[0]
      ? time >= range[0] && time <= range[1]
      : time >= range[0])
  )
    return true;
  const previous = hours.days?.[(key + 6) % 7];
  return !!previous && previous[1] < previous[0] && time <= previous[1];
}
