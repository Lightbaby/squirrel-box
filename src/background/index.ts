import { getTenantAccessToken, syncToFeishu } from '../lib/feishu';
import type { FeishuSyncMessage } from '../lib/feishu';
import { storage } from '../lib/storage';
import type { InspirationItem, InspirationMessage } from '../lib/types';

console.log('Background service worker loaded');

chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
    if (tab.windowId) {
        chrome.sidePanel.open({ windowId: tab.windowId });
    }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message: FeishuSyncMessage | InspirationMessage, sender, sendResponse) => {
    console.log('Message received:', message);

    if (message.type === 'OPEN_SIDE_PANEL') {
        if (sender.tab?.windowId) {
            chrome.sidePanel.open({ windowId: sender.tab.windowId });
        }
        sendResponse({ success: true });
    }

    // ==================== 灵感模式消息处理 ====================

    // 获取灵感模式状态
    if (message.type === 'GET_INSPIRATION_MODE') {
        storage.getInspirationMode()
            .then((enabled) => sendResponse({ enabled }))
            .catch((error) => sendResponse({ enabled: false, error: error.message }));
        return true;
    }

    // 设置灵感模式状态
    if (message.type === 'INSPIRATION_MODE_CHANGED') {
        const inspirationMsg = message as InspirationMessage;
        const enabled = inspirationMsg.enabled ?? false;
        storage.setInspirationMode(enabled)
            .then(async () => {
                // 广播给所有标签页
                const tabs = await chrome.tabs.query({});
                for (const tab of tabs) {
                    if (tab.id) {
                        try {
                            await chrome.tabs.sendMessage(tab.id, {
                                type: 'INSPIRATION_MODE_CHANGED',
                                enabled,
                            });
                        } catch {
                            // 忽略没有 content script 的标签页
                        }
                    }
                }
                sendResponse({ success: true });
            })
            .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;
    }

    // 获取灵感采集的内容
    if (message.type === 'GET_INSPIRATION_ITEMS') {
        storage.getInspirationItems()
            .then((items) => sendResponse({ items }))
            .catch((error) => sendResponse({ items: [], error: error.message }));
        return true;
    }

    // 保存灵感采集的内容
    if (message.type === 'INSPIRATION_ITEM_CAPTURED') {
        const inspirationMsg = message as InspirationMessage;
        if (inspirationMsg.item) {
            storage.addInspirationItem(inspirationMsg.item)
                .then(() => sendResponse({ success: true }))
                .catch((error) => sendResponse({ success: false, error: error.message }));
        } else {
            sendResponse({ success: false, error: 'Missing item' });
        }
        return true;
    }

    // 清空灵感采集的内容
    if (message.type === 'INSPIRATION_ITEMS_CLEAR') {
        storage.clearInspirationItems()
            .then(() => sendResponse({ success: true }))
            .catch((error) => sendResponse({ success: false, error: error.message }));
        return true;
    }

    // 删除单条灵感内容
    if (message.type === 'INSPIRATION_ITEM_REMOVE') {
        const itemId = (message as { type: string; itemId: string }).itemId;
        if (itemId) {
            storage.removeInspirationItem(itemId)
                .then(() => sendResponse({ success: true }))
                .catch((error) => sendResponse({ success: false, error: error.message }));
        } else {
            sendResponse({ success: false, error: 'Missing itemId' });
        }
        return true;
    }

    // 处理飞书连接测试
    if (message.type === 'FEISHU_TEST_CONNECTION') {
        if (message.appId && message.appSecret) {
            getTenantAccessToken(message.appId, message.appSecret)
                .then(() => {
                    sendResponse({ success: true });
                })
                .catch((error) => {
                    sendResponse({
                        success: false,
                        error: error instanceof Error ? error.message : '连接失败'
                    });
                });
        } else {
            sendResponse({ success: false, error: '缺少 App ID 或 App Secret' });
        }
        return true; // 保持消息通道开启以便异步响应
    }

    // 处理飞书同步（支持两种消息类型）
    if (message.type === 'FEISHU_SYNC' || message.type === 'SYNC_TO_FEISHU') {
        if (message.settings && message.tweets) {
            console.log('[Background] 收到飞书同步请求，内容数量:', message.tweets.length);
            syncToFeishu(message.settings, message.tweets)
                .then(() => {
                    console.log('[Background] 飞书同步成功');
                    sendResponse({ success: true });
                })
                .catch((error) => {
                    console.error('[Background] 飞书同步失败:', error);
                    sendResponse({
                        success: false,
                        error: error instanceof Error ? error.message : '同步失败'
                    });
                });
        } else {
            console.error('[Background] 飞书同步参数不完整');
            sendResponse({ success: false, error: '缺少必要参数' });
        }
        return true; // 保持消息通道开启以便异步响应
    }

    return true;
});
