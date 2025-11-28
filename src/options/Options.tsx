import { useEffect, useState } from 'react';
import { Save, CheckCircle, AlertCircle } from 'lucide-react';
import { storage } from '../lib/storage';
import { Settings } from '../lib/types';
import { callAI, defaultSummaryRules } from '../lib/ai';

export default function Options() {
    const [settings, setSettings] = useState<Settings>({
        apiKey: '',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o',
        defaultLanguage: 'zh',
        readingMode: false,
    });
    const [saved, setSaved] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    useEffect(() => {
        loadSettings();
    }, []);

    async function loadSettings() {
        const stored = await storage.getSettings();
        if (stored) {
            setSettings(stored);
        }
    }

    async function handleSave() {
        await storage.saveSettings(settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }

    async function testConnection() {
        setTesting(true);
        setTestResult(null);

        try {
            await callAI(settings, [
                { role: 'user', content: 'Hello, please respond with "OK"' }
            ]);
            setTestResult({ success: true, message: '连接成功！' });
        } catch (error) {
            setTestResult({
                success: false,
                message: error instanceof Error ? error.message : '连接失败'
            });
        } finally {
            setTesting(false);
        }
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white">
            <div className="max-w-3xl mx-auto p-6">
                {/* Header */}
                <div className="mb-6 flex items-center gap-3">
                    <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="100" height="100" rx="22" fill="#14171A" />
                        <path d="M62 15L32 48H48L38 85L70 48H56L62 15Z" fill="white" />
                    </svg>
                    <div>
                        <h1 className="text-2xl font-bold text-white">设置</h1>
                        <p className="text-sm text-gray-400 mt-1">配置 AI 模型和偏好设置</p>
                    </div>
                </div>

                {/* Settings Form */}
                <div className="bg-[#141414] rounded-lg border border-gray-800 p-6 space-y-6">
                    {/* API Settings */}
                    <div>
                        <h2 className="text-lg font-semibold text-white mb-4">AI API 配置</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    API Key
                                </label>
                                <input
                                    type="password"
                                    value={settings.apiKey}
                                    onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                                    placeholder="sk-..."
                                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Base URL
                                </label>
                                <input
                                    type="url"
                                    value={settings.baseUrl}
                                    onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
                                    placeholder="https://api.openai.com/v1"
                                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                />
                                <p className="text-xs text-gray-500 mt-1.5">
                                    兼容 OpenAI API 格式的接口地址
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    模型名称
                                </label>
                                <input
                                    type="text"
                                    value={settings.model}
                                    onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                                    placeholder="gpt-4o"
                                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                />
                                <p className="text-xs text-gray-500 mt-1.5">
                                    例如：gpt-4o, claude-sonnet-4-20250514, gemini-pro 等
                                </p>
                            </div>

                            <button
                                onClick={testConnection}
                                disabled={testing || !settings.apiKey || !settings.baseUrl}
                                className="px-4 py-2 bg-[#1a1a1a] text-white rounded-lg hover:bg-[#242424] disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors text-sm border border-gray-800"
                            >
                                {testing ? '测试中...' : '测试连接'}
                            </button>

                            {testResult && (
                                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${testResult.success
                                    ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                                    : 'bg-red-500/10 text-red-500 border border-red-500/20'
                                    }`}>
                                    {testResult.success ? (
                                        <CheckCircle className="w-4 h-4" />
                                    ) : (
                                        <AlertCircle className="w-4 h-4" />
                                    )}
                                    <span>{testResult.message}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Language Preference */}
                    <div className="pt-4 border-t border-gray-800">
                        <h2 className="text-lg font-semibold text-white mb-4">默认设置</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    默认语言
                                </label>
                                <select
                                    value={settings.defaultLanguage}
                                    onChange={(e) => setSettings({ ...settings, defaultLanguage: e.target.value as 'zh' | 'en' | 'ja' | 'ko' })}
                                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-800 rounded-lg text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                >
                                    <option value="zh">中文</option>
                                    <option value="en">English</option>
                                    <option value="ja">日本語</option>
                                    <option value="ko">한국어</option>
                                </select>
                            </div>

                            {/* Image Recognition Toggle */}
                            <div className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    id="imageRecognition"
                                    checked={settings.enableImageRecognition || false}
                                    onChange={(e) => setSettings({ ...settings, enableImageRecognition: e.target.checked })}
                                    className="mt-1 w-4 h-4 rounded bg-[#0a0a0a] border-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                                />
                                <div className="flex-1">
                                    <label htmlFor="imageRecognition" className="text-sm font-medium text-gray-300 cursor-pointer">
                                        启用图片识别
                                    </label>
                                    <p className="text-xs text-gray-500 mt-1">
                                        使用多模态大模型识别图片中的文字内容，收藏时自动分析图片并提取文字。需要模型支持视觉功能（如 GPT-4o、Claude 3.5 Sonnet、Gemini Pro Vision）。
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Custom Summary Prompt */}
                    <div className="pt-4 border-t border-gray-800">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-white">自定义摘要提示词</h2>
                            <button
                                onClick={() => setSettings({ ...settings, customSummaryPrompt: defaultSummaryRules })}
                                className="px-3 py-1.5 text-xs bg-[#1a1a1a] text-gray-400 rounded-lg hover:bg-[#242424] hover:text-white transition-colors border border-gray-800"
                            >
                                恢复默认
                            </button>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                摘要规则
                            </label>
                            <textarea
                                value={settings.customSummaryPrompt ?? DEFAULT_SUMMARY_PROMPT}
                                onChange={(e) => setSettings({ ...settings, customSummaryPrompt: e.target.value })}
                                rows={16}
                                className="w-full px-3 py-2 bg-[#0a0a0a] border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-mono resize-y"
                            />
                            <p className="text-xs text-gray-500 mt-1.5">
                                自定义内容分析规则，格式要求（JSON输出）会自动添加。
                            </p>
                        </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex items-center gap-3 pt-4 border-t border-gray-800">
                        <button
                            onClick={handleSave}
                            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                            <Save className="w-4 h-4" />
                            保存设置
                        </button>
                        {saved && (
                            <span className="flex items-center gap-1.5 text-green-500 text-sm">
                                <CheckCircle className="w-4 h-4" />
                                已保存
                            </span>
                        )}
                    </div>
                </div>

                {/* Info Box */}
                <div className="mt-4 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-400 mb-2 text-sm">💡 提示</h3>
                    <ul className="text-xs text-blue-300/80 space-y-1">
                        <li>• API Key 将安全地存储在本地，不会上传到任何服务器</li>
                        <li>• 支持任何兼容 OpenAI API 格式的服务</li>
                        <li>• 推荐使用 GPT-4o、Claude Sonnet 或 Gemini Pro 获得最佳效果</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
