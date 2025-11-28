# 摘要卡片 Markdown 渲染优化

## 📋 任务信息
- 类型：🟡 中等任务 (M)
- 预计时间：30 分钟
- 问题：摘要内容很长时，纯文本展示可读性差

## 🎯 方案
1. 修改 AI 提示词，要求使用 Markdown 格式输出摘要
2. 安装 react-markdown 库
3. 更新 SidePanel 组件，支持 Markdown 渲染

## 📋 清单
- [x] 修改提示词规则 (10min)
- [x] 安装 react-markdown 依赖 (2min)
- [x] 更新 SidePanel 摘要渲染 (15min)
- [x] 验证效果 (3min)

## ✅ 验收
- [x] 摘要支持 Markdown 格式（标题、列表、加粗等）
- [x] 样式美观，与现有 UI 协调
- [x] 无功能退化

## 交付

### 📝 代码变更
- `src/lib/ai.ts` - 更新提示词，要求 AI 使用 Markdown 格式输出摘要
- `src/sidepanel/SidePanel.tsx` - 使用 ReactMarkdown 渲染摘要内容
- `tailwind.config.js` - 添加 @tailwindcss/typography 插件支持 prose 样式

### 📦 依赖变更
- 新增 `react-markdown` - Markdown 渲染组件
- 新增 `@tailwindcss/typography` - Tailwind CSS 排版插件

### 效果说明
- AI 生成摘要时会使用 **加粗**、列表、`代码` 等 Markdown 格式
- 摘要卡片支持渲染 Markdown，提高长内容的可读性
- 样式与现有 UI 协调，支持深色/浅色模式

