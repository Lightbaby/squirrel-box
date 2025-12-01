export interface Tweet {
    id: string;
    tweetId: string;
    tweetUrl: string; // 推文链接
    author: string;
    authorHandle: string;
    authorProfileUrl?: string; // 作者个人主页链接
    authorAvatar?: string; // 作者头像 URL
    content: string;
    summary?: string;
    category?: string; // 分类：技术/产品/营销/生活/其他
    platform?: 'twitter' | 'xiaohongshu'; // 平台
    keywords: string[];
    sentiment?: 'positive' | 'neutral' | 'negative';
    collectTime: number;
    media: string[];
    stats: {
        likes: number;
        retweets: number;
        replies: number;
    };
    tags?: string[];
    // 评论区相关
    authorThread?: string; // 作者自己的线程/补充内容
    commentHighlights?: string; // 评论区精选观点
}

// 灵感模式 - 采集的内容项
export interface InspirationItem {
    id: string;
    platform: 'twitter' | 'xiaohongshu';
    author: string;
    authorHandle?: string;
    authorAvatar?: string;
    authorProfileUrl?: string;
    title?: string;           // 列表页采集的标题
    summary?: string;         // 列表页采集的摘要/预览
    content?: string;         // 详情页采集的完整内容
    url: string;
    thumbnail?: string;       // 缩略图
    media?: string[];         // 详情页采集的图片
    capturedAt: number;       // 采集时间
    isDetail: boolean;        // 是否为详情页采集（内容更丰富）
    // 详情页采集时的评论区内容
    authorThread?: string;
    commentHighlights?: string;
}

// 灵感模式相关消息类型
export interface InspirationMessage {
    type: 'INSPIRATION_MODE_CHANGED' | 'INSPIRATION_ITEM_CAPTURED' | 'INSPIRATION_ITEMS_CLEAR' | 'GET_INSPIRATION_MODE' | 'GET_INSPIRATION_ITEMS';
    enabled?: boolean;
    item?: InspirationItem;
    items?: InspirationItem[];
}

export interface Settings {
    apiKey: string;
    baseUrl: string;
    model: string;
    // 视觉模型配置（用于图片识别，如果不配置则使用主配置）
    visionModel?: string; // 视觉模型名称（需支持 vision，如 gpt-4o、qwen-vl-max）
    visionApiKey?: string; // 视觉模型 API Key（不填则使用主 API Key）
    visionBaseUrl?: string; // 视觉模型 Base URL（不填则使用主 Base URL）
    defaultLanguage: 'zh' | 'en' | 'ja' | 'ko';
    readingMode: boolean;
    customSummaryPrompt?: string; // 自定义摘要提示词
    customCreationPrompt?: string; // 自定义创作提示词
    enableImageRecognition?: boolean; // 图片识别开关
    enableCommentCollection?: boolean; // 收集评论区内容开关
    showFloatingButton?: boolean; // 是否显示悬浮按钮（默认 true）
    // 飞书同步配置
    feishu?: {
        appId?: string; // 飞书机器人 App ID
        appSecret?: string; // 飞书机器人 App Secret
        docToken?: string; // 文档 Token (从文档链接解析)
        docType?: 'doc' | 'docx' | 'sheet' | 'wiki'; // 文档类型
        autoSync?: boolean; // 是否自动同步
    };
}

export interface CreationRequest {
    topic: string;
    references: string[]; // Tweet IDs
    language: 'zh' | 'en' | 'ja' | 'ko';
    tone: 'professional' | 'casual' | 'concise' | 'detailed' | 'custom';
    customPrompt?: string;
    length: 'short' | 'standard' | 'long';
}
