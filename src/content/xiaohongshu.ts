import { storage } from '../lib/storage';
import { summarizeTweet, recognizeImage } from '../lib/ai';
import { generateId } from '../lib/utils';
import { Tweet, InspirationItem } from '../lib/types';

console.log('松鼠收藏夹 (小红书): Content script loaded');

// 评论区数据类型
interface CommentData {
    authorThread: string;      // 作者自己的补充内容/回复
    otherComments: string[];   // 其他用户的评论
}

let readingMode = false;
let currentNote: Element | null = null;

// ==================== 灵感模式 ====================
let inspirationMode = false;
let capturedUrls = new Set<string>(); // 已采集的 URL，避免重复
let detailPageObserver: MutationObserver | null = null;
let lastUrl = location.href;

// 初始化灵感模式状态
chrome.runtime.sendMessage({ type: 'GET_INSPIRATION_MODE' }).then((response) => {
    if (response?.enabled) {
        inspirationMode = true;
        console.log('[灵感模式] 已开启');
        initInspirationCapture();
    }
}).catch(() => {
    // 忽略错误
});

// Load reading mode state
storage.getReadingMode().then((mode) => {
    readingMode = mode;
    console.log('Reading mode:', readingMode);
});

// Listen for messages
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'READING_MODE_CHANGED') {
        readingMode = message.enabled;
        console.log('Reading mode changed:', readingMode);
    }

    if (message.type === 'PUBLISH_TWEET') {
        // 小红书发布功能可以后续实现
        sendResponse({ success: false, message: '小红书发布功能开发中' });
    }

    // 灵感模式状态变化
    if (message.type === 'INSPIRATION_MODE_CHANGED') {
        const wasEnabled = inspirationMode;
        inspirationMode = message.enabled;
        console.log('[灵感模式] 状态变化:', inspirationMode ? '开启' : '关闭');
        
        if (inspirationMode && !wasEnabled) {
            initInspirationCapture();
        } else if (!inspirationMode && wasEnabled) {
            stopInspirationCapture();
        }
        sendResponse({ success: true });
    }

    return true;
});

