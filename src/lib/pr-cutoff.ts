const CUTOFF_DAY = 10;
const TIME_ZONE = "Asia/Bangkok";

/** Next order-request cut-off (the 10th of the month), counted in Bangkok time. */
export function getNextCutoff(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const year = get("year");
  const month = get("month"); // 1-12
  const day = get("day");

  // Up to and including the 10th, the cut-off is this month. After that, next month.
  const targetMonthIndex = day <= CUTOFF_DAY ? month - 1 : month;
  const target = Date.UTC(year, targetMonthIndex, CUTOFF_DAY);
  const today = Date.UTC(year, month - 1, day);
  const daysLeft = Math.round((target - today) / 86400000);

  const label = new Date(target).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const daysText =
    daysLeft === 0 ? "Today is the last day" : daysLeft === 1 ? "1 day left" : `${daysLeft} days left`;

  return { label, daysLeft, daysText };
}