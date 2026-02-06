import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function InsightsPanel({ insights = [], problems = [] }) {
  const [expanded, setExpanded] = useState(true);

  if (insights.length === 0 && problems.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 border-t border-slate-200 pt-8">
      <div
        className="flex items-center justify-between cursor-pointer mb-4"
        onClick={() => setExpanded(!expanded)}
      >
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          阅读指南
        </h2>
        <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 数据洞察 */}
              {insights.length > 0 && (
                <Card className="p-5 bg-gradient-to-br from-blue-50 to-white border-blue-200">
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="w-4 h-4 text-blue-600" />
                    <h3 className="font-semibold text-blue-900">数据洞察</h3>
                    <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-200">
                      关键发现
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {insights.map((insight, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                        <p className="text-sm text-slate-700 leading-relaxed">{insight}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* 问题解读 */}
              {problems.length > 0 && (
                <Card className="p-5 bg-gradient-to-br from-amber-50 to-white border-amber-200">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <h3 className="font-semibold text-amber-900">问题解读</h3>
                    <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-200">
                      需要关注
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {problems.map((problem, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                        <p className="text-sm text-slate-700 leading-relaxed">{problem}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}