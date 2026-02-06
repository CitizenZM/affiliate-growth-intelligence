import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Eye, ChevronRight, Sparkles, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

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

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => setGenerating(false), 3000);
  };

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

            <div className="bg-slate-50 rounded-xl p-6 mt-4 border border-slate-100 min-h-[300px] flex items-center justify-center">
              <div className="text-center">
                <Eye className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">点击"生成完整报告"后，此处将显示报告预览</p>
                <p className="text-xs text-slate-400 mt-1">支持所见即所得编辑、图表替换、证据表嵌入</p>
              </div>
            </div>
          </motion.div>

          {/* Export options */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">导出格式</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {["PDF", "DOCX", "Markdown", "Board 摘要"].map((fmt) => (
                <button
                  key={fmt}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-blue-200 transition-all"
                >
                  <Download className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600 font-medium">{fmt}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}