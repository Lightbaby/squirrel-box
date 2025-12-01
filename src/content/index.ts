import { storage } from '../lib/storage';
import { summarizeTweet, recognizeImage } from '../lib/ai';
import { generateId } from '../lib/utils';
import { Tweet, InspirationItem } from '../lib/types';

console.log('松鼠收藏夹: Content script loaded');

let readingMode = false;
let currentTweet: Element | null = null;
let floatingBtnElement: HTMLElement | null = null; // 悬浮按钮元素引用

// ==================== 灵感模式 ====================
let inspirationMode = false;
let capturedUrls = new Set<string>(); // 已采集的 URL，避免重复
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
        publishTweetToTwitter(message.content);
        sendResponse({ success: true });
    }

    // 切换悬浮按钮显示/隐藏
    if (message.type === 'TOGGLE_FLOATING_BUTTON') {
        const show = message.show;
        if (floatingBtnElement) {
            floatingBtnElement.style.display = show ? 'flex' : 'none';
        }
        console.log('悬浮按钮显示状态:', show ? '显示' : '隐藏');
        sendResponse({ success: true });
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
            collectCurrentTweet();
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
    floatingBtnElement = floatingBtn; // 保存引用
    console.log('Floating button created');
}

// Track current tweet on hover
function trackCurrentTweet() {
    document.addEventListener('mouseover', (e) => {
        const target = e.target as HTMLElement;
        const tweetElement = target.closest('article[data-testid="tweet"]');
        if (tweetElement) {
            currentTweet = tweetElement;
            // 移除高亮效果，不再显示蓝色框线
            // highlightTweet(tweetElement as HTMLElement);
        }
    });
}

async function collectCurrentTweet() {
    if (!currentTweet) {
        showNotification('请先将鼠标悬停在要收藏的推文上');
        return;
    }

    try {
        await collectTweet(currentTweet);
        showNotification('✓ 已收藏！');
    } catch (error) {
        console.error('Failed to collect tweet:', error);
        showNotification('✗ 收藏失败');
    }
}

