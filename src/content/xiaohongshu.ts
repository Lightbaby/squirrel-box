import { storage } from '../lib/storage';
import { summarizeTweet, recognizeImage } from '../lib/ai';
import { generateId } from '../lib/utils';
import { Tweet } from '../lib/types';

console.log('松鼠收藏夹 (小红书): Content script loaded');

// 评论区数据类型
interface CommentData {
    authorThread: string;      // 作者自己的补充内容/回复
    otherComments: string[];   // 其他用户的评论
}

let readingMode = false;
let currentNote: Element | null = null;

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
