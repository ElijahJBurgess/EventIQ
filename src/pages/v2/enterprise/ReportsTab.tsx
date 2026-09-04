import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { EventStats } from "@/lib/enterpriseOverview";
import {
  REPORT_SECTIONS,
  REPORT_TYPES,
  reportDisplayTitle,
  reportSectionLabels,
  reportTypeMeta,
  type ReportRow,
  type ReportSectionKey,
} from "@/lib/enterpriseReports";

const STEP_NAMES = ["Scope", "Report type", "Sections"] as const;

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function TypeTag({ typeKey }: { typeKey: string | undefined }) {
  const meta = reportTypeMeta(typeKey);
  return (
    <span
      className="border border-black/10 px-2 py-0.5 font-display text-[9px] font-bold tracking-widest"
      style={{ backgroundColor: meta.color, color: "#000" }}
    >
      {meta.tag}
    </span>
  );
}

export default function ReportsTab({ event, accessHash }: { event: EventStats; accessHash: string }) {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<ReportRow | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [reportType, setReportType] = useState("executive_impact");
  const [title, setTitle] = useState("");
  const [sections, setSections] = useState<Set<ReportSectionKey>>(new Set(["executive_summary"]));
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdReport, setCreatedReport] = useState<ReportRow | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.functions.invoke("admin-auth", {
      body: { passwordHash: accessHash, action: "list-reports", eventId: event.id },
    });
    setLoading(false);
    const payload = data as { valid?: boolean; reports?: ReportRow[] } | null;
    if (error || !payload?.valid) {
      setLoadError("Couldn't load reports. Try again.");
      return;
    }
    setReports(payload.reports ?? []);
  }, [accessHash, event.id]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const openWizard = () => {
    setReportType("executive_impact");
    setTitle("");
    setSections(new Set(["executive_summary"]));
    setStep(1);
    setCreateError(null);
    setCreatedReport(null);
    setWizardOpen(true);
  };

  const toggleSection = (key: ReportSectionKey) => {
    setSections((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      next.add("executive_summary"); // always included
      return next;
    });
  };

  const createReport = async () => {
    if (creating) return;
    setCreating(true);
    setCreateError(null);
    const { data, error } = await supabase.functions.invoke("admin-auth", {
      body: {
        passwordHash: accessHash,
        action: "create-report",
        eventId: event.id,
        reportType,
        title: title.trim(),
        sections: [...sections],
      },
    });
    setCreating(false);
    const payload = data as { valid?: boolean; report?: ReportRow; error?: string } | null;
    if (error || !payload?.valid || payload.error || !payload.report) {
      setCreateError("Couldn't create the report. Try again.");
      return;
    }
    setCreatedReport(payload.report);
    setStep(4);
  };

  const closeWizard = () => {
    setWizardOpen(false);
    loadReports();
  };

  const progressPct = step >= 4 ? 100 : Math.round((step / 3) * 100);

  const typeMeta = useMemo(() => reportTypeMeta(reportType), [reportType]);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 font-display text-2xl font-black tracking-tight">REPORTS</div>
          <p className="font-offrip-body text-sm normal-case tracking-normal text-black/40">
            Shareable recaps built from this event's data.
          </p>
        </div>
        <button
          type="button"
          onClick={openWizard}
          className="shrink-0 bg-black px-4 py-2.5 font-display text-[11px] font-black tracking-widest text-white transition-colors hover:bg-black/80"
        >
          BUILD A REPORT
        </button>
      </div>

      {viewing ? (
        <div className="border border-black p-6">
          <button
            type="button"
            onClick={() => setViewing(null)}
            className="mb-4 font-display text-[10px] font-bold tracking-widest text-black/40 hover:text-black"
          >
            ← Back to reports
          </button>
          <div className="mb-2 flex items-center gap-3">
            <h3 className="font-display text-xl font-black tracking-tight">{reportDisplayTitle(viewing)}</h3>
            <TypeTag typeKey={viewing.raw_metrics?.meta?.reportType} />
          </div>
          <p className="mb-4 font-offrip-body text-xs normal-case tracking-normal text-black/40">
            Generated {formatDate(viewing.generated_at)} · Sections: {reportSectionLabels(viewing).join(", ") || "—"}
          </p>
          {viewing.executive_summary && (
            <p className="font-offrip-body text-sm normal-case leading-relaxed tracking-normal text-black/80">
              {viewing.executive_summary}
            </p>
          )}
          {viewing.insights && viewing.insights.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="font-display text-[10px] font-bold tracking-widest text-black/40">AI INSIGHTS</div>
              {viewing.insights.map((insight, index) => (
                <p
                  key={index}
                  className="border-l-4 border-[#69C0BE] bg-[#F1F1F1] py-2 pl-4 font-offrip-body text-sm normal-case leading-relaxed tracking-normal text-black/80"
                >
                  {insight}
                </p>
              ))}
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 font-offrip-body text-sm normal-case tracking-normal text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading reports…
        </div>
      ) : loadError ? (
        <p className="font-offrip-body text-xs normal-case tracking-normal text-destructive">{loadError}</p>
      ) : reports.length === 0 ? (
        <p className="font-offrip-body text-sm normal-case tracking-normal text-black/40">
          No reports yet. Build one to get started.
        </p>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <button
              key={report.id}
              type="button"
              onClick={() => setViewing(report)}
              className="flex w-full items-center justify-between gap-4 border border-black/10 p-4 text-left normal-case tracking-normal transition-shadow hover:shadow-[2px_2px_0_#000]"
            >
              <span>
                <span className="block font-display text-sm font-black tracking-tight">
                  {reportDisplayTitle(report)}
                </span>
                <span className="mt-0.5 block font-offrip-body text-xs text-black/40">
                  {formatDate(report.generated_at)} · {reportSectionLabels(report).join(", ") || "—"}
                </span>
              </span>
              <TypeTag typeKey={report.raw_metrics?.meta?.reportType} />
            </button>
          ))}
        </div>
      )}

      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg border border-black bg-white p-6">
            <div className="mb-1 h-1 w-full bg-black/10">
              <div className="h-full bg-black transition-all" style={{ width: `${progressPct}%` }} />
            </div>

            {step <= 3 ? (
              <>
                <div className="mb-4 mt-3 font-display text-sm font-black tracking-tight">
                  Step {step} of 3 — {STEP_NAMES[step - 1]}
                </div>

                {step === 1 && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      aria-pressed="true"
                      className="w-full border border-black bg-black/5 p-4 text-left normal-case tracking-normal"
                    >
                      <span className="block font-display text-sm font-black">{event.name}</span>
                      <span className="mt-0.5 block font-offrip-body text-xs text-black/40">
                        {event.totalCheckedIn} of {event.totalRegistrations} checked in
                      </span>
                    </button>
                    <p className="font-offrip-body text-[11px] normal-case tracking-normal text-black/30">
                      Multi-event support isn't available yet.
                    </p>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-2">
                    {REPORT_TYPES.map((type) => (
                      <button
                        key={type.key}
                        type="button"
                        disabled={!type.available}
                        onClick={() => setReportType(type.key)}
                        className={`w-full border p-4 text-left normal-case tracking-normal transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          reportType === type.key ? "border-black bg-black/5" : "border-black/10"
                        }`}
                      >
                        <span className="block font-display text-sm font-black">{type.label}</span>
                        {!type.available && type.note && (
                          <span className="mt-0.5 block font-offrip-body text-[11px] text-black/40">{type.note}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    <label className="block font-display text-[10px] font-bold tracking-widest text-black/50">
                      Title
                      <input
                        value={title}
                        onChange={(nativeEvent) => setTitle(nativeEvent.target.value)}
                        placeholder={`${event.name} — Executive Impact`}
                        className="mt-1 w-full border border-black bg-white px-3 py-2 font-offrip-body text-sm normal-case tracking-normal outline-none"
                      />
                    </label>
                    <div className="space-y-2">
                      {REPORT_SECTIONS.map((section) => (
                        <label
                          key={section.key}
                          className="flex items-center gap-2 font-offrip-body text-sm normal-case tracking-normal"
                        >
                          <input
                            type="checkbox"
                            checked={section.locked || sections.has(section.key)}
                            disabled={section.locked}
                            onChange={() => toggleSection(section.key)}
                          />
                          {section.label}
                          {section.locked && <span className="text-[11px] text-black/30">(always included)</span>}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {createError && (
                  <p className="mt-3 font-offrip-body text-xs normal-case tracking-normal text-destructive">
                    {createError}
                  </p>
                )}

                <div className="mt-6 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => (step === 1 ? setWizardOpen(false) : setStep(step - 1))}
                    className="font-display text-[10px] font-bold tracking-widest text-black/40 hover:text-black"
                  >
                    {step === 1 ? "Cancel" : "Back"}
                  </button>
                  {step < 3 ? (
                    <button
                      type="button"
                      disabled={step === 2 && !typeMeta.available}
                      onClick={() => setStep(step + 1)}
                      className="bg-black px-4 py-2 font-display text-[11px] font-black tracking-widest text-white disabled:opacity-40"
                    >
                      NEXT →
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={createReport}
                      disabled={creating}
                      className="bg-[#69C0BE] px-4 py-2 font-display text-[11px] font-black tracking-widest text-black disabled:opacity-60"
                    >
                      {creating ? "…" : "CREATE REPORT"}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="mt-3 text-center">
                <div className="font-display text-xl font-black tracking-tight">REPORT CREATED</div>
                <p className="mx-auto mt-2 max-w-sm font-offrip-body text-sm normal-case leading-relaxed tracking-normal text-black/60">
                  {createdReport ? reportDisplayTitle(createdReport) : "Your report"} is ready and saved to this event.
                </p>
                <button
                  type="button"
                  onClick={closeWizard}
                  className="mt-6 bg-black px-5 py-2.5 font-display text-[11px] font-black tracking-widest text-white"
                >
                  DONE
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
