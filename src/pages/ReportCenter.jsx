import React, { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
  User,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import DatasetSelector from "../components/dashboard/DatasetSelector";
import { useLanguage } from "@/components/LanguageContext";
import { useTranslatedReportSections } from "@/components/dashboard/useTranslatedText";

const SECTION_GROUPS = [
  {
    id: "performance",
    label: "PERFORMANCE ANALYTICS",
    color: "text-blue-900",
    dot: "bg-blue-600",
    bar: "bg-blue-600",
    sections: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    id: "action",
    label: "ACTION & ROADMAP",
    color: "text-emerald-900",
    dot: "bg-emerald-600",
    bar: "bg-emerald-600",
    sections: [7, 8],
  },
  {
    id: "market",
    label: "MARKET INTELLIGENCE",
    color: "text-violet-900",
    dot: "bg-violet-600",
    bar: "bg-violet-600",
    sections: [11, 12, 13, 14],
  },
  {
    id: "methodology",
    label: "METHODOLOGY & SOURCES",
    color: "text-slate-600",
    dot: "bg-slate-500",
    bar: "bg-slate-400",
    sections: [9, 10, 15],
  },
];

function getGroupForSection(sectionId) {
  return SECTION_GROUPS.find((g) => g.sections.includes(sectionId)) || SECTION_GROUPS[0];
}

function normalizeFinding(finding) {
  if (!finding) return null;
  if (typeof finding === "string") return { type: "note", title: finding, trigger: "", action: "", owner: "", deadline: "", linkPage: "" };
  return {
    type: finding.type || "note",
    title: finding.title || finding.text || "Finding",
    trigger: finding.trigger || "",
    action: finding.action || "",
    owner: finding.owner || "",
    deadline: finding.deadline || "",
    linkPage: finding.linkPage || "",
  };
}

function chapterStatus(section) {
  if (!section) return "missing";
  if (section.research_flags?.partial) return "partial";
  return "ready";
}

function StatusBadge({ status, label }) {
  const map = {
    ready: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    partial: "bg-amber-100 text-amber-700 border border-amber-200",
    missing: "bg-slate-100 text-slate-500 border border-slate-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${map[status] || map.missing}`}>
      {status === "ready" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
      {status === "partial" && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
      {status === "missing" && <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />}
      {label}
    </span>
  );
}

function BottomLine({ section, conclusionLabel }) {
  if (!section?.conclusion) return null;
  const statusMap = {
    good: { bg: "bg-emerald-900", accent: "border-emerald-400", icon: CheckCircle2, iconColor: "text-emerald-400" },
    warning: { bg: "bg-amber-900", accent: "border-amber-400", icon: AlertTriangle, iconColor: "text-amber-400" },
    bad: { bg: "bg-red-900", accent: "border-red-400", icon: XCircle, iconColor: "text-red-400" },
    neutral: { bg: "bg-[#0A1628]", accent: "border-blue-400", icon: TrendingUp, iconColor: "text-blue-400" },
  };
  const style = statusMap[section.conclusion_status] || statusMap.neutral;
  const Icon = style.icon;
  return (
    <div className={`${style.bg} rounded-lg border-l-4 ${style.accent} p-5`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${style.iconColor}`} />
        <div>
          <p className={`mb-1.5 text-[10px] font-bold uppercase tracking-widest ${style.iconColor}`}>
            {conclusionLabel || "THE BOTTOM LINE"}
          </p>
          <p className="text-sm font-medium leading-relaxed text-white">{section.conclusion}</p>
        </div>
      </div>
    </div>
  );
}

function ExhibitGrid({ section, exhibitStart = 1 }) {
  if (!section?.summary_cards?.length) return null;
  const toneMap = {
    good: { border: "border-t-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", value: "text-emerald-700" },
    warning: { border: "border-t-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200", value: "text-amber-700" },
    bad: { border: "border-t-red-500", badge: "bg-red-50 text-red-700 border-red-200", value: "text-red-700" },
    neutral: { border: "border-t-slate-300", badge: "bg-slate-50 text-slate-600 border-slate-200", value: "text-slate-800" },
  };
  return (
    <div>
      <ExhibitLabel number={exhibitStart} title="Key Performance Metrics" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        {section.summary_cards.map((card, i) => {
          const tone = toneMap[card.tone] || toneMap.neutral;
          return (
            <div key={`card-${i}`} className={`rounded-lg border border-t-2 bg-white p-4 shadow-sm ${tone.border}`}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{card.label}</p>
              <p className={`mt-2 text-2xl font-bold tabular-nums leading-none ${tone.value}`}>{card.value}</p>
              {card.insight && <p className="mt-2 text-xs leading-relaxed text-slate-600">{card.insight}</p>}
              {card.citation_indices?.length > 0 && (
                <div className="mt-2 flex gap-1">
                  {card.citation_indices.slice(0, 3).map((id) => (
                    <span key={id} className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[10px] text-slate-400">[{id}]</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExhibitLabel({ number, title }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Exhibit {number}</span>
      <span className="h-px flex-1 bg-slate-200" />
      <span className="text-[11px] font-semibold text-slate-600">{title}</span>
    </div>
  );
}

function ConsultingTable({ table, section, exhibitNumber }) {
  if (!table || !table.columns?.length) return null;
  return (
    <div>
      <ExhibitLabel number={exhibitNumber} title={table.title || "Data Table"} />
      <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="bg-[#0A1628]">
                {table.columns.map((col, i) => (
                  <th key={i} className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-blue-100">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(table.rows || []).map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                  {(row || []).map((cell, ci) => (
                    <td key={ci} className={`px-4 py-2.5 align-top text-slate-700 ${ci === 0 ? "font-semibold text-slate-900" : ""}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
              {(!table.rows || table.rows.length === 0) && (
                <tr>
                  <td colSpan={table.columns.length} className="px-4 py-6 text-center text-xs text-slate-400">
                    No data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {table.note && (
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2">
            <p className="text-[10px] italic text-slate-400">Source note: {table.note}</p>
          </div>
        )}
        <CitationChips section={section} citationIds={table.citation_indices} />
      </div>
    </div>
  );
}

function StrategyBlock({ block, section }) {
  if (!block) return null;
  const typeMap = {
    callout: {
      wrapper: "border-l-4 border-blue-600 bg-blue-50/70 pl-5",
      title: "text-blue-900 font-bold",
      body: "text-blue-800",
    },
    competitor_card: {
      wrapper: "rounded-lg border border-slate-200 bg-white shadow-sm",
      title: "text-slate-900 font-semibold",
      body: "text-slate-700",
    },
    keyword_cluster: {
      wrapper: "rounded-lg border border-violet-200 bg-violet-50/60",
      title: "text-violet-900 font-semibold",
      body: "text-violet-800",
    },
  };
  const style = typeMap[block.type] || { wrapper: "rounded-lg border border-slate-200 bg-white shadow-sm", title: "text-slate-900 font-semibold", body: "text-slate-700" };
  return (
    <div className={`p-4 ${style.wrapper}`}>
      {block.title && <p className={`text-sm ${style.title}`}>{block.title}</p>}
      {block.body && <p className={`mt-1.5 text-sm leading-relaxed ${style.body}`}>{block.body}</p>}
      {block.meta && <p className="mt-1 text-xs text-slate-500 italic">{block.meta}</p>}
      {Array.isArray(block.items) && block.items.length > 0 && (
        <div className="mt-3">
          {block.type === "numbered_list" ? (
            <ol className="space-y-1.5">
              {block.items.map((item, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-slate-700">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#0A1628] text-[10px] font-bold text-white">{i + 1}</span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ol>
          ) : (
            <ul className="space-y-1.5">
              {block.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-600" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {block.citation_indices?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {block.citation_indices.slice(0, 4).map((id) => (
            <span key={id} className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-400">[{id}]</span>
          ))}
        </div>
      )}
    </div>
  );
}

function FindingStack({ section, findings, labels, t }) {
  if (!findings?.length) return null;
  const typeConfig = {
    risk: {
      wrapper: "border-l-4 border-red-500 bg-red-50/50",
      badge: "bg-red-100 text-red-700",
      title: "text-red-900",
      body: "text-red-800",
      icon: AlertTriangle,
      iconColor: "text-red-500",
    },
    opportunity: {
      wrapper: "border-l-4 border-blue-500 bg-blue-50/50",
      badge: "bg-blue-100 text-blue-700",
      title: "text-blue-900",
      body: "text-blue-800",
      icon: TrendingUp,
      iconColor: "text-blue-500",
    },
    note: {
      wrapper: "border-l-4 border-slate-300 bg-slate-50/50",
      badge: "bg-slate-100 text-slate-600",
      title: "text-slate-900",
      body: "text-slate-700",
      icon: FileText,
      iconColor: "text-slate-400",
    },
  };
  return (
    <div className="space-y-3">
      {findings.map((raw, i) => {
        const f = normalizeFinding(raw);
        if (!f) return null;
        const cfg = typeConfig[f.type] || typeConfig.note;
        const Icon = cfg.icon;
        return (
          <div key={i} className={`rounded-lg p-4 pl-5 ${cfg.wrapper}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${cfg.iconColor}`} />
                <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${cfg.badge}`}>
                  {f.type === "risk" ? (labels?.risk || "Risk") : f.type === "opportunity" ? (labels?.opportunity || "Opportunity") : (labels?.note || "Note")}
                </span>
                {f.linkPage && (
                  <span className="text-[10px] text-slate-400">→ {f.linkPage}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {f.owner && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600">
                    <User className="h-2.5 w-2.5" /> {f.owner}
                  </span>
                )}
                {f.deadline && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600">
                    <Clock className="h-2.5 w-2.5" /> {f.deadline}
                  </span>
                )}
              </div>
            </div>
            <h4 className={`mt-2.5 text-sm font-semibold leading-snug ${cfg.title}`}>{f.title}</h4>
            {f.trigger && (
              <p className={`mt-1.5 text-xs leading-relaxed ${cfg.body}`}>
                <span className="font-semibold">Observation:</span> {f.trigger}
              </p>
            )}
            {f.action && (
              <p className={`mt-1 text-xs leading-relaxed ${cfg.body}`}>
                <span className="font-semibold">Recommended Action:</span> {f.action}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CitationChips({ section, citationIds = [] }) {
  if (!section?.citations?.length || !citationIds?.length) return null;
  const lookup = new Map((section.citations || []).map((c) => [c.id, c]));
  const found = (citationIds || []).map((id) => lookup.get(id)).filter(Boolean);
  if (!found.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-4 pb-3">
      {found.map((c) => (
        <a key={c.id} href={c.url} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500 hover:border-blue-300 hover:text-blue-600">
          [{c.id}] <span className="max-w-[180px] truncate">{c.title}</span>
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      ))}
    </div>
  );
}

function SourcesPanel({ section }) {
  if (!section?.citations?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Research Sources</p>
      </div>
      <div className="divide-y divide-slate-100">
        {section.citations.map((c) => (
          <a key={c.id} href={c.url} target="_blank" rel="noreferrer"
            className="flex items-start justify-between gap-3 px-4 py-3 transition hover:bg-white">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-800">[{c.id}] {c.title}</p>
              {c.note && <p className="mt-0.5 text-[10px] text-slate-400 italic">{c.note}</p>}
              <p className="mt-0.5 truncate text-[10px] text-blue-500">{c.url}</p>
            </div>
            <ExternalLink className="mt-0.5 h-3 w-3 flex-shrink-0 text-slate-400" />
          </a>
        ))}
      </div>
    </div>
  );
}

function MarkdownBody({ content }) {
  if (!content) return null;
  return (
    <div className="prose prose-sm max-w-none">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="mb-3 mt-6 border-b-2 border-[#0A1628] pb-2 font-['Georgia',serif] text-xl font-bold text-[#0A1628]">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-widest text-blue-700">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-4 border-l-2 border-[#0A1628] pl-3 text-sm font-bold text-slate-800">{children}</h3>
          ),
          p: ({ children }) => <p className="mb-3 text-sm leading-[1.75] text-slate-700">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 space-y-1.5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 space-y-1.5 list-decimal list-inside">{children}</ol>,
          li: ({ children }) => (
            <li className="flex items-start gap-2.5 text-sm text-slate-700">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#0A1628]" />
              <span className="leading-relaxed">{children}</span>
            </li>
          ),
          strong: ({ children }) => <strong className="font-bold text-slate-900">{children}</strong>,
          em: ({ children }) => <em className="italic text-slate-600">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-4 border-[#0A1628] bg-blue-50/60 pl-4 py-2 italic text-slate-700">{children}</blockquote>
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-hidden rounded-lg border border-slate-200">
              <table className="min-w-full text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-[#0A1628] text-white">{children}</thead>,
          th: ({ children }) => <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider">{children}</th>,
          td: ({ children }) => <td className="border-t border-slate-100 px-3 py-2 text-slate-700">{children}</td>,
          tr: ({ children }) => <tr className="even:bg-slate-50">{children}</tr>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function ReportCenter() {
  const [selectedChapter, setSelectedChapter] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [datasetId, setDatasetId] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const { t, language } = useLanguage();
  const rc = t("reportCenter");
  const queryClient = useQueryClient();
  const isEn = language === "en";

  const { data: sections = [], isLoading, refetch } = useQuery({
    queryKey: ["report-sections", datasetId],
    queryFn: () => (datasetId ? base44.entities.ReportSection.filter({ dataset_id: datasetId }) : []),
    enabled: !!datasetId,
  });

  const { data: dataset } = useQuery({
    queryKey: ["report-dataset", datasetId],
    queryFn: () => (datasetId ? base44.entities.DataUpload.get(datasetId) : null),
    enabled: !!datasetId,
  });

  const translatedSections = useTranslatedReportSections(sections);
  const currentSection = translatedSections.find((s) => s.section_id === selectedChapter);

  const chapters = useMemo(() => {
    const configured = Array.isArray(rc.chapters) ? rc.chapters : [];
    const maxId = Math.max(configured.length - 1, ...translatedSections.map((s) => s.section_id));
    return Array.from({ length: maxId + 1 }, (_, i) => {
      const cfg = configured[i];
      const live = translatedSections.find((s) => s.section_id === i);
      return {
        id: i,
        title: live?.title || cfg?.title || `Chapter ${i}`,
        description: cfg?.desc || live?.conclusion || "",
        status: chapterStatus(live),
      };
    });
  }, [rc.chapters, translatedSections]);

  const readyCount = chapters.filter((c) => c.status === "ready").length;
  const partialCount = chapters.filter((c) => c.status === "partial").length;
  const totalCount = chapters.length;

  const handleGenerate = async () => {
    if (!datasetId) { toast.error(rc.toasts?.selectDataset || "Please select a dataset"); return; }
    setGenerating(true);
    try {
      await base44.functions.invoke("aiGenerateSections", { dataset_id: datasetId, language });
      toast.success(rc.toasts?.generateSuccess || "Report generated");
      queryClient.invalidateQueries({ queryKey: ["report-sections", datasetId] });
      queryClient.invalidateQueries({ queryKey: ["report-dataset", datasetId] });
    } catch (error) {
      toast.error(`${rc.toasts?.generateFail || "Generation failed"}: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const downloadPDF = useCallback(async () => {
    if (!datasetId) { toast.error(rc.toasts?.selectDataset || "Please select a dataset"); return; }
    setDownloading("PDF");
    try {
      const response = await base44.functions.invoke("generateReport", { dataset_id: datasetId, format: "pdf" });
      const { pdf_base64, filename } = response.data;
      if (!pdf_base64) throw new Error("No PDF data returned");
      const byteChars = atob(pdf_base64);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = filename || "Affiliate-Report.pdf";
      document.body.appendChild(link); link.click();
      URL.revokeObjectURL(url); link.remove();
      toast.success(rc.toasts?.downloadSuccess || "Downloaded");
    } catch (error) {
      toast.error(`${rc.toasts?.downloadFail || "Download failed"}: ${error.message}`);
    } finally { setDownloading(null); }
  }, [datasetId, rc.toasts]);

  const downloadMarkdown = useCallback(async () => {
    if (!datasetId) { toast.error(rc.toasts?.selectDataset || "Please select a dataset"); return; }
    setDownloading("MD");
    try {
      const response = await base44.functions.invoke("generateReport", { dataset_id: datasetId, format: "markdown" });
      const text = typeof response.data === "string" ? response.data : JSON.stringify(response.data, null, 2);
      const blob = new Blob([text], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = "Affiliate-Report.md";
      document.body.appendChild(link); link.click();
      URL.revokeObjectURL(url); link.remove();
      toast.success(rc.toasts?.downloadSuccess || "Downloaded");
    } catch (error) {
      toast.error(`${rc.toasts?.downloadFail || "Download failed"}: ${error.message}`);
    } finally { setDownloading(null); }
  }, [datasetId, rc.toasts]);

  const currentGroup = getGroupForSection(selectedChapter);

  return (
    <div className="mx-auto max-w-[1480px] space-y-5">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#0A1628]" />
            <h1 className="font-['Georgia',serif] text-xl font-bold tracking-tight text-[#0A1628]">
              {rc.title || (isEn ? "Report Center" : "报告中心")}
            </h1>
            {dataset?.version_label && (
              <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {dataset.version_label}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {rc.subtitle || (isEn ? "Research-enhanced affiliate analysis · Confidential" : "研究增强型联盟分析 · 机密")}
          </p>
          {dataset?.updated_date && (
            <p className="mt-1 text-[10px] text-slate-400">
              {isEn ? "Generated" : "生成时间"}: {new Date(dataset.updated_date).toLocaleString()}
              {" · "}
              <span className={readyCount === totalCount ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
                {readyCount}/{totalCount} {isEn ? "chapters ready" : "章节已就绪"}
              </span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DatasetSelector value={datasetId} onChange={setDatasetId} />
          <button
            onClick={() => refetch()}
            disabled={!datasetId}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw className="h-3 w-3" />
            {isEn ? "Refresh" : "刷新"}
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || !datasetId}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#0A1628] px-4 text-xs font-semibold text-white transition hover:bg-[#1a2d4f] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {generating ? (rc.generating || (isEn ? "Generating…" : "生成中…")) : (rc.generateFull || (isEn ? "Generate Full Report" : "生成完整报告"))}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
        <div className="h-fit space-y-0 rounded-xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-6">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {isEn ? "Report Contents" : "报告目录"}
            </p>
          </div>

          <div className="space-y-0 p-2">
            {SECTION_GROUPS.map((group) => (
              <div key={group.id} className="mb-1">
                <div className="mb-0.5 flex items-center gap-2 px-2 py-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${group.dot}`} />
                  <p className={`text-[9px] font-bold uppercase tracking-widest ${group.color}`}>{group.label}</p>
                </div>
                {group.sections.map((sectionId) => {
                  const chapter = chapters[sectionId];
                  if (!chapter) return null;
                  const hasContent = translatedSections.some((s) => s.section_id === sectionId);
                  const isActive = selectedChapter === sectionId;
                  return (
                    <button
                      key={sectionId}
                      onClick={() => setSelectedChapter(sectionId)}
                      className={`w-full rounded-lg px-3 py-2 text-left transition-all ${
                        isActive
                          ? `bg-[#0A1628] text-white`
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold tabular-nums ${isActive ? "text-blue-200" : "text-slate-400"}`}>
                          {String(sectionId).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{chapter.title}</span>
                        {hasContent ? (
                          <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${isActive ? "bg-blue-300" : "bg-emerald-500"}`} />
                        ) : (
                          <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${isActive ? "bg-slate-500" : "bg-slate-200"}`} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 px-4 py-3">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[10px] text-slate-400">{isEn ? "Report completion" : "报告完整度"}</p>
              <p className="text-[10px] font-semibold text-slate-600">{readyCount + partialCount}/{totalCount}</p>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#0A1628] transition-all duration-500"
                style={{ width: `${Math.round(((readyCount + partialCount) / Math.max(totalCount, 1)) * 100)}%` }}
              />
            </div>
          </div>

          <div className="border-t border-slate-100 p-3 space-y-1.5">
            <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{isEn ? "Export" : "导出"}</p>
            <button
              onClick={downloadPDF}
              disabled={downloading === "PDF" || !datasetId}
              className="flex w-full items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-left transition hover:border-[#0A1628] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {downloading === "PDF" ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" /> : <Download className="h-3.5 w-3.5 text-[#0A1628]" />}
              <div>
                <p className="text-xs font-semibold text-slate-800">{rc.downloads?.pdf || "Download PDF"}</p>
                <p className="text-[10px] text-slate-400">Board-ready format</p>
              </div>
            </button>
            <button
              onClick={downloadMarkdown}
              disabled={downloading === "MD" || !datasetId}
              className="flex w-full items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {downloading === "MD" ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" /> : <Download className="h-3.5 w-3.5 text-slate-400" />}
              <div>
                <p className="text-xs font-medium text-slate-700">{rc.downloads?.markdown || "Download Markdown"}</p>
                <p className="text-[10px] text-slate-400">Editable text format</p>
              </div>
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={selectedChapter}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-100">
              <div className={`h-1 w-full ${currentGroup.bar}`} />
              <div className="px-8 py-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${currentGroup.color}`}>
                    {currentGroup.label}
                  </span>
                  <span className="text-[10px] text-slate-300">·</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Chapter {String(selectedChapter).padStart(2, "0")}
                  </span>
                  <span className="text-[10px] text-slate-300">·</span>
                  <StatusBadge
                    status={chapters[selectedChapter]?.status || "missing"}
                    label={chapters[selectedChapter]?.status === "ready" ? (isEn ? "Complete" : "完整") : chapters[selectedChapter]?.status === "partial" ? (isEn ? "Partial" : "部分") : (isEn ? "Missing" : "缺数据")}
                  />
                  {currentSection?.research_flags?.cache_hit && (
                    <StatusBadge status="partial" label={isEn ? "Cached Research" : "缓存研究"} />
                  )}
                </div>
                <h2 className="font-['Georgia',serif] text-2xl font-bold text-[#0A1628]">
                  {chapters[selectedChapter]?.title || `Chapter ${selectedChapter}`}
                </h2>
                {chapters[selectedChapter]?.description && (
                  <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{chapters[selectedChapter].description}</p>
                )}
              </div>
            </div>

            <div className="p-8">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="mb-3 h-7 w-7 animate-spin text-[#0A1628]" />
                  <p className="text-sm text-slate-400">{isEn ? "Loading report data…" : "加载中…"}</p>
                </div>
              ) : currentSection ? (
                <div className="space-y-7">
                  <BottomLine section={currentSection} conclusionLabel={isEn ? "THE BOTTOM LINE" : "核心结论"} />

                  {currentSection.summary_cards?.length > 0 && (
                    <ExhibitGrid section={currentSection} exhibitStart={1} />
                  )}

                  {currentSection.content_md && (
                    <div>
                      <ExhibitLabel number={currentSection.summary_cards?.length > 0 ? 2 : 1} title={isEn ? "Analysis" : "深度分析"} />
                      <MarkdownBody content={currentSection.content_md} />
                    </div>
                  )}

                  {currentSection.content_blocks?.length > 0 && (
                    <div>
                      <ExhibitLabel
                        number={(currentSection.summary_cards?.length > 0 ? 2 : 1) + (currentSection.content_md ? 1 : 0)}
                        title={isEn ? "Strategic Context" : "战略背景"}
                      />
                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        {currentSection.content_blocks.map((block, i) => (
                          <StrategyBlock key={i} block={block} section={currentSection} />
                        ))}
                      </div>
                    </div>
                  )}

                  {currentSection.tables?.length > 0 && (
                    <div className="space-y-5">
                      {currentSection.tables.map((table, i) => {
                        const base = (currentSection.summary_cards?.length > 0 ? 2 : 1) + (currentSection.content_md ? 1 : 0) + (currentSection.content_blocks?.length > 0 ? 1 : 0);
                        return <ConsultingTable key={i} table={table} section={currentSection} exhibitNumber={base + i} />;
                      })}
                    </div>
                  )}

                  {currentSection.key_findings?.length > 0 && (
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          {isEn ? "Key Findings & Implications" : "关键发现与影响"}
                        </span>
                        <span className="h-px flex-1 bg-slate-200" />
                        <span className="text-[10px] font-semibold text-slate-400">
                          {currentSection.key_findings.length} {isEn ? "findings" : "条"}
                        </span>
                      </div>
                      <FindingStack
                        section={currentSection}
                        findings={currentSection.key_findings}
                        labels={{ risk: isEn ? "Risk" : "风险", opportunity: isEn ? "Opportunity" : "机会", note: isEn ? "Note" : "备注" }}
                        t={t}
                      />
                    </div>
                  )}

                  <SourcesPanel section={currentSection} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200">
                    <FileText className="h-7 w-7 text-slate-300" />
                  </div>
                  <p className="mb-1 text-sm font-semibold text-slate-700">
                    {isEn ? "Chapter not yet generated" : "章节尚未生成"}
                  </p>
                  <p className="mb-6 max-w-xs text-center text-xs text-slate-400">
                    {isEn
                      ? "Generate the full report to populate this chapter with AI-powered analysis."
                      : "生成完整报告以使用 AI 分析填充此章节。"}
                  </p>
                  <button
                    onClick={handleGenerate}
                    disabled={generating || !datasetId}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0A1628] px-5 text-xs font-semibold text-white transition hover:bg-[#1a2d4f] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {generating ? (rc.generating || (isEn ? "Generating…" : "生成中…")) : (rc.generateFull || (isEn ? "Generate Full Report" : "生成完整报告"))}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
