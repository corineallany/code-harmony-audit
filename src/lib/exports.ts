/** Point d'entrée unique des exports : une seule fonction de sérialisation CSV pour toute l'app. */

export type Column<T> = { key: string; label: string; value: (row: T) => unknown };

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "oui" : "non";
  const text = String(value).replace(/\r?\n/g, " ").trim();
  return /[";,]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T>(rows: T[], columns: Column<T>[]): string {
  const head = columns.map((c) => cell(c.label)).join(";");
  const body = rows.map((row) => columns.map((c) => cell(c.value(row))).join(";"));
  return [head, ...body].join("\r\n");
}

export function downloadCsv(filename: string, content: string) {
  // BOM pour qu'Excel reconnaisse l'UTF-8 et les accents français.
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
