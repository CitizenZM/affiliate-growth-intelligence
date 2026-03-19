import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "./utils";
import {
  LayoutDashboard, Upload, Filter, PieChart, BarChart3,
  ScatterChart, ShieldCheck, Layers, ListChecks, CalendarRange,
  FileText, Database, ChevronLeft, Menu,
  Download, Globe, Languages, Search
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import ProgressIndicator from "@/components/layout/ProgressIndicator";
import ProcessingStatus from "@/components/layout/ProcessingStatus";
import { LanguageProvider, useLanguage } from "@/components/LanguageContext";

const getNavItems = (t) => [
  { name: "Overview", page: "Dashboard", icon: LayoutDashboard, label: t('nav.overview'), sectionId: 0 },
  { name: "Input", page: "Input", icon: Upload, label: t('nav.input'), sectionId: null },
  { name: "Activation", page: "Activation", icon: Filter, label: t('nav.activation'), sectionId: 1 },
  { name: "Concentration", page: "Concentration", icon: BarChart3, label: t('nav.concentration'), sectionId: 2 },
  { name: "MixHealth", page: "MixHealth", icon: PieChart, label: t('nav.mixHealth'), sectionId: 3 },
  { name: "Efficiency", page: "Efficiency", icon: ScatterChart, label: t('nav.efficiency'), sectionId: 4 },
  { name: "Approval", page: "Approval", icon: ShieldCheck, label: t('nav.approval'), sectionId: 5 },
  { name: "OperatingSystem", page: "OperatingSystem", icon: Layers, label: t('nav.operatingSystem'), sectionId: 6 },
  { name: "ActionPlan", page: "ActionPlan", icon: ListChecks, label: t('nav.actionPlan'), sectionId: 7 },
  { name: "Timeline", page: "Timeline", icon: CalendarRange, label: t('nav.timeline'), sectionId: 8 },
  { name: "ReportCenter", page: "ReportCenter", icon: FileText, label: t('nav.reportCenter'), sectionId: null },
  { name: "DataCenter", page: "DataCenter", icon: Database, label: t('nav.dataCenter'), sectionId: null },
];

const LayoutContent = ({ children, currentPageName }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [latestDataset, setLatestDataset] = useState(null);
  const { language, toggleLanguage, t } = useLanguage();
  const navItems = getNavItems(t);

  const { data: datasets } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => base44.entities.DataUpload.list('-created_date', 1),
    refetchInterval: (query) => {
      const data = query.state.data || [];
      return data.some((d) => d.status === 'processing') ? 2000 : false;
    },
  });

  useEffect(() => {
    if (datasets && datasets.length > 0) setLatestDataset(datasets[0]);
  }, [datasets]);

  useEffect(() => {
    if (!latestDataset?.id) return;
    const unsubscribe = base44.entities.DataUpload.subscribe((event) => {
      if (event.id === latestDataset.id && event.type === 'update') setLatestDataset(event.data);
    });
    return unsubscribe;
  }, [latestDataset?.id]);

  const currentNav = navItems.find(n => n.page === currentPageName);

  return (
    <div className="min-h-screen flex bg-[#f0f2f5]">
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`
        fixed lg:sticky top-0 left-0 h-screen z-50
        bg-[#0f1729] text-white
        flex flex-col
        transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${collapsed ? "w-[68px]" : "w-[232px]"}
        ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <div className={`h-[60px] flex items-center border-b border-white/[0.06] shrink-0 ${collapsed ? "justify-center px-3" : "justify-between px-4"}`}>
          {!collapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <BarChart3 className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-[13px] font-semibold tracking-tight text-white/90">Xark OS</span>
            </div>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 text-white" />
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex w-5 h-5 items-center justify-center rounded text-white/30 hover:text-white/60 transition">
            <ChevronLeft className={`w-3 h-3 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5" style={{ scrollbarWidth: 'none' }}>
          {navItems.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.name}
                to={createPageUrl(item.page)}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-2.5 rounded-lg transition-all duration-150
                  ${collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2"}
                  ${isActive
                    ? "bg-blue-500/15 text-blue-400"
                    : "text-white/50 hover:text-white/80 hover:bg-white/[0.04]"
                  }
                `}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className={`w-[17px] h-[17px] flex-shrink-0 ${isActive ? "text-blue-400" : ""}`} />
                {!collapsed && (
                  <>
                    <span className={`text-[12.5px] truncate flex-1 ${isActive ? "font-semibold" : "font-medium"}`}>{item.label}</span>
                    {item.sectionId !== null && latestDataset && (
                      <ProgressIndicator
                        sectionId={item.sectionId}
                        sectionsReady={latestDataset?.sections_ready || []}
                        status={latestDataset?.status}
                        isProcessing={latestDataset?.status === 'processing'}
                      />
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="p-3 border-t border-white/[0.06] shrink-0">
            <div className="rounded-lg bg-white/[0.04] p-2.5">
              <p className="text-[10px] text-white/30 font-medium uppercase tracking-wider">{t('layout.dataVersion')}</p>
              <p className="text-[11px] text-white/70 mt-0.5 font-medium truncate">
                {latestDataset?.version_label || 'Latest'}
              </p>
            </div>
          </div>
        )}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[60px] bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 transition">
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
            <h1 className="text-[15px] font-semibold text-slate-800 tracking-tight">{currentNav?.label || currentPageName}</h1>
            {latestDataset && (
              <ProcessingStatus
                status={latestDataset.status}
                processingProgress={latestDataset.processing_progress}
                processingStep={latestDataset.processing_step}
                processingStartedAt={latestDataset.processing_started_at}
                processingCompletedAt={latestDataset.processing_completed_at}
              />
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={toggleLanguage} className="h-8 px-3 rounded-lg text-[12px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition inline-flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5" />
              {language === 'zh' ? 'EN' : '中文'}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

const Layout = ({ children, currentPageName }) => (
  <LanguageProvider>
    <LayoutContent children={children} currentPageName={currentPageName} />
  </LanguageProvider>
);

export default Layout;
