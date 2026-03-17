async function parseJsonResponse(response) {
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response.");
  }
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`OpenAI returned invalid JSON: ${error.message}`);
  }
}

async function parseTextResponse(response) {
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response.");
  }
  return content;
}

function extractResponsesText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const outputs = Array.isArray(data?.output) ? data.output : [];
  for (const item of outputs) {
    if (Array.isArray(item?.content)) {
      for (const content of item.content) {
        if (typeof content?.text === "string" && content.text.trim()) {
          return content.text.trim();
        }
      }
    }
    if (typeof item?.text === "string" && item.text.trim()) {
      return item.text.trim();
    }
  }

  throw new Error("OpenAI Responses API returned an empty response.");
}

export async function openAiJson({ system, prompt, schema, schemaName, temperature = 0.2 }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: schemaName,
          schema,
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${message}`);
  }

  return parseJsonResponse(response);
}

export async function openAiText({ system, prompt, temperature = 0.2 }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${message}`);
  }

  return parseTextResponse(response);
}

export async function openAiWebJson({
  system,
  prompt,
  schema,
  schemaName,
  temperature = 0.2,
  searchContextSize = "medium",
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_RESEARCH_MODEL || process.env.OPENAI_MODEL || "gpt-5-mini",
      temperature,
      tool_choice: "auto",
      tools: [
        {
          type: "web_search",
          search_context_size: searchContextSize,
          user_location: {
            type: "approximate",
            country: "US",
            timezone: "America/Los_Angeles",
          },
        },
      ],
      input: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          schema,
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI web research request failed (${response.status}): ${message}`);
  }

  const data = await response.json();
  const content = extractResponsesText(data);

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`OpenAI web research returned invalid JSON: ${error.message}`);
  }
}

export async function openAiTranslations({ items, targetLanguage }) {
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      translations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            source: { type: "string" },
            translated: { type: "string" },
          },
          required: ["source", "translated"],
        },
      },
    },
    required: ["translations"],
  };

  return openAiJson({
    system:
      "You translate affiliate marketing dashboard copy. Preserve numbers, brand names, product names, KPI abbreviations, URLs, and IDs. Return concise natural translations only.",
    prompt: `Translate each item into ${targetLanguage === "zh" ? "Simplified Chinese" : "English"}.\nReturn one translated string for each source string.\n\n${JSON.stringify(items)}`,
    schema,
    schemaName: "dashboard_translations",
    temperature: 0,
  });
}