async function collectTweet(tweetElement: Element) {
    try {
        // Extract tweet data
        const textElement = tweetElement.querySelector('[data-testid="tweetText"]');
        let content = textElement?.textContent || '';

        // 先提取媒体，判断是否有图片
        const mediaElements = tweetElement.querySelectorAll('img[src*="pbs.twimg.com"]');
        const media = Array.from(mediaElements)
            .map(img => (img as HTMLImageElement).src)
            .filter(src => {
                if (src.includes('profile_images')) return false;
                if (src.includes('emoji')) return false;
                if (src.includes('_normal') || src.includes('_mini')) return false;
                return src.includes('/media/') || src.includes('tweet_video_thumb') || src.includes('ext_tw_video_thumb');
            });

        // 如果既没有文字也没有图片，才报错
        if (!content && media.length === 0) {
            throw new Error('无法提取推文内容（无文字也无图片）');
        }

        // 如果只有图片没有文字，设置提示内容
        if (!content && media.length > 0) {
            content = `[图片内容，共 ${media.length} 张图片]`;
        }

        const authorElement = tweetElement.querySelector('[data-testid="User-Name"]');
        const authorName = authorElement?.querySelector('span')?.textContent || 'Unknown';

        // 改进 handle 提取：从用户链接中获取，更可靠
        let authorHandle = 'unknown';
        const userLink = tweetElement.querySelector('a[href^="/"][role="link"]');
        if (userLink) {
            const href = userLink.getAttribute('href') || '';
            const handleMatch = href.match(/^\/([^/]+)$/);
            if (handleMatch) {
                authorHandle = handleMatch[1];
            }
        }
        // 备用方案：查找包含 @ 的文本
        if (authorHandle === 'unknown') {
            const allSpans = authorElement?.querySelectorAll('span') || [];
            for (const span of allSpans) {
                const text = span.textContent || '';
                if (text.startsWith('@')) {
                    authorHandle = text.replace('@', '');
                    break;
                }
            }
        }
        console.log('提取到的 authorHandle:', authorHandle);

        // 提取作者头像
        let authorAvatar = '';
        const avatarImg = tweetElement.querySelector('img[src*="profile_images"]') as HTMLImageElement;
        if (avatarImg?.src) {
            // 使用原图尺寸（移除 _normal 等后缀）
            authorAvatar = avatarImg.src.replace(/_normal\.(jpg|jpeg|png|gif|webp)$/i, '.$1');
        }
        console.log('提取到的作者头像:', authorAvatar ? '有' : '无');

        // Extract stats
        const likeButton = tweetElement.querySelector('[data-testid="like"]');
        const retweetButton = tweetElement.querySelector('[data-testid="retweet"]');
        const replyButton = tweetElement.querySelector('[data-testid="reply"]');

        const getCount = (button: Element | null) => {
            if (!button) return 0;
            const text = button.getAttribute('aria-label') || '0';
            const match = text.match(/\d+/);
            return match ? parseInt(match[0]) : 0;
        };

        // Extract tweet URL
        const tweetId = extractTweetId(tweetElement);
        const tweetUrl = `https://twitter.com/${authorHandle}/status/${tweetId}`;

        // 获取设置
        const settings = await storage.getSettings();

        // 收集评论区内容（如果启用）
        let commentData: CommentData | null = null;
        console.log('评论区收集设置:', settings?.enableCommentCollection ? '已开启' : '未开启');
        if (settings?.enableCommentCollection) {
            console.log('开始收集评论区内容...');
            commentData = collectComments(tweetElement, authorHandle);
            console.log('评论区收集完成:', {
                authorThread: commentData.authorThread.slice(0, 50),
                commentsCount: commentData.otherComments.length
            });
        }

        const tweet: Tweet = {
            id: generateId(),
            tweetId,
            tweetUrl,
            author: authorName,
            authorHandle,
            authorAvatar: authorAvatar || undefined,
            content,
            platform: 'twitter',
            keywords: [],
            collectTime: Date.now(),
            media,
            stats: {
                likes: getCount(likeButton),
                retweets: getCount(retweetButton),
                replies: getCount(replyButton),
            },
            // 评论区内容
            authorThread: commentData?.authorThread || undefined,
            commentHighlights: commentData?.otherComments.length ? commentData.otherComments.join('\n') : undefined,
        };

        console.log('Collecting tweet:', tweet);

        // Save tweet
        await storage.saveTweet(tweet);

        // Get AI summary in background
        if (settings && settings.apiKey) {
            try {
                let contentToAnalyze = content;

                // 如果有作者的线程内容，整合进去
                if (commentData?.authorThread) {
                    contentToAnalyze = `${content}\n\n【作者补充内容】\n${commentData.authorThread}`;
                }

                // 如果启用了图片识别且有图片，先识别图片内容
                if (settings.enableImageRecognition && media.length > 0) {
                    console.log(`图片识别已启用，共 ${media.length} 张图片，开始识别...`);
                    try {
                        // 最多识别 4 张图片（Twitter 单条推文上限）
                        const imagesToRecognize = media.slice(0, 4);
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
                            contentToAnalyze = `${contentToAnalyze}\n\n【图片内容】\n${recognizedText}`;
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
        console.error('Failed to collect tweet:', error);
        throw error;
    }
}

function extractTweetId(tweetElement: Element): string {
    const link = tweetElement.querySelector('a[href*="/status/"]');
    if (link) {
        const match = link.getAttribute('href')?.match(/\/status\/(\d+)/);
        return match ? match[1] : generateId();
    }
    return generateId();
}

// 收集评论区内容
interface CommentData {
    authorThread: string; // 作者自己的内容（线程/回复）
    otherComments: string[]; // 其他用户的评论
}

function collectComments(mainTweetElement: Element, authorHandle: string): CommentData {
    const result: CommentData = {
        authorThread: '',
        otherComments: []
    };

    // 获取页面上所有的推文（回复）
    const allTweets = document.querySelectorAll('article[data-testid="tweet"]');
    const authorThreadParts: string[] = [];
    const otherCommentsSet = new Set<string>(); // 用 Set 去重

    allTweets.forEach((tweet) => {
        // 跳过主推文本身
        if (tweet === mainTweetElement) return;

        // 提取这条推文的作者 - 改进提取逻辑
        let tweetHandle = '';
        const userLink = tweet.querySelector('a[href^="/"][role="link"]');
        if (userLink) {
            const href = userLink.getAttribute('href') || '';
            const handleMatch = href.match(/^\/([^/]+)$/);
            if (handleMatch) {
                tweetHandle = handleMatch[1];
            }
        }
        // 备用方案：查找包含 @ 的文本
        if (!tweetHandle) {
            const tweetAuthorElement = tweet.querySelector('[data-testid="User-Name"]');
            const allSpans = tweetAuthorElement?.querySelectorAll('span') || [];
            for (const span of allSpans) {
                const text = span.textContent || '';
                if (text.startsWith('@')) {
                    tweetHandle = text.replace('@', '');
                    break;
                }
            }
        }

        // 提取推文内容
        const textElement = tweet.querySelector('[data-testid="tweetText"]');
        const content = textElement?.textContent?.trim() || '';

        if (!content) return;

        // 判断是否是原作者的内容
        if (tweetHandle && tweetHandle.toLowerCase() === authorHandle.toLowerCase()) {
            // 作者自己的线程/回复
            authorThreadParts.push(content);
        } else if (tweetHandle) {
            // 其他用户的评论（只取前 100 字，去重）
            const shortComment = content.length > 100 ? content.slice(0, 100) + '...' : content;
            const commentWithAuthor = `@${tweetHandle}: ${shortComment}`;
            otherCommentsSet.add(commentWithAuthor);
        }
    });

    result.authorThread = authorThreadParts.join('\n\n');
    result.otherComments = Array.from(otherCommentsSet).slice(0, 10); // 最多取 10 条评论

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

// Publish tweet function - 最简单的方式：打开弹窗 + 提示粘贴
async function publishTweetToTwitter(_content: string) {
    try {
        // 打开发推编辑框
        const composeButton = document.querySelector('[data-testid="SideNav_NewTweet_Button"]') as HTMLElement;

        if (composeButton) {
            composeButton.click();
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // 聚焦到输入框
        const textArea = document.querySelector('[data-testid="tweetTextarea_0"]') as HTMLElement;
        if (textArea) {
            const editableDiv = textArea.querySelector('[contenteditable="true"]') || textArea;
            if (editableDiv instanceof HTMLElement) {
                editableDiv.focus();
            }
        }

        // 提示用户粘贴
        showNotification('📋 内容已复制！请按 Cmd+V 粘贴');
        
    } catch (error) {
        console.error('Failed to open compose:', error);
        showNotification('📋 内容已复制！请按 Cmd+V 粘贴');
    }
}

// ==================== 灵感模式采集逻辑 ====================

// 初始化灵感采集
function initInspirationCapture() {
    console.log('[灵感模式] 初始化采集...');
    
    // 判断当前页面类型
    if (isDetailPage()) {
        captureDetailPage();
    } else {
        // 时间线/搜索结果：设置 Intersection Observer
        setupListObserver();
    }
    
    // 监听 URL 变化（SPA 路由）
    setupUrlChangeListener();
}

// 停止灵感采集
function stopInspirationCapture() {
    console.log('[灵感模式] 停止采集');
}

// 判断是否为详情页（单条推文页面）
function isDetailPage(): boolean {
    return location.pathname.includes('/status/');
}

// 监听 URL 变化
function setupUrlChangeListener() {
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

// 设置时间线 Intersection Observer
function setupListObserver() {
    const observer = new IntersectionObserver((entries) => {
        if (!inspirationMode) return;
        
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const tweetElement = entry.target as HTMLElement;
                captureListItem(tweetElement);
            }
        });
    }, { threshold: 0.5 });
    
    // 观察所有推文
    function observeTweets() {
        const tweets = document.querySelectorAll('article[data-testid="tweet"]');
        tweets.forEach((tweet) => {
            if (!tweet.hasAttribute('data-inspiration-observed')) {
                tweet.setAttribute('data-inspiration-observed', 'true');
                observer.observe(tweet);
            }
        });
    }
    
    // 初始观察
    observeTweets();
    
    // 监听 DOM 变化，观察新加载的推文
    const mutationObserver = new MutationObserver(() => {
        if (inspirationMode) {
            observeTweets();
        }
    });
    
    mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
    });
}

// 采集时间线单条推文（轻量：文字摘要）
function captureListItem(tweetElement: HTMLElement) {
    try {
        // 在详情页时不采集列表项（避免把评论当成单独的帖子）
        if (isDetailPage()) {
            return;
        }
        
        // 提取推文 ID 和 URL
        const link = tweetElement.querySelector('a[href*="/status/"]');
        if (!link) return;
        
        const href = link.getAttribute('href') || '';
        const match = href.match(/\/([^/]+)\/status\/(\d+)/);
        if (!match) return;
        
        const authorHandle = match[1];
        const tweetId = match[2];
        const url = `https://twitter.com/${authorHandle}/status/${tweetId}`;
        
        // 去重检查
        if (capturedUrls.has(url)) return;
        capturedUrls.add(url);
        
        // 提取作者名
        const authorElement = tweetElement.querySelector('[data-testid="User-Name"]');
        const authorName = authorElement?.querySelector('span')?.textContent || authorHandle;
        
        // 提取作者头像
        let authorAvatar = '';
        const avatarImg = tweetElement.querySelector('img[src*="profile_images"]') as HTMLImageElement;
        if (avatarImg?.src) {
            authorAvatar = avatarImg.src.replace(/_normal\.(jpg|jpeg|png|gif|webp)$/i, '.$1');
        }
        
        // 提取推文内容（摘要）
        const textElement = tweetElement.querySelector('[data-testid="tweetText"]');
        const content = textElement?.textContent?.trim() || '';
        
        // 提取缩略图（如果有）
        const mediaImg = tweetElement.querySelector('img[src*="pbs.twimg.com/media"]') as HTMLImageElement;
        const thumbnail = mediaImg?.src || '';
        
        // 如果没有内容也没有图片，跳过
        if (!content && !thumbnail) return;
        
        const item: InspirationItem = {
            id: generateId(),
            platform: 'twitter',
            author: authorName,
            authorHandle,
            authorAvatar: authorAvatar || undefined,
            summary: content?.slice(0, 150) || undefined, // 列表页只取摘要
            url,
            thumbnail: thumbnail || undefined,
            capturedAt: Date.now(),
            isDetail: false,
        };
        
        console.log('[灵感模式] 采集列表项:', item.summary?.slice(0, 30) || '[图片]');
        
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
        // 等待内容加载
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 找到主推文
        const mainTweet = document.querySelector('article[data-testid="tweet"]');
        if (!mainTweet) {
            console.log('[灵感模式] 未找到主推文');
            return;
        }
        
        // 提取推文 ID 和 URL
        const urlMatch = location.pathname.match(/\/([^/]+)\/status\/(\d+)/);
        if (!urlMatch) return;
        
        const authorHandle = urlMatch[1];
        const tweetId = urlMatch[2];
        const url = `https://twitter.com/${authorHandle}/status/${tweetId}`;
        
        // 提取作者名
        const authorElement = mainTweet.querySelector('[data-testid="User-Name"]');
        const authorName = authorElement?.querySelector('span')?.textContent || authorHandle;
        
        // 提取作者头像
        let authorAvatar = '';
        const avatarImg = mainTweet.querySelector('img[src*="profile_images"]') as HTMLImageElement;
        if (avatarImg?.src) {
            authorAvatar = avatarImg.src.replace(/_normal\.(jpg|jpeg|png|gif|webp)$/i, '.$1');
        }
        
        // 提取完整内容
        const textElement = mainTweet.querySelector('[data-testid="tweetText"]');
        const content = textElement?.textContent?.trim() || '';
        
        // 提取媒体
        const mediaElements = mainTweet.querySelectorAll('img[src*="pbs.twimg.com"]');
        const media = Array.from(mediaElements)
            .map(img => (img as HTMLImageElement).src)
            .filter(src => {
                if (src.includes('profile_images')) return false;
                if (src.includes('emoji')) return false;
                if (src.includes('_normal') || src.includes('_mini')) return false;
                return src.includes('/media/') || src.includes('tweet_video_thumb');
            });
        
        // 如果没有内容也没有图片，跳过
        if (!content && media.length === 0) {
            console.log('[灵感模式] 详情页内容为空，跳过');
            return;
        }
        
        // 收集评论区
        const settings = await storage.getSettings();
        let commentData: CommentData | null = null;
        if (settings?.enableCommentCollection) {
            commentData = collectComments(mainTweet, authorHandle);
        }
        
        const item: InspirationItem = {
            id: generateId(),
            platform: 'twitter',
            author: authorName,
            authorHandle,
            authorAvatar: authorAvatar || undefined,
            authorProfileUrl: `https://twitter.com/${authorHandle}`,
            content: content || `[图片内容，共 ${media.length} 张]`,
            url,
            thumbnail: media[0] || undefined,
            media: media.length > 0 ? media : undefined,
            capturedAt: Date.now(),
            isDetail: true,
            authorThread: commentData?.authorThread || undefined,
            commentHighlights: commentData?.otherComments.length ? commentData.otherComments.join('\n') : undefined,
        };
        
        console.log('[灵感模式] 采集详情页:', item.content?.slice(0, 30));
        
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

// Initialize
async function init() {
    console.log('Initializing 松鼠收藏夹...');
    
    // 检查悬浮按钮设置
    const settings = await storage.getSettings();
    const showButton = settings?.showFloatingButton !== false; // 默认显示
    
    createFloatingButton();
    trackCurrentTweet();
    
    // 根据设置显示/隐藏悬浮按钮
    if (floatingBtnElement && !showButton) {
        floatingBtnElement.style.display = 'none';
        console.log('悬浮按钮已根据设置隐藏');
    }
    
    console.log('松鼠收藏夹 initialized!');
}

// Wait for page to load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
