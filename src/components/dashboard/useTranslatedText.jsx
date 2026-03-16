import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/LanguageContext";

const translationCache = {};

function isChinese(text) {
  return /[\u4e00-\u9fff]/.test(text);
}

async function translateText(text) {
  if (!text || !isChinese(text)) return text;
  if (translationCache[`en:${text}`]) return translationCache[`en:${text}`];

  try {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Translate this Chinese affiliate marketing text to English, concise and professional (keep names/IDs as-is, max 12 words): "${text}"`,
    });
    const translated = typeof result === "string" ? result.trim().replace(/^["']|["']$/g, "") : text;
    translationCache[`en:${text}`] = translated;
    return translated;
  } catch {
    return text;
  }
}

async function translateTextForLanguage(text, language) {
  if (!text || typeof text !== "string") return text;
  const hasChinese = isChinese(text);
  const hasLatin = /[A-Za-z]/.test(text);
  const needsTranslation = (language === "en" && hasChinese) || (language === "zh" && hasLatin);
  if (!needsTranslation) return text;

  const cacheKey = `${language}:${text}`;
  if (translationCache[cacheKey]) return translationCache[cacheKey];

  try {
    const prompt =
      language === "en"
        ? `Translate this affiliate marketing text to English. Keep names, brands, IDs, KPI abbreviations, and numbers unchanged. Return only translated text: "${text}"`
        : `Translate this affiliate marketing text to Simplified Chinese. Keep names, brands, IDs, KPI abbreviations, and numbers unchanged. Return only translated text: "${text}"`;
    const result = await base44.integrations.Core.InvokeLLM({ prompt });
    const translated = typeof result === "string" ? result.trim().replace(/^["']|["']$/g, "") : text;
    translationCache[cacheKey] = translated;
    return translated;
  } catch {
    return text;
  }
}

async function translateBatchForLanguage(texts, language) {
  const uniqueTexts = [...new Set(
    texts.filter((text) => {
      if (!text || typeof text !== "string") return false;
      const hasChinese = isChinese(text);
      const hasLatin = /[A-Za-z]/.test(text);
      return (language === "en" && hasChinese) || (language === "zh" && hasLatin);
    })
  )];

  if (!uniqueTexts.length) return {};

  const uncached = uniqueTexts.filter((text) => !translationCache[`${language}:${text}`]);
  if (uncached.length) {
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        language,
        translation_items: uncached,
      });

      if (Array.isArray(result)) {
        result.forEach((item, index) => {
          const source = item?.source || uncached[index];
          const translated = item?.translated || source;
          translationCache[`${language}:${source}`] = translated;
        });
      }
    } catch {
      uncached.forEach((text) => {
        translationCache[`${language}:${text}`] = text;
      });
    }
  }

  return uniqueTexts.reduce((acc, text) => {
    acc[text] = translationCache[`${language}:${text}`] || text;
    return acc;
  }, {});
}

/**
 * Translates an array of items' text fields when language is 'en'.
 * Returns items with translated fields.
 */
export function useTranslatedItems(items, fields = ["title", "notes"]) {
  const { language } = useLanguage();
  const [translated, setTranslated] = useState(items);
  const fieldsKey = useMemo(() => fields.join("|"), [fields]);
  const itemsSignature = useMemo(() => JSON.stringify(items), [items]);

  useEffect(() => {
    const sourceTexts = items.flatMap((item) => fields.map((field) => item?.[field]).filter(Boolean));
    const needsTranslation = sourceTexts.some((text) =>
      (language === "en" && isChinese(text)) || (language === "zh" && /[A-Za-z]/.test(text))
    );

    if (!needsTranslation) {
      setTranslated(items);
      return;
    }

    async function doTranslate() {
      const translations = await translateBatchForLanguage(sourceTexts, language);
      const result = items.map((item) => {
        const updated = { ...item };
        for (const field of fields) {
          if (typeof item[field] === "string") {
            updated[field] = translations[item[field]] || item[field];
          }
        }
        return updated;
      });
      setTranslated(result);
    }

    doTranslate();
  }, [itemsSignature, fieldsKey, language]);

  return translated;
}

export function useTranslatedReportSections(sections = []) {
  const { language } = useLanguage();
  const [translated, setTranslated] = useState(sections);
  const sectionsSignature = useMemo(() => JSON.stringify(sections), [sections]);

  useEffect(() => {
    let cancelled = false;

    async function doTranslate() {
      const sourceTexts = sections.flatMap((section) => [
        section.title,
        section.conclusion,
        section.content_md,
        ...(section.key_findings || []).flatMap((finding) => {
          if (typeof finding === "string") return [finding];
          return [finding?.title, finding?.trigger, finding?.action, finding?.owner, finding?.deadline];
        }),
      ]).filter(Boolean);

      const translations = await translateBatchForLanguage(sourceTexts, language);
      const result = sections.map((section) => ({
        ...section,
        title: translations[section.title] || section.title,
        conclusion: translations[section.conclusion] || section.conclusion,
        content_md: translations[section.content_md] || section.content_md,
        key_findings: (section.key_findings || []).map((finding) => {
          if (typeof finding === "string") {
            return translations[finding] || finding;
          }
          return {
            ...finding,
            title: translations[finding.title] || finding.title,
            trigger: translations[finding.trigger] || finding.trigger,
            action: translations[finding.action] || finding.action,
            owner: translations[finding.owner] || finding.owner,
            deadline: translations[finding.deadline] || finding.deadline,
            linkPage: finding.linkPage,
          };
        }),
      }));

      if (!cancelled) setTranslated(result);
    }

    doTranslate();
    return () => {
      cancelled = true;
    };
  }, [sectionsSignature, language]);

  return translated;
}
