import { Tweet, Settings } from './types';

export type Theme = 'system' | 'light' | 'dark';

const STORAGE_KEYS = {
    TWEETS: 'tweets',
    SETTINGS: 'settings',
    READING_MODE: 'readingMode',
    THEME: 'theme',
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
};
