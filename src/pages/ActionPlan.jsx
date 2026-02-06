import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, LayoutGrid, Table2, GripVertical, Calendar, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";

const statusConfig = {
  todo: { label: "To Do", bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-300" },
  doing: { label: "Doing", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-300" },
  done: { label: "Done", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300" },
};

const workstreamLabels = {
  content_expansion: "内容扩张",
  deal_optimization: "Deal 优化",
  social_video: "社交视频",
  landing_page: "落地页",
  tier_management: "Tier 管理",
  governance: "治理",
  other: "其他",
};

const priorityColors = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-600",
};

export default function ActionPlan() {
  const [view, setView] = useState("kanban");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newItem, setNewItem] = useState({ title: "", workstream: "other", priority: "medium", owner: "", due_date: "", notes: "" });

  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["actionItems"],
    queryFn: () => base44.entities.ActionItem.list("-created_date", 100),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ActionItem.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actionItems"] });
      setDialogOpen(false);
      setNewItem({ title: "", workstream: "other", priority: "medium", owner: "", due_date: "", notes: "" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ActionItem.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["actionItems"] }),
  });

  const kanbanColumns = ["todo", "doing", "done"];

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">行动计划</h1>
          <p className="text-sm text-slate-500 mt-1">从分析到执行的行动闭环管理</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button onClick={() => setView("kanban")} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === "kanban" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>
              <LayoutGrid className="w-3.5 h-3.5 inline mr-1" /> 看板
            </button>
            <button onClick={() => setView("table")} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === "table" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>
              <Table2 className="w-3.5 h-3.5 inline mr-1" /> 表格
            </button>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700">
                <Plus className="w-3.5 h-3.5" /> 新增行动
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>新增行动项</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>标题</Label>
                  <Input className="mt-1" value={newItem.title} onChange={(e) => setNewItem({ ...newItem, title: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Workstream</Label>
                    <Select value={newItem.workstream} onValueChange={(v) => setNewItem({ ...newItem, workstream: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(workstreamLabels).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>优先级</Label>
                    <Select value={newItem.priority} onValueChange={(v) => setNewItem({ ...newItem, priority: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">高</SelectItem>
                        <SelectItem value="medium">中</SelectItem>
                        <SelectItem value="low">低</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>负责人</Label>
                    <Input className="mt-1" value={newItem.owner} onChange={(e) => setNewItem({ ...newItem, owner: e.target.value })} />
                  </div>
                  <div>
                    <Label>截止日期</Label>
                    <Input type="date" className="mt-1" value={newItem.due_date} onChange={(e) => setNewItem({ ...newItem, due_date: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>备注</Label>
                  <Textarea className="mt-1" value={newItem.notes} onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })} />
                </div>
                <Button onClick={() => createMutation.mutate(newItem)} disabled={!newItem.title || createMutation.isPending} className="w-full bg-blue-600 hover:bg-blue-700">
                  创建
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {kanbanColumns.map((col) => {
            const colItems = items.filter((i) => i.status === col);
            const cfg = statusConfig[col];
            return (
              <div key={col} className={`rounded-2xl border ${cfg.border} p-4 min-h-[300px]`} style={{ borderColor: "transparent", background: col === "todo" ? "#F8FAFC" : col === "doing" ? "#EFF6FF" : "#F0FDF4" }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`text-sm font-semibold ${cfg.text}`}>{cfg.label}</h3>
                  <Badge className={`${cfg.bg} ${cfg.text} text-[10px]`}>{colItems.length}</Badge>
                </div>
                <div className="space-y-2">
                  {colItems.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-1.5">
                        <p className="text-sm font-medium text-slate-800 leading-snug">{item.title}</p>
                        <Badge className={`${priorityColors[item.priority]} text-[9px] ml-2 flex-shrink-0`}>
                          {item.priority === "high" ? "高" : item.priority === "medium" ? "中" : "低"}
                        </Badge>
                      </div>
                      {item.workstream && (
                        <p className="text-[11px] text-slate-400 mb-2">{workstreamLabels[item.workstream] || item.workstream}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          {item.owner && (
                            <span className="flex items-center gap-0.5"><User className="w-3 h-3" /> {item.owner}</span>
                          )}
                          {item.due_date && (
                            <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" /> {item.due_date}</span>
                          )}
                        </div>
                        <Select
                          value={item.status}
                          onValueChange={(v) => updateMutation.mutate({ id: item.id, data: { status: v } })}
                        >
                          <SelectTrigger className="h-6 w-16 text-[10px] border-0 bg-transparent p-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todo">To Do</SelectItem>
                            <SelectItem value="doing">Doing</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </motion.div>
                  ))}
                  {colItems.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-8">暂无行动项</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">标题</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Workstream</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">状态</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">优先级</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">负责人</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">截止日期</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-800">{item.title}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{workstreamLabels[item.workstream] || item.workstream}</td>
                  <td className="px-4 py-3">
                    <Badge className={`${statusConfig[item.status]?.bg} ${statusConfig[item.status]?.text} text-[10px]`}>
                      {statusConfig[item.status]?.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={`${priorityColors[item.priority]} text-[10px]`}>
                      {item.priority === "high" ? "高" : item.priority === "medium" ? "中" : "低"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{item.owner || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{item.due_date || "—"}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm">暂无行动项，点击"新增行动"开始</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}