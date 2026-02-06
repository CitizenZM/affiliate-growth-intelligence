import React from "react";
import { Badge } from "@/components/ui/badge";
import InsightsPanel from "../components/dashboard/InsightsPanel";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const tasks = [
  { name: "Content Creator 招募", start: 0, duration: 3, color: "#3B82F6", milestone: false },
  { name: "Deal 佣金结构调整", start: 1, duration: 2, color: "#EF4444", milestone: false },
  { name: "Tier2 加速孵化", start: 1, duration: 4, color: "#8B5CF6", milestone: false },
  { name: "落地页 A/B 测试", start: 2, duration: 2, color: "#06B6D4", milestone: false },
  { name: "Q1 Review 里程碑", start: 2, duration: 1, color: "#F59E0B", milestone: true },
  { name: "社交视频 Pilot", start: 3, duration: 3, color: "#10B981", milestone: false },
  { name: "治理白名单发布", start: 4, duration: 1, color: "#DC2626", milestone: true },
  { name: "H1 Performance Review", start: 5, duration: 1, color: "#F59E0B", milestone: true },
  { name: "Content 占比达标检查", start: 6, duration: 2, color: "#3B82F6", milestone: false },
  { name: "年度策略刷新", start: 9, duration: 3, color: "#8B5CF6", milestone: false },
];

const promoEvents = [
  { month: 2, label: "Spring Sale" },
  { month: 5, label: "Mid-Year Sale" },
  { month: 10, label: "Black Friday" },
  { month: 11, label: "Holiday Season" },
];

export default function Timeline() {
  const currentMonth = new Date().getMonth();

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">甘特图与节点</h1>
        <p className="text-sm text-slate-500 mt-1">12 个月行动时间线，叠加促销日历</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 overflow-x-auto">
        {/* Header months */}
        <div className="flex">
          <div className="w-[200px] flex-shrink-0" />
          <div className="flex-1 flex">
            {months.map((m, i) => (
              <div
                key={m}
                className={`flex-1 text-center text-xs font-medium pb-2 border-b-2 ${
                  i === currentMonth ? "text-blue-600 border-blue-600" : "text-slate-400 border-slate-100"
                }`}
              >
                {m}
              </div>
            ))}
          </div>
        </div>

        {/* Promo events */}
        <div className="flex mt-2 mb-1">
          <div className="w-[200px] flex-shrink-0 text-[10px] text-slate-400 font-medium pr-3 text-right">促销日历</div>
          <div className="flex-1 relative h-6">
            {promoEvents.map((e) => (
              <div
                key={e.label}
                className="absolute top-0 h-full flex items-center"
                style={{ left: `${(e.month / 12) * 100}%` }}
              >
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] whitespace-nowrap">{e.label}</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Tasks */}
        <div className="space-y-1.5 mt-2">
          {tasks.map((task, idx) => (
            <div key={idx} className="flex items-center group hover:bg-slate-50/50 rounded-lg py-1 -mx-2 px-2 transition-colors">
              <div className="w-[200px] flex-shrink-0 text-xs text-slate-600 font-medium pr-3 truncate flex items-center gap-1.5">
                {task.milestone && <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />}
                {task.name}
              </div>
              <div className="flex-1 relative h-7">
                <div
                  className="absolute top-1 h-5 rounded-md transition-all group-hover:shadow-sm"
                  style={{
                    left: `${(task.start / 12) * 100}%`,
                    width: `${(task.duration / 12) * 100}%`,
                    backgroundColor: task.color,
                    opacity: task.milestone ? 0.9 : 0.7,
                  }}
                >
                  {task.milestone && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white text-[9px] font-bold">⬥</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Current month indicator */}
        <div className="flex mt-4 pt-3 border-t border-slate-100">
          <div className="w-[200px] flex-shrink-0" />
          <div className="flex-1 relative">
            <div
              className="absolute top-0 w-0.5 h-4 bg-blue-600"
              style={{ left: `${(currentMonth / 12) * 100}%` }}
            />
            <div
              className="absolute top-4 text-[10px] text-blue-600 font-medium -translate-x-1/2"
              style={{ left: `${(currentMonth / 12) * 100}%` }}
            >
              今天
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> 里程碑</span>
        <span className="flex items-center gap-1.5"><span className="w-8 h-2 rounded bg-blue-500/70" /> 任务</span>
        <span className="flex items-center gap-1.5"><span className="w-0.5 h-3 bg-blue-600" /> 当前日期</span>
      </div>

      <InsightsPanel
        insights={[
          "营销日历与行动计划的叠加视图帮助识别资源冲突和协同机会，Spring Sale和Black Friday前应提前2-3个月启动Content招募",
          "品类营销节奏：时尚类Q1春季、Q4假日最强；科技类Black Friday、开学季；家居类春季装修、年末促销",
          "建议在大促前30天完成Tier2培育和Deal佣金调整，确保渠道有充分时间备货和推广",
          "里程碑节点(Q1 Review、H1 Performance Review)是策略校准的关键时机，需要对照KPI完成度决定资源再分配"
        ]}
        problems={[
          "如果多个高优先级任务集中在同一时段，会导致资源争抢和执行质量下降，需要错峰安排",
          "大促期间(如Black Friday前后)不建议进行重大系统变更或治理动作，避免影响业务连续性",
          "Content类渠道通常需要2-3个月的内容制作周期，所以招募应该提前到Q1就启动",
          "如果年度策略刷新(Q4)发现KPI严重偏离，说明前期规划有问题，需要在H1就进行中期Review纠偏"
        ]}
      />
    </div>
  );
}