// Create floating collect button
function createFloatingButton() {
    // Check if button already exists
    if (document.getElementById('twitter-ai-floating-btn')) {
        return;
    }

    const floatingBtn = document.createElement('div');
    floatingBtn.id = 'twitter-ai-floating-btn';
    const logoUrl = chrome.runtime.getURL('icons/logo.png');
    floatingBtn.innerHTML = `
    <img src="${logoUrl}" width="40" height="40" style="border-radius: 10px; display: block;">
  `;
    floatingBtn.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 30px;
    width: 60px;
    height: 60px;
    border-radius: 16px;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    transition: all 0.3s ease;
    user-select: none;
  `;

    // Draggable functionality
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialX = 0;
    let initialY = 0;

    floatingBtn.onmousedown = (e) => {
        isDragging = true;
        floatingBtn.style.cursor = 'grabbing';
        floatingBtn.style.transition = 'none';

        const rect = floatingBtn.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        initialX = rect.left;
        initialY = rect.top;

        e.preventDefault();
    };

    document.onmousemove = (e) => {
        if (!isDragging) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        const newX = initialX + deltaX;
        const newY = initialY + deltaY;

        floatingBtn.style.left = `${newX}px`;
        floatingBtn.style.top = `${newY}px`;
        floatingBtn.style.right = 'auto';
        floatingBtn.style.bottom = 'auto';
    };

    document.onmouseup = (e) => {
        if (!isDragging) return;

        isDragging = false;
        floatingBtn.style.cursor = 'grab';
        floatingBtn.style.transition = 'all 0.3s ease';

        // Snap to nearest edge
        const rect = floatingBtn.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        const distanceToLeft = centerX;
        const distanceToRight = windowWidth - centerX;
        const distanceToTop = centerY;
        const distanceToBottom = windowHeight - centerY;

        const minDistance = Math.min(distanceToLeft, distanceToRight, distanceToTop, distanceToBottom);

        const margin = 30;

        if (minDistance === distanceToLeft) {
            floatingBtn.style.left = `${margin}px`;
            floatingBtn.style.top = `${Math.max(margin, Math.min(rect.top, windowHeight - rect.height - margin))}px`;
        } else if (minDistance === distanceToRight) {
            floatingBtn.style.left = `${windowWidth - rect.width - margin}px`;
            floatingBtn.style.top = `${Math.max(margin, Math.min(rect.top, windowHeight - rect.height - margin))}px`;
        } else if (minDistance === distanceToTop) {
            floatingBtn.style.left = `${Math.max(margin, Math.min(rect.left, windowWidth - rect.width - margin))}px`;
            floatingBtn.style.top = `${margin}px`;
        } else {
            floatingBtn.style.left = `${Math.max(margin, Math.min(rect.left, windowWidth - rect.width - margin))}px`;
            floatingBtn.style.top = `${windowHeight - rect.height - margin}px`;
        }

        floatingBtn.style.right = 'auto';
        floatingBtn.style.bottom = 'auto';

        // Only trigger click if not dragged
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (distance < 5) {
            collectCurrentNote();
        }
    };

    floatingBtn.onmouseover = () => {
        if (!isDragging) {
            floatingBtn.style.transform = 'scale(1.08) translateY(-2px)';
            floatingBtn.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)';
        }
    };

    floatingBtn.onmouseout = () => {
        if (!isDragging) {
            floatingBtn.style.transform = 'scale(1) translateY(0)';
            floatingBtn.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.3)';
        }
    };

    document.body.appendChild(floatingBtn);
    console.log('Floating button created');
}

// Track current note on hover
function trackCurrentNote() {
    document.addEventListener('mouseover', (e) => {
        const target = e.target as HTMLElement;
        // 小红书笔记的选择器可能需要根据实际页面结构调整
        const noteElement = target.closest('.note-item, [class*="note"], [class*="card"]');
        if (noteElement) {
            currentNote = noteElement;
        }
    });
}

async function collectCurrentNote() {
    if (!currentNote) {
        showNotification('请先将鼠标悬停在要收藏的笔记上');
        return;
    }

    try {
        await collectNote(currentNote);
        showNotification('✓ 已收藏！');
    } catch (error) {
        console.error('Failed to collect note:', error);
        showNotification('✗ 收藏失败');
    }
}

async function collectNote(noteElement: Element) {
    try {
        // 提取笔记数据 - 这些选择器需要根据小红书实际DOM结构调整
        const titleElement = noteElement.querySelector('.note-title, [class*="title"]');
        const contentElement = noteElement.querySelector('.note-content, [class*="desc"], [class*="content"]');
        const authorElement = noteElement.querySelector('.author-name, [class*="author"], [class*="name"]');

        const title = titleElement?.textContent?.trim() || '';
        const content = contentElement?.textContent?.trim() || '';
        const fullContent = title ? `${title}\n\n${content}` : content;

        if (!fullContent) {
            throw new Error('无法提取笔记内容');
        }

        // 清理作者名称：移除"关注"、"已关注"等按钮文字
        let authorName = authorElement?.textContent?.trim() || 'Unknown';
        authorName = authorName
            .replace(/关注$/, '')      // 移除结尾的"关注"
            .replace(/已关注$/, '')    // 移除结尾的"已关注"
            .replace(/\s*关注\s*$/, '') // 移除结尾的空格+关注
            .trim();

        // 提取作者主页链接
        const authorLinkElement = noteElement.querySelector('a[href*="/user/profile/"]');
        let authorProfileUrl = '';
        let authorUserId = '';
        if (authorLinkElement) {
            const href = authorLinkElement.getAttribute('href') || '';
            authorProfileUrl = href.startsWith('http') ? href : `https://www.xiaohongshu.com${href}`;
            // 提取用户 ID
            const userIdMatch = authorProfileUrl.match(/\/user\/profile\/([a-zA-Z0-9]+)/);
            authorUserId = userIdMatch ? userIdMatch[1] : '';
        }

        // 提取作者头像 - 优先使用作者链接附近的头像，避免取到评论区头像
        let authorAvatar = '';
        
        // 方法1：如果有作者链接，查找同一个作者链接内或附近的头像
        if (authorLinkElement) {
            // 先在作者链接内查找
            const avatarInLink = authorLinkElement.querySelector('img[src*="sns-avatar"]') as HTMLImageElement;
            if (avatarInLink?.src) {
                authorAvatar = avatarInLink.src;
            } else {
                // 查找与作者链接 href 相同的另一个 a 标签（通常头像也有链接到用户主页）
                const authorHref = authorLinkElement.getAttribute('href');
                if (authorHref) {
                    const allAuthorLinks = noteElement.querySelectorAll(`a[href="${authorHref}"]`);
                    for (const link of allAuthorLinks) {
                        const avatarImg = link.querySelector('img[src*="sns-avatar"]') as HTMLImageElement;
                        if (avatarImg?.src) {
                            authorAvatar = avatarImg.src;
                            break;
                        }
                    }
                }
            }
        }
        
        // 方法2：如果方法1没找到，尝试在笔记顶部区域查找（排除评论区）
        if (!authorAvatar) {
            // 查找笔记详情区域的头像（通常在 .note-top、.author-wrapper 等区域）
            const topSelectors = [
                '.note-top img[src*="sns-avatar"]',
                '.author-wrapper img[src*="sns-avatar"]',
                '[class*="author-info"] img[src*="sns-avatar"]',
                '.note-detail header img[src*="sns-avatar"]',
            ];
            for (const selector of topSelectors) {
                const avatarImg = document.querySelector(selector) as HTMLImageElement;
                if (avatarImg?.src) {
                    authorAvatar = avatarImg.src;
                    break;
                }
            }
        }
        
        // 方法3：最后的备选 - 从整个页面的第一个作者头像区域找
        if (!authorAvatar) {
            // 在笔记卡片外的固定作者信息区域查找（详情页顶部）
            const pageHeaderAvatar = document.querySelector('.author-container img[src*="sns-avatar"], .note-scroller > div:first-child img[src*="sns-avatar"]') as HTMLImageElement;
            if (pageHeaderAvatar?.src) {
                authorAvatar = pageHeaderAvatar.src;
            }
        }
        
        console.log('提取到的作者头像:', authorAvatar ? '有' : '无', authorAvatar?.slice(0, 50));

        // 提取笔记URL并清理
        const linkElement = noteElement.querySelector('a[href*="/explore/"]');
        let noteUrl = linkElement ? new URL(linkElement.getAttribute('href') || '', window.location.origin).href : window.location.href;
        
        // 清理 URL，只保留基础路径，移除可能过期的 token 参数
        noteUrl = cleanNoteUrl(noteUrl);

        // 提取图片（去重 + 过滤无关图片）
        const imageElements = noteElement.querySelectorAll('img[src]');
        const mediaSet = new Set<string>();
        Array.from(imageElements)
            .map(img => (img as HTMLImageElement).src)
            .filter(src => {
                if (!src) return false;
                // 过滤掉头像、静态资源、图标等
                if (src.includes('avatar')) return false;
                if (src.includes('picasso-static')) return false; // 小红书静态资源
                if (src.includes('emoji')) return false;
                if (src.includes('icon')) return false;
                if (src.includes('/fe-platform/')) return false; // 平台静态资源
                // 只保留实际内容图片（通常是 sns-webpic 开头）
                return src.includes('sns-webpic') || src.includes('xhscdn.com');
            })
            .forEach(src => mediaSet.add(src)); // 去重
        const media = Array.from(mediaSet);

        // 获取设置
        const settings = await storage.getSettings();

        // 收集评论区内容（如果启用）
        let commentData: CommentData | null = null;
        console.log('评论区收集设置:', settings?.enableCommentCollection ? '已开启' : '未开启');
        if (settings?.enableCommentCollection) {
            console.log('开始收集评论区内容...');
            commentData = collectComments(authorName);
        }

        const tweet: Tweet = {
            id: generateId(),
            tweetId: extractNoteId(noteUrl),
            tweetUrl: noteUrl,
            author: authorName,
            authorHandle: authorUserId || authorName.toLowerCase().replace(/\s+/g, '_'),
            authorProfileUrl: authorProfileUrl || undefined,
            authorAvatar: authorAvatar || undefined,
            content: fullContent,
            platform: 'xiaohongshu',
            keywords: [],
            collectTime: Date.now(),
            media,
            stats: {
                likes: 0,
                retweets: 0,
                replies: 0,
            },
            // 评论区内容
            authorThread: commentData?.authorThread || undefined,
            commentHighlights: commentData?.otherComments.length ? commentData.otherComments.join('\n') : undefined,
        };

        console.log('Collecting note:', tweet);

        // Save note
        await storage.saveTweet(tweet);

        // Get AI summary in background
        if (settings && settings.apiKey) {
            try {
                let contentToAnalyze = fullContent;

                // 如果有作者的补充内容，整合进去
                if (commentData?.authorThread) {
                    contentToAnalyze = `${fullContent}\n\n【作者补充内容】\n${commentData.authorThread}`;
                }

                // 如果启用了图片识别且有图片，先识别图片内容
                if (settings.enableImageRecognition && media.length > 0) {
                    console.log(`图片识别已启用，共 ${media.length} 张图片，开始识别...`);
                    try {
                        // 最多识别 9 张图片（小红书单条笔记上限）
                        const imagesToRecognize = media.slice(0, 9);
                        const imageTexts = await Promise.all(
                            imagesToRecognize.map((url, idx) => 
                                recognizeImage(settings, url).then(text => {
                                    console.log(`图片 ${idx + 1}/${imagesToRecognize.length} 识别完成`);
                                    return text;
                                }).catch(err => {
                                    console.warn(`图片 ${idx + 1} 识别失败:`, err);
                                    return '';
                                })
                            )
                        );
                        const recognizedText = imageTexts.filter(t => t).join('\n\n---\n\n');
                        if (recognizedText) {
                            contentToAnalyze = `${fullContent}\n\n【图片内容】\n${recognizedText}`;
                            console.log('图片识别完成，识别出文字:', recognizedText.slice(0, 100));
                        }
                    } catch (error) {
                        console.error('图片识别失败:', error);
                        // 识别失败也继续处理原始内容
                    }
                }

                // 如果有其他用户的评论，添加到分析内容中
                if (commentData?.otherComments.length) {
                    contentToAnalyze = `${contentToAnalyze}\n\n【评论区观点】\n${commentData.otherComments.join('\n')}`;
                }

                const aiResult = await summarizeTweet(settings, contentToAnalyze);
                await storage.updateTweet(tweet.id, {
                    summary: aiResult.summary,
                    keywords: aiResult.keywords,
                    sentiment: aiResult.sentiment,
                    category: aiResult.category,
                });
                console.log('AI summary completed');
            } catch (error) {
                console.error('Failed to get AI summary:', error);
            }
        }
    } catch (error) {
        console.error('Failed to collect note:', error);
        throw error;
    }
}

