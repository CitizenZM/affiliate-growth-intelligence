import React, { useState } from "react";
import { ChevronDown, ChevronUp, Download, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function EvidenceTable({ title = "证据表", columns = [], data = [], derivationNotes }) {
  const [expanded, setExpanded] = useState(false);

  const handleCopyNotes = () => {
    if (derivationNotes) {
      navigator.clipboard.writeText(typeof derivationNotes === "string" ? derivationNotes : JSON.stringify(derivationNotes, null, 2));
      toast.success("推导备注已复制");
    }
  };

  const handleExport = () => {
    const csv = [columns.map(c => c.label).join(","), ...data.map(row => columns.map(c => row[c.key] ?? "").join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {title}
          <span className="text-xs text-slate-400 font-normal">({data.length} 条)</span>
        </button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400" onClick={handleExport}>
            <Download className="w-3 h-3 mr-1" /> 导出
          </Button>
          {derivationNotes && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400" onClick={handleCopyNotes}>
              <Copy className="w-3 h-3 mr-1" /> 推导备注
            </Button>
          )}
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-xl border border-slate-200 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    {columns.map((col) => (
                      <TableHead key={col.key} className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                        {col.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.slice(0, 20).map((row, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-50/50">
                      {columns.map((col) => (
                        <TableCell key={col.key} className="text-xs text-slate-700 whitespace-nowrap">
                          {col.render ? col.render(row[col.key], row) : row[col.key]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data.length > 20 && (
                <div className="px-4 py-2 text-xs text-slate-400 border-t bg-slate-50">
                  显示前 20 条，共 {data.length} 条
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}