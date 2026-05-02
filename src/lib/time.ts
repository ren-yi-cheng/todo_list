import type { IsoString } from "../types";

export function nowIso(): IsoString {
  return new Date().toISOString();
}

export function parseIso(iso: IsoString): Date | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function formatLocal(iso: IsoString): string {
  const d = parseIso(iso);
  if (!d) return iso;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function toDatetimeLocalValue(iso: IsoString | null): string {
  if (!iso) return "";
  const d = parseIso(iso);
  if (!d) return "";
  return (
    String(d.getFullYear()) +
    "-" +
    pad2(d.getMonth() + 1) +
    "-" +
    pad2(d.getDate()) +
    "T" +
    pad2(d.getHours()) +
    ":" +
    pad2(d.getMinutes())
  );
}

export function fromDatetimeLocalValue(value: string): IsoString | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function compareMaybeIso(a: IsoString | null, b: IsoString | null): number {
  if (a && b) return a.localeCompare(b);
  if (a) return -1;
  if (b) return 1;
  return 0;
}