function extractNoteId(url: string): string {
    const match = url.match(/\/explore\/([a-zA-Z0-9]+)/);
    return match ? match[1] : generateId();
}

// 清理笔记 URL，移除可能过期的 token 参数
function cleanNoteUrl(url: string): string {
    try {
        const urlObj = new URL(url);
        // 只保留基础路径，移除所有查询参数（xsec_token 等会过期）
        return `${urlObj.origin}${urlObj.pathname}`;
    } catch {
        return url;
    }
}

// 收集评论区内容
function collectComments(authorName: string): CommentData {
    const result: CommentData = {
        authorThread: '',
        otherComments: []
    };

    const authorThreadParts: string[] = [];
    const otherCommentsSet = new Set<string>();

    // 小红书评论区的常见选择器
    const commentSelectors = [
        '.comment-item',
        '.comments-container .comment',
        '[class*="comment-item"]',
        '[class*="CommentItem"]',
        '.note-comment',
    ];

    let commentElements: Element[] = [];
    for (const selector of commentSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            commentElements = Array.from(elements);
            console.log(`找到评论元素: ${selector}, 数量: ${elements.length}`);
            break;
        }
    }

    if (commentElements.length === 0) {
        console.log('未找到评论区元素');
        return result;
    }

    commentElements.forEach((comment) => {
        // 提取评论者名称
        const nameSelectors = [
            '.user-name',
            '.author-name',
            '[class*="nickname"]',
            '[class*="userName"]',
            '[class*="name"]',
        ];
        let commenterName = '';
        for (const selector of nameSelectors) {
            const nameEl = comment.querySelector(selector);
            if (nameEl?.textContent?.trim()) {
                commenterName = nameEl.textContent.trim();
                break;
            }
        }

        // 提取评论内容
        const contentSelectors = [
            '.comment-content',
            '.content',
            '[class*="content"]',
            '[class*="text"]',
        ];
        let commentContent = '';
        for (const selector of contentSelectors) {
            const contentEl = comment.querySelector(selector);
            if (contentEl?.textContent?.trim()) {
                commentContent = contentEl.textContent.trim();
                break;
            }
        }

        if (!commentContent) return;

        // 判断是否是作者的回复
        const isAuthorComment = commenterName && 
            (commenterName === authorName || 
             comment.querySelector('[class*="author-tag"]') ||
             comment.querySelector('[class*="作者"]'));

        if (isAuthorComment) {
            authorThreadParts.push(commentContent);
        } else if (commenterName) {
            const shortComment = commentContent.length > 100 
                ? commentContent.slice(0, 100) + '...' 
                : commentContent;
            const commentWithAuthor = `${commenterName}: ${shortComment}`;
            otherCommentsSet.add(commentWithAuthor);
        }
    });

    result.authorThread = authorThreadParts.join('\n\n');
    result.otherComments = Array.from(otherCommentsSet).slice(0, 10); // 最多取 10 条评论

    console.log('评论区收集结果:', {
        authorThread: result.authorThread.slice(0, 50),
        commentsCount: result.otherComments.length
    });

    return result;
}

