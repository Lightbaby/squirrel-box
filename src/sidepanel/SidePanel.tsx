import { useEffect, useState, useCallback } from 'react';
import {
    BookOpen, PenTool, Trash2, Copy, Sparkles, Loader2, ExternalLink,
    Send, Settings as SettingsIcon, Download, MousePointer2,
    AlertTriangle, Sun, Moon, Monitor, ChevronDown, Filter,
    Plus, Check, X, Library, Cloud, CloudOff, Lightbulb
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { storage, Theme } from '../lib/storage';
import { Tweet, Settings, CreationRequest, InspirationItem } from '../lib/types';
import { generateTweet } from '../lib/ai';
import { formatDate, cn } from '../lib/utils';

export default function SidePanel() {
    const [activeTab, setActiveTab] = useState<'collection' | 'create'>('collection');
    const [tweets, setTweets] = useState<Tweet[]>([]);
    const [selectedTweets, setSelectedTweets] = useState<Set<string>>(new Set());
    const [settings, setSettings] = useState<Settings | null>(null);
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [platformFilter, setPlatformFilter] = useState<string>('all');
    const [expandedTweets, setExpandedTweets] = useState<Set<string>>(new Set());
    const [theme, setTheme] = useState<Theme>('system');

    // Creation form state
    const [topic, setTopic] = useState('');
    const [language, setLanguage] = useState<'zh' | 'en' | 'ja' | 'ko'>('zh');
    const [tone, setTone] = useState<'professional' | 'casual' | 'concise' | 'detailed'>('casual');
    const [length, setLength] = useState<'short' | 'standard' | 'long'>('standard');
    const [generating, setGenerating] = useState(false);
    const [generatedVersions, setGeneratedVersions] = useState<string[]>([]);
    const [publishing, setPublishing] = useState(false);
    
    // 删除确认弹窗状态
    const [deleteConfirm, setDeleteConfirm] = useState<{
        show: boolean;
        tweetId: string;
        authorName: string;
    }>({ show: false, tweetId: '', authorName: '' });

    // 选择参考模式状态
    const [selectMode, setSelectMode] = useState(false);

    // 飞书同步状态
    const [syncing, setSyncing] = useState(false);

    // ==================== 灵感模式状态 ====================
    const [inspirationMode, setInspirationMode] = useState(false);
    const [inspirationItems, setInspirationItems] = useState<InspirationItem[]>([]);
    const [referenceSource, setReferenceSource] = useState<'collection' | 'inspiration'>('collection');
    const [selectedInspirationItems, setSelectedInspirationItems] = useState<Set<string>>(new Set());
    // 采集日志（最近的采集记录）
    const [captureLog, setCaptureLog] = useState<{ text: string; time: number }[]>([]);

    useEffect(() => {
        loadData();

        // Listen for storage changes
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (changes.tweets) {
                setTweets((changes.tweets.newValue as Tweet[]) || []);
            }
            // 监听灵感数据变化（session storage）
            if (areaName === 'session' && changes.inspirationItems) {
                const newItems = (changes.inspirationItems.newValue as InspirationItem[]) || [];
                const oldItems = (changes.inspirationItems.oldValue as InspirationItem[]) || [];
                setInspirationItems(newItems);
                
                // 检测新增的内容
                if (newItems.length > oldItems.length) {
                    const newItem = newItems[0]; // 新内容在最前面
                    if (newItem) {
                        // 添加到采集日志
                        const logText = newItem.isDetail 
                            ? `📄 详情：${newItem.title || newItem.content?.slice(0, 30) || '...'}`
                            : `📋 列表：${newItem.title || newItem.summary?.slice(0, 30) || '...'}`;
                        setCaptureLog(prev => [
                            { text: logText, time: Date.now() },
                            ...prev.slice(0, 4) // 最多保留 5 条
                        ]);
                        
                        // 自动选中新采集的内容
                        setSelectedInspirationItems(prev => {
                            const newSet = new Set(prev);
                            newSet.add(newItem.id);
                            return newSet;
                        });
                    }
                }
            }
            if (areaName === 'session' && changes.inspirationMode) {
                setInspirationMode(changes.inspirationMode.newValue as boolean);
            }
        });
    }, []);

    // Theme effect
    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');

        if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            root.classList.add(systemTheme);
        } else {
            root.classList.add(theme);
        }
        storage.setTheme(theme);
    }, [theme]);

    async function loadData() {
        const [storedTweets, storedSettings, storedTheme, storedInspirationMode, storedInspirationItems] = await Promise.all([
            storage.getTweets(),
            storage.getSettings(),
            storage.getTheme(),
            storage.getInspirationMode(),
            storage.getInspirationItems(),
        ]);
        setTweets(storedTweets);
        setSettings(storedSettings);
        setTheme(storedTheme);
        setInspirationMode(storedInspirationMode);
        setInspirationItems(storedInspirationItems);
        // 默认选中所有灵感内容
        if (storedInspirationItems.length > 0) {
            setSelectedInspirationItems(new Set(storedInspirationItems.map(item => item.id)));
        }
        if (storedSettings) {
            setLanguage(storedSettings.defaultLanguage);
        }
    }

    function cycleTheme() {
        setTheme(curr => {
            if (curr === 'system') return 'light';
            if (curr === 'light') return 'dark';
            return 'system';
        });
    }

    function getThemeIcon() {
        switch (theme) {
            case 'light': return <Sun className="w-4 h-4" />;
            case 'dark': return <Moon className="w-4 h-4" />;
            default: return <Monitor className="w-4 h-4" />;
        }
    }

    // 显示删除确认弹窗
    function showDeleteConfirm(tweetId: string, authorName?: string) {
        setDeleteConfirm({
            show: true,
            tweetId,
            authorName: authorName || '未知作者'
        });
    }

    // 确认删除
    async function confirmDelete() {
        const { tweetId } = deleteConfirm;
        await storage.deleteTweet(tweetId);
        setTweets(tweets.filter(t => t.id !== tweetId));
        selectedTweets.delete(tweetId);
        setSelectedTweets(new Set(selectedTweets));
        setDeleteConfirm({ show: false, tweetId: '', authorName: '' });
        showNotification('已删除');
    }

    // 取消删除
    function cancelDelete() {
        setDeleteConfirm({ show: false, tweetId: '', authorName: '' });
    }

    function toggleSelect(tweetId: string) {
        const newSelected = new Set(selectedTweets);
        if (newSelected.has(tweetId)) {
            newSelected.delete(tweetId);
        } else {
            newSelected.add(tweetId);
        }
        setSelectedTweets(newSelected);
    }

    async function handleGenerate() {
        if (!settings) {
            alert('请先在设置页面配置 AI API');
            return;
        }

        if (!topic.trim()) {
            alert('请输入创作主题');
            return;
        }

        setGenerating(true);
        setGeneratedVersions([]);

        try {
            // 合并收藏和灵感的参考内容
            const referenceTweets = tweets
                .filter(t => selectedTweets.has(t.id))
                .map(t => ({ content: t.content, summary: t.summary }));

            const referenceInspirations = inspirationItems
                .filter(i => selectedInspirationItems.has(i.id))
                .map(i => ({ content: i.content || i.summary || '', summary: i.title || i.summary }));

            const allReferences = [...referenceTweets, ...referenceInspirations];

            const request: CreationRequest = {
                topic,
                references: [...Array.from(selectedTweets), ...Array.from(selectedInspirationItems)],
                language,
                tone,
                length,
            };

            const versions = await generateTweet(settings, request, allReferences);
            setGeneratedVersions(versions);
        } catch (error) {
            alert(error instanceof Error ? error.message : '生成失败');
        } finally {
            setGenerating(false);
        }
    }

    async function publishTweet(text: string) {
        setPublishing(true);
        try {
            // 先在 SidePanel 端复制到剪贴板（SidePanel 有焦点所以可以成功）
            await navigator.clipboard.writeText(text);
            
            // Get active Twitter tab - 包含所有可能的 URL 变体
            const [tab] = await chrome.tabs.query({ 
                url: [
                    'https://twitter.com/*', 
                    'https://x.com/*',
                    'https://www.twitter.com/*',
                    'https://www.x.com/*',
                    'https://mobile.twitter.com/*',
                    'https://mobile.x.com/*'
                ] 
            });

            if (!tab || !tab.id) {
                // 即使没找到 Twitter 页面，内容已在剪贴板
                showNotification('📋 内容已复制！请打开 Twitter 后按 Cmd+V 粘贴');
                return;
            }

            // Send message to content script to publish (内容已在剪贴板)
            await chrome.tabs.sendMessage(tab.id, {
                type: 'PUBLISH_TWEET',
                content: text,
            });
        } catch (error) {
            // 尝试至少复制到剪贴板
            try {
                await navigator.clipboard.writeText(text);
                showNotification('📋 内容已复制！请按 Cmd+V 粘贴到 Twitter');
            } catch {
                showNotification('✗ 发布失败：' + (error instanceof Error ? error.message : '未知错误'));
            }
        } finally {
            setPublishing(false);
        }
    }

    async function copyToClipboard(text: string) {
        await navigator.clipboard.writeText(text);
        showNotification('已复制！');
    }

    function showNotification(message: string) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.className = 'fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm';
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 2000);
    }

    // 手动同步到飞书
    async function handleSyncToFeishu() {
        if (!settings?.feishu?.appId || !settings?.feishu?.appSecret || !settings?.feishu?.docToken) {
            showNotification('请先在设置中配置飞书同步');
            return;
        }

        if (filteredTweets.length === 0) {
            showNotification('没有可同步的内容');
            return;
        }

        setSyncing(true);
        try {
            // 通过 background service worker 调用,避免 CORS 问题
            const response = await chrome.runtime.sendMessage({
                type: 'FEISHU_SYNC',
                settings: settings,
                tweets: filteredTweets,
            });

            if (response.success) {
                showNotification(`✓ 已同步 ${filteredTweets.length} 条内容到飞书`);
            } else {
                showNotification('✗ 同步失败: ' + (response.error || '未知错误'));
            }
        } catch (error) {
            showNotification('✗ 同步失败: ' + (error instanceof Error ? error.message : '未知错误'));
        } finally {
            setSyncing(false);
        }
    }

    // ==================== 灵感模式函数 ====================

    // 切换灵感模式
    const toggleInspirationMode = useCallback(async () => {
        const newMode = !inspirationMode;
        setInspirationMode(newMode);
        
        // 通知 background 广播给所有标签页
        try {
            await chrome.runtime.sendMessage({
                type: 'INSPIRATION_MODE_CHANGED',
                enabled: newMode,
            });
            showNotification(newMode ? '💡 灵感模式已开启' : '灵感模式已关闭');
        } catch (error) {
            console.error('切换灵感模式失败:', error);
            showNotification('切换失败，请重试');
            setInspirationMode(!newMode); // 回滚状态
        }
    }, [inspirationMode]);

    // 清空灵感采集
    const clearInspirationItems = useCallback(async () => {
        try {
            await chrome.runtime.sendMessage({ type: 'INSPIRATION_ITEMS_CLEAR' });
            setInspirationItems([]);
            setSelectedInspirationItems(new Set());
            showNotification('已清空灵感采集');
        } catch (error) {
            console.error('清空灵感采集失败:', error);
        }
    }, []);

    // 删除单条灵感内容
    const removeInspirationItem = useCallback(async (itemId: string) => {
        try {
            await chrome.runtime.sendMessage({ type: 'INSPIRATION_ITEM_REMOVE', itemId });
            setInspirationItems(prev => prev.filter(i => i.id !== itemId));
            selectedInspirationItems.delete(itemId);
            setSelectedInspirationItems(new Set(selectedInspirationItems));
        } catch (error) {
            console.error('删除灵感内容失败:', error);
        }
    }, [selectedInspirationItems]);

    // 切换灵感内容选择
    const toggleInspirationSelect = useCallback((itemId: string) => {
        const newSelected = new Set(selectedInspirationItems);
        if (newSelected.has(itemId)) {
            newSelected.delete(itemId);
        } else {
            newSelected.add(itemId);
        }
        setSelectedInspirationItems(newSelected);
    }, [selectedInspirationItems]);

    // 切换悬浮按钮显示
    async function toggleFloatingButton() {
        const newValue = settings?.showFloatingButton === false;
        const newSettings = { ...settings, showFloatingButton: newValue } as Settings;
        setSettings(newSettings);
        await storage.saveSettings(newSettings);
        
        // 通知所有标签页更新悬浮按钮状态
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
            if (tab.id) {
                try {
                    await chrome.tabs.sendMessage(tab.id, {
                        type: 'TOGGLE_FLOATING_BUTTON',
                        show: newValue,
                    });
                } catch {
                    // 忽略没有内容脚本的标签页
                }
            }
        }
        
        showNotification(newValue ? '悬浮按钮已开启' : '悬浮按钮已关闭');
    }

    function getCategoryColor(category?: string) {
        const colors: Record<string, string> = {
            '技术': 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300',
            '产品': 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300',
            '营销': 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300',
            '资讯': 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300',
            '观点': 'bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300',
            '生活': 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300',
            '其他': 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
        };
        return colors[category || '其他'] || colors['其他'];
    }

    // 获取所有可用的类别和平台
    const categories = ['all', ...Array.from(new Set(tweets.map(t => t.category).filter(Boolean)))];
    const platforms = Array.from(new Set(tweets.map(t => t.platform).filter(Boolean)));

    // 筛选和排序推文
    const filteredTweets = tweets
        .filter(tweet => categoryFilter === 'all' || tweet.category === categoryFilter)
        .filter(tweet => platformFilter === 'all' || tweet.platform === platformFilter)
        .sort((a, b) => b.collectTime - a.collectTime); // 按时间倒序

    const toggleExpanded = (tweetId: string) => {
        const newExpanded = new Set(expandedTweets);
        if (newExpanded.has(tweetId)) {
            newExpanded.delete(tweetId);
        } else {
            newExpanded.add(tweetId);
        }
        setExpandedTweets(newExpanded);
    };

    const getPlatformName = (platform?: string) => {
        const map: Record<string, string> = {
            'twitter': 'Twitter',
            'xiaohongshu': '小红书',
        };
        return map[platform || ''] || platform;
    };

    // 获取用户主页链接
    const getProfileUrl = (tweet: Tweet) => {
        // 优先使用直接保存的用户主页链接
        if (tweet.authorProfileUrl) {
            return tweet.authorProfileUrl;
        }
        // 回退到根据平台和 handle 构建链接
        if (!tweet.authorHandle) return '#';
        switch (tweet.platform) {
            case 'twitter':
                return `https://x.com/${tweet.authorHandle}`;
            case 'xiaohongshu':
                return `https://www.xiaohongshu.com/user/profile/${tweet.authorHandle}`;
            default:
                return '#';
        }
    };

    // 导出功能
    function exportAsJSON() {
        const dataStr = JSON.stringify(filteredTweets, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `squirrel-collection-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        showNotification('✓ 已导出为 JSON');
    }

    function exportAsMarkdown() {
        let markdown = `# 松鼠收藏夹\n\n导出时间: ${new Date().toLocaleString('zh-CN')}\n总计: ${filteredTweets.length} 条\n\n---\n\n`;

        filteredTweets.forEach((tweet, index) => {
            markdown += `## ${index + 1}. ${tweet.author}\n\n`;
            markdown += `**平台**: ${getPlatformName(tweet.platform)} | `;
            markdown += `**分类**: ${tweet.category || '未分类'} | `;
            markdown += `**时间**: ${formatDate(tweet.collectTime)}\n\n`;

            if (tweet.summary) {
                markdown += `**摘要**: ${tweet.summary}\n\n`;
            }

            markdown += `**原文**:\n${tweet.content}\n\n`;

            if (tweet.keywords.length > 0) {
                markdown += `**关键词**: ${tweet.keywords.map(k => `#${k}`).join(' ')}\n\n`;
            }

            if (tweet.tweetUrl) {
                markdown += `**原文链接**: ${tweet.tweetUrl}\n\n`;
            }

            markdown += `---\n\n`;
        });

        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `squirrel-collection-${new Date().toISOString().split('T')[0]}.md`;
        link.click();
        URL.revokeObjectURL(url);
        showNotification('✓ 已导出为 Markdown');
    }

    return (
        <div className="h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors font-sans">
            {/* Sticky Header Section with Glassmorphism */}
            <div className="sticky top-0 z-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 transition-colors">
                {/* Top Bar */}
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img 
                            src="/icons/logo.png" 
                            alt="Logo" 
                            width="24" 
                            height="24" 
                            className="rounded-lg shadow-sm"
                        />
                        <h1 className="text-base font-semibold text-zinc-800 dark:text-zinc-100 tracking-tight">
                            松鼠收藏夹
                        </h1>
                    </div>
                    <div className="flex items-center gap-1">
                        {/* Theme Toggle */}
                        <div className="relative group">
                            <button
                                onClick={cycleTheme}
                                className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                            >
                                {getThemeIcon()}
                            </button>
                            <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 text-[10px] font-medium text-white bg-zinc-800 dark:bg-zinc-700 rounded shadow-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                {theme === 'system' ? '跟随系统' : theme === 'dark' ? '深色模式' : '浅色模式'}
                            </span>
                        </div>

                        {/* 悬浮按钮开关 */}
                        <div className="relative group">
                            <button
                                onClick={toggleFloatingButton}
                                className={cn(
                                    'p-2 rounded-md transition-colors',
                                    settings?.showFloatingButton !== false
                                        ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10'
                                        : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                )}
                            >
                                <MousePointer2 className="w-4 h-4" />
                            </button>
                            <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 text-[10px] font-medium text-white bg-zinc-800 dark:bg-zinc-700 rounded shadow-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                悬浮按钮 {settings?.showFloatingButton !== false ? '已开启' : '已关闭'}
                            </span>
                        </div>

                        {/* Feishu Sync Button */}
                        {settings?.feishu?.docToken && (
                            <div className="relative group">
                                <button
                                    onClick={handleSyncToFeishu}
                                    disabled={syncing}
                                    className={cn(
                                        "p-2 rounded-md transition-colors",
                                        syncing
                                            ? "text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                                            : settings?.feishu?.autoSync
                                                ? "text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10"
                                                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                    )}
                                >
                                    {syncing ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : settings?.feishu?.autoSync ? (
                                        <Cloud className="w-4 h-4" />
                                    ) : (
                                        <CloudOff className="w-4 h-4" />
                                    )}
                                </button>
                                <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 text-[10px] font-medium text-white bg-zinc-800 dark:bg-zinc-700 rounded shadow-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                    {syncing ? '同步中...' : settings?.feishu?.autoSync ? '飞书自动同步' : '同步到飞书'}
                                </span>
                            </div>
                        )}

                        {/* Settings */}
                        <div className="relative group">
                            <button
                                onClick={() => chrome.runtime.openOptionsPage()}
                                className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                            >
                                <SettingsIcon className="w-4 h-4" />
                            </button>
                            <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 text-[10px] font-medium text-white bg-zinc-800 dark:bg-zinc-700 rounded shadow-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                设置
                            </span>
                        </div>

                         {/* Export Dropdown */}
                         {tweets.length > 0 && (
                            <div className="relative group ml-1">
                                <button
                                    className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                                >
                                    <Download className="w-4 h-4" />
                                </button>
                                <span className="absolute top-full right-0 mt-1.5 px-2 py-1 text-[10px] font-medium text-white bg-zinc-800 dark:bg-zinc-700 rounded shadow-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                                    导出
                                </span>
                                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[140px]">
                                    <button
                                        onClick={exportAsJSON}
                                        className="w-full px-4 py-2.5 text-left text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors"
                                    >
                                        导出为 JSON
                                    </button>
                                    <button
                                        onClick={exportAsMarkdown}
                                        className="w-full px-4 py-2.5 text-left text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors"
                                    >
                                        导出为 Markdown
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex px-2 pb-2 gap-1">
                    <button
                        onClick={() => setActiveTab('collection')}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all',
                            activeTab === 'collection'
                                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'
                                : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-700 dark:hover:text-zinc-300'
                        )}
                    >
                        <BookOpen className="w-4 h-4" />
                        收藏库
                    </button>
                    <button
                        onClick={() => setActiveTab('create')}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all',
                            activeTab === 'create'
                                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'
                                : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-700 dark:hover:text-zinc-300'
                        )}
                    >
                        <PenTool className="w-4 h-4" />
                        创作
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
                {activeTab === 'collection' && (
                    <div className="space-y-4">
                        {/* 选择模式顶栏 */}
                        {selectMode && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Library className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                        选择参考内容
                                    </span>
                                    {selectedTweets.size > 0 && (
                                        <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                                            {selectedTweets.size}
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectMode(false);
                                        setActiveTab('create');
                                    }}
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                >
                                    取消
                                </button>
                            </div>
                        )}

                        {/* Filters - 非选择模式下显示 */}
                        {tweets.length > 0 && !selectMode && (
                            <div className="flex gap-2 items-center sticky top-0 z-0"> 
                                {/* Platform Filter */}
                                {platforms.length > 0 && (
                                    <div className="relative min-w-[110px]">
                                        <select
                                            value={platformFilter}
                                            onChange={(e) => setPlatformFilter(e.target.value)}
                                            className="w-full appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg pl-3 pr-8 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer shadow-sm"
                                        >
                                            <option value="all">全部平台</option>
                                            {platforms.map(p => (
                                                <option key={p} value={p}>{getPlatformName(p)}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                                    </div>
                                )}

                                {/* Category Filter */}
                                <div className="relative flex-1">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none">
                                        <Filter className="w-full h-full" />
                                    </div>
                                    <select
                                        value={categoryFilter}
                                        onChange={(e) => setCategoryFilter(e.target.value)}
                                        className="w-full appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg pl-9 pr-8 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer shadow-sm"
                                    >
                                        <option value="all">全部分类</option>
                                        {categories.filter(c => c !== 'all').map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                                </div>
                            </div>
                        )}

                        {/* Tweet List */}
                        {filteredTweets.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="bg-zinc-100 dark:bg-zinc-900/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <BookOpen className="w-8 h-8 text-zinc-400 dark:text-zinc-600" />
                                </div>
                                <p className="text-sm text-zinc-600 dark:text-zinc-400 font-medium">
                                    {tweets.length === 0 ? '还没有收藏的内容' : '该类别暂无内容'}
                                </p>
                                <p className="text-xs mt-1.5 text-zinc-400 dark:text-zinc-500">在 Twitter / 小红书上点击悬浮按钮收藏</p>
                            </div>
                        ) : (
                            <div className={cn("grid gap-4", selectMode && "pb-20")}>
                                {filteredTweets.map((tweet) => (
                                    <div
                                        key={tweet.id}
                                        className={cn(
                                            'group bg-white dark:bg-zinc-900 rounded-xl p-5 transition-all border shadow-sm hover:shadow-md relative min-w-0',
                                            'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700',
                                            selectMode && 'cursor-pointer',
                                            selectMode && selectedTweets.has(tweet.id) && 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/10'
                                        )}
                                        onClick={() => selectMode && toggleSelect(tweet.id)}
                                    >
                                        {/* 选择模式下的选中勾选 */}
                                        {selectMode && (
                                            <div className={cn(
                                                "absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                                                selectedTweets.has(tweet.id)
                                                    ? "bg-blue-600 border-blue-600"
                                                    : "border-zinc-300 dark:border-zinc-600"
                                            )}>
                                                {selectedTweets.has(tweet.id) && (
                                                    <Check className="w-3 h-3 text-white" />
                                                )}
                                            </div>
                                        )}

                                        {/* Card Header */}
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {/* 头像 */}
                                                <a
                                                    href={getProfileUrl(tweet)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="shrink-0"
                                                >
                                                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-600 flex items-center justify-center overflow-hidden">
                                                        {/* 优先使用存储的头像，其次用 unavatar，最后用首字母 */}
                                                        {tweet.authorAvatar ? (
                                                            <img 
                                                                src={tweet.authorAvatar}
                                                                alt={tweet.author}
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    e.currentTarget.style.display = 'none';
                                                                    e.currentTarget.parentElement!.innerHTML = `<span class="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">${tweet.author?.charAt(0)?.toUpperCase() || '?'}</span>`;
                                                                }}
                                                            />
                                                        ) : tweet.platform === 'twitter' && tweet.authorHandle ? (
                                                            <img 
                                                                src={`https://unavatar.io/twitter/${tweet.authorHandle}`}
                                                                alt={tweet.author}
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    e.currentTarget.style.display = 'none';
                                                                    e.currentTarget.parentElement!.innerHTML = `<span class="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">${tweet.author?.charAt(0)?.toUpperCase() || '?'}</span>`;
                                                                }}
                                                            />
                                                        ) : (
                                                            <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                                                                {tweet.author?.charAt(0)?.toUpperCase() || '?'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </a>
                                                {/* 作者名 */}
                                                <a
                                                    href={getProfileUrl(tweet)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm truncate hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors"
                                                >
                                                    {tweet.author}
                                                </a>
                                                {/* 平台标签 */}
                                                <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-full font-medium shrink-0">
                                                    {getPlatformName(tweet.platform)}
                                                </span>
                                                {tweet.category && (
                                                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 shrink-0', getCategoryColor(tweet.category))}>
                                                        {tweet.category}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium whitespace-nowrap">
                                                {formatDate(tweet.collectTime)}
                                            </span>
                                        </div>

                                        {/* Summary Content */}
                                        <div className="mb-3">
                                            {tweet.summary ? (
                                                <div className="relative">
                                                    <div className={cn(
                                                        "prose prose-sm dark:prose-invert prose-zinc max-w-none break-words",
                                                        "prose-p:my-1.5 prose-p:leading-relaxed",
                                                        "prose-ul:my-1.5 prose-ul:pl-4 prose-li:my-0.5",
                                                        "prose-ol:my-1.5 prose-ol:pl-4",
                                                        "prose-strong:text-zinc-800 dark:prose-strong:text-zinc-200",
                                                        "prose-code:bg-zinc-100 dark:prose-code:bg-zinc-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none",
                                                        !expandedTweets.has(tweet.id) && "line-clamp-4"
                                                    )}>
                                                        <ReactMarkdown>
                                                            {tweet.summary}
                                                        </ReactMarkdown>
                                                    </div>
                                                    {tweet.summary.length > 120 && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleExpanded(tweet.id);
                                                            }}
                                                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1.5 font-medium"
                                                        >
                                                            {expandedTweets.has(tweet.id) ? '收起' : '展开全文'}
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-zinc-400 text-sm italic py-2">
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    <span>正在生成摘要...</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Footer: Keywords & Hover Actions */}
                                        <div className="flex items-end justify-between min-h-[28px]">
                                            <div className="flex flex-wrap gap-1.5">
                                                {tweet.keywords.length > 0 && tweet.keywords.map((kw, idx) => (
                                                    <span key={idx} className="text-[10px] bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 px-2 py-1 rounded border border-zinc-100 dark:border-zinc-700/50">
                                                        #{kw}
                                                    </span>
                                                ))}
                                            </div>
                                            
                                            {/* Actions - visible on hover */}
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                                {tweet.tweetUrl && (
                                                    <a
                                                        href={tweet.tweetUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="p-1.5 text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-md transition-colors"
                                                        title="查看原文"
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </a>
                                                )}
                                                <a
                                                    href={getProfileUrl(tweet)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="p-1.5 text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-md transition-colors"
                                                    title="作者主页"
                                                >
                                                     {/* Replaced with User Icon since image loading might be unreliable and user icon is safer default */}
                                                    <ExternalLink className="w-3.5 h-3.5 hidden" /> 
                                                    <span className="text-[10px] font-bold">@</span>
                                                </a>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        showDeleteConfirm(tweet.id, tweet.author);
                                                    }}
                                                    className="p-1.5 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors"
                                                    title="删除"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 选择模式 - 底部确认按钮 */}
                        {selectMode && (
                            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 shadow-lg">
                                <button
                                    onClick={() => {
                                        setSelectMode(false);
                                        setActiveTab('create');
                                    }}
                                    className={cn(
                                        "w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all text-sm",
                                        selectedTweets.size > 0
                                            ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow"
                                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                                    )}
                                >
                                    <Check className="w-4 h-4" />
                                    {selectedTweets.size > 0 
                                        ? `确认选择 (${selectedTweets.size})` 
                                        : '完成选择'
                                    }
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'create' && (
                    <div className="space-y-4">
                        {/* 创作参考区域 - 支持收藏和灵感两种来源 */}
                        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                            <div className="p-4">
                                {/* 标题和清空按钮 */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Library className="w-4 h-4 text-zinc-400" />
                                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                            创作参考
                                        </h3>
                                    </div>
                                    {(selectedTweets.size > 0 || selectedInspirationItems.size > 0) && (
                                        <button
                                            onClick={() => {
                                                setSelectedTweets(new Set());
                                                setSelectedInspirationItems(new Set());
                                            }}
                                            className="text-xs text-zinc-400 hover:text-red-500 transition-colors"
                                        >
                                            清空选择
                                        </button>
                                    )}
                                </div>

                                {/* 参考来源切换 Tabs */}
                                <div className="flex gap-1 mb-3 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                                    <button
                                        onClick={() => setReferenceSource('collection')}
                                        className={cn(
                                            'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all',
                                            referenceSource === 'collection'
                                                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                                                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                                        )}
                                    >
                                        <BookOpen className="w-3 h-3" />
                                        收藏
                                        {selectedTweets.size > 0 && (
                                            <span className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                                {selectedTweets.size}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setReferenceSource('inspiration')}
                                        className={cn(
                                            'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all',
                                            referenceSource === 'inspiration'
                                                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                                                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                                        )}
                                    >
                                        <Lightbulb className={cn('w-3 h-3', inspirationMode && 'text-amber-500')} />
                                        灵感
                                        {selectedInspirationItems.size > 0 && (
                                            <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                                {selectedInspirationItems.size}
                                            </span>
                                        )}
                                        {inspirationMode && (
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                            </span>
                                        )}
                                    </button>
                                </div>

                                {/* 收藏来源内容 */}
                                {referenceSource === 'collection' && (
                                    <>
                                        {selectedTweets.size === 0 ? (
                                            <button
                                                onClick={() => {
                                                    setSelectMode(true);
                                                    setActiveTab('collection');
                                                }}
                                                className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-400 hover:text-blue-500 hover:border-blue-400 dark:hover:border-blue-500 transition-all group"
                                            >
                                                <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                                <span className="text-sm">从收藏中选择参考内容</span>
                                            </button>
                                        ) : (
                                            <div className="space-y-2">
                                                {Array.from(selectedTweets).map((id) => {
                                                    const tweet = tweets.find(t => t.id === id);
                                                    if (!tweet) return null;
                                                    return (
                                                        <div key={id} className="flex items-start gap-2 p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg group">
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
                                                                    {tweet.author}
                                                                </p>
                                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
                                                                    {tweet.summary || tweet.content.slice(0, 50)}
                                                                </p>
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    const newSelected = new Set(selectedTweets);
                                                                    newSelected.delete(id);
                                                                    setSelectedTweets(newSelected);
                                                                }}
                                                                className="p-1 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                                <button
                                                    onClick={() => {
                                                        setSelectMode(true);
                                                        setActiveTab('collection');
                                                    }}
                                                    className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                    添加更多
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* 灵感来源内容 */}
                                {referenceSource === 'inspiration' && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                        {/* 灵感模式开关卡片 */}
                                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200/50 dark:border-amber-800/30 rounded-xl p-4 relative overflow-hidden">
                                            {/* 背景装饰 */}
                                            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-amber-100 dark:bg-amber-900/20 rounded-full blur-2xl opacity-50 pointer-events-none"></div>
                                            
                                            <div className="flex items-center justify-between relative z-10">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <div className={cn(
                                                            "p-1.5 rounded-lg transition-colors",
                                                            inspirationMode ? "bg-amber-500 text-white shadow-sm" : "bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400"
                                                        )}>
                                                            <Sparkles className="w-4 h-4" />
                                                        </div>
                                                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">灵感模式</h3>
                                                    </div>
                                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                                        {inspirationMode 
                                                            ? '正在自动采集浏览内容...' 
                                                            : '浏览时自动采集灵感素材'}
                                                    </p>
                                                </div>
                                                
                                                <button
                                                    onClick={toggleInspirationMode}
                                                    className={cn(
                                                        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900',
                                                        inspirationMode ? 'bg-amber-500' : 'bg-zinc-200 dark:bg-zinc-700'
                                                    )}
                                                >
                                                    <span className="sr-only">Use setting</span>
                                                    <span
                                                        className={cn(
                                                            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                                                            inspirationMode ? 'translate-x-5' : 'translate-x-0'
                                                        )}
                                                    />
                                                </button>
                                            </div>

                                            {/* 实时采集日志 */}
                                            {inspirationMode && captureLog.length > 0 && (
                                                <div className="mt-4 pt-3 border-t border-amber-200/30 dark:border-amber-800/30">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="relative flex h-2 w-2">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                                        </span>
                                                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-500 uppercase tracking-wider">实时动态</span>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        {captureLog.slice(0, 3).map((log, idx) => (
                                                            <div 
                                                                key={log.time} 
                                                                className={cn(
                                                                    "flex items-start gap-2 text-xs transition-all duration-300",
                                                                    idx === 0 ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-500 dark:text-zinc-500"
                                                                )}
                                                            >
                                                                <span className="text-[10px] opacity-50 mt-0.5">{new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                                                <span className="truncate flex-1">{log.text}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* 灵感内容列表 */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between px-1">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                                        采集列表
                                                    </h4>
                                                    <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-medium px-1.5 py-0.5 rounded-md">
                                                        {inspirationItems.length}
                                                    </span>
                                                </div>
                                                {inspirationItems.length > 0 && (
                                                    <button
                                                        onClick={clearInspirationItems}
                                                        className="text-[10px] text-zinc-400 hover:text-red-500 transition-colors flex items-center gap-1"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                        清空
                                                    </button>
                                                )}
                                            </div>

                                            {inspirationItems.length === 0 ? (
                                                <div className="text-center py-8 border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-xl">
                                                    <div className="bg-zinc-50 dark:bg-zinc-900 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                                        <Lightbulb className="w-6 h-6 text-zinc-300 dark:text-zinc-600" />
                                                    </div>
                                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-[200px] mx-auto leading-relaxed">
                                                        {inspirationMode 
                                                            ? '去浏览 Twitter 或 小红书\n灵感会自动出现在这里' 
                                                            : '开启上方灵感模式\n自动采集你的浏览足迹'}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="max-h-[300px] overflow-y-auto space-y-2 scrollbar-thin pr-1">
                                                    {inspirationItems.slice(0, 20).map((item) => (
                                                        <div
                                                            key={item.id}
                                                            onClick={() => toggleInspirationSelect(item.id)}
                                                            className={cn(
                                                                'group relative flex gap-3 p-3 rounded-xl cursor-pointer transition-all border',
                                                                selectedInspirationItems.has(item.id)
                                                                    ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50 shadow-sm ring-1 ring-amber-200 dark:ring-amber-800/30'
                                                                    : 'bg-white dark:bg-zinc-900/50 border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                                                            )}
                                                        >
                                                            {/* 缩略图 */}
                                                            <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700/50">
                                                                {item.thumbnail ? (
                                                                    <img
                                                                        src={item.thumbnail}
                                                                        alt=""
                                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                                        onError={(e) => {
                                                                            e.currentTarget.style.display = 'none';
                                                                            e.currentTarget.parentElement!.innerHTML = `<div class="w-full h-full flex items-center justify-center text-zinc-300 dark:text-zinc-600"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></div>`;
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-zinc-300 dark:text-zinc-600">
                                                                        <div className="w-5 h-5 opacity-50">
                                                                            {item.platform === 'twitter' ? (
                                                                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                                                                            ) : (
                                                                                <BookOpen className="w-full h-full" />
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            
                                                            {/* 内容 */}
                                                            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                                                <div>
                                                                    <div className="flex items-center gap-1.5 mb-1">
                                                                        <span className={cn(
                                                                            'text-[10px] px-1.5 py-0.5 rounded-md font-medium flex items-center gap-1',
                                                                            item.platform === 'twitter' 
                                                                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                                                                                : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                                                                        )}>
                                                                            {item.platform === 'twitter' ? 'Twitter' : '小红书'}
                                                                        </span>
                                                                        {item.isDetail && (
                                                                            <span className="text-[10px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-md font-medium">
                                                                                详情
                                                                            </span>
                                                                        )}
                                                                        <span className="text-[10px] text-zinc-400 truncate max-w-[80px]">
                                                                            @{item.author}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-xs text-zinc-700 dark:text-zinc-300 line-clamp-2 font-medium leading-relaxed">
                                                                        {item.title || item.content || item.summary}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {/* 选择状态指示器 */}
                                                            <div className={cn(
                                                                'absolute top-3 right-3 w-4 h-4 rounded-full border transition-all flex items-center justify-center',
                                                                selectedInspirationItems.has(item.id)
                                                                    ? 'bg-amber-500 border-amber-500 shadow-sm'
                                                                    : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 opacity-0 group-hover:opacity-100'
                                                            )}>
                                                                {selectedInspirationItems.has(item.id) && (
                                                                    <Check className="w-2.5 h-2.5 text-white" />
                                                                )}
                                                            </div>

                                                            {/* 删除按钮 */}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    removeInspirationItem(item.id);
                                                                }}
                                                                className="absolute bottom-3 right-3 p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Creation Form */}
                        <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 space-y-5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                            <div>
                                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                                    创作主题
                                </label>
                                <textarea
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    placeholder="写下你的想法..."
                                    rows={3}
                                    className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-950 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none text-sm transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                                        语言
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={language}
                                            onChange={(e) => setLanguage(e.target.value as any)}
                                            className="w-full appearance-none px-3 py-2 bg-zinc-50 dark:bg-zinc-950 rounded-lg text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm pr-8 transition-all"
                                        >
                                            <option value="zh">中文</option>
                                            <option value="en">English</option>
                                            <option value="ja">日本語</option>
                                            <option value="ko">한국어</option>
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                                        风格
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={tone}
                                            onChange={(e) => setTone(e.target.value as any)}
                                            className="w-full appearance-none px-3 py-2 bg-zinc-50 dark:bg-zinc-950 rounded-lg text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm pr-8 transition-all"
                                        >
                                            <option value="professional">专业严肃</option>
                                            <option value="casual">轻松幽默</option>
                                            <option value="concise">简洁精炼</option>
                                            <option value="detailed">详细解释</option>
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                                    </div>
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                                        长度
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={length}
                                            onChange={(e) => setLength(e.target.value as any)}
                                            className="w-full appearance-none px-3 py-2 bg-zinc-50 dark:bg-zinc-950 rounded-lg text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm pr-8 transition-all"
                                        >
                                            <option value="short">短推 (&lt;140字)</option>
                                            <option value="standard">标准 (140-280字)</option>
                                            <option value="long">长文 (分段)</option>
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleGenerate}
                                disabled={generating || !topic.trim()}
                                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-medium py-3 px-4 rounded-xl hover:bg-blue-700 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-600 disabled:cursor-not-allowed transition-all text-sm shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm"
                            >
                                {generating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        正在思考...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        开始创作
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Generated Results */}
                        {generatedVersions.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 px-1">生成结果</h3>
                                {generatedVersions.map((version, idx) => (
                                    <div key={idx} className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm group hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                                        <div className="flex items-start justify-between mb-3">
                                            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                                                Version {idx + 1}
                                            </span>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => copyToClipboard(version)}
                                                    className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 text-xs px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                    复制
                                                </button>
                                                <button
                                                    onClick={() => publishTweet(version)}
                                                    disabled={publishing}
                                                    className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:text-zinc-400 text-xs px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                                >
                                                    <Send className="w-3.5 h-3.5" />
                                                    发布
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap text-sm leading-relaxed break-words">
                                            {version}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 删除确认弹窗 */}
            {deleteConfirm.show && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-sm w-full overflow-hidden scale-100 animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 text-center">
                            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                                确认删除？
                            </h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                                确定要删除来自 <span className="font-medium text-zinc-900 dark:text-zinc-100">{deleteConfirm.authorName}</span> 的这条收藏吗？此操作无法撤销。
                            </p>
                            
                            <div className="flex gap-3">
                                <button
                                    onClick={cancelDelete}
                                    className="flex-1 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-sm hover:shadow transition-all"
                                >
                                    删除
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
