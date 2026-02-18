import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, ArrowRight, CheckCircle2, AlertCircle, Settings, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/components/LanguageContext";

const fieldMappings = [
  { source: "publisher_id", target: "publisher_id", status: "mapped" },
  { source: "publisher_name", target: "publisher_name", status: "mapped" },
  { source: "total_revenue", target: "total_revenue", status: "mapped" },
  { source: "total_commission", target: "total_commission", status: "mapped" },
  { source: "num_clicks", target: "clicks", status: "mapped" },
  { source: "num_orders", target: "orders", status: "mapped" },
  { source: "publisher_category", target: "publisher_type", status: "mapped" },
  { source: "avg_order_value", target: "aov", status: "mapped" },
  { source: "conversion_rate", target: "cvr", status: "review" },
  { source: "daily_gmv", target: "—", status: "unmapped" },
];

const typeMappings = [
  { original: "Content / Blog", mapped: "content", rule: "tag contains 'content' OR 'blog'" },
  { original: "Coupon / Deal", mapped: "deal_coupon", rule: "tag contains 'coupon' OR 'deal'" },
  { original: "Cashback / Loyalty", mapped: "loyalty_cashback", rule: "publisher_type = 'loyalty'" },
  { original: "Search / SEM", mapped: "search", rule: "publisher_type = 'search'" },
  { original: "Sub-network / Toolbar", mapped: "tech_sub", rule: "publisher_type in ('sub-network', 'toolbar')" },
  { original: "Social / Video", mapped: "social_video", rule: "tag contains 'social' OR 'video'" },
];

const computeLogsData = [
  { version: "v2026.02", time: "2026-02-06 14:32", duration: "2.3s", rows: 1245, status: "success", notesKey: "log1" },
  { version: "v2026.01", time: "2026-01-15 09:18", duration: "1.8s", rows: 1189, status: "success", notesKey: "log2" },
  { version: "v2025.12", time: "2025-12-20 16:45", duration: "2.1s", rows: 1102, status: "warning", notesKey: "log3" },
];

const statusIcon = {
  mapped: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
  review: <AlertCircle className="w-3.5 h-3.5 text-amber-500" />,
  unmapped: <AlertCircle className="w-3.5 h-3.5 text-red-500" />,
};

export default function DataCenter() {
  const { t } = useLanguage();
  const dc = t('dataCenter');
  const computeLogs = computeLogsData.map(l => ({ ...l, notes: dc.logNotes[l.notesKey] }));
  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{dc.title}</h1>
        <p className="text-sm text-slate-500 mt-1">{dc.subtitle}</p>
      </div>

      <Tabs defaultValue="fields" className="w-full">
        <TabsList className="bg-slate-100 rounded-lg p-0.5">
          <TabsTrigger value="fields" className="text-xs gap-1.5"><Database className="w-3.5 h-3.5" /> {dc.tabs.fields}</TabsTrigger>
          <TabsTrigger value="types" className="text-xs gap-1.5"><Settings className="w-3.5 h-3.5" /> {dc.tabs.types}</TabsTrigger>
          <TabsTrigger value="logs" className="text-xs gap-1.5"><FileText className="w-3.5 h-3.5" /> {dc.tabs.logs}</TabsTrigger>
        </TabsList>

        <TabsContent value="fields" className="mt-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="text-sm font-semibold text-slate-700">{dc.fieldEditor}</span>
              <div className="flex gap-2 text-[11px]">
                <Badge className="bg-emerald-50 text-emerald-700">{dc.mappedLabel} {fieldMappings.filter(f => f.status === "mapped").length}</Badge>
                <Badge className="bg-amber-50 text-amber-700">{dc.reviewLabel} {fieldMappings.filter(f => f.status === "review").length}</Badge>
                <Badge className="bg-red-50 text-red-700">{dc.unmappedLabel} {fieldMappings.filter(f => f.status === "unmapped").length}</Badge>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500">{dc.sourceField}</th>
                  <th className="px-5 py-2.5 text-center text-xs font-semibold text-slate-500" />
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500">{dc.targetField}</th>
                  <th className="px-5 py-2.5 text-center text-xs font-semibold text-slate-500">{dc.status}</th>
                </tr>
              </thead>
              <tbody>
                {fieldMappings.map((f, i) => (
                  <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-2.5 font-mono text-xs text-slate-700">{f.source}</td>
                    <td className="px-5 py-2.5 text-center"><ArrowRight className="w-3.5 h-3.5 text-slate-300 mx-auto" /></td>
                    <td className="px-5 py-2.5 font-mono text-xs text-slate-700">{f.target}</td>
                    <td className="px-5 py-2.5 text-center">{statusIcon[f.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="types" className="mt-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <span className="text-sm font-semibold text-slate-700">{dc.typeMappingRules}</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500">{dc.originalType}</th>
                  <th className="px-5 py-2.5 text-center text-xs font-semibold text-slate-500" />
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500">{dc.mappedType}</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500">{dc.rule}</th>
                </tr>
              </thead>
              <tbody>
                {typeMappings.map((t, i) => (
                  <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-2.5 text-xs text-slate-700">{t.original}</td>
                    <td className="px-5 py-2.5 text-center"><ArrowRight className="w-3.5 h-3.5 text-slate-300 mx-auto" /></td>
                    <td className="px-5 py-2.5">
                      <Badge className="bg-blue-50 text-blue-700 text-[10px]">{t.mapped}</Badge>
                    </td>
                    <td className="px-5 py-2.5 font-mono text-[11px] text-slate-500">{t.rule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <span className="text-sm font-semibold text-slate-700">{dc.computeLogs}</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500">{dc.version}</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500">{dc.time}</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500">{dc.duration}</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500">{dc.rows}</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500">{dc.status}</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500">{dc.notes}</th>
                </tr>
              </thead>
              <tbody>
                {computeLogs.map((log, i) => (
                  <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-2.5 font-mono text-xs font-semibold text-slate-700">{log.version}</td>
                    <td className="px-5 py-2.5 text-xs text-slate-500">{log.time}</td>
                    <td className="px-5 py-2.5 text-xs text-slate-500">{log.duration}</td>
                    <td className="px-5 py-2.5 text-xs text-slate-700">{log.rows.toLocaleString()}</td>
                    <td className="px-5 py-2.5">
                      <Badge className={`text-[10px] ${log.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {log.status === "success" ? dc.success : dc.warning}
                      </Badge>
                    </td>
                    <td className="px-5 py-2.5 text-xs text-slate-500">{log.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}