import React, { useState } from "react";
import SectionLayout from "../components/dashboard/SectionLayout";
import EvidenceTable from "../components/dashboard/EvidenceTable";
import DatasetSelector from "../components/dashboard/DatasetSelector";
import DataLoader from "../components/dashboard/DataLoader";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useLanguage } from "@/components/LanguageContext";

const funnelData = [
  { name: "Total", value: 1245, color: "#94A3B8" },
  { name: "Active", value: 398, color: "#3B82F6" },
  { name: "Core Drivers", value: 45, color: "#2563EB" },
];


const evidenceData = [
  { name: "RetailMeNot", type: "Deal/Coupon", gmv: "$85,000", cpa: "$12.30", status: "Active" },
  { name: "Wirecutter", type: "Content", gmv: "$62,000", cpa: "$18.50", status: "Active" },
  { name: "Rakuten", type: "Loyalty", gmv: "$54,000", cpa: "$8.90", status: "Active" },
  { name: "BuzzFeed", type: "Content", gmv: "$31,000", cpa: "$22.10", status: "Active" },
  { name: "Honey", type: "Tech/Sub", gmv: "$28,500", cpa: "$6.40", status: "Active" },
];



export default function Activation() {
  const [datasetId, setDatasetId] = useState(null);
  const { t } = useLanguage();
  const ac = t('activation');
  const isEn = t('nav.overview') === 'Overview';

  const derivationNotes = [
    {
      title: ac.derivation.defTitle,
      items: [
        { label: "Active", value: ac.derivation.active },
        { label: isEn ? "Dedup" : "去重", value: ac.derivation.dedup },
        { label: "Core Driver", value: ac.derivation.coreDriver },
      ],
    },
    {
      title: ac.derivation.stepsTitle,
      items: [
        { label: "Step 1", value: ac.derivation.step1 },
        { label: "Step 2", value: ac.derivation.step2 },
        { label: "Step 3", value: ac.derivation.step3 },
      ],
    },
  ];

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{ac.title}</h1>
          <p className="text-sm text-slate-500 mt-1">{ac.subtitle}</p>
        </div>
        <DatasetSelector value={datasetId} onChange={setDatasetId} />
      </div>

      <DataLoader datasetId={datasetId}>
        {({ getMetric, getTable, getSection }) => {
          const section = getSection(1);
          const total = getMetric('total_publishers');
          const active = getMetric('active_publishers');
          const activeRatio = getMetric('active_ratio');
          
          const funnelData = [
            { name: "Total", value: total, color: "#94A3B8" },
            { name: "Active", value: active, color: "#3B82F6" },
            { name: "Core Drivers", value: getMetric('publishers_to_50pct'), color: "#2563EB" },
          ];

          return (
            <SectionLayout
              conclusion={section?.conclusion || (isEn
                ? `Current activation rate ${(activeRatio * 100).toFixed(1)}%, ${activeRatio < 0.4 ? 'below' : 'meeting'} the 40% target.`
                : `当前激活率 ${(activeRatio * 100).toFixed(1)}%，${activeRatio < 0.4 ? '低于' : '达到'} 40% 目标线。`)}
              conclusionStatus={section?.conclusion_status || (activeRatio < 0.4 ? 'warning' : 'neutral')}
              derivationNotes={section?.derivation_notes || derivationNotes}
            >
              {/* Funnel chart */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">{ac.chartTitle}</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnelData} layout="vertical" barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: "#94A3B8" }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 13, fill: "#475569", fontWeight: 500 }} width={100} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}
                  formatter={(value) => [`${value} publishers`, ac.quantity]}
                />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={36}>
                  {funnelData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Mini stats */}
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
            {funnelData.map((d) => (
              <div key={d.name} className="text-center">
                <p className="text-2xl font-bold text-slate-900 tabular-nums">{d.value.toLocaleString()}</p>
                <p className="text-xs text-slate-500 mt-0.5">{d.name}</p>
              </div>
            ))}
                </div>
              </div>

              {/* Evidence table */}
              <EvidenceTable
                title={ac.tableTitle}
                columns={[
                  { key: "name", label: ac.cols.name },
                  { key: "type", label: ac.cols.type },
                  { key: "gmv", label: ac.cols.gmv },
                  { key: "cpa", label: ac.cols.cpa },
                  { key: "status", label: ac.cols.status },
                ]}
                data={evidenceData}
                derivationNotes={section?.derivation_notes || derivationNotes}
              />
            </SectionLayout>
          );
        }}
      </DataLoader>
    </div>
  );
}