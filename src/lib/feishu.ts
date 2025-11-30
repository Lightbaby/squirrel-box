import { Tweet, Settings } from './types';

/**
 * 从飞书文档链接解析文档信息
 * 支持的链接格式:
 * - https://xxx.feishu.cn/docx/xxxxx (新版文档)
 * - https://xxx.feishu.cn/docs/xxxxx (旧版文档)
 * - https://xxx.feishu.cn/sheets/xxxxx (电子表格)
 * - https://xxx.feishu.cn/wiki/xxxxx (知识库)
 */
export function parseFeishuDocUrl(url: string): { docToken: string; docType: 'doc' | 'docx' | 'sheet' | 'wiki'; error?: string } | null {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;

        console.log('[Feishu] 解析文档链接:', url);
        console.log('[Feishu] pathname:', pathname);

        // 匹配 /docx/, /docs/, /sheets/, /wiki/ 路径
        const docxMatch = pathname.match(/\/docx\/([a-zA-Z0-9]+)/);
        const docsMatch = pathname.match(/\/docs\/([a-zA-Z0-9]+)/);
        const sheetsMatch = pathname.match(/\/sheets\/([a-zA-Z0-9]+)/);
        const wikiMatch = pathname.match(/\/wiki\/([a-zA-Z0-9]+)/);

        if (docxMatch) {
            console.log('[Feishu] 识别为新版文档 (docx):', docxMatch[1]);
            return { docToken: docxMatch[1], docType: 'docx' };
        } else if (docsMatch) {
            console.log('[Feishu] 识别为旧版文档 (docs):', docsMatch[1]);
            return { docToken: docsMatch[1], docType: 'doc' };
        } else if (sheetsMatch) {
            console.log('[Feishu] 识别为电子表格 (sheets):', sheetsMatch[1]);
            return { docToken: sheetsMatch[1], docType: 'sheet' };
        } else if (wikiMatch) {
            console.log('[Feishu] 识别为知识库 (wiki):', wikiMatch[1]);
            return { docToken: wikiMatch[1], docType: 'wiki' };
        }

        console.error('[Feishu] 无法识别的文档类型，路径:', pathname);
        return null;
    } catch (error) {
        console.error('[Feishu] 解析文档链接失败:', error);
        return null;
    }
}

/**
 * 获取飞书 tenant_access_token
 * 注意: 这个函数只能在 background service worker 中调用,因为有 CORS 限制
 */
export async function getTenantAccessToken(appId: string, appSecret: string): Promise<string> {
    const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            app_id: appId,
            app_secret: appSecret,
        }),
    });

    const data = await response.json();
    if (data.code !== 0) {
        throw new Error(`获取飞书 access token 失败: ${data.msg}`);
    }

    return data.tenant_access_token;
}

/**
 * 将 Tweet 转换为 Markdown 格式
 */
