import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export const translations = {
  zh: {
    nav: {
      overview: "总览", input: "数据接入", activation: "激活漏斗", concentration: "集中度",
      mixHealth: "结构健康", efficiency: "效率象限", approval: "交易质量",
      operatingSystem: "分层治理", actionPlan: "行动计划", timeline: "甘特图",
      reportCenter: "报告中心", dataCenter: "数据中心",
    },
    common: {
      loading: "加载中...", noData: "暂无数据", export: "导出", download: "下载",
      upload: "上传", cancel: "取消", confirm: "确认", save: "保存", delete: "删除",
      edit: "编辑", search: "搜索", filter: "筛选", all: "全部", selectDataset: "选择数据集",
    },
    layout: { dataVersion: "数据版本", scrape: "联网抓取" },
    shared: {
      readingGuide: "阅读指南", dataInsights: "数据洞察", keyFindings: "关键发现",
      issueInterpretation: "问题解读", needsAttention: "需要关注",
      derivationNotes: "推导备注", copied: "已复制到剪贴板",
      items: "条", showingFirst: "显示前", of: "条，共",
      today: "今天", milestone: "里程碑", task: "任务", currentDate: "当前日期",
      promoCalendar: "促销日历", publishers: "publishers",
      exceed: "超标", watch: "关注", healthy: "健康", low: "偏低",
    },
    datasetSelector: {
      placeholder: "选择数据集", completed: "已完成", failed: "失败",
      pending: "待处理", unknown: "未知",
    },
    overview: {
      title: "Affiliate Growth Dashboard",
      subtitle: "一屏掌握渠道健康度与核心风险机会",
      coreKpis: "核心 KPI", top3Risks: "Top 3 风险", top3Opportunities: "Top 3 机会",
      quickLinks: "快速跳转", generateReport: "生成完整报告",
      labels: {
        totalPubs: "总 Publisher", activePubs: "活跃 Publisher",
        activeDef: "活跃定义: total_revenue > 0",
        contentGmv: "Content GMV", totalGmv: "Total GMV", dealGmv: "Deal/Coupon GMV",
      },
      quickLinkLabels: {
        activation: "激活漏斗", concentration: "集中度分析", mixHealth: "结构健康",
        efficiency: "效率象限", approval: "交易质量", operatingSystem: "分层治理",
        actionPlan: "行动计划", input: "数据接入",
      },
      risks: {
        concentrationTitle: "头部集中度过高",
        concentrationAction: "启动 Tier2 加速孵化计划，90 天内培养 5 个新 Core Driver",
        concentrationOwner: "BD Lead",
        dealTitle: "Deal/Coupon 结构过重",
        dealAction: "提高 Content 类佣金率 2%，降低 Coupon 类佣金率 1%，激励结构迁移",
        dealOwner: "Program Manager",
        approvalTitle: "交易审批率偏低",
        approvalAction: "对高拒绝率 Publisher 启动治理审查流程",
        approvalOwner: "Compliance",
      },
      opportunities: {
        contentTitle: "Content 渠道扩张空间大",
        contentAction: "招募 20 个垂直领域 Content Creator，配套专属落地页与佣金激励",
        contentOwner: "Content Lead",
        activationTitle: "激活率提升空间",
        activationAction: "启动 Publisher 激活计划，提供培训和专属素材",
        activationOwner: "BD Lead",
        outputTitle: "平均产出可提升",
        outputAction: "优化 Publisher 培育体系，提供更好的工具和激励",
        outputOwner: "Product",
      },
    },
    activation: {
      title: "激活漏斗", subtitle: "从 Total 到 Active 到 Core Drivers 的转化全景",
      chartTitle: "Publisher 激活漏斗", tableTitle: "Active Publisher 明细",
      cols: { name: "Publisher", type: "类型", gmv: "GMV", cpa: "CPA", status: "状态" },
      quantity: "数量",
      derivation: {
        defTitle: "口径定义", active: "total_revenue > 0",
        dedup: "PublisherID 优先，缺失时用 publisher_name",
        coreDriver: "贡献 80% 累计 GMV 的头部 Publisher",
        stepsTitle: "计算步骤",
        step1: "筛选 total_revenue > 0 得到 Active 集合",
        step2: "按 total_revenue desc 排序",
        step3: "累计至 80% 确定 Core Drivers",
      },
    },
    concentration: {
      title: "集中度分析", subtitle: "Pareto 曲线揭示 GMV 集中风险与头部依赖",
      paretoTitle: "Pareto 曲线 — 累计 Publisher % vs 累计 GMV %",
      tableTitle: "TopN 排名明细",
      publishers50: "50% GMV 所需", unit50: "个",
      cols: { rank: "#", name: "Publisher", gmv: "GMV", pct: "占比", cumPct: "累计" },
      derivation: {
        sortTitle: "排序规则", sortField: "total_revenue DESC",
        denominator: "Total GMV = sum(total_revenue)",
        thresholdTitle: "阈值说明", healthLine: "Top10 ≤ 50%",
        riskLine: "Top10 > 60%", coverage: "达到 50% GMV 所需最少 publisher 数",
      },
    },
    mixHealth: {
      title: "结构健康", subtitle: "GMV 类型分布与数量分布的健康度评估",
      gmvChartTitle: "GMV 类型占比", countChartTitle: "Publisher 数量 vs 目标",
      tableTitle: "类型结构明细", current: "当前", target: "目标",
      cols: { type: "类型", count: "数量", gmv: "GMV", gmvShare: "GMV 占比", targetPct: "目标区间", status: "状态" },
      statusLabels: { healthy: "健康", exceed: "超标", low: "偏低" },
      derivation: {
        mappingTitle: "映射规则", priority: "tag > publisher_type > parent_publisher_type",
        defaultMapping: "无法识别归入 Other", formulaTitle: "计算公式",
        gmvShare: "type_revenue / sum(total_revenue)", targetInterval: "基于行业 benchmark 设定",
      },
    },
    efficiency: {
      title: "效率象限", subtitle: "CPA vs AOV 四象限定位 Publisher 策略优先级",
      chartTitle: "CPA vs AOV 散点图", tableTitle: "Publisher 效率明细",
      cols: { name: "Publisher", type: "类型", cpa: "CPA", aov: "AOV", roi: "ROI", gmv: "GMV" },
      quadrant: {
        q1: "★ 高AOV 低CPA", q1sub: "加码投入", q2: "高AOV 高CPA", q2sub: "优化转化",
        q3: "低AOV 低CPA", q3sub: "批量扩展", q4: "低AOV 高CPA", q4sub: "治理/淘汰",
      },
      drawer: {
        recommended: "推荐动作", type: "类型", addAction: "加入行动计划",
        star: "★ 核心优质 Publisher — 建议提升佣金率加码合作",
        highValue: "高价值但成本偏高 — 建议优化转化路径降低 CPA",
        efficient: "效率型 Publisher — 适合批量扩展",
        review: "需评估合作性价比 — 建议启动治理流程",
      },
      derivation: {
        defsTitle: "指标定义", cpa: "total_commission / orders", aov: "total_revenue / orders",
        roi: "total_revenue / total_commission", dotSize: "按 GMV 缩放",
        stratTitle: "象限策略",
        highAovLowCpa: "★ 最优 — 加码投入", highAovHighCpa: "优化转化路径",
        lowAovLowCpa: "批量扩展", lowAovHighCpa: "治理或淘汰",
      },
    },
    approval: {
      title: "交易质量", subtitle: "Approval/Pending/Declined 分布与异常 Publisher 识别",
      waterfallTitle: "GMV 审批瀑布", riskTitle: "⚠ 高拒绝率 Publisher",
      tableTitle: "交易质量明细",
      tags: { fraud: "疑似欺诈", highDecline: "异常高拒", lowQuality: "质量偏低" },
      cols: { publisher: "Publisher", total: "Total GMV", approved: "Approved", pending: "Pending", declined: "Declined", approvalRate: "Approval %" },
      derivation: {
        defsTitle: "口径定义", approved: "approved_revenue 字段",
        pending: "pending_revenue 字段", declined: "declined_revenue 字段",
        approvalRate: "approved_revenue / total_revenue",
        thresholdTitle: "阈值", healthy: "Approval Rate ≥ 85%",
        watch: "70% ≤ Rate < 85%", risk: "Rate < 70%",
      },
    },
    operatingSystem: {
      title: "分层治理", subtitle: "四层金字塔模型，差异化运营策略",
      exportBtn: "导出 Tier 名单", strategy: "策略",
      tiers: {
        tier1: "Tier 1 — Hero", tier2: "Tier 2 — Growth",
        tier3: "Tier 3 — Long Tail", tier4: "Tier 4 — Inactive",
        tier1Strategy: "专属佣金率 + 联合内容 + 季度 QBR + 独家促销窗口",
        tier2Strategy: "阶梯佣金激励 + 内容模板支持 + 月度 Performance Review",
        tier3Strategy: "标准佣金 + 自动化邮件 Nurture + 季度批量激活活动",
        tier4Strategy: "季度激活邮件 + 连续 6 月无效自动清理 + 治理白名单排除",
      },
      derivation: {
        title: "分层规则", tier1: "Top contributors 达 50% GMV",
        tier2: "50%-80% GMV 区间", tier3: "active but < 80% 区间", tier4: "total_revenue = 0",
      },
    },
    actionPlan: {
      title: "行动计划", subtitle: "从分析到执行的行动闭环管理",
      generateAI: "AI 生成行动", generating: "生成中...",
      addAction: "新增行动", kanban: "看板", table: "表格",
      newActionDialog: "新增行动项", titleLabel: "标题", workstreamLabel: "Workstream",
      priorityLabel: "优先级", ownerLabel: "负责人", dueDateLabel: "截止日期",
      notesLabel: "备注", createBtn: "创建",
      noItems: "暂无行动项，点击\"新增行动\"开始", noItemsKanban: "暂无行动项",
      tableHeaders: { title: "标题", workstream: "Workstream", status: "状态", priority: "优先级", owner: "负责人", dueDate: "截止日期" },
      workstreams: {
        content_expansion: "内容扩张", deal_optimization: "Deal 优化", social_video: "社交视频",
        landing_page: "落地页", tier_management: "Tier 管理", governance: "治理", other: "其他",
      },
      priority: { high: "高", medium: "中", low: "低" },
    },
    timeline: {
      title: "甘特图与节点", subtitle: "12 个月行动时间线，叠加促销日历",
      tasks: {
        contentRecruit: "Content Creator 招募", dealCommission: "Deal 佣金结构调整",
        tier2Incubate: "Tier2 加速孵化", landingAbTest: "落地页 A/B 测试",
        q1Review: "Q1 Review 里程碑", socialVideoPilot: "社交视频 Pilot",
        governanceWhitelist: "治理白名单发布", h1Review: "H1 Performance Review",
        contentCheck: "Content 占比达标检查", annualRefresh: "年度策略刷新",
      },
      insights: [
        "营销日历与行动计划的叠加视图帮助识别资源冲突和协同机会，Spring Sale和Black Friday前应提前2-3个月启动Content招募",
        "品类营销节奏：时尚类Q1春季、Q4假日最强；科技类Black Friday、开学季；家居类春季装修、年末促销",
        "建议在大促前30天完成Tier2培育和Deal佣金调整，确保渠道有充分时间备货和推广",
        "里程碑节点(Q1 Review、H1 Performance Review)是策略校准的关键时机，需要对照KPI完成度决定资源再分配",
      ],
      problems: [
        "如果多个高优先级任务集中在同一时段，会导致资源争抢和执行质量下降，需要错峰安排",
        "大促期间(如Black Friday前后)不建议进行重大系统变更或治理动作，避免影响业务连续性",
        "Content类渠道通常需要2-3个月的内容制作周期，所以招募应该提前到Q1就启动",
        "如果年度策略刷新(Q4)发现KPI严重偏离，说明前期规划有问题，需要在H1就进行中期Review纠偏",
      ],
    },
    reportCenter: {
      title: "报告中心", subtitle: "0—10 章完整报告，支持多格式导出",
      generateFull: "生成完整报告", generating: "生成中...",
      boardSummary: "Board 摘要版", boardSummaryLabel: "Board 摘要",
      chapterNav: "章节目录", exportFormats: "导出格式",
      noContent: "点击\"生成完整报告\"后，此处将显示报告预览",
      noContentSub: "支持所见即所得编辑、图表替换、证据表嵌入",
      noContentText: "暂无内容",
      conclusion: "结论", keyFindings: "关键发现",
      status: { ready: "就绪", partial: "部分", missing: "缺数据" },
      toasts: {
        selectDataset: "请先选择数据集", generateSuccess: "报告生成完成", generateFail: "生成失败",
        downloadSuccess: "下载成功", downloadFail: "下载失败", boardSuccess: "Board 摘要已下载",
      },
      chapters: [
        { title: "Executive Summary", desc: "CEO 一页摘要，核心 KPI 与风险机会" },
        { title: "Activation & Funnel", desc: "激活率、Active Ratio、Core Driver 分析" },
        { title: "Concentration Analysis", desc: "Pareto 曲线、Top10 集中度、去集中度建议" },
        { title: "Mix Health", desc: "类型结构分布、目标区间对比、映射规则" },
        { title: "Efficiency Quadrant", desc: "CPA vs AOV 四象限分析、Publisher 效率排名" },
        { title: "Approval & Quality", desc: "审批瀑布、异常 Publisher 识别、治理建议" },
        { title: "Operating System", desc: "四层分级体系、差异化策略模板" },
        { title: "Action Plan", desc: "行动计划汇总、KPI 跟踪、Owner 分配" },
        { title: "Timeline & Milestones", desc: "12 个月甘特图（需 Daily GMV 补充完整）" },
        { title: "Website & Landing Page", desc: "官网分析（需联网抓取数据）" },
        { title: "Recommendations", desc: "总结性建议与下一步行动" },
      ],
    },
    dataCenter: {
      title: "数据中心", subtitle: "字段映射、分类规则编辑与复算日志",
      tabs: { fields: "字段映射", types: "分类映射", logs: "复算日志" },
      fieldEditor: "字段映射编辑器",
      mappedLabel: "已映射", reviewLabel: "待确认", unmappedLabel: "未映射",
      sourceField: "源字段", targetField: "目标字段", status: "状态",
      typeMappingRules: "分类映射规则", originalType: "原始类型", mappedType: "映射类型", rule: "规则",
      computeLogs: "复算日志", version: "版本", time: "时间", duration: "耗时",
      rows: "行数", notes: "备注", success: "成功", warning: "有警告",
    },
  },
  en: {
    nav: {
      overview: "Overview", input: "Input", activation: "Activation", concentration: "Concentration",
      mixHealth: "Mix Health", efficiency: "Efficiency", approval: "Approval",
      operatingSystem: "Operating System", actionPlan: "Action Plan", timeline: "Timeline",
      reportCenter: "Report Center", dataCenter: "Data Center",
    },
    common: {
      loading: "Loading...", noData: "No data", export: "Export", download: "Download",
      upload: "Upload", cancel: "Cancel", confirm: "Confirm", save: "Save", delete: "Delete",
      edit: "Edit", search: "Search", filter: "Filter", all: "All", selectDataset: "Select Dataset",
    },
    layout: { dataVersion: "Data Version", scrape: "Web Scrape" },
    shared: {
      readingGuide: "Reading Guide", dataInsights: "Data Insights", keyFindings: "Key Findings",
      issueInterpretation: "Issue Interpretation", needsAttention: "Needs Attention",
      derivationNotes: "Derivation Notes", copied: "Copied to clipboard",
      items: "items", showingFirst: "Showing first", of: "of",
      today: "Today", milestone: "Milestone", task: "Task", currentDate: "Current Date",
      promoCalendar: "Promo Calendar", publishers: "publishers",
      exceed: "Exceeds", watch: "Watch", healthy: "Healthy", low: "Below Target",
    },
    datasetSelector: {
      placeholder: "Select Dataset", completed: "Completed", failed: "Failed",
      pending: "Pending", unknown: "Unknown",
    },
    overview: {
      title: "Affiliate Growth Dashboard",
      subtitle: "Channel health & core risks at a glance",
      coreKpis: "Core KPIs", top3Risks: "Top 3 Risks", top3Opportunities: "Top 3 Opportunities",
      quickLinks: "Quick Links", generateReport: "Generate Full Report",
      labels: {
        totalPubs: "Total Publishers", activePubs: "Active Publishers",
        activeDef: "Active def: total_revenue > 0",
        contentGmv: "Content GMV", totalGmv: "Total GMV", dealGmv: "Deal/Coupon GMV",
      },
      quickLinkLabels: {
        activation: "Activation Funnel", concentration: "Concentration", mixHealth: "Mix Health",
        efficiency: "Efficiency Quadrant", approval: "Trade Quality", operatingSystem: "Tier Management",
        actionPlan: "Action Plan", input: "Data Input",
      },
      risks: {
        concentrationTitle: "High Publisher Concentration",
        concentrationAction: "Launch Tier2 incubation program, develop 5 new Core Drivers in 90 days",
        concentrationOwner: "BD Lead",
        dealTitle: "Deal/Coupon Structure Overweight",
        dealAction: "Increase Content commission by 2%, decrease Coupon commission by 1% to shift mix",
        dealOwner: "Program Manager",
        approvalTitle: "Low Transaction Approval Rate",
        approvalAction: "Launch governance review for high-decline publishers",
        approvalOwner: "Compliance",
      },
      opportunities: {
        contentTitle: "Content Channel Expansion Opportunity",
        contentAction: "Recruit 20 vertical Content Creators with dedicated landing pages and commission incentives",
        contentOwner: "Content Lead",
        activationTitle: "Activation Rate Improvement",
        activationAction: "Launch Publisher Activation Program with training and dedicated creative assets",
        activationOwner: "BD Lead",
        outputTitle: "Average Output Improvable",
        outputAction: "Optimize publisher development system with better tools and incentives",
        outputOwner: "Product",
      },
    },
    activation: {
      title: "Activation Funnel", subtitle: "Full view from Total to Active to Core Drivers",
      chartTitle: "Publisher Activation Funnel", tableTitle: "Active Publisher Details",
      cols: { name: "Publisher", type: "Type", gmv: "GMV", cpa: "CPA", status: "Status" },
      quantity: "Count",
      derivation: {
        defTitle: "Field Definitions", active: "total_revenue > 0",
        dedup: "PublisherID preferred, fallback to publisher_name",
        coreDriver: "Top contributors reaching 80% cumulative GMV",
        stepsTitle: "Calculation Steps",
        step1: "Filter total_revenue > 0 to get Active set",
        step2: "Sort by total_revenue desc",
        step3: "Cumulate to 80% to identify Core Drivers",
      },
    },
    concentration: {
      title: "Concentration Analysis", subtitle: "Pareto curve reveals GMV concentration risk and top dependency",
      paretoTitle: "Pareto Curve — Cumulative Publisher % vs Cumulative GMV %",
      tableTitle: "TopN Ranking Details",
      publishers50: "Publishers for 50% GMV", unit50: "",
      cols: { rank: "#", name: "Publisher", gmv: "GMV", pct: "Share", cumPct: "Cumulative" },
      derivation: {
        sortTitle: "Sort Rules", sortField: "total_revenue DESC",
        denominator: "Total GMV = sum(total_revenue)",
        thresholdTitle: "Thresholds", healthLine: "Top10 ≤ 50%",
        riskLine: "Top10 > 60%", coverage: "Min publishers to reach 50% GMV",
      },
    },
    mixHealth: {
      title: "Mix Health", subtitle: "GMV type distribution and publisher count health assessment",
      gmvChartTitle: "GMV by Type", countChartTitle: "Publisher Count vs Target",
      tableTitle: "Type Structure Details", current: "Current", target: "Target",
      cols: { type: "Type", count: "Count", gmv: "GMV", gmvShare: "GMV Share", targetPct: "Target Range", status: "Status" },
      statusLabels: { healthy: "Healthy", exceed: "Exceeds", low: "Below Target" },
      derivation: {
        mappingTitle: "Mapping Rules", priority: "tag > publisher_type > parent_publisher_type",
        defaultMapping: "Unrecognized mapped to Other", formulaTitle: "Formulas",
        gmvShare: "type_revenue / sum(total_revenue)", targetInterval: "Based on industry benchmarks",
      },
    },
    efficiency: {
      title: "Efficiency Quadrant", subtitle: "CPA vs AOV quadrant to prioritize publisher strategies",
      chartTitle: "CPA vs AOV Scatter Plot", tableTitle: "Publisher Efficiency Details",
      cols: { name: "Publisher", type: "Type", cpa: "CPA", aov: "AOV", roi: "ROI", gmv: "GMV" },
      quadrant: {
        q1: "★ High AOV Low CPA", q1sub: "Double Down", q2: "High AOV High CPA", q2sub: "Optimize CVR",
        q3: "Low AOV Low CPA", q3sub: "Scale Up", q4: "Low AOV High CPA", q4sub: "Review/Exit",
      },
      drawer: {
        recommended: "Recommended Action", type: "Type", addAction: "Add to Action Plan",
        star: "★ Top Publisher — Increase commission rate to scale",
        highValue: "High value but costly — optimize conversion path to reduce CPA",
        efficient: "Efficient Publisher — suitable for bulk scaling",
        review: "Review partnership ROI — consider governance process",
      },
      derivation: {
        defsTitle: "Metric Definitions", cpa: "total_commission / orders", aov: "total_revenue / orders",
        roi: "total_revenue / total_commission", dotSize: "Scaled by GMV",
        stratTitle: "Quadrant Strategy",
        highAovLowCpa: "★ Best — Double down", highAovHighCpa: "Optimize conversion path",
        lowAovLowCpa: "Scale in bulk", lowAovHighCpa: "Govern or exit",
      },
    },
    approval: {
      title: "Approval & Quality", subtitle: "Approved/Pending/Declined distribution and anomaly identification",
      waterfallTitle: "GMV Approval Waterfall", riskTitle: "⚠ High-Decline Publishers",
      tableTitle: "Transaction Quality Details",
      tags: { fraud: "Suspected Fraud", highDecline: "Abnormally High Decline", lowQuality: "Low Quality" },
      cols: { publisher: "Publisher", total: "Total GMV", approved: "Approved", pending: "Pending", declined: "Declined", approvalRate: "Approval %" },
      derivation: {
        defsTitle: "Field Definitions", approved: "approved_revenue field",
        pending: "pending_revenue field", declined: "declined_revenue field",
        approvalRate: "approved_revenue / total_revenue",
        thresholdTitle: "Thresholds", healthy: "Approval Rate ≥ 85%",
        watch: "70% ≤ Rate < 85%", risk: "Rate < 70%",
      },
    },
    operatingSystem: {
      title: "Operating System", subtitle: "Four-tier pyramid model with differentiated strategies",
      exportBtn: "Export Tier List", strategy: "Strategy",
      tiers: {
        tier1: "Tier 1 — Hero", tier2: "Tier 2 — Growth",
        tier3: "Tier 3 — Long Tail", tier4: "Tier 4 — Inactive",
        tier1Strategy: "Exclusive commission + Co-content + Quarterly QBR + Exclusive promo windows",
        tier2Strategy: "Tiered commission incentives + Content template support + Monthly Performance Review",
        tier3Strategy: "Standard commission + Automated email nurture + Quarterly bulk activation",
        tier4Strategy: "Quarterly activation emails + Auto-cleanup after 6 months + Governance whitelist",
      },
      derivation: {
        title: "Tier Rules", tier1: "Top contributors reaching 50% GMV",
        tier2: "50%-80% GMV range", tier3: "Active but below 80% range", tier4: "total_revenue = 0",
      },
    },
    actionPlan: {
      title: "Action Plan", subtitle: "Closed-loop action management from analysis to execution",
      generateAI: "AI Generate Actions", generating: "Generating...",
      addAction: "Add Action", kanban: "Kanban", table: "Table",
      newActionDialog: "New Action Item", titleLabel: "Title", workstreamLabel: "Workstream",
      priorityLabel: "Priority", ownerLabel: "Owner", dueDateLabel: "Due Date",
      notesLabel: "Notes", createBtn: "Create",
      noItems: "No action items. Click \"Add Action\" to start.", noItemsKanban: "No items",
      tableHeaders: { title: "Title", workstream: "Workstream", status: "Status", priority: "Priority", owner: "Owner", dueDate: "Due Date" },
      workstreams: {
        content_expansion: "Content Expansion", deal_optimization: "Deal Optimization",
        social_video: "Social/Video", landing_page: "Landing Page",
        tier_management: "Tier Management", governance: "Governance", other: "Other",
      },
      priority: { high: "High", medium: "Med", low: "Low" },
    },
    timeline: {
      title: "Gantt Chart & Milestones", subtitle: "12-month action timeline with promotional calendar",
      tasks: {
        contentRecruit: "Content Creator Recruitment", dealCommission: "Deal Commission Restructure",
        tier2Incubate: "Tier2 Accelerated Incubation", landingAbTest: "Landing Page A/B Test",
        q1Review: "Q1 Review Milestone", socialVideoPilot: "Social Video Pilot",
        governanceWhitelist: "Governance Whitelist Launch", h1Review: "H1 Performance Review",
        contentCheck: "Content Share Target Check", annualRefresh: "Annual Strategy Refresh",
      },
    },
    reportCenter: {
      title: "Report Center", subtitle: "Full report chapters 0-10, multi-format export",
      generateFull: "Generate Full Report", generating: "Generating...",
      boardSummary: "Board Summary", chapterNav: "Chapter Index", exportFormats: "Export Formats",
      noContent: "Click \"Generate Full Report\" to preview the report here",
      noContentSub: "Supports WYSIWYG editing, chart replacement, and evidence table embedding",
      conclusion: "Conclusion", keyFindings: "Key Findings",
      status: { ready: "Ready", partial: "Partial", missing: "Missing Data" },
      chapters: [
        { title: "Executive Summary", desc: "One-page CEO summary with core KPIs and risks/opportunities" },
        { title: "Activation & Funnel", desc: "Activation rate, Active Ratio, Core Driver analysis" },
        { title: "Concentration Analysis", desc: "Pareto curve, Top10 concentration, de-concentration recommendations" },
        { title: "Mix Health", desc: "Type structure distribution, target range comparison, mapping rules" },
        { title: "Efficiency Quadrant", desc: "CPA vs AOV four-quadrant analysis, publisher efficiency ranking" },
        { title: "Approval & Quality", desc: "Approval waterfall, anomalous publisher identification, governance recommendations" },
        { title: "Operating System", desc: "Four-tier system, differentiated strategy templates" },
        { title: "Action Plan", desc: "Action plan summary, KPI tracking, owner assignment" },
        { title: "Timeline & Milestones", desc: "12-month Gantt chart (requires Daily GMV for full completion)" },
        { title: "Website & Landing Page", desc: "Website analysis (requires web scraping data)" },
        { title: "Recommendations", desc: "Summary recommendations and next steps" },
      ],
    },
    dataCenter: {
      title: "Data Center", subtitle: "Field mapping, classification rules and recomputation logs",
      tabs: { fields: "Field Mapping", types: "Type Mapping", logs: "Compute Logs" },
      fieldEditor: "Field Mapping Editor",
      mappedLabel: "Mapped", reviewLabel: "Review", unmappedLabel: "Unmapped",
      sourceField: "Source Field", targetField: "Target Field", status: "Status",
      typeMappingRules: "Type Mapping Rules", originalType: "Original Type", mappedType: "Mapped Type", rule: "Rule",
      computeLogs: "Compute Logs", version: "Version", time: "Time", duration: "Duration",
      rows: "Rows", notes: "Notes", success: "Success", warning: "Warning",
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
    <LanguageContext.Provider value={{ language, toggleLanguage, t, translations: translations[language] }}>
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