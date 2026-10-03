function toDate(value: Date | string) {
  return typeof value === "string" ? new Date(value) : value;
}

export function shortDate(value: Date | string) {
  const date = toDate(value);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) }).format(date);
}

export function dateTime(value: Date | string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(toDate(value));
}
