import React, { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import {
  AlertTriangle,
  CheckCircle,
  Download,
  Eye,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import DatasetSelector from "../components/dashboard/DatasetSelector";
import { useLanguage } from "@/components/LanguageContext";
import { useTranslatedReportSections } from "@/components/dashboard/useTranslatedText";

function normalizeFinding(finding) {
  if (!finding) return null;
  if (typeof finding === "string") {
    return {
      type: "note",
      title: finding,
      trigger: "",
      action: "",
      owner: "",
      deadline: "",
      linkPage: "",
    };
  }
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

function findCitations(section, citationIds = []) {
  const lookup = new Map((section?.citations || []).map((citation) => [citation.id, citation]));
  return (citationIds || []).map((id) => lookup.get(id)).filter(Boolean);
}

function CitationChips({ section, citationIds = [] }) {
  const citations = findCitations(section, citationIds);
  if (!citations.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {citations.map((citation) => (
        <a
          key={`${citation.id}-${citation.url}`}
          href={citation.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 hover:border-blue-300 hover:text-blue-700"
        >
          <span>[{citation.id}]</span>
          <span className="max-w-[220px] truncate">{citation.title}</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      ))}
    </div>
  );
}

function SummaryCardGrid({ section }) {
  if (!section?.summary_cards?.length) return null;

  const toneStyles = {
    good: "border-emerald-200 bg-emerald-50 text-emerald-800",
    neutral: "border-slate-200 bg-slate-50 text-slate-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    bad: "border-red-200 bg-red-50 text-red-800",
  };

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {section.summary_cards.map((card, index) => {
        const tone = toneStyles[card.tone] || toneStyles.neutral;
        return (
          <div key={`${card.label}-${index}`} className={`rounded-2xl border p-4 ${tone}`}>
            <p className="text-[11px] font-bold uppercase tracking-wider opacity-75">{card.label}</p>
            <p className="mt-2 text-xl font-bold">{card.value}</p>
            {card.insight && <p className="mt-2 text-sm leading-relaxed">{card.insight}</p>}
            <CitationChips section={section} citationIds={card.citation_indices} />
          </div>
        );
      })}
    </div>
  );
}

function StructuredTable({ table, section }) {
  if (!table) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">{table.title || "Table"}</p>
        {table.note && <p className="mt-1 text-xs text-slate-500">{table.note}</p>}
        <CitationChips section={section} citationIds={table.citation_indices} />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-900 text-white">
            <tr>
              {(table.columns || []).map((column, index) => (
                <th key={`${column}-${index}`} className="px-3 py-2 font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(table.rows || []).map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`} className="border-t border-slate-100">
                {(row || []).map((cell, cellIndex) => (
                  <td key={`cell-${rowIndex}-${cellIndex}`} className="px-3 py-2 align-top text-slate-700">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ContentBlock({ block, section }) {
  if (!block) return null;

  const wrapper =
    block.type === "callout"
      ? "border-blue-200 bg-blue-50"
      : block.type === "competitor_card"
        ? "border-slate-200 bg-slate-50"
        : block.type === "keyword_cluster"
          ? "border-violet-200 bg-violet-50"
          : "border-slate-200 bg-white";

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${wrapper}`}>
      {block.title && <p className="text-sm font-semibold text-slate-900">{block.title}</p>}
      {block.body && <p className="mt-2 text-sm leading-relaxed text-slate-700">{block.body}</p>}
      {block.meta && <p className="mt-2 text-xs text-slate-500">{block.meta}</p>}
      {Array.isArray(block.items) && block.items.length > 0 && (
        <div className="mt-3">
          {block.type === "numbered_list" ? (
            <ol className="space-y-2 text-sm text-slate-700">
              {block.items.map((item, index) => (
                <li key={`${item}-${index}`} className="flex gap-2">
                  <span className="font-semibold text-slate-900">{index + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          ) : (
            <ul className="space-y-2 text-sm text-slate-700">
              {block.items.map((item, index) => (
                <li key={`${item}-${index}`} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <CitationChips section={section} citationIds={block.citation_indices} />
    </div>
  );
}

function SourcesPanel({ section, title }) {
  if (!section?.citations?.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
      <div className="mb-3 flex items-center gap-2">
        <ExternalLink className="h-4 w-4 text-slate-600" />
        <p className="text-xs font-bold uppercase tracking-wider text-slate-700">{title}</p>
      </div>
      <div className="grid gap-2">
        {section.citations.map((citation) => (
          <a
            key={`${citation.id}-${citation.url}`}
            href={citation.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">[{citation.id}] {citation.title}</p>
                {citation.note && <p className="mt-1 text-xs text-slate-500">{citation.note}</p>}
              </div>
              <ExternalLink className="mt-0.5 h-4 w-4 flex-shrink-0" />
            </div>
          </a>
        ))}
      </div>
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

  const statusStyles = {
    ready: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: rc.status.ready },
    partial: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: rc.status.partial },
    missing: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: rc.status.missing },
  };

  const conclusionStyles = {
    good: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800", icon: CheckCircle },
    neutral: { bg: "bg-slate-50 border-slate-200", text: "text-slate-700", icon: Eye },
    warning: { bg: "bg-amber-50 border-amber-200", text: "text-amber-800", icon: AlertTriangle },
    bad: { bg: "bg-red-50 border-red-200", text: "text-red-800", icon: AlertTriangle },
  };

  const findingStyles = {
    risk: {
      card: "bg-red-50 border-red-200",
      badge: "bg-red-100 text-red-700 border-red-200",
      title: "text-red-900",
      body: "text-red-800",
    },
    opportunity: {
      card: "bg-blue-50 border-blue-200",
      badge: "bg-blue-100 text-blue-700 border-blue-200",
      title: "text-blue-900",
      body: "text-blue-800",
    },
    note: {
      card: "bg-slate-50 border-slate-200",
      badge: "bg-slate-100 text-slate-700 border-slate-200",
      title: "text-slate-900",
      body: "text-slate-700",
    },
  };

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
  const currentSection = translatedSections.find((section) => section.section_id === selectedChapter);

  const chapters = useMemo(() => {
    const configured = Array.isArray(rc.chapters) ? rc.chapters : [];
    const maxId = Math.max(configured.length - 1, ...translatedSections.map((section) => section.section_id));
    return Array.from({ length: maxId + 1 }, (_, index) => {
      const configuredChapter = configured[index];
      const liveSection = translatedSections.find((section) => section.section_id === index);
      return {
        id: index,
        title: liveSection?.title || configuredChapter?.title || `${rc.chapterLabel || "Chapter"} ${index}`,
        description: configuredChapter?.desc || liveSection?.conclusion || "",
        status: chapterStatus(liveSection),
      };
    });
  }, [rc.chapters, rc.chapterLabel, translatedSections]);

  const handleGenerate = async () => {
    if (!datasetId) {
      toast.error(rc.toasts.selectDataset);
      return;
    }
    setGenerating(true);
    try {
      await base44.functions.invoke("aiGenerateSections", { dataset_id: datasetId });
      toast.success(rc.toasts.generateSuccess);
      queryClient.invalidateQueries({ queryKey: ["report-sections", datasetId] });
      queryClient.invalidateQueries({ queryKey: ["report-dataset", datasetId] });
    } catch (error) {
      toast.error(`${rc.toasts.generateFail}: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const downloadPDF = useCallback(async () => {
    if (!datasetId) {
      toast.error(rc.toasts.selectDataset);
      return;
    }
    setDownloading("PDF");
    try {
      const response = await base44.functions.invoke("generateReport", {
        dataset_id: datasetId,
        format: "pdf",
      });

      const { pdf_base64, filename } = response.data;
      if (!pdf_base64) throw new Error("No PDF data returned");

      const byteChars = atob(pdf_base64);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i += 1) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || "Affiliate-Report.pdf";
      document.body.appendChild(link);
      link.click();
      URL.revokeObjectURL(url);
      link.remove();
      toast.success(rc.toasts.downloadSuccess);
    } catch (error) {
      toast.error(`${rc.toasts.downloadFail}: ${error.message}`);
    } finally {
      setDownloading(null);
    }
  }, [datasetId, rc.toasts.downloadFail, rc.toasts.downloadSuccess, rc.toasts.selectDataset]);

  const downloadMarkdown = useCallback(async () => {
    if (!datasetId) {
      toast.error(rc.toasts.selectDataset);
      return;
    }
    setDownloading("MD");
    try {
      const response = await base44.functions.invoke("generateReport", {
        dataset_id: datasetId,
        format: "markdown",
      });
      const text = typeof response.data === "string" ? response.data : JSON.stringify(response.data, null, 2);
      const blob = new Blob([text], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Affiliate-Report.md";
      document.body.appendChild(link);
      link.click();
      URL.revokeObjectURL(url);
      link.remove();
      toast.success(rc.toasts.downloadSuccess);
    } catch (error) {
      toast.error(`${rc.toasts.downloadFail}: ${error.message}`);
    } finally {
      setDownloading(null);
    }
  }, [datasetId, rc.toasts.downloadFail, rc.toasts.downloadSuccess, rc.toasts.selectDataset]);

  return (
    <div className="mx-auto max-w-[1480px] space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{rc.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{rc.subtitle}</p>
          {dataset?.updated_date && (
            <p className="mt-2 text-xs text-slate-400">
              {(rc.updatedAt || (language === "zh" ? "最近更新" : "Updated"))}: {new Date(dataset.updated_date).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DatasetSelector value={datasetId} onChange={setDatasetId} />
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => refetch()} disabled={!datasetId}>
            <RefreshCw className="h-3.5 w-3.5" />
            {rc.refresh || (language === "zh" ? "刷新" : "Refresh")}
          </Button>
          <Button size="sm" className="gap-1.5 bg-blue-600 text-xs hover:bg-blue-700" onClick={handleGenerate} disabled={generating || !datasetId}>
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {generating ? rc.generating : rc.generateFull}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
        <div className="h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-24">
          <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{rc.chapterNav}</p>
          <div className="space-y-0.5">
            {chapters.map((chapter) => {
              const status = statusStyles[chapter.status] || statusStyles.ready;
              const hasContent = translatedSections.some((section) => section.section_id === chapter.id);
              return (
                <button
                  key={chapter.id}
                  onClick={() => setSelectedChapter(chapter.id)}
                  className={`w-full rounded-xl px-3 py-2.5 text-left transition-all ${
                    selectedChapter === chapter.id ? "bg-blue-50 text-blue-700 shadow-sm" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${hasContent ? "bg-emerald-500" : status.dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{chapter.id}. {chapter.title}</p>
                    </div>
                    {hasContent && <CheckCircle className="h-3 w-3 flex-shrink-0 text-emerald-500" />}
                  </div>
                  {chapter.description && <p className="mt-1 pl-4 text-[11px] text-slate-400">{chapter.description}</p>}
                </button>
              );
            })}
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{rc.exportFormats}</p>
            <button
              onClick={downloadPDF}
              disabled={downloading === "PDF" || !datasetId}
              className="mb-1.5 flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-left transition-all hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {downloading === "PDF" ? <Loader2 className="h-4 w-4 animate-spin text-blue-500" /> : <Download className="h-4 w-4 text-blue-500" />}
              <span className="text-xs font-medium text-slate-700">{rc.downloads?.pdf || "Download PDF"}</span>
            </button>
            <button
              onClick={downloadMarkdown}
              disabled={downloading === "MD" || !datasetId}
              className="flex w-full items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-left transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {downloading === "MD" ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : <Download className="h-4 w-4 text-slate-400" />}
              <span className="text-xs font-medium text-slate-700">{rc.downloads?.markdown || "Download Markdown"}</span>
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={selectedChapter}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-6 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-200">
                      {rc.chapterLabel || "Chapter"} {selectedChapter}
                    </span>
                    <Badge className="border-white/30 bg-white/20 text-[10px] text-white">
                      {statusStyles[chapters[selectedChapter]?.status || "ready"].label}
                    </Badge>
                    {currentSection?.research_flags?.cache_hit && (
                      <Badge className="border-white/30 bg-white/20 text-[10px] text-white">
                        {rc.cacheHit || (language === "zh" ? "缓存研究" : "Cached Research")}
                      </Badge>
                    )}
                  </div>
                  <h2 className="text-xl font-bold">{chapters[selectedChapter]?.title}</h2>
                  <p className="mt-1 text-sm text-blue-200">{chapters[selectedChapter]?.description}</p>
                </div>
              </div>
            </div>

            <div className="p-8">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-500" />
                  <p className="text-sm text-slate-400">{rc.loading || (language === "zh" ? "加载中..." : "Loading...")}</p>
                </div>
              ) : currentSection ? (
                <div className="space-y-6">
                  {currentSection.conclusion && (() => {
                    const styles = conclusionStyles[currentSection.conclusion_status] || conclusionStyles.neutral;
                    const Icon = styles.icon;
                    return (
                      <div className={`flex gap-3 rounded-xl border p-4 ${styles.bg}`}>
                        <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${styles.text}`} />
                        <div>
                          <p className={`mb-1 text-xs font-bold uppercase tracking-wider ${styles.text}`}>{rc.conclusion}</p>
                          <p className={`text-sm leading-relaxed ${styles.text}`}>{currentSection.conclusion}</p>
                        </div>
                      </div>
                    );
                  })()}

                  <SummaryCardGrid section={currentSection} />

                  {currentSection.content_md ? (
                    <div className="prose prose-sm max-w-none prose-slate text-slate-700">
                      <ReactMarkdown
                        components={{
                          h1: ({ children }) => <h1 className="mb-3 mt-6 border-b border-slate-200 pb-2 text-xl font-bold text-slate-900">{children}</h1>,
                          h2: ({ children }) => <h2 className="mb-2 mt-5 text-base font-bold text-blue-700">{children}</h2>,
                          h3: ({ children }) => <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-800">{children}</h3>,
                          p: ({ children }) => <p className="mb-3 text-sm leading-relaxed text-slate-700">{children}</p>,
                          ul: ({ children }) => <ul className="mb-3 space-y-1">{children}</ul>,
                          li: ({ children }) => (
                            <li className="flex items-start gap-2 text-sm text-slate-700">
                              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                              <span>{children}</span>
                            </li>
                          ),
                          strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                          blockquote: ({ children }) => <blockquote className="my-3 border-l-4 border-blue-400 pl-4 italic text-slate-600">{children}</blockquote>,
                        }}
                      >
                        {currentSection.content_md}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="py-8 text-center text-sm text-slate-400">{rc.noContentText}</p>
                  )}

                  {currentSection.content_blocks?.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      {currentSection.content_blocks.map((block, index) => (
                        <ContentBlock key={`${block.title}-${index}`} block={block} section={currentSection} />
                      ))}
                    </div>
                  )}

                  {currentSection.tables?.length > 0 && (
                    <div className="space-y-4">
                      {currentSection.tables.map((table, index) => (
                        <StructuredTable key={`${table.title}-${index}`} table={table} section={currentSection} />
                      ))}
                    </div>
                  )}

                  {currentSection.key_findings?.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-slate-600" />
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-700">{rc.keyFindings}</p>
                      </div>
                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        {currentSection.key_findings.map((rawFinding, index) => {
                          const finding = normalizeFinding(rawFinding);
                          if (!finding) return null;
                          const styles = findingStyles[finding.type] || findingStyles.note;
                          return (
                            <div key={`${finding.title}-${index}`} className={`rounded-xl border p-4 ${styles.card}`}>
                              <div className="mb-3 flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/70 bg-white/80 text-[11px] font-bold text-slate-700">
                                    {index + 1}
                                  </span>
                                  <Badge className={`${styles.badge} text-[10px] capitalize`}>
                                    {finding.type === "risk" ? t("shared.risk") : finding.type === "opportunity" ? t("shared.opportunity") : t("shared.note")}
                                  </Badge>
                                </div>
                                {finding.linkPage && <span className="text-[11px] text-slate-500">{finding.linkPage}</span>}
                              </div>
                              <h4 className={`mb-2 text-sm font-semibold ${styles.title}`}>{finding.title}</h4>
                              {finding.trigger && (
                                <p className={`mb-2 text-sm leading-relaxed ${styles.body}`}>
                                  <span className="font-medium">{rc.findingLabels?.trigger || t("shared.trigger")}:</span> {finding.trigger}
                                </p>
                              )}
                              {finding.action && (
                                <p className={`mb-3 text-sm leading-relaxed ${styles.body}`}>
                                  <span className="font-medium">{rc.findingLabels?.action || t("shared.action")}:</span> {finding.action}
                                </p>
                              )}
                              {(finding.owner || finding.deadline) && (
                                <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
                                  {finding.owner && (
                                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                                      {rc.findingLabels?.owner || t("shared.owner")}: {finding.owner}
                                    </span>
                                  )}
                                  {finding.deadline && (
                                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1">
                                      {rc.findingLabels?.due || t("shared.due")}: {finding.deadline}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <SourcesPanel section={currentSection} title={rc.sources || (language === "zh" ? "研究来源" : "Research Sources")} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                    <FileText className="h-8 w-8 text-slate-300" />
                  </div>
                  <p className="mb-1 text-sm font-medium text-slate-600">{rc.noContent}</p>
                  <p className="max-w-xs text-center text-xs text-slate-400">{rc.noContentSub}</p>
                  <Button size="sm" className="mt-6 gap-1.5 bg-blue-600 hover:bg-blue-700" onClick={handleGenerate} disabled={generating || !datasetId}>
                    {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {generating ? rc.generating : rc.generateFull}
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
