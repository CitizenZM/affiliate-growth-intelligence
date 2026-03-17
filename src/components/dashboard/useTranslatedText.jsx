import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useLanguage } from "@/components/LanguageContext";

const translationCache = {};
const NON_TRANSLATABLE_KEYS = new Set([
  "url",
  "domain",
  "linkPage",
  "cluster_type",
  "type",
  "tone",
  "section",
  "confidence",
  "research_mode",
  "source_type",
]);

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

function collectTranslatableStrings(value, path = []) {
  if (!value) return [];

  if (typeof value === "string") {
    const key = path[path.length - 1];
    if (NON_TRANSLATABLE_KEYS.has(key)) return [];
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectTranslatableStrings(item, path));
  }

  if (typeof value === "object") {
    return Object.entries(value).flatMap(([key, nested]) => collectTranslatableStrings(nested, [...path, key]));
  }

  return [];
}

function applyTranslationsDeep(value, translations, path = []) {
  if (!value) return value;

  if (typeof value === "string") {
    const key = path[path.length - 1];
    if (NON_TRANSLATABLE_KEYS.has(key)) return value;
    return translations[value] || value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => applyTranslationsDeep(item, translations, path));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, applyTranslationsDeep(nested, translations, [...path, key])])
    );
  }

  return value;
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
      const sourceTexts = sections.flatMap((section) => collectTranslatableStrings({
        title: section.title,
        conclusion: section.conclusion,
        content_md: section.content_md,
        key_findings: section.key_findings || [],
        summary_cards: section.summary_cards || [],
        content_blocks: section.content_blocks || [],
        tables: section.tables || [],
        citations: section.citations || [],
      })).filter(Boolean);

      const translations = await translateBatchForLanguage(sourceTexts, language);
      const result = sections.map((section) => applyTranslationsDeep(section, translations));

      if (!cancelled) setTranslated(result);
    }

    doTranslate();
    return () => {
      cancelled = true;
    };
  }, [sectionsSignature, language]);

  return translated;
}
