import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "./utils";
import {
  LayoutDashboard, Upload, Filter, PieChart, BarChart3,
  ScatterChart, ShieldCheck, Layers, ListChecks, CalendarRange,
  FileText, Database, ChevronLeft, ChevronRight, Menu, X,
  Download, Globe, Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import ProgressIndicator from "@/components/layout/ProgressIndicator";
import ProcessingStatus from "@/components/layout/ProcessingStatus";

const navItems = [
  { name: "Overview", page: "Dashboard", icon: LayoutDashboard, label: "总览", sectionId: 0 },
  { name: "Input", page: "Input", icon: Upload, label: "数据接入", sectionId: null },
  { name: "Activation", page: "Activation", icon: Filter, label: "激活漏斗", sectionId: 1 },
  { name: "Concentration", page: "Concentration", icon: BarChart3, label: "集中度", sectionId: 2 },
  { name: "MixHealth", page: "MixHealth", icon: PieChart, label: "结构健康", sectionId: 3 },
  { name: "Efficiency", page: "Efficiency", icon: ScatterChart, label: "效率象限", sectionId: 4 },
  { name: "Approval", page: "Approval", icon: ShieldCheck, label: "交易质量", sectionId: 5 },
  { name: "OperatingSystem", page: "OperatingSystem", icon: Layers, label: "分层治理", sectionId: 6 },
  { name: "ActionPlan", page: "ActionPlan", icon: ListChecks, label: "行动计划", sectionId: 7 },
  { name: "Timeline", page: "Timeline", icon: CalendarRange, label: "甘特图", sectionId: 8 },
  { name: "ReportCenter", page: "ReportCenter", icon: FileText, label: "报告中心", sectionId: null },
  { name: "DataCenter", page: "DataCenter", icon: Database, label: "数据中心", sectionId: null },
];

export default function Layout({ children, currentPageName }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [latestDataset, setLatestDataset] = useState(null);

  // Fetch latest dataset
  const { data: datasets } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => base44.entities.DataUpload.list('-created_date', 1),
    refetchInterval: 3000, // Refresh every 3s
  });

  useEffect(() => {
    if (datasets && datasets.length > 0) {
      setLatestDataset(datasets[0]);
    }
  }, [datasets]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!latestDataset?.id) return;
    
    const unsubscribe = base44.entities.DataUpload.subscribe((event) => {
      if (event.id === latestDataset.id && event.type === 'update') {
        setLatestDataset(event.data);
      }
    });

    return unsubscribe;
  }, [latestDataset?.id]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      <style>{`
        :root {
          --primary: #2563EB;
          --primary-light: #DBEAFE;
          --success: #16A34A;
          --warning: #F59E0B;
          --danger: #DC2626;
          --text-dark: #0F172A;
          --text-muted: #64748B;
          --surface: #FFFFFF;
          --border: #E2E8F0;
        }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
        .nav-item { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        .nav-item:hover { background: #F1F5F9; }
        .nav-item.active { background: #EFF6FF; color: #2563EB; border-right: 3px solid #2563EB; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 2px; }
      `}</style>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 h-screen z-50
        bg-white border-r border-slate-200
        flex flex-col
        transition-all duration-300 ease-in-out
        ${collapsed ? "w-[72px]" : "w-[240px]"}
        ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* Logo area */}
        <div className={`h-16 flex items-center border-b border-slate-100 px-4 ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <BarChart3 className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <span className="font-bold text-sm text-slate-900 tracking-tight">Affiliate</span>
                <span className="font-light text-sm text-blue-600 ml-0.5">Growth</span>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <BarChart3 className="w-4.5 h-4.5 text-white" />
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-6 h-6 items-center justify-center rounded-md hover:bg-slate-100 text-slate-400"
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2">
          {navItems.map((item) => {
            const isActive = currentPageName === item.page;
            const showProgress = item.sectionId !== null && latestDataset;

            return (
              <Link
                key={item.name}
                to={createPageUrl(item.page)}
                onClick={() => setMobileOpen(false)}
                className={`
                  nav-item flex items-center gap-3 rounded-lg mb-0.5
                  ${collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"}
                  ${isActive ? "active bg-blue-50 text-blue-600 font-medium" : "text-slate-500 hover:text-slate-700"}
                `}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                {!collapsed && (
                  <span className="text-[13px] truncate flex-1">{item.label}</span>
                )}
                {!collapsed && showProgress && (
                  <ProgressIndicator 
                    sectionId={item.sectionId}
                    sectionsReady={latestDataset?.sections_ready || []}
                    status={latestDataset?.status}
                    isProcessing={latestDataset?.status === 'processing'}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        {!collapsed && (
          <div className="p-3 border-t border-slate-100">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">数据版本</p>
              <p className="text-xs text-slate-600 mt-1 font-medium">v2026.02 — Latest</p>
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
            >
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
            <div className="hidden md:flex items-center gap-2 text-sm text-slate-500">
              <span className="font-medium text-slate-800">
                {navItems.find(n => n.page === currentPageName)?.label || currentPageName}
              </span>
            </div>
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
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-slate-500 gap-1.5 text-xs hidden md:flex">
              <Globe className="w-3.5 h-3.5" />
              联网抓取
            </Button>
            <Button variant="ghost" size="sm" className="text-slate-500 gap-1.5 text-xs hidden md:flex">
              <Download className="w-3.5 h-3.5" />
              导出
            </Button>
            <button className="relative p-2 rounded-lg hover:bg-slate-100">
              <Bell className="w-4.5 h-4.5 text-slate-400" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}