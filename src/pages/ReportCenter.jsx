import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Eye, Sparkles, Loader2, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import DatasetSelector from "../components/dashboard/DatasetSelector";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/components/LanguageContext";
import ReactMarkdown from "react-markdown";

const chapterStatuses = ["ready","ready","ready","ready","ready","ready","ready","ready","partial","partial","ready"];

export default function ReportCenter() {
  const [selectedChapter, setSelectedChapter] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [datasetId, setDatasetId] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const { t, language } = useLanguage();
  const rc = t('reportCenter');
  const queryClient = useQueryClient();

  const chapters = rc.chapters.map((ch, i) => ({
    id: i,
    title: ch.title,
    description: ch.desc,
    status: chapterStatuses[i],
  }));

  const statusStyles = {
    ready:   { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", border: "border-emerald-200", label: rc.status.ready },
    partial: { bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-500",   border: "border-amber-200",   label: rc.status.partial },
    missing: { bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-500",     border: "border-red-200",     label: rc.status.missing },
  };

  const conclusionStyles = {
    good:    { bar: "bg-emerald-500", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800", icon: CheckCircle },
    neutral: { bar: "bg-slate-400",   bg: "bg-slate-50 border-slate-200",    text: "text-slate-700",   icon: Eye },
    warning: { bar: "bg-amber-500",   bg: "bg-amber-50 border-amber-200",    text: "text-amber-800",   icon: AlertTriangle },
    bad:     { bar: "bg-red-500",     bg: "bg-red-50 border-red-200",        text: "text-red-800",     icon: AlertTriangle },
  };

  const { data: sections = [], isLoading, refetch } = useQuery({
    queryKey: ['report-sections', datasetId],
    queryFn: () => datasetId ? base44.entities.ReportSection.filter({ dataset_id: datasetId }) : [],
    enabled: !!datasetId,
  });

  const currentSection = sections.find(s => s.section_id === selectedChapter);

  const handleGenerate = async () => {
    if (!datasetId) { toast.error(rc.toasts.selectDataset); return; }
    setGenerating(true);
    try {
      await base44.functions.invoke('aiGenerateSections', { dataset_id: datasetId });
      toast.success(rc.toasts.generateSuccess);
      queryClient.invalidateQueries({ queryKey: ['report-sections', datasetId] });
    } catch (error) {
      toast.error(rc.toasts.generateFail + ': ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const downloadPDF = useCallback(async () => {
    if (!datasetId) { toast.error(rc.toasts.selectDataset); return; }
    setDownloading('PDF');
    try {
      const response = await base44.functions.invoke('generateReport', {
        dataset_id: datasetId,
        format: 'pdf',
      });

      const { pdf_base64, filename } = response.data;
      if (!pdf_base64) throw new Error('No PDF data returned');

      // Decode base64 → Blob → download
      const byteChars = atob(pdf_base64);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'Affiliate-Report.pdf';
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
      toast.success(rc.toasts.downloadSuccess);
    } catch (error) {
      console.error('PDF download error:', error);
      toast.error(rc.toasts.downloadFail + ': ' + error.message);
    } finally {
      setDownloading(null);
    }
  }, [datasetId]);

  const downloadMarkdown = useCallback(async () => {
    if (!datasetId) { toast.error(rc.toasts.selectDataset); return; }
    setDownloading('MD');
    try {
      const response = await base44.functions.invoke('generateReport', {
        dataset_id: datasetId,
        format: 'markdown',
      });
      const text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2);
      const blob = new Blob([text], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Affiliate-Report.md';
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
      toast.success(rc.toasts.downloadSuccess);
    } catch (error) {
      toast.error(rc.toasts.downloadFail + ': ' + error.message);
    } finally {
      setDownloading(null);
    }
  }, [datasetId]);

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{rc.title}</h1>
          <p className="text-sm text-slate-500 mt-1">{rc.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <DatasetSelector value={datasetId} onChange={setDatasetId} />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => refetch()}
            disabled={!datasetId}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {language === 'zh' ? '刷新' : 'Refresh'}
          </Button>
          <Button
            size="sm"
            className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700"
            onClick={handleGenerate}
            disabled={generating || !datasetId}
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {generating ? rc.generating : rc.generateFull}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
        {/* Chapter nav */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 h-fit lg:sticky lg:top-24 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-3">{rc.chapterNav}</p>
          <div className="space-y-0.5">
            {chapters.map((ch) => {
              const sc = statusStyles[ch.status];
              const hasContent = sections.some(s => s.section_id === ch.id);
              return (
                <button
                  key={ch.id}
                  onClick={() => setSelectedChapter(ch.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${
                    selectedChapter === ch.id
                      ? "bg-blue-50 text-blue-700 shadow-sm"
                      : "hover:bg-slate-50 text-slate-600"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${hasContent ? 'bg-emerald-500' : sc.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{ch.id}. {ch.title}</p>
                  </div>
                  {hasContent && (
                    <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Download section */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">{rc.exportFormats}</p>
            <button
              onClick={downloadPDF}
              disabled={downloading === 'PDF' || !datasetId}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 hover:bg-blue-50 hover:border-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-1.5 text-left"
            >
              {downloading === 'PDF'
                ? <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                : <Download className="w-4 h-4 text-blue-500" />}
              <span className="text-xs font-medium text-slate-700">Download PDF</span>
            </button>
            <button
              onClick={downloadMarkdown}
              disabled={downloading === 'MD' || !datasetId}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left"
            >
              {downloading === 'MD'
                ? <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                : <Download className="w-4 h-4 text-slate-400" />}
              <span className="text-xs font-medium text-slate-700">Download Markdown</span>
            </button>
          </div>
        </div>

        {/* Content Preview */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedChapter}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            {/* Chapter header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-6 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">
                      Chapter {selectedChapter}
                    </span>
                    <Badge className="bg-white/20 text-white border-white/30 text-[10px]">
                      {statusStyles[chapters[selectedChapter].status].label}
                    </Badge>
                  </div>
                  <h2 className="text-xl font-bold">{chapters[selectedChapter].title}</h2>
                  <p className="text-sm text-blue-200 mt-1">{chapters[selectedChapter].description}</p>
                </div>
              </div>
            </div>

            <div className="p-8">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-24">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
                  <p className="text-sm text-slate-400">{language === 'zh' ? '加载中...' : 'Loading...'}</p>
                </div>
              ) : currentSection ? (
                <div className="space-y-6">
                  {/* Conclusion */}
                  {currentSection.conclusion && (() => {
                    const cs = conclusionStyles[currentSection.conclusion_status] || conclusionStyles.neutral;
                    const Icon = cs.icon;
                    return (
                      <div className={`flex gap-3 p-4 rounded-xl border ${cs.bg}`}>
                        <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${cs.text}`} />
                        <div>
                          <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${cs.text}`}>{rc.conclusion}</p>
                          <p className={`text-sm leading-relaxed ${cs.text}`}>{currentSection.conclusion}</p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Main content */}
                  {currentSection.content_md ? (
                    <div className="prose prose-sm prose-slate max-w-none text-slate-700 leading-relaxed">
                      <ReactMarkdown
                        components={{
                          h1: ({children}) => <h1 className="text-xl font-bold text-slate-900 mt-6 mb-3 pb-2 border-b border-slate-200">{children}</h1>,
                          h2: ({children}) => <h2 className="text-base font-bold text-blue-700 mt-5 mb-2">{children}</h2>,
                          h3: ({children}) => <h3 className="text-sm font-semibold text-slate-800 mt-4 mb-2">{children}</h3>,
                          p: ({children}) => <p className="text-sm text-slate-700 leading-relaxed mb-3">{children}</p>,
                          ul: ({children}) => <ul className="space-y-1 mb-3">{children}</ul>,
                          li: ({children}) => (
                            <li className="flex items-start gap-2 text-sm text-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                              <span>{children}</span>
                            </li>
                          ),
                          strong: ({children}) => <strong className="font-semibold text-slate-900">{children}</strong>,
                          blockquote: ({children}) => (
                            <blockquote className="border-l-4 border-blue-400 pl-4 italic text-slate-600 my-3">{children}</blockquote>
                          ),
                          table: ({children}) => (
                            <div className="overflow-x-auto my-4 rounded-xl border border-slate-200">
                              <table className="w-full text-xs">{children}</table>
                            </div>
                          ),
                          th: ({children}) => <th className="bg-slate-800 text-white px-3 py-2 text-left font-semibold">{children}</th>,
                          td: ({children}) => <td className="px-3 py-2 border-t border-slate-100">{children}</td>,
                        }}
                      >
                        {currentSection.content_md}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-slate-400 text-center py-8 text-sm">{rc.noContentText}</p>
                  )}

                  {/* Key findings */}
                  {currentSection.key_findings && currentSection.key_findings.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">{rc.keyFindings}</p>
                      </div>
                      <div className="space-y-2">
                        {currentSection.key_findings.map((finding, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-800 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <p className="text-sm text-amber-900 leading-relaxed">
                              {typeof finding === 'string' ? finding : finding.text || JSON.stringify(finding)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-600 mb-1">{rc.noContent}</p>
                  <p className="text-xs text-slate-400 text-center max-w-xs">{rc.noContentSub}</p>
                  <Button
                    size="sm"
                    className="mt-6 gap-1.5 bg-blue-600 hover:bg-blue-700"
                    onClick={handleGenerate}
                    disabled={generating || !datasetId}
                  >
                    {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
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