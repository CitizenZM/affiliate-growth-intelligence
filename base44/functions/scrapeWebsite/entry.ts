import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { website_url, dataset_id } = await req.json();

    if (!website_url) {
      return Response.json({ error: 'website_url is required' }, { status: 400 });
    }

    // Fetch website content
    const websiteContent = await fetch(`https://r.jina.ai/${website_url}`, {
      headers: { 'Accept': 'application/json' }
    }).then(r => r.json());

    // Use AI to extract structured information
    const extractedInfo = await base44.integrations.Core.InvokeLLM({
      prompt: `分析以下电商网站内容，提取关键信息：

网站URL: ${website_url}
网站内容: ${websiteContent.content || ''}

请提取并返回以下信息：
1. 品牌名称
2. 主要产品类别
3. 价格带区间（最低价-最高价）
4. 是否有促销活动（是/否）
5. 促销机制描述
6. 信任组件（如评价数量、保障服务等）
7. 主要卖点

请以结构化JSON格式返回。`,
      response_json_schema: {
        type: "object",
        properties: {
          brand_name: { type: "string" },
          product_categories: { type: "array", items: { type: "string" } },
          price_range: { 
            type: "object",
            properties: {
              min: { type: "number" },
              max: { type: "number" },
              currency: { type: "string" }
            }
          },
          has_promotion: { type: "boolean" },
          promotion_description: { type: "string" },
          trust_elements: { type: "array", items: { type: "string" } },
          key_selling_points: { type: "array", items: { type: "string" } }
        }
      }
    });

    // Store the scraped data
    if (dataset_id) {
      await base44.asServiceRole.entities.DataUpload.update(dataset_id, {
        website_scrape_data: extractedInfo
      });
    }

    return Response.json({
      success: true,
      data: extractedInfo,
      raw_content_preview: websiteContent.content?.substring(0, 500) || ''
    });

  } catch (error) {
    console.error('Website scraping error:', error);
    return Response.json({ 
      error: error.message,
      details: 'Failed to scrape website'
    }, { status: 500 });
  }
});