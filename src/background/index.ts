import { getTenantAccessToken, syncToFeishu } from '../lib/feishu';
import type { FeishuSyncMessage } from '../lib/feishu';

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
chrome.runtime.onMessage.addListener((message: FeishuSyncMessage, sender, sendResponse) => {
    console.log('Message received:', message);

    if (message.type === 'OPEN_SIDE_PANEL') {
        if (sender.tab?.windowId) {
            chrome.sidePanel.open({ windowId: sender.tab.windowId });
        }
        sendResponse({ success: true });
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
