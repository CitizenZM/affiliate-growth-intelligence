import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";

const TARGET_FIELDS = [
  { key: "publisher_id", label: "Publisher ID", required: false },
  { key: "publisher_name", label: "Publisher Name", required: true },
  { key: "publisher_type", label: "Publisher Type", required: false },
  { key: "total_revenue", label: "Total Revenue", required: true },
  { key: "total_commission", label: "Commission", required: false },
  { key: "clicks", label: "Clicks", required: false },
  { key: "orders", label: "Orders", required: false },
  { key: "approved_revenue", label: "Approved Revenue", required: false },
  { key: "pending_revenue", label: "Pending Revenue", required: false },
  { key: "declined_revenue", label: "Declined Revenue", required: false },
  { key: "aov", label: "AOV", required: false },
  { key: "cvr", label: "CVR", required: false },
];

export default function FieldMapper({ headers, mapping, onChange }) {
  const mappedCount = Object.values(mapping).filter(Boolean).length;
  const requiredMapped = TARGET_FIELDS.filter(f => f.required).every(f => 
    Object.values(mapping).includes(f.key)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">字段映射</h3>
        <div className="flex items-center gap-2">
          {requiredMapped ? (
            <Badge className="bg-emerald-50 text-emerald-700 text-xs gap-1">
              <CheckCircle2 className="w-3 h-3" />
              必填字段已映射
            </Badge>
          ) : (
            <Badge className="bg-amber-50 text-amber-700 text-xs gap-1">
              <AlertCircle className="w-3 h-3" />
              缺少必填字段
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            已映射 {mappedCount}/{headers.length}
          </Badge>
        </div>
      </div>

      <div className="bg-slate-50 rounded-xl p-4 space-y-3">
        <p className="text-xs text-slate-500">
          将上传文件的列名映射到系统字段。<span className="text-red-500">*</span> 标记为必填字段。
        </p>
        
        <div className="space-y-2">
          {headers.map((header, idx) => {
            const targetField = TARGET_FIELDS.find(f => f.key === mapping[header]);
            return (
              <div key={idx} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-slate-200">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{header}</p>
                  <p className="text-xs text-slate-400">源字段</p>
                </div>
                
                <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                
                <div className="flex-1">
                  <Select 
                    value={mapping[header] || "skip"} 
                    onValueChange={(value) => onChange(header, value === "skip" ? null : value)}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip" className="text-xs text-slate-400">
                        跳过此字段
                      </SelectItem>
                      {TARGET_FIELDS.map(field => (
                        <SelectItem key={field.key} value={field.key} className="text-xs">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}