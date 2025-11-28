import { useEffect, useState } from 'react';
import { BookOpen, PenTool, Trash2, Copy, Sparkles, Loader2, ExternalLink, Send, Tag, Settings as SettingsIcon, Download, MousePointer2, AlertTriangle, X } from 'lucide-react';
import { storage } from '../lib/storage';
import { Tweet, Settings, CreationRequest } from '../lib/types';
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

    useEffect(() => {
        loadData();

        // Listen for storage changes
        chrome.storage.onChanged.addListener((changes) => {
            if (changes.tweets) {
                setTweets((changes.tweets.newValue as Tweet[]) || []);
            }
        });
    }, []);

    async function loadData() {
        const [storedTweets, storedSettings] = await Promise.all([
            storage.getTweets(),
            storage.getSettings(),
        ]);
        setTweets(storedTweets);
        setSettings(storedSettings);
        if (storedSettings) {
            setLanguage(storedSettings.defaultLanguage);
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
            const referenceTweets = tweets
                .filter(t => selectedTweets.has(t.id))
                .map(t => ({ content: t.content, summary: t.summary }));

            const request: CreationRequest = {
                topic,
                references: Array.from(selectedTweets),
                language,
                tone,
                length,
            };

            const versions = await generateTweet(settings, request, referenceTweets);
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
            // Get active Twitter tab
            const [tab] = await chrome.tabs.query({ url: ['https://twitter.com/*', 'https://x.com/*'] });

            if (!tab || !tab.id) {
                throw new Error('请先打开 Twitter/X 页面');
            }

            // Send message to content script to publish
            await chrome.tabs.sendMessage(tab.id, {
                type: 'PUBLISH_TWEET',
                content: text,
            });

            showNotification('✓ 推文已发布！');
        } catch (error) {
            showNotification('✗ 发布失败：' + (error instanceof Error ? error.message : '未知错误'));
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
            '技术': 'bg-purple-500/20 text-purple-400',
            '产品': 'bg-blue-500/20 text-blue-400',
            '营销': 'bg-green-500/20 text-green-400',
            '资讯': 'bg-yellow-500/20 text-yellow-400',
            '观点': 'bg-pink-500/20 text-pink-400',
            '生活': 'bg-orange-500/20 text-orange-400',
            '其他': 'bg-gray-500/20 text-gray-400',
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
    const getProfileUrl = (platform?: string, handle?: string) => {
        if (!handle) return '#';
        switch (platform) {
            case 'twitter':
                return `https://x.com/${handle}`;
            case 'xiaohongshu':
                return `https://www.xiaohongshu.com/user/profile/${handle}`;
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
        <div className="h-screen flex flex-col bg-[#0a0a0a] text-white">
            {/* Header */}
            <div className="bg-[#141414] px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <img 
                        src="/icons/logo.png" 
                        alt="Logo" 
                        width="28" 
                        height="28" 
                        className="rounded-lg"
                    />
                    <h1 className="text-lg font-semibold text-white">
                        松鼠收藏夹
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    {/* 悬浮按钮开关 */}
                    <button
                        onClick={toggleFloatingButton}
                        className={cn(
                            'p-2 rounded-lg transition-colors',
                            settings?.showFloatingButton !== false
                                ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/10'
                                : 'text-gray-600 hover:text-gray-400 hover:bg-[#1a1a1a]'
                        )}
                        title={settings?.showFloatingButton !== false ? '悬浮按钮已开启' : '悬浮按钮已关闭'}
                    >
                        <MousePointer2 className="w-5 h-5" />
                    </button>
                    {/* Export Dropdown */}
                    {tweets.length > 0 && (
                        <div className="relative group">
                            <button
                                className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
                                title="导出"
                            >
                                <Download className="w-5 h-5" />
                            </button>
                            <div className="absolute right-0 top-full mt-1 bg-[#1a1a1a] border border-gray-800 rounded-lg shadow-lg overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[120px]">
                                <button
                                    onClick={exportAsJSON}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-[#242424] hover:text-white transition-colors"
                                >
                                    导出为 JSON
                                </button>
                                <button
                                    onClick={exportAsMarkdown}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-[#242424] hover:text-white transition-colors"
                                >
                                    导出为 Markdown
                                </button>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => chrome.runtime.openOptionsPage()}
                        className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors"
                        title="设置"
                    >
                        <SettingsIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-[#141414]">
                <button
                    onClick={() => setActiveTab('collection')}
                    className={cn(
                        'flex-1 flex items-center justify-center gap-2 py-3 font-medium transition-colors text-sm',
                        activeTab === 'collection'
                            ? 'text-blue-500 border-b-2 border-blue-500'
                            : 'text-gray-500 hover:text-gray-300'
                    )}
                >
                    <BookOpen className="w-4 h-4" />
                    收藏库
                </button>
                <button
                    onClick={() => setActiveTab('create')}
                    className={cn(
                        'flex-1 flex items-center justify-center gap-2 py-3 font-medium transition-colors text-sm',
                        activeTab === 'create'
                            ? 'text-blue-500 border-b-2 border-blue-500'
                            : 'text-gray-500 hover:text-gray-300'
                    )}
                >
                    <PenTool className="w-4 h-4" />
                    创作
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {activeTab === 'collection' && (
                    <div className="space-y-3">
                        {/* 筛选器 */}
                        {tweets.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {/* 平台筛选 */}
                                {platforms.length > 0 && (
                                    <>
                                        <button
                                            onClick={() => setPlatformFilter('all')}
                                            className={cn(
                                                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                                                platformFilter === 'all'
                                                    ? 'bg-blue-500 text-white'
                                                    : 'bg-[#141414] text-gray-400 hover:text-gray-300'
                                            )}
                                        >
                                            全部
                                        </button>
                                        {platforms.map(platform => (
                                            <button
                                                key={platform}
                                                onClick={() => setPlatformFilter(platform || 'all')}
                                                className={cn(
                                                    'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                                                    platformFilter === platform
                                                        ? 'bg-blue-500 text-white'
                                                        : 'bg-[#141414] text-gray-400 hover:text-gray-300'
                                                )}
                                            >
                                                {getPlatformName(platform)}
                                            </button>
                                        ))}
                                        <div className="w-px bg-gray-800 self-stretch mx-1" />
                                    </>
                                )}

                                {/* 类别筛选 */}
                                <button
                                    onClick={() => setCategoryFilter('all')}
                                    className={cn(
                                        'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                                        categoryFilter === 'all'
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-[#141414] text-gray-400 hover:text-gray-300'
                                    )}
                                >
                                    全部分类
                                </button>
                                {categories.filter(c => c !== 'all').map(category => (
                                    <button
                                        key={category}
                                        onClick={() => setCategoryFilter(category || 'all')}
                                        className={cn(
                                            'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                                            categoryFilter === category
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-[#141414] text-gray-400 hover:text-gray-300'
                                        )}
                                    >
                                        {category}
                                    </button>
                                ))}
                            </div>
                        )}

                        {filteredTweets.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-700" />
                                <p className="text-sm">
                                    {tweets.length === 0 ? '还没有收藏的推文' : '该类别暂无内容'}
                                </p>
                                <p className="text-xs mt-1 text-gray-600">在 Twitter 上点击悬浮按钮收藏</p>
                            </div>
                        ) : (
                            filteredTweets.map((tweet) => (
                                <div
                                    key={tweet.id}
                                    className={cn(
                                        'bg-[#141414] rounded-xl p-4 transition-all cursor-pointer relative group',
                                        selectedTweets.has(tweet.id)
                                            ? 'bg-blue-500/5 ring-1 ring-blue-500/30'
                                            : 'hover:bg-[#1a1a1a]'
                                    )}
                                    onClick={() => toggleSelect(tweet.id)}
                                >
                                    {/* 时间线指示器 */}
                                    <div className="flex items-start gap-3">
                                        <div className="flex flex-col items-center">
                                            <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                                            <div className="w-0.5 flex-1 bg-gray-800 mt-1" />
                                        </div>
                                        <div className="flex-1 min-w-0 space-y-3">
                                            {/* 头部信息 */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <a
                                                    href={getProfileUrl(tweet.platform, tweet.authorHandle)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="font-medium text-white text-sm hover:text-blue-400 hover:underline transition-colors"
                                                >
                                                    {tweet.author}
                                                </a>
                                                <a
                                                    href={getProfileUrl(tweet.platform, tweet.authorHandle)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-gray-500 text-xs hover:text-blue-400 transition-colors"
                                                >
                                                    @{tweet.authorHandle}
                                                </a>
                                                {tweet.platform && (
                                                    <span className="text-xs bg-gray-800/50 text-gray-400 px-2 py-0.5 rounded-full">
                                                        {getPlatformName(tweet.platform)}
                                                    </span>
                                                )}
                                                {tweet.category && (
                                                    <span className={cn('text-xs px-2 py-0.5 rounded-full flex items-center gap-1', getCategoryColor(tweet.category))}>
                                                        <Tag className="w-3 h-3" />
                                                        {tweet.category}
                                                    </span>
                                                )}
                                            </div>

                                            {/* AI 摘要 - 主要内容 */}
                                            {tweet.summary ? (
                                                <div>
                                                    <p className="text-gray-300 text-sm leading-relaxed">
                                                        {expandedTweets.has(tweet.id)
                                                            ? tweet.summary
                                                            : tweet.summary.length > 120
                                                                ? tweet.summary.slice(0, 120) + '...'
                                                                : tweet.summary
                                                        }
                                                    </p>
                                                    {tweet.summary.length > 120 && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleExpanded(tweet.id);
                                                            }}
                                                            className="text-xs text-blue-400 hover:text-blue-300 mt-1 transition-colors"
                                                        >
                                                            {expandedTweets.has(tweet.id) ? '收起' : '展开全文'}
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-gray-500 text-sm italic">
                                                    正在生成摘要...
                                                </p>
                                            )}

                                            {/* 关键词标签 */}
                                            {tweet.keywords.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {tweet.keywords.map((kw, idx) => (
                                                        <span key={idx} className="text-xs bg-gray-800/50 text-gray-400 px-2 py-0.5 rounded-full">
                                                            #{kw}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {/* 时间和操作按钮 */}
                                            <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                                                <div className="text-xs text-gray-600">
                                                    {formatDate(tweet.collectTime)}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {tweet.tweetUrl && (
                                                        <a
                                                            href={tweet.tweetUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                            查看原文
                                                        </a>
                                                    )}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            showDeleteConfirm(tweet.id, tweet.author);
                                                        }}
                                                        className="text-gray-600 hover:text-red-400 transition-colors"
                                                        title="删除"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'create' && (
                    <div className="space-y-4">
                        {/* Selected References */}
                        {selectedTweets.size > 0 && (
                            <div className="bg-[#141414] rounded-xl p-3">
                                <h3 className="text-sm font-semibold text-white mb-1">
                                    已选择 {selectedTweets.size} 条参考推文
                                </h3>
                                <button
                                    onClick={() => setSelectedTweets(new Set())}
                                    className="text-xs text-blue-500 hover:text-blue-400"
                                >
                                    清空选择
                                </button>
                            </div>
                        )}

                        {/* Creation Form */}
                        <div className="bg-[#141414] rounded-xl p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    创作主题
                                </label>
                                <textarea
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    placeholder="输入你想要创作的主题或想法..."
                                    rows={3}
                                    className="w-full px-3 py-2 bg-[#0a0a0a] rounded-lg text-white placeholder-gray-600 focus:ring-1 focus:ring-blue-500 outline-none resize-none text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        语言
                                    </label>
                                    <select
                                        value={language}
                                        onChange={(e) => setLanguage(e.target.value as any)}
                                        className="w-full px-3 py-2 bg-[#0a0a0a] rounded-lg text-white focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                    >
                                        <option value="zh">中文</option>
                                        <option value="en">English</option>
                                        <option value="ja">日本語</option>
                                        <option value="ko">한국어</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        风格
                                    </label>
                                    <select
                                        value={tone}
                                        onChange={(e) => setTone(e.target.value as any)}
                                        className="w-full px-3 py-2 bg-[#0a0a0a] rounded-lg text-white focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                    >
                                        <option value="professional">专业严肃</option>
                                        <option value="casual">轻松幽默</option>
                                        <option value="concise">简洁精炼</option>
                                        <option value="detailed">详细解释</option>
                                    </select>
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        长度
                                    </label>
                                    <select
                                        value={length}
                                        onChange={(e) => setLength(e.target.value as any)}
                                        className="w-full px-3 py-2 bg-[#0a0a0a] rounded-lg text-white focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                                    >
                                        <option value="short">短推 (&lt;140字)</option>
                                        <option value="standard">标准 (140-280字)</option>
                                        <option value="long">长文 (分段)</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={handleGenerate}
                                disabled={generating || !topic.trim()}
                                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-medium py-2.5 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors text-sm"
                            >
                                {generating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        生成中...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        生成推文
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Generated Results */}
                        {generatedVersions.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-white">生成结果</h3>
                                {generatedVersions.map((version, idx) => (
                                    <div key={idx} className="bg-[#141414] rounded-xl p-3">
                                        <div className="flex items-start justify-between mb-2">
                                            <span className="text-xs font-medium text-gray-500">版本 {idx + 1}</span>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => copyToClipboard(version)}
                                                    className="flex items-center gap-1 text-gray-400 hover:text-gray-300 text-xs"
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                    复制
                                                </button>
                                                <button
                                                    onClick={() => publishTweet(version)}
                                                    disabled={publishing}
                                                    className="flex items-center gap-1 text-blue-500 hover:text-blue-400 disabled:text-gray-600 text-xs"
                                                >
                                                    <Send className="w-3.5 h-3.5" />
                                                    发布
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-gray-300 whitespace-pre-wrap text-sm">{version}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 删除确认弹窗 */}
            {deleteConfirm.show && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 shadow-2xl max-w-sm w-full overflow-hidden">
                        {/* 弹窗头部 */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                            <div className="flex items-center gap-2 text-red-400">
                                <AlertTriangle className="w-5 h-5" />
                                <span className="font-medium">确认删除</span>
                            </div>
                            <button
                                onClick={cancelDelete}
                                className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        
                        {/* 弹窗内容 */}
                        <div className="px-4 py-4">
                            <p className="text-gray-300 text-sm">
                                确定要删除 <span className="text-white font-medium">{deleteConfirm.authorName}</span> 的这条收藏吗？
                            </p>
                            <p className="text-gray-500 text-xs mt-2">
                                此操作无法撤销
                            </p>
                        </div>
                        
                        {/* 弹窗按钮 */}
                        <div className="flex gap-2 px-4 py-3 border-t border-gray-800 bg-[#141414]">
                            <button
                                onClick={cancelDelete}
                                className="flex-1 px-4 py-2 text-sm text-gray-300 bg-[#242424] rounded-lg hover:bg-[#2a2a2a] transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                            >
                                删除
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
