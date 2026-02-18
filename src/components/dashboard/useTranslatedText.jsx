import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/LanguageContext";

const translationCache = {};

function isChinese(text) {
  return /[\u4e00-\u9fff]/.test(text);
}

async function translateText(text) {
  if (!text || !isChinese(text)) return text;
  if (translationCache[text]) return translationCache[text];

  try {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Translate this Chinese affiliate marketing text to English, concise and professional (keep names/IDs as-is, max 12 words): "${text}"`,
    });
    const translated = typeof result === "string" ? result.trim().replace(/^["']|["']$/g, "") : text;
    translationCache[text] = translated;
    return translated;
  } catch {
    return text;
  }
}

/**
 * Translates an array of items' text fields when language is 'en'.
 * Returns items with translated fields.
 */
export function useTranslatedItems(items, fields = ["title", "notes"]) {
  const { language } = useLanguage();
  const [translated, setTranslated] = useState(items);
  const prevLang = useRef(language);
  const prevItems = useRef(null);

  useEffect(() => {
    if (language === "zh") {
      setTranslated(items);
      prevLang.current = language;
      return;
    }

    // Check if anything needs translating
    const needsTranslation = items.some(item =>
      fields.some(f => item[f] && isChinese(item[f]))
    );

    if (!needsTranslation && prevLang.current === language) {
      setTranslated(items);
      return;
    }

    prevLang.current = language;

    async function doTranslate() {
      const result = await Promise.all(
        items.map(async (item) => {
          const updated = { ...item };
          for (const field of fields) {
            if (item[field] && isChinese(item[field])) {
              updated[field] = await translateText(item[field]);
            }
          }
          return updated;
        })
      );
      setTranslated(result);
    }

    doTranslate();
  }, [items, language]);

  // Keep in sync when items change
  useEffect(() => {
    if (language === "zh") {
      setTranslated(items);
    }
  }, [items]);

  return translated;
}