import { Settings, CreationRequest } from './types';

export async function callAI(
    settings: Settings,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string | any }>
): Promise<string> {
    if (!settings.apiKey || !settings.baseUrl) {
        throw new Error('API配置未完成，请前往设置页面配置');
    }

    const response = await fetch(`${settings.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
            model: settings.model || 'gpt-4o',
            messages,
            temperature: 0.7,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`AI调用失败: ${response.status} ${error}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
}

// 将图片 URL 转换为 base64
async function imageUrlToBase64(imageUrl: string): Promise<string> {
    try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('图片转换 base64 失败:', error);
        throw error;
    }
}

// 识别图片中的文字内容
export async function recognizeImage(settings: Settings, imageUrl: string): Promise<string> {
    if (!settings.apiKey || !settings.baseUrl) {
        throw new Error('API配置未完成，请前往设置页面配置');
    }

    const prompt = `请仔细分析这张图片，提取其中的所有文字内容。
要求：
1. 完整提取图片中的所有文字，保持原有的排版和段落结构
2. 如果是多图拼接，请按图片顺序整理文字
3. 忽略水印、装饰性文字
4. 只返回提取的文字内容，不要添加任何额外说明`;

    // 将图片转换为 base64，避免 API 服务器无法访问外部图片 URL
    let imageData = imageUrl;
    try {
        imageData = await imageUrlToBase64(imageUrl);
        console.log('图片已转换为 base64');
    } catch (error) {
        console.warn('图片转换失败，尝试直接使用 URL:', error);
        // 如果转换失败，尝试直接使用 URL
    }

    const result = await callAI(settings, [
        {
            role: 'user',
            content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageData } }
            ]
        }
    ]);

    return result;
}

// 默认摘要规则 - 导出以便在设置页面使用
export const defaultSummaryRules = `1. **核心摘要**：
   - 保留原文的核心论点和关键细节，不限制字数
   - 如果有具体的方法、步骤、规则，必须完整保留
   - 保留数据、示例、对比等重要信息
   - 保持原文的逻辑结构和重点层次
   - 根据内容复杂度决定摘要长度，宁可详细也不要丢失重点

   特别注意：
   - 如果原文包含具体的操作指令、提示词、配置项等，必须完整保留
   - 如果原文有列举的要点（如：删除、假设、输出、禁止等），必须列出所有要点
   - 不要用"介绍了XX"这种过于概括的表达，要说明具体内容是什么
   - 对于干货内容，摘要可以更长，确保不遗漏关键信息

2. **关键词提取**（3-5个）：
   - 提取最核心的主题词
   - 优先选择专业术语和核心概念
   - 避免过于宽泛的词汇

3. **情感分析**：
   - positive: 积极、正面、乐观的内容
   - neutral: 客观陈述、中立观点
   - negative: 批评、负面、消极的内容

4. **内容分类**（选择最匹配的一个）：
   - 技术：编程、开发、工具、框架、技术方案
   - 产品：产品设计、功能特性、用户体验、产品思考
   - 营销：市场策略、增长方法、推广技巧、销售经验
   - 资讯：行业新闻、事件报道、趋势动态
   - 观点：个人见解、深度思考、评论分析
   - 生活：日常分享、生活感悟、娱乐内容
   - 其他：不属于以上类别`;

export async function summarizeTweet(settings: Settings, content: string): Promise<{
    summary: string;
    keywords: string[];
    sentiment: 'positive' | 'neutral' | 'negative';
    category: string;
}> {
    // 使用用户自定义提示词或默认提示词
    const summaryRules = settings.customSummaryPrompt || defaultSummaryRules;

    const prompt = `作为一个专业的内容分析助手，请分析以下推文/笔记内容，提供精准的摘要和分类：

任务要求：
${summaryRules}

原始内容：
${content}

请严格按照以下JSON格式返回（不要添加任何markdown标记）：
{
  "summary": "这里是核心摘要，根据内容复杂度自行决定长度，必须保留所有关键细节和具体内容",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "sentiment": "positive",
  "category": "技术"
}`;

    const result = await callAI(settings, [
        { role: 'user', content: prompt }
    ]);

    try {
        const parsed = JSON.parse(result);
        return {
            summary: parsed.summary || content.slice(0, 100),
            keywords: parsed.keywords || [],
            sentiment: parsed.sentiment || 'neutral',
            category: parsed.category || '其他',
        };
    } catch {
        return {
            summary: content.slice(0, 100),
            keywords: [],
            sentiment: 'neutral',
            category: '其他',
        };
    }
}

// 默认创作规则
export const defaultCreationRules = `你是一位专业的社交媒体内容创作者，专注于 Twitter/X 平台。

**Twitter 排版规则**：
1. 使用空行分段，让内容更易读
2. 重要观点单独成段
3. 适当使用 emoji 增加表现力（但不要过度）
4. 列表项用换行分隔，可用数字或 emoji 作为列表标记
5. 长文需要分成多个段落，每段聚焦一个要点
6. 开头要有吸引力，结尾可以有 call-to-action

**内容要求**：
1. 观点清晰，表达有力
2. 避免空洞的套话
3. 如有数据或案例，要具体
4. 保持真实感和个人风格
5. 适当引发讨论或互动

**格式示例**：
🔥 开头抓住注意力

核心观点第一段
解释或展开

要点一
要点二
要点三

总结或 call-to-action`;

export async function generateTweet(
    settings: Settings,
    request: CreationRequest,
    referenceTweets: Array<{ content: string; summary?: string }>
): Promise<string[]> {
    const languageMap = {
        zh: '中文',
        en: 'English',
        ja: '日本語',
        ko: '한국어',
    };

    const toneMap = {
        professional: '专业严肃',
        casual: '轻松幽默',
        concise: '简洁精炼',
        detailed: '详细解释',
        custom: request.customPrompt || '自然流畅',
    };

    const lengthMap = {
        short: '短推（<140字，1-2段）',
        standard: '标准（140-280字，2-4段）',
        long: '长文（需要分段，每段不超过280字，可以有5-8段）',
    };

    // 使用自定义创作规则或默认规则
    const creationRules = settings.customCreationPrompt || defaultCreationRules;

    let prompt = `${creationRules}

---

请基于以下要求创作推文：

**主题**：${request.topic}
**语言**：${languageMap[request.language]}
**风格**：${toneMap[request.tone]}
**长度**：${lengthMap[request.length]}
`;

    if (referenceTweets.length > 0) {
        prompt += '\n**参考素材**：\n';
        referenceTweets.forEach((tweet, idx) => {
            prompt += `${idx + 1}. ${tweet.summary || tweet.content}\n`;
        });
    }

    prompt += `
---

请生成3个不同版本的推文，每个版本风格略有不同。
**重要**：每个版本之间用 --- 分隔，直接输出推文内容，不要加"版本1"等标签。
确保排版清晰，适合直接发布到 Twitter。`;

    const result = await callAI(settings, [
        { role: 'user', content: prompt }
    ]);

    // Split by --- and clean up
    const versions = result.split('---').map(v => v.trim()).filter(v => v.length > 0);
    return versions.length > 0 ? versions : [result];
}