function tweetToMarkdown(tweet: Tweet): string {
    const lines: string[] = [];

    // 标题
    lines.push(`### ${tweet.author}${tweet.platform ? ` · ${tweet.platform === 'twitter' ? 'Twitter' : '小红书'}` : ''}`);
    lines.push('');

    // 基本信息
    if (tweet.category) {
        lines.push(`**分类**: ${tweet.category}`);
    }
    lines.push(`**时间**: ${new Date(tweet.collectTime).toLocaleString('zh-CN')}`);
    lines.push('');

    // 摘要
    if (tweet.summary) {
        lines.push('**摘要**:');
        lines.push(tweet.summary);
        lines.push('');
    }

    // 原文
    lines.push('**原文**:');
    lines.push(tweet.content);
    lines.push('');

    // 关键词
    if (tweet.keywords.length > 0) {
        lines.push(`**关键词**: ${tweet.keywords.map(k => `#${k}`).join(' ')}`);
        lines.push('');
    }

    // 链接
    if (tweet.tweetUrl) {
        lines.push(`**原文链接**: ${tweet.tweetUrl}`);
        lines.push('');
    }

    lines.push('---');
    lines.push('');

    return lines.join('\n');
}

/**
 * 将 Tweet 转换为飞书文档块结构（富文本格式）
 */
function tweetToFeishuBlocks(tweet: Tweet): any[] {
    const blocks: any[] = [];

    // 标题（加粗 + 大字体）
    blocks.push({
        block_type: 2, // 文本块
        text: {
            elements: [
                {
                    text_run: {
                        content: `${tweet.author}${tweet.platform ? ` · ${tweet.platform === 'twitter' ? 'Twitter' : '小红书'}` : ''}`,
                        text_element_style: {
                            bold: true,
                        },
                    },
                },
            ],
            style: {
                headingLevel: 3, // H3 标题
            },
        },
    });

    // 分类和时间
    const metaInfo: string[] = [];
    if (tweet.category) {
        metaInfo.push(`分类: ${tweet.category}`);
    }
    metaInfo.push(`时间: ${new Date(tweet.collectTime).toLocaleString('zh-CN')}`);

    blocks.push({
        block_type: 2,
        text: {
            elements: [
                {
                    text_run: {
                        content: metaInfo.join(' | '),
                        text_element_style: {
                            italic: true,
                        },
                    },
                },
            ],
        },
    });

    // 摘要
    if (tweet.summary) {
        blocks.push({
            block_type: 2,
            text: {
                elements: [
                    {
                        text_run: {
                            content: '摘要:',
                            text_element_style: {
                                bold: true,
                            },
                        },
                    },
                ],
            },
        });

        blocks.push({
            block_type: 2,
            text: {
                elements: [
                    {
                        text_run: {
                            content: tweet.summary,
                        },
                    },
                ],
            },
        });
    }

    // 原文
    blocks.push({
        block_type: 2,
        text: {
            elements: [
                {
                    text_run: {
                        content: '原文:',
                        text_element_style: {
                            bold: true,
                        },
                    },
                },
            ],
        },
    });

    blocks.push({
        block_type: 2,
        text: {
            elements: [
                {
                    text_run: {
                        content: tweet.content,
                    },
                },
            ],
        },
    });

    // 关键词
    if (tweet.keywords.length > 0) {
        blocks.push({
            block_type: 2,
            text: {
                elements: [
                    {
                        text_run: {
                            content: `关键词: ${tweet.keywords.map(k => `#${k}`).join(' ')}`,
                            text_element_style: {
                                italic: true,
                            },
                        },
                    },
                ],
            },
        });
    }

    // 原文链接
    if (tweet.tweetUrl) {
        blocks.push({
            block_type: 2,
            text: {
                elements: [
                    {
                        text_run: {
                            content: '原文链接: ',
                            text_element_style: {
                                bold: true,
                            },
                        },
                    },
                    {
                        text_run: {
                            content: tweet.tweetUrl,
                            text_element_style: {
                                link: {
                                    url: tweet.tweetUrl,
                                },
                            },
                        },
                    },
                ],
            },
        });
    }

    // 分隔线
    blocks.push({
        block_type: 2,
        text: {
            elements: [
                {
                    text_run: {
                        content: '────────────────────',
                        text_element_style: {
                            italic: true,
                        },
                    },
                },
            ],
        },
    });

    // 空行
    blocks.push({
        block_type: 2,
        text: {
            elements: [
                {
                    text_run: {
                        content: ' ',
                    },
                },
            ],
        },
    });

    return blocks;
}

/**
 * 同步内容到飞书文档
 */
export async function syncToFeishu(settings: Settings, tweets: Tweet[]): Promise<void> {
    if (!settings.feishu?.appId || !settings.feishu?.appSecret || !settings.feishu?.docToken) {
        throw new Error('飞书配置不完整');
    }

    const { appId, appSecret, docToken, docType } = settings.feishu;

    // 获取 access token
    const accessToken = await getTenantAccessToken(appId, appSecret);

    // 根据文档类型选择不同的 API
    if (docType === 'docx') {
        await syncToDocx(accessToken, docToken, tweets);
    } else if (docType === 'doc') {
        await syncToDoc(accessToken, docToken, tweets);
    } else if (docType === 'sheet') {
        await syncToSheet(accessToken, docToken, tweets);
    } else if (docType === 'wiki') {
        await syncToWiki(accessToken, docToken, tweets);
    } else {
        throw new Error(`不支持的文档类型: ${docType}`);
    }
}

/**
 * 同步到新版文档 (docx)
 */
async function syncToDocx(accessToken: string, docToken: string, tweets: Tweet[]): Promise<void> {
    console.log('[Feishu] 开始同步到 docx 文档:', docToken);
    console.log('[Feishu] 同步内容数量:', tweets.length);

    // 首先获取文档信息，找到根节点 block_id
    const docResponse = await fetch(`https://open.feishu.cn/open-apis/docx/v1/documents/${docToken}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    const docData = await docResponse.json();
    console.log('[Feishu] 文档信息响应:', docData);

    if (docData.code !== 0) {
        throw new Error(`获取文档信息失败: ${docData.msg}`);
    }

    const pageId = docData.data?.document?.document_id;
    if (!pageId) {
        throw new Error('无法获取文档 ID');
    }

    console.log('[Feishu] 文档 ID:', pageId);

    // 将所有 tweets 转换为飞书块结构
    const allBlocks = tweets.flatMap(tweet => tweetToFeishuBlocks(tweet));
    console.log('[Feishu] 生成块数量:', allBlocks.length);

    // 飞书 API 限制每次最多添加 50 个块，需要分批处理
    const batchSize = 50;
    for (let i = 0; i < allBlocks.length; i += batchSize) {
        const batch = allBlocks.slice(i, i + batchSize);
        console.log(`[Feishu] 处理第 ${Math.floor(i / batchSize) + 1} 批，块数: ${batch.length}`);

        const payload = {
            children: batch,
            index: 0, // 插入到顶部（最新的在上面）
        };

        const response = await fetch(`https://open.feishu.cn/open-apis/docx/v1/documents/${docToken}/blocks/${pageId}/children`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        console.log('[Feishu] API 响应状态:', response.status, response.statusText);

        const responseText = await response.text();

        let data;
        try {
            data = JSON.parse(responseText);
        } catch {
            console.error('[Feishu] API 响应内容:', responseText);
            throw new Error(`API 返回非 JSON 格式: ${responseText}`);
        }

        if (data.code !== 0) {
            console.error('[Feishu] API 错误响应:', data);
            throw new Error(`同步到飞书文档失败: ${data.msg}`);
        }

        console.log(`[Feishu] 第 ${Math.floor(i / batchSize) + 1} 批同步成功`);

        // 避免请求过快，添加小延迟
        if (i + batchSize < allBlocks.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    console.log('[Feishu] Docx 同步完成');
}

/**
 * 同步到旧版文档 (doc) - 使用批量添加段落
 */
async function syncToDoc(accessToken: string, docToken: string, tweets: Tweet[]): Promise<void> {
    // 为每条 tweet 创建段落
    const requests = tweets.flatMap(tweet => {
        const markdown = tweetToMarkdown(tweet);
        const lines = markdown.split('\n');

        return lines.map(line => ({
            action: 'InsertBlockAfter',
            elem_type: 'text',
            block_id: '',
            text: {
                text: line,
            },
        }));
    });

    const response = await fetch(`https://open.feishu.cn/open-apis/doc/v2/batch_update`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            doc_token: docToken,
            requests,
        }),
    });

    const data = await response.json();
    if (data.code !== 0) {
        throw new Error(`同步到飞书文档失败: ${data.msg}`);
    }
}

