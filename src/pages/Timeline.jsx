import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import InsightsPanel from "../components/dashboard/InsightsPanel";
import DatasetSelector from "../components/dashboard/DatasetSelector";
import DataLoader from "../components/dashboard/DataLoader";
import SectionLayout from "../components/dashboard/SectionLayout";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const priorityColor = { high: "#DC2626", medium: "#3B82F6", low: "#94A3B8" };

export default function Timeline() {
  const [datasetId, setDatasetId] = useState(null);
  const currentMonth = new Date().getMonth();

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">甘特图与节点</h1>
          <p className="text-sm text-slate-500 mt-1">12 个月行动时间线（按数据集自动生成）</p>
        </div>
        <DatasetSelector value={datasetId} onChange={setDatasetId} />
      </div>

      <DataLoader datasetId={datasetId}>
        {({ getTable, getSection }) => {
          const section = getSection(8);
          const tasks = getTable("timeline_tasks").map((task) => ({
            ...task,
            start: Math.max(0, Number(task.month_start || 1) - 1),
            duration: Math.max(1, Number(task.duration || 1)),
            color: priorityColor[task.priority] || "#3B82F6",
          }));

          return (
            <>
              <SectionLayout
                conclusion={section?.conclusion || "时间线已基于当前数据集自动生成。"}
                conclusionStatus={section?.conclusion_status || "neutral"}
                derivationNotes={section?.derivation_notes || []}
              >
                <div className="bg-white rounded-2xl border border-slate-200 p-6 overflow-x-auto">
                  <div className="flex">
                    <div className="w-[240px] flex-shrink-0" />
                    <div className="flex-1 flex">
                      {months.map((m, i) => (
                        <div key={m} className={`flex-1 text-center text-xs font-medium pb-2 border-b-2 ${i === currentMonth ? "text-blue-600 border-blue-600" : "text-slate-400 border-slate-100"}`}>
                          {m}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 mt-3">
                    {tasks.map((task, idx) => (
                      <div key={idx} className="flex items-center group hover:bg-slate-50/50 rounded-lg py-1 -mx-2 px-2 transition-colors">
                        <div className="w-[240px] flex-shrink-0 text-xs text-slate-600 font-medium pr-3 truncate">{task.name}</div>
                        <div className="flex-1 relative h-7">
                          <div
                            className="absolute top-1 h-5 rounded-md transition-all group-hover:shadow-sm"
                            style={{
                              left: `${(task.start / 12) * 100}%`,
                              width: `${(task.duration / 12) * 100}%`,
                              backgroundColor: task.color,
                              opacity: 0.8,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionLayout>

              <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                <Badge className="bg-red-100 text-red-700 border-red-200">高优先级</Badge>
                <Badge className="bg-blue-100 text-blue-700 border-blue-200">中优先级</Badge>
              </div>

              <InsightsPanel
                insights={[
                  "Timeline 页已切换为按当前数据集自动生成任务，不再使用固定样例",
                  "新数据集处理完成后，任务内容与优先级会随核心 KPI 自动调整",
                ]}
                problems={[
                  "若需要叠加促销日历/Daily GMV，需要在 Input 上传对应数据后扩展 timeline_tasks 生成逻辑",
                ]}
              />
            </>
          );
        }}
      </DataLoader>
    </div>
  );
}
