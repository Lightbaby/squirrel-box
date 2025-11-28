export interface Tweet {
    id: string;
    tweetId: string;
    tweetUrl: string; // 推文链接
    author: string;
    authorHandle: string;
    authorProfileUrl?: string; // 作者个人主页链接
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
}

export interface CreationRequest {
    topic: string;
    references: string[]; // Tweet IDs
    language: 'zh' | 'en' | 'ja' | 'ko';
    tone: 'professional' | 'casual' | 'concise' | 'detailed' | 'custom';
    customPrompt?: string;
    length: 'short' | 'standard' | 'long';
}