function showNotification(message: string) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 80px;
    background: #1d9bf0;
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(29, 155, 240, 0.3);
    z-index: 10001;
    font-size: 14px;
    font-weight: 500;
    animation: slideIn 0.3s ease-out;
  `;

    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// ==================== 灵感模式采集逻辑 ====================

// 初始化灵感采集
function initInspirationCapture() {
    console.log('[灵感模式] 初始化采集...');
    
    // 判断当前页面类型
    if (isDetailPage()) {
        captureDetailPage();
    } else {
        // 列表页：设置 Intersection Observer
        setupListObserver();
    }
    
    // 监听 URL 变化（SPA 路由）
    setupUrlChangeListener();
}

// 停止灵感采集
function stopInspirationCapture() {
    console.log('[灵感模式] 停止采集');
    if (detailPageObserver) {
        detailPageObserver.disconnect();
        detailPageObserver = null;
    }
}

// 判断是否为详情页
function isDetailPage(): boolean {
    return location.pathname.includes('/explore/') || 
           location.pathname.includes('/discovery/item/') ||
           location.pathname.includes('/search_result/');
}

// 监听 URL 变化
function setupUrlChangeListener() {
    // 使用 setInterval 检测 URL 变化（兼容 SPA）
    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            console.log('[灵感模式] URL 变化:', lastUrl);
            
            if (!inspirationMode) return;
            
            if (isDetailPage()) {
                // 延迟采集，等待页面加载
                setTimeout(() => captureDetailPage(), 1000);
            }
        }
    }, 500);
}

// 设置列表页 Intersection Observer
function setupListObserver() {
    const observer = new IntersectionObserver((entries) => {
        if (!inspirationMode) return;
        
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const noteCard = entry.target as HTMLElement;
                captureListItem(noteCard);
            }
        });
    }, { threshold: 0.5 });
    
    // 观察所有笔记卡片
    function observeNoteCards() {
        const noteCards = document.querySelectorAll('.note-item, [class*="note-item"], .feeds-page section, [class*="NoteItem"]');
        noteCards.forEach((card) => {
            if (!card.hasAttribute('data-inspiration-observed')) {
                card.setAttribute('data-inspiration-observed', 'true');
                observer.observe(card);
            }
        });
    }
    
    // 初始观察
    observeNoteCards();
    
    // 监听 DOM 变化，观察新加载的卡片
    const mutationObserver = new MutationObserver(() => {
        if (inspirationMode) {
            observeNoteCards();
        }
    });
    
    mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
    });
}

// 采集列表页单个笔记（轻量：标题+摘要）
function captureListItem(noteCard: HTMLElement) {
    try {
        // 提取链接
        const linkElement = noteCard.querySelector('a[href*="/explore/"], a[href*="/discovery/item/"]');
        if (!linkElement) return;
        
        const href = linkElement.getAttribute('href') || '';
        const url = href.startsWith('http') ? href : `https://www.xiaohongshu.com${href}`;
        
        // 去重检查
        if (capturedUrls.has(url)) return;
        capturedUrls.add(url);
        
        // 提取标题
        const titleElement = noteCard.querySelector('.title, [class*="title"], [class*="Title"]');
        const title = titleElement?.textContent?.trim() || '';
        
        // 提取摘要/描述
        const descElement = noteCard.querySelector('.desc, [class*="desc"], [class*="content"]');
        const summary = descElement?.textContent?.trim()?.slice(0, 100) || '';
        
        // 提取作者
        const authorElement = noteCard.querySelector('.author-name, [class*="author"], .name, [class*="nickname"]');
        let author = authorElement?.textContent?.trim() || '未知作者';
        author = author.replace(/关注$/, '').replace(/已关注$/, '').trim();
        
        // 提取作者头像
        const avatarElement = noteCard.querySelector('img[src*="sns-avatar"]') as HTMLImageElement;
        const authorAvatar = avatarElement?.src || '';
        
        // 提取缩略图
        const thumbElement = noteCard.querySelector('img[src*="sns-webpic"], img[src*="xhscdn"]') as HTMLImageElement;
        const thumbnail = thumbElement?.src || '';
        
        const item: InspirationItem = {
            id: generateId(),
            platform: 'xiaohongshu',
            author,
            authorAvatar: authorAvatar || undefined,
            title: title || undefined,
            summary: summary || title || undefined,
            url,
            thumbnail: thumbnail || undefined,
            capturedAt: Date.now(),
            isDetail: false,
        };
        
        console.log('[灵感模式] 采集列表项:', item.title || item.summary?.slice(0, 20));
        
        // 发送到 background 保存
        chrome.runtime.sendMessage({
            type: 'INSPIRATION_ITEM_CAPTURED',
            item,
        });
    } catch (error) {
        console.error('[灵感模式] 采集列表项失败:', error);
    }
}

