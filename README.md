# 松鼠收藏夹 🐿️

一款智能浏览器插件，帮助你高效收集 Twitter 和小红书的优质内容，并借助 AI 快速创作多语言内容。

## ✨ 功能特性

### 🗂️ 多平台支持
- **Twitter/X**：收集推文，支持图片内容识别
- **小红书**：收集笔记，智能整理图文内容

### 📚 智能收集
- 🔖 **一键收藏**：悬浮按钮快速保存优质内容
- 🤖 **AI 智能总结**：自动提取核心观点，支持 Markdown 格式输出
- 🖼️ **图片识别**：支持识别图片中的文字内容（需配置视觉模型）
- 💬 **评论区收集**：可选收集作者补充内容和精彩评论
- 🏷️ **自动分类**：AI 自动分类和提取关键词
- 🔍 **语义搜索**：基于 Embedding 的智能搜索，用自然语言查找相关内容
- 💾 **本地存储**：所有数据安全存储在浏览器本地（含向量索引）

### ✍️ AI 创作助手
- 📝 **智能创作**：基于收藏内容生成新创意
- 📚 **参考选择**：从收藏库选择参考素材，交互更自然
- 💡 **灵感模式**：自动采集浏览内容作为创作参考，支持列表页/详情页采集
- 🌍 **多语言支持**：中文、英文、日文、韩文
- 🎨 **风格定制**：专业、幽默、简洁、详细等多种风格
- 📏 **长度控制**：短文、标准、长文
- 🔄 **多版本生成**：一次生成多个版本供选择

### 🎨 界面体验
- 🌓 **深色/浅色模式**：跟随系统或手动切换
- 📖 **Markdown 渲染**：摘要内容支持列表、加粗等格式，可读性更佳
- 🖱️ **悬浮按钮开关**：可在侧边栏控制显示/隐藏
- 📤 **数据导出**：支持导出为 JSON 或 Markdown 格式

### ⚙️ 灵活配置
- 🤖 **AI 模型选择**：支持任何兼容 OpenAI API 的服务
- 👁️ **视觉模型独立配置**：可单独配置图片识别 API
- 🔢 **Embedding 模型配置**：可单独配置语义搜索使用的 Embedding 模型
- 📝 **自定义提示词**：可自定义摘要和创作的 AI 提示词
- 🧪 **连接测试**：验证 API 配置是否正确

## 🚀 快速开始

### 📦 安装插件

#### 方式一：从源码构建

1. **克隆项目**
   ```bash
   git clone https://github.com/HelloSanshi/squirrel-box.git
   cd squirrel-box
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **构建插件**
   ```bash
   npm run build
   ```

4. **加载到浏览器**
   - 打开 Chrome，访问 `chrome://extensions/`
   - 开启右上角的"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择 `dist` 文件夹

#### 方式二：Chrome 应用商店
- 🚧 即将上线...

### ⚙️ 配置 AI API

1. **打开设置页面**：点击插件图标 → 设置按钮

2. **填写 API 配置**
   - **API Key**：AI 服务的 API 密钥
   - **Base URL**：API 接口地址（如 `https://api.openai.com/v1`）
   - **模型名称**：如 `gpt-4o`、`qwen-max` 等

3. **测试连接**：点击"测试连接"确认配置正确

> 💡 API Key 加密存储在本地，不会上传到任何服务器

### 📖 使用指南

#### 收藏内容
1. 访问 Twitter/X 或小红书
2. 看到喜欢的内容，点击页面上的悬浮收藏按钮
3. 插件自动保存并调用 AI 生成智能摘要

#### AI 创作
1. 点击插件图标打开侧边栏，选择"创作"标签
2. 点击"从收藏中选择参考内容"（可选）
3. 输入创作主题，选择语言、风格、长度
4. 点击"开始创作"，AI 生成多个版本供选择

## 🛠️ 开发

### 技术栈
- **框架**：React 19 + TypeScript
- **构建**：Vite 7 + CRXJS
- **样式**：Tailwind CSS
- **浏览器 API**：Chrome Extension Manifest V3

### 项目结构

```
creator-plugin/
├── src/
│   ├── background/      # Service Worker
│   ├── content/         # 内容脚本（Twitter、小红书）
│   ├── sidepanel/       # 侧边栏面板
│   ├── options/         # 设置页面
│   ├── popup/           # 弹出窗口
│   └── lib/             # 公共库（types, storage, ai, utils）
├── public/icons/        # 插件图标
├── manifest.json        # 扩展配置
└── vite.config.ts
```

### 开发命令

```bash
# 开发模式（热更新）
npm run dev

# 生产构建
npm run build

# 代码检查
npm run lint
```

## 🔐 隐私与安全

- ✅ **本地存储**：所有数据存储在浏览器本地
- ✅ **不上传服务器**：插件不会上传你的数据
- 🔒 **API 直连**：AI 调用直接发送到你配置的服务商
- 🔒 **加密存储**：API Key 使用浏览器加密存储

### 权限说明

| 权限 | 用途 |
|------|------|
| `storage` | 保存收藏内容和设置 |
| `sidePanel` | 显示收藏库和创作面板 |

## 🌟 支持的 AI 服务

支持任何兼容 OpenAI API 格式的服务：

**国际服务**
- OpenAI（GPT-4o, GPT-4, GPT-3.5-turbo）
- Anthropic Claude（通过兼容代理）

**国内服务**
- 阿里云通义千问（qwen-max, qwen-plus）
- 字节跳动豆包
- 其他支持 OpenAI 兼容模式的服务

**中转服务**
- OpenRouter、API2D 等

## 🗺️ 路线图

### v1.0 ✅ 当前版本
- [x] Twitter/X 和小红书支持
- [x] AI 智能收集和总结
- [x] AI 辅助创作
- [x] 多语言、多风格生成
- [x] 图片内容识别
- [x] 深色/浅色模式
- [x] Markdown 摘要渲染
- [x] 评论区内容收集
- [x] 创作参考交互优化
- [x] 灵感模式（自动采集浏览内容）

### v1.1 🚧 计划中
- [ ] 收藏库高级搜索
- [ ] 内容标签管理
- [ ] 批量操作
- [ ] 数据统计

### v2.0 💭 未来
- [ ] 更多平台支持
- [ ] 云同步（可选）
- [ ] 定时发布

## 📝 更新日志

详见 [CHANGELOG.MD](./CHANGELOG.MD)

## 📄 许可证

MIT License - 你可以自由使用、修改和分发。

## 💬 反馈

- 🐛 [提交 Bug](https://github.com/HelloSanshi/squirrel-box/issues)
- 💡 [功能建议](https://github.com/HelloSanshi/squirrel-box/issues)
- ⭐ 觉得有用？给个 [Star](https://github.com/HelloSanshi/squirrel-box) 支持一下！

---

<div align="center">

**用 AI 让内容收集和创作更简单 🚀**

Made with ❤️ by 松鼠收藏夹

</div>
