import React from "react";
import { Copy, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLanguage } from "@/components/LanguageContext";

function normalizeNotes(notes) {
  return (Array.isArray(notes) ? notes : [])
    .map((note, index) => {
      if (typeof note === "string") {
        return {
          title: index === 0 ? "Notes" : `Notes ${index + 1}`,
          items: [{ label: "Detail", value: note }],
        };
      }

      if (!note || typeof note !== "object") {
        return null;
      }

      const title = note.title || `Notes ${index + 1}`;
      if (Array.isArray(note.items)) {
        return {
          title,
          items: note.items
            .filter(Boolean)
            .map((item, itemIndex) => {
              if (typeof item === "string") {
                return { label: `Item ${itemIndex + 1}`, value: item };
              }

              return {
                label: item?.label || `Item ${itemIndex + 1}`,
                value: item?.value ?? "",
              };
            }),
        };
      }

      if ("value" in note || "label" in note) {
        return {
          title,
          items: [{ label: note.label || "Detail", value: note.value ?? "" }],
        };
      }

      return {
        title,
        items: Object.entries(note)
          .filter(([key]) => key !== "title")
          .map(([key, value]) => ({
            label: key,
            value: typeof value === "string" ? value : JSON.stringify(value),
          })),
      };
    })
    .filter((note) => note && note.items.length > 0);
}

export default function DerivationPanel({ notes = [] }) {
  const { t } = useLanguage();
  const normalizedNotes = normalizeNotes(notes);
  const handleCopy = (format) => {
    const text = format === "json"
      ? JSON.stringify(normalizedNotes, null, 2)
      : normalizedNotes.map(n => `## ${n.title}\n${n.items.map(i => `- **${i.label}**: ${i.value}`).join("\n")}`).join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success(t('shared.copied'));
  };

  if (!normalizedNotes.length) return null;

  return (
    <div className="bg-slate-50/50 rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700">{t('shared.derivationNotes')}</h3>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-6 text-[11px] text-slate-400" onClick={() => handleCopy("md")}>
            <Copy className="w-3 h-3 mr-1" /> MD
          </Button>
          <Button variant="ghost" size="sm" className="h-6 text-[11px] text-slate-400" onClick={() => handleCopy("json")}>
            <Copy className="w-3 h-3 mr-1" /> JSON
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        {normalizedNotes.map((section, i) => (
          <div key={i}>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{section.title}</p>
            <div className="space-y-1">
              {section.items.map((item, j) => (
                <div key={j} className="flex gap-2 text-xs">
                  <span className="text-slate-400 font-medium min-w-[80px]">{item.label}:</span>
                  <span className="text-slate-600">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
