import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../../utils";
import { AlertTriangle, Sparkles, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function RiskOpportunityCard({ type = "risk", title, trigger, action, owner, deadline, linkPage }) {
  const isRisk = type === "risk";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        rounded-xl border p-4 transition-all duration-200 hover:shadow-md cursor-pointer
        ${isRisk ? "border-red-100 bg-gradient-to-br from-white to-red-50/40" : "border-blue-100 bg-gradient-to-br from-white to-blue-50/40"}
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${isRisk ? "bg-red-100" : "bg-blue-100"}`}>
          {isRisk ? (
            <AlertTriangle className="w-4 h-4 text-red-600" />
          ) : (
            <Sparkles className="w-4 h-4 text-blue-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-slate-800 mb-1">{title}</h4>
          <p className="text-xs text-slate-500 mb-2 line-clamp-2">{trigger}</p>
          
          <div className="bg-white/70 rounded-lg p-2.5 border border-slate-100 mb-2">
            <p className="text-xs font-medium text-slate-700">{action}</p>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              {owner && <span>负责人: <span className="text-slate-600 font-medium">{owner}</span></span>}
              {deadline && <span>截止: <span className="text-slate-600 font-medium">{deadline}</span></span>}
            </div>
            {linkPage && (
              <Link to={createPageUrl(linkPage)} className="text-blue-600 hover:text-blue-700">
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}