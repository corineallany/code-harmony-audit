import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell, EmptyState } from "@/components/AppShell";
import { useCurrentRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { detectConflicts } from "@/lib/conflicts";
import {
  attendanceQuery,
  availabilityQuery,
  formatDate,
  formatDateTime,
  internalNotesQuery,
  logAction,
  membersQuery,
  polesQuery,
  PRESENCE_LABEL,
  programDocumentsQuery,
  programsQuery,
  recurrenceLabel,
  solicitationsQuery,
  STATUS_LABEL,
  timelineQuery,
  type ResponseStatus,
} from "@/lib/icc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/programme/$id")({
  head: () => ({
    meta: [
      { title: "Fiche programme — COM ICC Le Mans" },
      {
        name: "description",
        content:
          "Fiche programme complète du pôle Communication ICC Le Mans : équipe affectée, réponses, renforts, documents, notes et timeline.",
      },
      { property: "og:title", content: "Fiche programme — COM ICC Le Mans" },
      {
        property: "og:description",
        content: "Toutes les informations d'un programme : équipe du jour, réponses, documents et historique.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProgramSheet,
});

const RESPONSES: ResponseStatus[] = ["available", "partial", "unavailable"];
const RESPONSE_TEXT: Record<string, string> = {
  available: "Accepté",
  partial: "Accepté partiellement",
  unavailable: "Refusé",
  pending: "En attente",
};

function responseLabel(status: string | null | undefined) {
  return status ? RESPONSE_TEXT[status] ?? status : "En attente";
}

function solicitationNature(s: {
  target_type?: string | null;
  mode?: string | null;
  replacement_member_id?: string | null;
  event_name?: string | null;
}) {
  const raw = `${s.target_type ?? ""} ${s.mode ?? ""} ${s.event_name ?? ""}`.toLowerCase();
  return s.replacement_member_id || raw.includes("remplac") ? "Remplacement" : "Renfort ponctuel";
}

function solicitationResponse(status: string | null | undefined, decision: string | null | undefined) {
  const value = decision ?? status ?? "pending";
  if (["accepted", "available", "validated"].includes(value)) return "Accepté";
  if (["partial", "partially_accepted"].includes(value)) return "Accepté partiellement";
  if (["refused", "unavailable", "rejected"].includes(value)) return "Refusé";
  return "En attente";
}

function ProgramSheet() {
  const { id } = Route.useParams();
  const { member, isStaff, isAdmin } = useCurrentRole();
  const queryClient = useQueryClient();

  const programs = useQuery(programsQuery);
  const poles = useQuery(polesQuery);
  const members = useQuery(membersQuery);
  const availability = useQuery(availabilityQuery);
  const solicitations = useQuery(solicitationsQuery);
  const documents = useQuery(programDocumentsQuery);
  const notes = useQuery(internalNotesQuery);
  const attendance = useQuery(attendanceQuery);
  const timeline = useQuery(timelineQuery("program", id));
  const programResponses = useQuery({
    queryKey: ["program-responses", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_member_responses")
        .select("*")
        .eq("program_id", id);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const program = (programs.data ?? []).find((p) => p.id === id) ?? null;

  const poleName = useMemo(() => new Map((poles.data ?? []).map((p) => [p.id, p.name])), [poles.data]);
  const memberById = useMemo(
    () => new Map((members.data?.members ?? []).map((m) => [m.id, m])),
    [members.data],
  );
  const memberName = (mid: string) => memberById.get(mid)?.full_name ?? mid;

  const conflicts = useMemo(() => {
    if (!programs.data || !availability.data || !members.data) return [];
    return detectConflicts(programs.data, members.data.members, availability.data).filter(
      (c) => c.programId === id,
    );
  }, [programs.data, availability.data, members.data, id]);

  const linkedSolicitations = (solicitations.data ?? []).filter((s) => s.program_id === id);
  const programDocs = (documents.data ?? []).filter((d) => d.program_id === id);
  const programNotes = (notes.data ?? []).filter((n) => n.entity === "program" && n.entity_id === id);
  const programAttendance = (attendance.data ?? []).filter((a) => a.program_id === id);

  const assignedIds = useMemo(
    () => Array.from(new Set((program?.assignments ?? []).flatMap((a) => a.memberIds))),
    [program],
  );
  const responseOf = (mid: string) => (programResponses.data ?? []).find((r) => r.member_id === mid) ?? null;

  const [responseEditor, setResponseEditor] = useState<ResponseStatus | null>(null);
  const [responseNote, setResponseNote] = useState("");

  const respond = useMutation({
    mutationFn: async ({ status, note }: { status: ResponseStatus; note?: string }) => {
      if (!member?.id) throw new Error("Votre compte n'est lié à aucun équipier.");
      const clean = note?.trim() || null;
      const { error } = await supabase.from("program_member_responses").upsert(
        {
          id: `${id}__${member.id}`,
          program_id: id,
          member_id: member.id,
          status,
          reserve: status === "partial" ? clean : null,
          reason: status === "unavailable" ? clean : null,
        },
        { onConflict: "program_id,member_id" },
      );
      if (error) throw new Error(error.message);
      await logAction({
        action: "reponse_affectation",
        entity: "program",
        entityId: id,
        detail: `${responseLabel(status)}${clean ? ` — ${clean}` : ""}`,
        actorName: member.full_name,
      });
    },
    onSuccess: () => {
      setResponseEditor(null);
      setResponseNote("");
      toast.success("Réponse enregistrée");
      queryClient.invalidateQueries({ queryKey: ["program-responses", id] });
      queryClient.invalidateQueries({ queryKey: ["programs"] });
      queryClient.invalidateQueries({ queryKey: ["timeline", "program", id] });
    },
    onError: (e: Error) => toast.error("Enregistrement impossible", { description: e.message }),
  });

  function chooseResponse(status: ResponseStatus) {
    if (status === "available") {
      setResponseEditor(null);
      setResponseNote("");
      respond.mutate({ status });
      return;
    }
    const existing = responseOf(member?.id ?? "");
    setResponseEditor(status);
    setResponseNote(status === "partial" ? existing?.reserve ?? "" : existing?.reason ?? "");
  }

  const [docTitle, setDocTitle] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const addDocument = useMutation({
    mutationFn: async () => {
      if (!docTitle.trim() || !docUrl.trim()) throw new Error("Titre et lien obligatoires.");
      const { error } = await supabase
        .from("program_documents")
        .insert({ program_id: id, title: docTitle.trim(), url: docUrl.trim(), kind: "lien" });
      if (error) throw new Error(error.message);
      await logAction({
        action: "document_ajoute",
        entity: "program",
        entityId: id,
        detail: docTitle.trim(),
        actorName: member?.full_name,
      });
    },
    onSuccess: () => {
      setDocTitle("");
      setDocUrl("");
      toast.success("Document ajouté");
      queryClient.invalidateQueries({ queryKey: ["program-documents"] });
      queryClient.invalidateQueries({ queryKey: ["timeline", "program", id] });
    },
    onError: (e: Error) => toast.error("Ajout impossible", { description: e.message }),
  });

  const [noteBody, setNoteBody] = useState("");
  const [noteVisibility, setNoteVisibility] = useState("equipe");
  const addNote = useMutation({
    mutationFn: async () => {
      if (!noteBody.trim()) throw new Error("Note vide.");
      const { error } = await supabase.from("internal_notes").insert({
        entity: "program",
        entity_id: id,
        body: noteBody.trim(),
        visibility: noteVisibility,
        author_name: member?.full_name ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setNoteBody("");
      toast.success("Note enregistrée");
      queryClient.invalidateQueries({ queryKey: ["internal-notes"] });
    },
    onError: (e: Error) => toast.error("Enregistrement impossible", { description: e.message }),
  });

  async function copyLink() {
    const url = `${window.location.origin}/programme/${id}`;
    await navigator.clipboard.writeText(url);
    toast.success("Lien copié", { description: url });
  }

  if (programs.isLoading) {
    return (
      <AppShell title="Fiche programme">
        <Skeleton className="h-40 rounded-xl" />
      </AppShell>
    );
  }

  if (!program) {
    return (
      <AppShell title="Fiche programme">
        <EmptyState title="Programme introuvable" description="Il a peut-être été archivé ou supprimé." />
      </AppShell>
    );
  }

  const mine = member?.id ? responseOf(member.id) : null;
  const canRespond = !!member?.id && assignedIds.includes(member.id);

  return (
    <AppShell
      title={program.title}
      subtitle={`${formatDate(program.start_date)}${program.location ? ` · ${program.location}` : ""}`}
      actions={
        <>
          <Button size="sm" variant="outline" onClick={copyLink}>
            🔗 Copier le lien
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            🖨️ Feuille de service
          </Button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{STATUS_LABEL[program.status] ?? program.status}</Badge>
        {program.importance ? <Badge variant="outline">{program.importance}</Badge> : null}
        {program.program_type ? <Badge variant="outline">{program.program_type}</Badge> : null}
        {program.format ? <Badge variant="outline">{program.format}</Badge> : null}
        {program.archived ? <Badge variant="destructive">Archivé</Badge> : null}
      </div>

      <Tabs defaultValue="infos">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="infos">Informations</TabsTrigger>
          <TabsTrigger value="equipe">Équipe du jour</TabsTrigger>
          <TabsTrigger value="documents">Documents & notes</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="infos" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informations générales</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Info label="Date" value={formatDate(program.start_date)} />
              <Info
                label="Horaires"
                value={`${program.start_time ?? "—"} → ${program.end_time ?? "—"}`}
              />
              <Info label="Lieu" value={program.location ?? "—"} />
              {(program.onsite || program.travel) ? (
                <>
                  <Info label="Membres sur place" value={program.onsite ?? "—"} />
                  <Info label="Membres en déplacement" value={program.travel ?? "—"} />
                </>
              ) : null}
              <Info label="Public" value={program.audience ?? "—"} />
              <Info label="Récurrence" value={recurrenceLabel(program.recurrence)} />
              <Info
                label="Pôles mobilisés"
                value={
                  program.assignments.length
                    ? program.assignments.map((a) => poleName.get(a.pole_id) ?? "?").join(", ")
                    : "—"
                }
              />
              <Info label="Lien ressource" value={program.resource_link ?? "—"} />
              {program.description ? (
                <div className="sm:col-span-2">
                  <Info label="Description" value={program.description} />
                </div>
              ) : null}
              {program.general_note ? (
                <div className="sm:col-span-2">
                  <Info label="Note générale" value={program.general_note} />
                </div>
              ) : null}
            </CardContent>
          </Card>

          {canRespond ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ma réponse à l'affectation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {RESPONSES.map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={mine?.status === status ? "default" : "outline"}
                      disabled={respond.isPending}
                      onClick={() => chooseResponse(status)}
                    >
                      {status === "available" ? "Accepter" : status === "partial" ? "Accepter partiellement" : "Refuser"}
                    </Button>
                  ))}
                  {respond.isPending ? (
                    <span className="self-center text-xs text-muted-foreground">Synchronisation…</span>
                  ) : null}
                </div>

                {responseEditor ? (
                  <div className="rounded-xl border border-border bg-muted/30 p-3">
                    <p className="mb-2 text-sm font-bold text-icc-violet">
                      {responseEditor === "partial" ? "Réserve liée à l'acceptation partielle" : "Motif du refus"}
                    </p>
                    <Textarea
                      rows={3}
                      value={responseNote}
                      onChange={(e) => setResponseNote(e.target.value)}
                      placeholder={responseEditor === "partial" ? "Ex. : disponible à partir de 15 h, départ à 18 h…" : "Indique ton motif si tu le souhaites."}
                    />
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        disabled={respond.isPending || (responseEditor === "partial" && !responseNote.trim())}
                        onClick={() => respond.mutate({ status: responseEditor, note: responseNote })}
                      >
                        Enregistrer ma réponse
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setResponseEditor(null); setResponseNote(""); }}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : null}

                {mine ? (
                  <p className="text-xs text-muted-foreground">
                    Réponse actuelle : <b>{responseLabel(mine.status)}</b>
                    {mine.reserve ? ` · Réserve : ${mine.reserve}` : ""}
                    {mine.reason ? ` · Motif : ${mine.reason}` : ""}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {conflicts.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conflits et alertes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {conflicts.map((c, i) => (
                  <p key={i} className="text-sm">
                    <Badge variant={c.severity === "high" ? "destructive" : "secondary"} className="mr-2">
                      {c.severity === "high" ? "Bloquant" : "Alerte"}
                    </Badge>
                    {c.message}
                  </p>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {linkedSolicitations.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sollicitations ponctuelles liées</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {linkedSolicitations.map((s) => {
                  const nature = solicitationNature(s);
                  const person = s.replacement_member_id
                    ? memberName(s.replacement_member_id)
                    : s.target_name ?? "Personne sollicitée non renseignée";
                  const answer = solicitationResponse(s.status, s.decision);
                  return (
                    <div key={s.id} className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <b className="text-icc-violet">{nature}</b>
                        <Badge variant={answer === "Refusé" ? "destructive" : answer === "En attente" ? "outline" : "secondary"}>
                          {answer}
                        </Badge>
                      </div>
                      <p className="mt-1"><b>Personne sollicitée :</b> {person}</p>
                      {s.event_name ? <p className="mt-1 text-muted-foreground">{s.event_name}</p> : null}
                      {s.decision_note ? <p className="mt-1"><b>Précision :</b> {s.decision_note}</p> : null}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="equipe" className="space-y-4">
          <Card className="icc-print-sheet">
            <CardHeader>
              <CardTitle className="text-base">
                Équipe du jour — {program.title} · {formatDate(program.start_date)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {program.assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun pôle affecté.</p>
              ) : (
                program.assignments.map((a) => (
                  <div key={a.id} className="rounded-lg border border-border p-3">
                    <p className="font-black text-icc-violet">{poleName.get(a.pole_id) ?? "Pôle"}</p>
                    {a.tasks ? <p className="mt-1 text-sm text-muted-foreground">{a.tasks}</p> : null}
                    <ul className="mt-2 space-y-1 text-sm">
                      {a.memberIds.length === 0 ? (
                        <li className="text-muted-foreground">Personne affectée.</li>
                      ) : (
                        a.memberIds.map((mid) => {
                          const r = responseOf(mid);
                          const att = programAttendance.find((x) => x.member_id === mid);
                          return (
                            <li key={mid} className="flex flex-wrap items-center gap-2">
                              <span>{memberName(mid)}</span>
                              <Badge variant="outline">{r ? responseLabel(r.status) : "Pas encore répondu"}</Badge>
                              {r?.reserve && isStaff ? (
                                <span className="text-xs text-muted-foreground">Réserve : {r.reserve}</span>
                              ) : null}
                              {r?.reason && isStaff ? (
                                <span className="text-xs text-muted-foreground">Motif : {r.reason}</span>
                              ) : null}
                              {att ? (
                                <Badge variant="secondary">
                                  {PRESENCE_LABEL[att.presence] ?? att.presence}
                                  {att.replaced_member_id
                                    ? ` — remplace ${memberName(att.replaced_member_id)}`
                                    : ""}
                                </Badge>
                              ) : null}
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </div>
                ))
              )}

              {programAttendance.filter((a) => a.is_reinforcement && !assignedIds.includes(a.member_id))
                .length > 0 ? (
                <div className="rounded-lg border border-dashed border-border p-3">
                  <p className="font-black text-icc-violet">Renforts</p>
                  <ul className="mt-1 space-y-1 text-sm">
                    {programAttendance
                      .filter((a) => a.is_reinforcement && !assignedIds.includes(a.member_id))
                      .map((a) => (
                        <li key={a.id}>{memberName(a.member_id)}</li>
                      ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documents et liens</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {programDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun document.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {programDocs.map((d) => (
                    <li key={d.id}>
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-icc-violet underline"
                      >
                        {d.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {isStaff ? (
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <Input
                    placeholder="Titre (brief, conducteur, affiche…)"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                  />
                  <Input
                    placeholder="https://…"
                    value={docUrl}
                    onChange={(e) => setDocUrl(e.target.value)}
                  />
                  <Button disabled={addDocument.isPending} onClick={() => addDocument.mutate()}>
                    {addDocument.isPending ? "Synchronisation…" : "Ajouter"}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes internes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {programNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune note.</p>
              ) : (
                programNotes.map((n) => (
                  <div key={n.id} className="rounded-lg bg-muted/60 p-3 text-sm">
                    <p className="whitespace-pre-wrap">{n.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {n.author_name ?? "—"} · {formatDateTime(n.created_at)} · visibilité {n.visibility}
                    </p>
                  </div>
                ))
              )}
              {isStaff ? (
                <div className="space-y-2">
                  <Textarea
                    rows={3}
                    placeholder="Note interne visible selon la portée choisie."
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                      value={noteVisibility}
                      onChange={(e) => setNoteVisibility(e.target.value)}
                    >
                      <option value="equipe">Toute l'équipe</option>
                      <option value="encadrement">Encadrement</option>
                      {isAdmin ? <option value="direction">Direction seulement</option> : null}
                    </select>
                    <Button disabled={addNote.isPending} onClick={() => addNote.mutate()}>
                      {addNote.isPending ? "Synchronisation…" : "Enregistrer la note"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histoire du programme</CardTitle>
            </CardHeader>
            <CardContent>
              {(timeline.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun événement enregistré.</p>
              ) : (
                <ol className="space-y-2 border-l border-border pl-4 text-sm">
                  {(timeline.data ?? []).map((e) => (
                    <li key={e.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-icc-violet" />
                      <b>{e.action}</b>
                      {e.detail ? ` — ${e.detail}` : ""}
                      <span className="block text-xs text-muted-foreground">
                        {e.actor_name ?? "Système"} · {formatDateTime(e.occurred_at)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="mt-6 text-xs text-muted-foreground">
        Besoin du compte rendu ?{" "}
        <Link to="/post-service" className="font-bold text-icc-violet">
          Ouvrir le post-service
        </Link>
      </p>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