/**
 * 同步到电子表格 (sheet)
 */
async function syncToSheet(accessToken: string, docToken: string, tweets: Tweet[]): Promise<void> {
    // 准备表格数据
    const rows = tweets.map(tweet => [
        new Date(tweet.collectTime).toLocaleString('zh-CN'),
        tweet.author,
        tweet.platform === 'twitter' ? 'Twitter' : '小红书',
        tweet.category || '',
        tweet.summary || '',
        tweet.content,
        tweet.keywords.join(', '),
        tweet.tweetUrl || '',
    ]);

    // 追加到表格
    const response = await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${docToken}/values_append`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            valueRange: {
                range: 'Sheet1!A:H',
                values: rows,
            },
        }),
    });

    const data = await response.json();
    if (data.code !== 0) {
        throw new Error(`同步到飞书表格失败: ${data.msg}`);
    }
}

/**
 * 同步到知识库 (wiki)
 * 知识库中的文档实际上是 docx 格式，我们获取该 wiki 节点关联的文档 token 后同步
 */
async function syncToWiki(accessToken: string, wikiToken: string, tweets: Tweet[]): Promise<void> {
    console.log('[Feishu] 开始同步到知识库节点:', wikiToken);
    console.log('[Feishu] 同步内容数量:', tweets.length);

    try {
        // 1. 获取 wiki 节点信息，找到关联的文档 token
        const nodeResponse = await fetch(`https://open.feishu.cn/open-apis/wiki/v2/spaces/get_node?token=${wikiToken}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        const nodeData = await nodeResponse.json();
        console.log('[Feishu] Wiki 节点信息:', nodeData);

        if (nodeData.code !== 0) {
            throw new Error(`获取知识库节点信息失败: ${nodeData.msg || '未知错误'}`);
        }

        // 2. 获取节点关联的文档 token
        const objToken = nodeData.data?.node?.obj_token;
        const objType = nodeData.data?.node?.obj_type;

        if (!objToken) {
            throw new Error('无法获取知识库关联的文档 token');
        }

        console.log('[Feishu] Wiki 关联的文档类型:', objType, 'Token:', objToken);

        // 3. 根据文档类型调用对应的同步方法
        if (objType === 'docx') {
            console.log('[Feishu] 使用 docx API 同步到知识库文档');
            await syncToDocx(accessToken, objToken, tweets);
        } else if (objType === 'doc') {
            console.log('[Feishu] 使用 doc API 同步到知识库文档');
            await syncToDoc(accessToken, objToken, tweets);
        } else {
            throw new Error(`知识库关联的文档类型不支持: ${objType}`);
        }

        console.log('[Feishu] 知识库同步完成');
    } catch (error) {
        console.error('[Feishu] 知识库同步失败:', error);
        throw error;
    }
}

/**
 * 同步相关的接口类型定义
 */
export interface FeishuSyncMessage {
    type: 'FEISHU_SYNC' | 'SYNC_TO_FEISHU' | 'FEISHU_TEST_CONNECTION' | 'OPEN_SIDE_PANEL';
    settings?: Settings;
    tweets?: Tweet[];
    appId?: string;
    appSecret?: string;
}
