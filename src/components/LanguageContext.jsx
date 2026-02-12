import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export const translations = {
  zh: {
    // Navigation
    nav: {
      overview: "总览",
      input: "数据接入",
      activation: "激活漏斗",
      concentration: "集中度",
      mixHealth: "结构健康",
      efficiency: "效率象限",
      approval: "交易质量",
      operatingSystem: "分层治理",
      actionPlan: "行动计划",
      timeline: "甘特图",
      reportCenter: "报告中心",
      dataCenter: "数据中心",
    },
    // Common
    common: {
      loading: "加载中...",
      noData: "暂无数据",
      export: "导出",
      download: "下载",
      upload: "上传",
      cancel: "取消",
      confirm: "确认",
      save: "保存",
      delete: "删除",
      edit: "编辑",
      search: "搜索",
      filter: "筛选",
      all: "全部",
      selectDataset: "选择数据集",
    },
    // Layout
    layout: {
      dataVersion: "数据版本",
      scrape: "联网抓取",
    },
  },
  en: {
    // Navigation
    nav: {
      overview: "Overview",
      input: "Input",
      activation: "Activation",
      concentration: "Concentration",
      mixHealth: "Mix Health",
      efficiency: "Efficiency",
      approval: "Approval",
      operatingSystem: "Operating System",
      actionPlan: "Action Plan",
      timeline: "Timeline",
      reportCenter: "Report Center",
      dataCenter: "Data Center",
    },
    // Common
    common: {
      loading: "Loading...",
      noData: "No data",
      export: "Export",
      download: "Download",
      upload: "Upload",
      cancel: "Cancel",
      confirm: "Confirm",
      save: "Save",
      delete: "Delete",
      edit: "Edit",
      search: "Search",
      filter: "Filter",
      all: "All",
      selectDataset: "Select Dataset",
    },
    // Layout
    layout: {
      dataVersion: "Data Version",
      scrape: "Web Scrape",
    },
  },
};

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('app-language') || 'zh';
  });

  useEffect(() => {
    localStorage.setItem('app-language', language);
  }, [language]);

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'zh' ? 'en' : 'zh');
  };

  const t = (path) => {
    const keys = path.split('.');
    let value = translations[language];
    for (const key of keys) {
      value = value?.[key];
    }
    return value || path;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}