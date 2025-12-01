import { Tweet, Settings, InspirationItem } from './types';

export type Theme = 'system' | 'light' | 'dark';

const STORAGE_KEYS = {
    TWEETS: 'tweets',
    SETTINGS: 'settings',
    READING_MODE: 'readingMode',
    THEME: 'theme',
    // 灵感模式（使用 session storage）
    INSPIRATION_MODE: 'inspirationMode',
    INSPIRATION_ITEMS: 'inspirationItems',
};

export const storage = {
    async getTweets(): Promise<Tweet[]> {
        const result = await chrome.storage.local.get(STORAGE_KEYS.TWEETS);
        return (result[STORAGE_KEYS.TWEETS] as Tweet[]) || [];
    },

    async saveTweet(tweet: Tweet): Promise<void> {
        const tweets = await this.getTweets();
        tweets.unshift(tweet);
        await chrome.storage.local.set({ [STORAGE_KEYS.TWEETS]: tweets });

        // 注意：不在这里触发自动同步，而是等待 AI 摘要完成后在 updateTweet 中同步
        console.log('[Storage] Tweet 已保存，等待 AI 摘要完成后同步');
    },

    async updateTweet(tweetId: string, updates: Partial<Tweet>): Promise<void> {
        const tweets = await this.getTweets();
        const index = tweets.findIndex(t => t.id === tweetId);
        if (index !== -1) {
            tweets[index] = { ...tweets[index], ...updates };
            await chrome.storage.local.set({ [STORAGE_KEYS.TWEETS]: tweets });

            // 如果是 AI 摘要完成的更新（包含 summary 字段），触发自动同步
            if (updates.summary) {
                const settings = await this.getSettings();
                const shouldAutoSync = settings?.feishu?.autoSync &&
                                      settings?.feishu?.appId &&
                                      settings?.feishu?.appSecret &&
                                      settings?.feishu?.docToken;

                console.log('[Storage] AI 摘要已更新，检查自动同步配置:', {
                    hasSettings: !!settings,
                    autoSync: settings?.feishu?.autoSync,
                    hasAppId: !!settings?.feishu?.appId,
                    hasAppSecret: !!settings?.feishu?.appSecret,
                    hasDocToken: !!settings?.feishu?.docToken,
                    shouldAutoSync
                });

                if (shouldAutoSync) {
                    console.log('[Storage] 触发自动同步到飞书（AI 摘要已完成）');
                    try {
                        const response = await chrome.runtime.sendMessage({
                            type: 'SYNC_TO_FEISHU',
                            settings: settings, // 必须传递 settings 参数
                            tweets: [tweets[index]], // 只同步当前更新的这条
                        });
                        console.log('[Storage] 自动同步响应:', response);
                    } catch (error) {
                        console.error('[Storage] 自动同步失败:', error);
                    }
                }
            }
        }
    },

    async deleteTweet(tweetId: string): Promise<void> {
        const tweets = await this.getTweets();
        const filtered = tweets.filter(t => t.id !== tweetId);
        await chrome.storage.local.set({ [STORAGE_KEYS.TWEETS]: filtered });
    },

    async getSettings(): Promise<Settings | null> {
        const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
        return (result[STORAGE_KEYS.SETTINGS] as Settings) || null;
    },

    async saveSettings(settings: Settings): Promise<void> {
        await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
    },

    async getReadingMode(): Promise<boolean> {
        const result = await chrome.storage.local.get(STORAGE_KEYS.READING_MODE);
        return (result[STORAGE_KEYS.READING_MODE] as boolean) ?? false;
    },

    async setReadingMode(enabled: boolean): Promise<void> {
        await chrome.storage.local.set({ [STORAGE_KEYS.READING_MODE]: enabled });
    },

    async getTheme(): Promise<Theme> {
        const result = await chrome.storage.local.get(STORAGE_KEYS.THEME);
        return (result[STORAGE_KEYS.THEME] as Theme) || 'system';
    },

    async setTheme(theme: Theme): Promise<void> {
        await chrome.storage.local.set({ [STORAGE_KEYS.THEME]: theme });
    },

    // ==================== 灵感模式 ====================
    // 使用 session storage，关闭浏览器自动清空

    async getInspirationMode(): Promise<boolean> {
        const result = await chrome.storage.session.get(STORAGE_KEYS.INSPIRATION_MODE);
        return (result[STORAGE_KEYS.INSPIRATION_MODE] as boolean) ?? false;
    },

    async setInspirationMode(enabled: boolean): Promise<void> {
        await chrome.storage.session.set({ [STORAGE_KEYS.INSPIRATION_MODE]: enabled });
    },

    async getInspirationItems(): Promise<InspirationItem[]> {
        const result = await chrome.storage.session.get(STORAGE_KEYS.INSPIRATION_ITEMS);
        return (result[STORAGE_KEYS.INSPIRATION_ITEMS] as InspirationItem[]) || [];
    },

    async addInspirationItem(item: InspirationItem): Promise<void> {
        const items = await this.getInspirationItems();
        // 去重：如果已存在相同 URL 的内容，更新它（详情页内容更丰富）
        const existingIndex = items.findIndex(i => i.url === item.url);
        if (existingIndex !== -1) {
            // 如果新的是详情页内容，或者旧的不是详情页内容，则更新
            if (item.isDetail || !items[existingIndex].isDetail) {
                items[existingIndex] = { ...items[existingIndex], ...item };
            }
        } else {
            // 新增到开头
            items.unshift(item);
        }
        // 最多保留 50 条
        const trimmedItems = items.slice(0, 50);
        await chrome.storage.session.set({ [STORAGE_KEYS.INSPIRATION_ITEMS]: trimmedItems });
    },

    async clearInspirationItems(): Promise<void> {
        await chrome.storage.session.set({ [STORAGE_KEYS.INSPIRATION_ITEMS]: [] });
    },

    async removeInspirationItem(itemId: string): Promise<void> {
        const items = await this.getInspirationItems();
        const filtered = items.filter(i => i.id !== itemId);
        await chrome.storage.session.set({ [STORAGE_KEYS.INSPIRATION_ITEMS]: filtered });
    },
};
