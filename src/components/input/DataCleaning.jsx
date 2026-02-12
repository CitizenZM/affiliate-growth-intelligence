import React from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Filter, TrendingUp } from "lucide-react";

export default function DataCleaning({ options, onChange }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-700">数据清洗选项</h3>
      
      <div className="space-y-3">
        {/* Remove duplicates */}
        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200">
          <div className="flex items-start gap-3">
            <Trash2 className="w-4 h-4 text-slate-400 mt-0.5" />
            <div>
              <Label className="text-sm font-medium text-slate-700">去重</Label>
              <p className="text-xs text-slate-400 mt-0.5">
                基于 Publisher ID/Name 去除重复记录
              </p>
            </div>
          </div>
          <Switch 
            checked={options.removeDuplicates} 
            onCheckedChange={(v) => onChange({ ...options, removeDuplicates: v })} 
          />
        </div>

        {/* Handle missing values */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <Filter className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <Label className="text-sm font-medium text-slate-700">缺失值处理</Label>
                <p className="text-xs text-slate-400 mt-0.5">
                  选择如何处理数据中的空值
                </p>
              </div>
            </div>
            <Switch 
              checked={options.handleMissing} 
              onCheckedChange={(v) => onChange({ ...options, handleMissing: v })} 
            />
          </div>
          
          {options.handleMissing && (
            <div className="pl-7 space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-slate-500 w-24">数值字段</Label>
                <Select 
                  value={options.missingNumeric} 
                  onValueChange={(v) => onChange({ ...options, missingNumeric: v })}
                >
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zero" className="text-xs">填充为 0</SelectItem>
                    <SelectItem value="skip" className="text-xs">跳过该行</SelectItem>
                    <SelectItem value="keep" className="text-xs">保留空值</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <Label className="text-xs text-slate-500 w-24">文本字段</Label>
                <Select 
                  value={options.missingText} 
                  onValueChange={(v) => onChange({ ...options, missingText: v })}
                >
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown" className="text-xs">填充为 "Unknown"</SelectItem>
                    <SelectItem value="skip" className="text-xs">跳过该行</SelectItem>
                    <SelectItem value="keep" className="text-xs">保留空值</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* Filter low values */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <Label className="text-sm font-medium text-slate-700">过滤低值数据</Label>
                <p className="text-xs text-slate-400 mt-0.5">
                  移除 GMV 低于阈值的记录
                </p>
              </div>
            </div>
            <Switch 
              checked={options.filterLowGMV} 
              onCheckedChange={(v) => onChange({ ...options, filterLowGMV: v })} 
            />
          </div>
          
          {options.filterLowGMV && (
            <div className="pl-7">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-slate-500">最小 GMV</Label>
                <input
                  type="number"
                  value={options.minGMV || 0}
                  onChange={(e) => onChange({ ...options, minGMV: parseFloat(e.target.value) })}
                  className="flex-1 h-8 px-2 text-xs border border-slate-200 rounded-md"
                  placeholder="0"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}