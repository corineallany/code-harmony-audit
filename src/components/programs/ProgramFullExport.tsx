import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, formatDateTime, recurrenceLabel, STATUS_LABEL } from "@/lib/icc";

type ExportSection = "infos" | "tasks" | "team" | "documents";

type ProgramFullExportProps = {
  program: any;
  tasks: any[];
  documents: any[];
  notes: any[];
  responses: any[];
  memberName: Map<string, string>;
  poleName: Map<string, string>;
};

const SECTION_LABELS: Record<ExportSection, string> = {
  infos: "Informations",
  tasks: "Tâches / checklist",
  team: "Équipe du jour",
  documents: "Documents & notes",
};

const responseLabel = (status?: string | null) => ({
  available: "Accepté",
  partial: "Accepté partiellement",
  unavailable: "Refusé",
  pending: "En attente",
}[status ?? ""] ?? status ?? "En attente");

const esc = (value: unknown) => String(value ?? "—")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

export function ProgramFullExport({ program, tasks, documents, notes, responses, memberName, poleName }: ProgramFullExportProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<ExportSection, boolean>>({ infos: true, tasks: true, team: true, documents: true });
  const sections = Object.keys(SECTION_LABELS) as ExportSection[];
  const allSelected = sections.every(section => selected[section]);
  const anySelected = sections.some(section => selected[section]);

  const toggleAll = (checked: boolean) => setSelected({ infos: checked, tasks: checked, team: checked, documents: checked });

  const exportSheet = () => {
    if (!anySelected) return;
    const responseOf = (memberId: string) => responses.find((response: any) => response.member_id === memberId);
    const infoRows = [
      ["Statut", STATUS_LABEL[program.status] ?? program.status],
      ["Date", formatDate(program.start_date)],
      ["Horaires", `${program.start_time ?? "—"} → ${program.end_time ?? "—"}`],
      ["Lieu", program.location ?? "—"],
      ["Public", program.audience ?? "—"],
      ["Récurrence", recurrenceLabel(program.recurrence)],
      ["Format", program.format ?? "—"],
      ["Type", program.program_type ?? "—"],
      ["Pôles mobilisés", (program.assignments ?? []).map((assignment: any) => poleName.get(assignment.pole_id) ?? assignment.pole_id).join(", ") || "—"],
      ["Description", program.description ?? "—"],
      ["Note générale", program.general_note ?? "—"],
    ];
    const infoHtml = `<section><h2>Informations</h2><div class="grid">${infoRows.map(([label, value]) => `<div class="field"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("")}</div></section>`;
    const tasksHtml = `<section><h2>Tâches / checklist</h2>${tasks.length ? `<ul>${tasks.map((task: any) => `<li>${task.status === "done" ? "☑" : "☐"} ${esc(task.title)}${task.pole_id ? ` <small>· ${esc(poleName.get(task.pole_id) ?? task.pole_id)}</small>` : ""}</li>`).join("")}</ul>` : "<p>Aucune tâche.</p>"}</section>`;
    const teamHtml = `<section><h2>Équipe du jour</h2>${(program.assignments ?? []).length ? (program.assignments ?? []).map((assignment: any) => `<div class="team"><h3>${esc(poleName.get(assignment.pole_id) ?? "Pôle")}</h3>${assignment.tasks ? `<p>${esc(assignment.tasks)}</p>` : ""}${(assignment.memberIds ?? []).length ? `<ul>${assignment.memberIds.map((memberId: string) => { const response = responseOf(memberId); const location = response?.team_location === "travel" ? "En déplacement" : response?.team_location === "onsite" ? "Sur place" : "Répartition à préciser"; return `<li><strong>${esc(memberName.get(memberId) ?? memberId)}</strong> · ${esc(responseLabel(response?.status))}${program.travel ? ` · ${esc(location)}` : ""}</li>`; }).join("")}</ul>` : "<p>Aucun membre affecté.</p>"}</div>`).join("") : "<p>Aucune équipe affectée.</p>"}</section>`;
    const programDocuments = documents.filter((document: any) => document.program_id === program.id);
    const programNotes = notes.filter((note: any) => note.entity === "program" && note.entity_id === program.id);
    const documentsHtml = `<section><h2>Documents & notes</h2><h3>Documents</h3>${programDocuments.length ? `<ul>${programDocuments.map((document: any) => `<li>${esc(document.title)}${document.url ? ` — ${esc(document.url)}` : ""}</li>`).join("")}</ul>` : "<p>Aucun document.</p>"}<h3>Notes</h3>${programNotes.length ? programNotes.map((note: any) => `<div class="note"><p>${esc(note.body)}</p><small>${esc(note.author_name ?? "")} ${note.created_at ? `· ${esc(formatDateTime(note.created_at))}` : ""}</small></div>`).join("") : "<p>Aucune note.</p>"}</section>`;
    const body = [selected.infos ? infoHtml : "", selected.tasks ? tasksHtml : "", selected.team ? teamHtml : "", selected.documents ? documentsHtml : ""].join("");
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) return;
    popup.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(program.title)} — fiche programme</title><style>@page{size:A4;margin:15mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#1f2937;line-height:1.45;margin:0}header{border-bottom:3px solid #6d28d9;padding-bottom:14px;margin-bottom:22px}h1{font-size:24px;margin:0 0 5px;color:#4c1d95}h2{font-size:18px;color:#5b21b6;border-bottom:1px solid #ddd;padding-bottom:6px;margin:24px 0 12px}h3{font-size:14px;margin:14px 0 5px}.meta{color:#6b7280;font-size:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 18px}.field{padding:8px 0;border-bottom:1px solid #eee}.field span{display:block;text-transform:uppercase;font-size:9px;color:#6b7280;font-weight:700}.field strong{font-size:12px;white-space:pre-wrap}.team,.note{border:1px solid #e5e7eb;border-radius:8px;padding:10px;margin:8px 0}ul{padding-left:20px}li{margin:5px 0;font-size:12px}p{font-size:12px;white-space:pre-wrap}small{color:#6b7280}section{break-inside:avoid-page}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><header><h1>${esc(program.title)}</h1><div class="meta">Fiche programme complète · ${esc(formatDate(program.start_date))}${program.location ? ` · ${esc(program.location)}` : ""}</div></header>${body}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),150));<\/script></body></html>`);
    popup.document.close();
    setOpen(false);
  };

  return <>
    <Button size="sm" variant="outline" onClick={() => setOpen(true)}>🖨️ Exporter la fiche</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Exporter la fiche complète</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Choisissez les parties de la fiche à inclure. L’export reprend les données complètes, même si l’onglet n’est pas affiché à l’écran.</p>
        <label className="flex items-center gap-3 rounded-lg border p-3 font-semibold"><input type="checkbox" checked={allSelected} onChange={event => toggleAll(event.target.checked)} />Tout sélectionner</label>
        <div className="grid gap-2">
          {sections.map(section => <label key={section} className="flex items-center gap-3 rounded-lg border p-3"><input type="checkbox" checked={selected[section]} onChange={event => setSelected(current => ({ ...current, [section]: event.target.checked }))} /><span>{SECTION_LABELS[section]}</span></label>)}
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button disabled={!anySelected} onClick={exportSheet}>Exporter / imprimer</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
