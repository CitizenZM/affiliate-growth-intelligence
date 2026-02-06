import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Eye, ChevronRight, Sparkles, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import DatasetSelector from "../components/dashboard/DatasetSelector";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

const chapters = [
  { id: 0, title: "Executive Summary", status: "ready", description: "CEO 一页摘要，核心 KPI 与风险机会" },
  { id: 1, title: "Activation & Funnel", status: "ready", description: "激活率、Active Ratio、Core Driver 分析" },
  { id: 2, title: "Concentration Analysis", status: "ready", description: "Pareto 曲线、Top10 集中度、去集中度建议" },
  { id: 3, title: "Mix Health", status: "ready", description: "类型结构分布、目标区间对比、映射规则" },
  { id: 4, title: "Efficiency Quadrant", status: "ready", description: "CPA vs AOV 四象限分析、Publisher 效率排名" },
  { id: 5, title: "Approval & Quality", status: "ready", description: "审批瀑布、异常 Publisher 识别、治理建议" },
  { id: 6, title: "Operating System", status: "ready", description: "四层分级体系、差异化策略模板" },
  { id: 7, title: "Action Plan", status: "ready", description: "行动计划汇总、KPI 跟踪、Owner 分配" },
  { id: 8, title: "Timeline & Milestones", status: "partial", description: "12 个月甘特图（需 Daily GMV 补充完整）" },
  { id: 9, title: "Website & Landing Page", status: "partial", description: "官网分析（需联网抓取数据）" },
  { id: 10, title: "Recommendations", status: "ready", description: "总结性建议与下一步行动" },
];

const statusColors = {
  ready: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "就绪" },
  partial: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "部分" },
  missing: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "缺数据" },
};

export default function ReportCenter() {
  const [selectedChapter, setSelectedChapter] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [datasetId, setDatasetId] = useState(null);
  const [downloading, setDownloading] = useState(null);

  // Fetch report sections
  const { data: sections = [], isLoading } = useQuery({
    queryKey: ['report-sections', datasetId],
    queryFn: () => datasetId ? base44.entities.ReportSection.filter({ dataset_id: datasetId }) : [],
    enabled: !!datasetId,
  });

  const handleGenerate = async () => {
    if (!datasetId) {
      toast.error('请先选择数据集');
      return;
    }
    
    setGenerating(true);
    try {
      await base44.functions.invoke('aiGenerateSections', { dataset_id: datasetId });
      toast.success('报告生成完成');
    } catch (error) {
      toast.error('生成失败: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (format) => {
    if (!datasetId) {
      toast.error('请先选择数据集');
      return;
    }

    setDownloading(format);
    try {
      const response = await base44.functions.invoke('generateReport', { 
        dataset_id: datasetId, 
        format: format.toLowerCase() 
      });
      
      const blob = new Blob([response.data], { 
        type: format === 'PDF' ? 'application/pdf' : 'text/markdown' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report.${format === 'PDF' ? 'pdf' : 'md'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      toast.success('下载成功');
    } catch (error) {
      toast.error('下载失败: ' + error.message);
    } finally {
      setDownloading(null);
    }
  };

  // Get current section
  const currentSection = sections.find(s => s.section_id === selectedChapter);

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">报告中心</h1>
          <p className="text-sm text-slate-500 mt-1">0—10 章完整报告，支持多格式导出</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Sparkles className="w-3.5 h-3.5" /> Board 摘要版
          </Button>
          <Button size="sm" className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700" onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            {generating ? "生成中..." : "生成完整报告"}
          </Button>
        </div>
      </div>

      {/* Dataset selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <DatasetSelector value={datasetId} onChange={setDatasetId} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        {/* Chapter nav */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 h-fit lg:sticky lg:top-24">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">章节目录</p>
          <div className="space-y-0.5">
            {chapters.map((ch) => {
              const sc = statusColors[ch.status];
              return (
                <button
                  key={ch.id}
                  onClick={() => setSelectedChapter(ch.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all ${
                    selectedChapter === ch.id ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50 text-slate-600"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.dot}`} />
                  <span className="text-xs font-medium truncate">{ch.id}. {ch.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content preview */}
        <div className="space-y-4">
          {/* Selected chapter */}
          <motion.div
            key={selectedChapter}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-slate-200 p-8"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <Badge className={`${statusColors[chapters[selectedChapter].status].bg} ${statusColors[chapters[selectedChapter].status].text} text-[10px] mb-2`}>
                  {statusColors[chapters[selectedChapter].status].label}
                </Badge>
                <h2 className="text-xl font-bold text-slate-900">Chapter {selectedChapter}: {chapters[selectedChapter].title}</h2>
                <p className="text-sm text-slate-500 mt-1">{chapters[selectedChapter].description}</p>
              </div>
            </div>

            {isLoading ? (
              <div className="bg-slate-50 rounded-xl p-6 mt-4 border border-slate-100 min-h-[300px] flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
              </div>
            ) : currentSection ? (
              <div className="bg-white rounded-xl p-6 mt-4 border border-slate-100 min-h-[300px]">
                {currentSection.conclusion && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-semibold text-blue-700 mb-1">结论</p>
                    <p className="text-sm text-slate-700">{currentSection.conclusion}</p>
                  </div>
                )}
                
                <div className="prose prose-sm max-w-none text-slate-700">
                  {currentSection.content_md ? (
                    <div className="whitespace-pre-wrap">{currentSection.content_md}</div>
                  ) : (
                    <p className="text-slate-400 text-center py-8">暂无内容</p>
                  )}
                </div>

                {currentSection.key_findings && currentSection.key_findings.length > 0 && (
                  <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs font-semibold text-amber-700 mb-2">关键发现</p>
                    <ul className="space-y-1">
                      {currentSection.key_findings.map((finding, idx) => (
                        <li key={idx} className="text-sm text-slate-700">
                          • {typeof finding === 'string' ? finding : finding.text || JSON.stringify(finding)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 rounded-xl p-6 mt-4 border border-slate-100 min-h-[300px] flex items-center justify-center">
                <div className="text-center">
                  <Eye className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">点击"生成完整报告"后，此处将显示报告预览</p>
                  <p className="text-xs text-slate-400 mt-1">支持所见即所得编辑、图表替换、证据表嵌入</p>
                </div>
              </div>
            )}
          </motion.div>

          {/* Export options */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">导出格式</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {["PDF", "Markdown"].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => handleDownload(fmt)}
                  disabled={downloading === fmt || !datasetId}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {downloading === fmt ? (
                    <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 text-slate-400" />
                  )}
                  <span className="text-sm text-slate-600 font-medium">{fmt}</span>
                </button>
              ))}
              <button
                disabled
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 opacity-50 cursor-not-allowed"
              >
                <Download className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-600 font-medium">DOCX</span>
              </button>
              <button
                disabled
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 opacity-50 cursor-not-allowed"
              >
                <Download className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-600 font-medium">Board 摘要</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}