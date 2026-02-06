import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function FilePreview({ data, headers, fileType }) {
  const previewRows = data.slice(0, 10);
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">数据预览</h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {fileType.toUpperCase()}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {data.length} 行数据
          </Badge>
        </div>
      </div>
      
      <ScrollArea className="h-[400px] rounded-xl border border-slate-200">
        <Table>
          <TableHeader className="sticky top-0 bg-slate-50 z-10">
            <TableRow>
              <TableHead className="w-12 text-xs font-semibold text-slate-500">#</TableHead>
              {headers.map((header, i) => (
                <TableHead key={i} className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {previewRows.map((row, idx) => (
              <TableRow key={idx} className="hover:bg-slate-50/50">
                <TableCell className="text-xs text-slate-400 font-mono">{idx + 1}</TableCell>
                {headers.map((header, i) => (
                  <TableCell key={i} className="text-xs text-slate-700 whitespace-nowrap">
                    {row[header] || <span className="text-slate-300">—</span>}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
      
      {data.length > 10 && (
        <p className="text-xs text-slate-400 text-center">
          显示前 10 行，共 {data.length} 行数据
        </p>
      )}
    </div>
  );
}