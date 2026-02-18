import React from "react";
import { Badge } from "@/components/ui/badge";
import InsightsPanel from "../components/dashboard/InsightsPanel";
import { useLanguage } from "@/components/LanguageContext";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const taskDefs = [
  { key: "contentRecruit", start: 0, duration: 3, color: "#3B82F6", milestone: false },
  { key: "dealCommission", start: 1, duration: 2, color: "#EF4444", milestone: false },
  { key: "tier2Incubate", start: 1, duration: 4, color: "#8B5CF6", milestone: false },
  { key: "landingAbTest", start: 2, duration: 2, color: "#06B6D4", milestone: false },
  { key: "q1Review", start: 2, duration: 1, color: "#F59E0B", milestone: true },
  { key: "socialVideoPilot", start: 3, duration: 3, color: "#10B981", milestone: false },
  { key: "governanceWhitelist", start: 4, duration: 1, color: "#DC2626", milestone: true },
  { key: "h1Review", start: 5, duration: 1, color: "#F59E0B", milestone: true },
  { key: "contentCheck", start: 6, duration: 2, color: "#3B82F6", milestone: false },
  { key: "annualRefresh", start: 9, duration: 3, color: "#8B5CF6", milestone: false },
];

const promoEvents = [
  { month: 2, label: "Spring Sale" },
  { month: 5, label: "Mid-Year Sale" },
  { month: 10, label: "Black Friday" },
  { month: 11, label: "Holiday Season" },
];

export default function Timeline() {
  const currentMonth = new Date().getMonth();
  const { t } = useLanguage();
  const tl = t('timeline');
  const tasks = taskDefs.map(td => ({ ...td, name: tl.tasks[td.key] || td.key }));

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{tl.title}</h1>
        <p className="text-sm text-slate-500 mt-1">{tl.subtitle}</p>
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
          <div className="w-[200px] flex-shrink-0 text-[10px] text-slate-400 font-medium pr-3 text-right">{t('shared.promoCalendar')}</div>
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
              {t('shared.today')}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> {t('shared.milestone')}</span>
        <span className="flex items-center gap-1.5"><span className="w-8 h-2 rounded bg-blue-500/70" /> {t('shared.task')}</span>
        <span className="flex items-center gap-1.5"><span className="w-0.5 h-3 bg-blue-600" /> {t('shared.currentDate')}</span>
      </div>

      <InsightsPanel
        insights={tl.insights}
        problems={tl.problems}
      />
    </div>
  );
}