// 采集详情页（完整内容+评论区）
async function captureDetailPage() {
    if (!inspirationMode) return;
    
    try {
        const url = cleanNoteUrl(location.href);
        
        // 去重检查（但详情页可以覆盖列表页的轻量数据）
        // 不在这里检查，让 storage 层处理合并逻辑
        
        // 等待内容加载
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 提取标题
        const titleElement = document.querySelector('.title, [class*="title"], h1');
        const title = titleElement?.textContent?.trim() || '';
        
        // 提取内容
        const contentElement = document.querySelector('.note-content, [class*="content"], .desc, #detail-desc');
        const content = contentElement?.textContent?.trim() || '';
        
        // 提取作者
        const authorElement = document.querySelector('.author-name, [class*="author"], .user-name, [class*="nickname"]');
        let author = authorElement?.textContent?.trim() || '未知作者';
        author = author.replace(/关注$/, '').replace(/已关注$/, '').trim();
        
        // 提取作者头像
        let authorAvatar = '';
        const authorLinkElement = document.querySelector('a[href*="/user/profile/"]');
        if (authorLinkElement) {
            const avatarImg = authorLinkElement.querySelector('img[src*="sns-avatar"]') as HTMLImageElement;
            if (avatarImg?.src) {
                authorAvatar = avatarImg.src;
            }
        }
        
        // 提取作者主页链接和 handle
        let authorProfileUrl = '';
        let authorHandle = '';
        if (authorLinkElement) {
            const href = authorLinkElement.getAttribute('href') || '';
            authorProfileUrl = href.startsWith('http') ? href : `https://www.xiaohongshu.com${href}`;
            const userIdMatch = authorProfileUrl.match(/\/user\/profile\/([a-zA-Z0-9]+)/);
            authorHandle = userIdMatch ? userIdMatch[1] : '';
        }
        
        // 提取图片
        const imageElements = document.querySelectorAll('.note-slider img[src*="sns-webpic"], .swiper-slide img[src*="xhscdn"]');
        const media = Array.from(imageElements)
            .map(img => (img as HTMLImageElement).src)
            .filter(src => src && !src.includes('avatar'));
        
        // 收集评论区
        const settings = await storage.getSettings();
        let commentData: CommentData | null = null;
        if (settings?.enableCommentCollection) {
            commentData = collectComments(author);
        }
        
        const fullContent = title ? `${title}\n\n${content}` : content;
        
        if (!fullContent && media.length === 0) {
            console.log('[灵感模式] 详情页内容为空，跳过');
            return;
        }
        
        const item: InspirationItem = {
            id: generateId(),
            platform: 'xiaohongshu',
            author,
            authorHandle: authorHandle || undefined,
            authorAvatar: authorAvatar || undefined,
            authorProfileUrl: authorProfileUrl || undefined,
            title: title || undefined,
            content: fullContent || undefined,
            url,
            thumbnail: media[0] || undefined,
            media: media.length > 0 ? media : undefined,
            capturedAt: Date.now(),
            isDetail: true,
            authorThread: commentData?.authorThread || undefined,
            commentHighlights: commentData?.otherComments.length ? commentData.otherComments.join('\n') : undefined,
        };
        
        console.log('[灵感模式] 采集详情页:', item.title?.slice(0, 20) || item.content?.slice(0, 20));
        
        // 发送到 background 保存
        chrome.runtime.sendMessage({
            type: 'INSPIRATION_ITEM_CAPTURED',
            item,
        });
        
        // 标记已采集
        capturedUrls.add(url);
    } catch (error) {
        console.error('[灵感模式] 采集详情页失败:', error);
    }
}

// Add styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Initialize
function init() {
    console.log('Initializing Twitter AI Assistant for 小红书...');
    createFloatingButton();
    trackCurrentNote();
    console.log('Twitter AI Assistant for 小红书 initialized!');
}

// Wait for page to load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
