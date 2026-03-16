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
