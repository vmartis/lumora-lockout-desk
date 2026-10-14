import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";

export interface Ticket {
  ticketId: string;
  createdAt: string;
  accountId: string;
  channel: string;
  status: string;
  text: string;
}

const OPEN = new Set(["NEW", "WAITING_FOR_CUSTOMER"]);

/** Tickets refer to customers as "LB-000083", "83" or "000003"; map all to "LB-000083". */
export function normalizeAccountId(ref: string): string | null {
  const m = /^(?:LB-)?(\d{1,6})$/i.exec(ref.trim());
  if (!m) return null;
  return `LB-${m[1].padStart(6, "0")}`;
}

export function parseTickets(csv: string): Ticket[] {
  const rows: Record<string, string>[] = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
  return rows.flatMap((r) => {
    const accountId = normalizeAccountId(r.customer_ref ?? "");
    if (!accountId || !OPEN.has(r.status)) return [];
    return [{ ticketId: r.ticket_id, createdAt: r.created_at, accountId, channel: r.channel, status: r.status, text: r.text }];
  });
}

export const loadTickets = (file: string) => parseTickets(readFileSync(file, "utf8"));
