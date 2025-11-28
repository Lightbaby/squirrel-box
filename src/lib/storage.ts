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
    },

    async updateTweet(tweetId: string, updates: Partial<Tweet>): Promise<void> {
        const tweets = await this.getTweets();
        const index = tweets.findIndex(t => t.id === tweetId);
        if (index !== -1) {
            tweets[index] = { ...tweets[index], ...updates };
            await chrome.storage.local.set({ [STORAGE_KEYS.TWEETS]: tweets });
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
