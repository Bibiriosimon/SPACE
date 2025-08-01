// --- 全局变量和状态 ---
const API_BASE_URL = "https://backend-dt.onrender.com"; 

// 这个变量现在只用来存用户名，方便显示。所有权限验证都靠token。
let currentUsername = null; 
let currentTopicId = null; 
let currentUserId = null; // 【新增】保存当前用户的ID
let currentChatPartner = null;
let chatPollingInterval = null// {id: 1, username: 'Tom'}
// --- DOM 元素获取 (请确保HTML中有这些ID) ---
const authView = document.getElementById('auth-view');
const mainView = document.getElementById('main-view');
const plazaView = document.getElementById('plaza-view');
const topicDetailView = document.getElementById('topic-detail-view');
//avatar
const avatarModal = document.getElementById('avatar-modal');
const avatarModalTitle = document.getElementById('avatar-modal-title');
const avatarChoicesContainer = document.getElementById('avatar-choices-container');
const avatarModalMessage = document.getElementById('avatar-modal-message');

let availableAvatars = []; // 存储从后端获取的所有可选头像URL
let afterAvatarSelectCallback = null; // 用于存储选择头像后要执行的回调函数
//else
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');

const currentUsernameDisplay = document.getElementById('current-username-display');
const logoutBtn = document.getElementById('logout-btn');

const gotoPlazaBtn = document.getElementById('goto-plaza-btn');
const plazaTopicsList = document.getElementById('plaza-topics-list');
const backBtns = document.querySelectorAll('.back-btn');

const publishModal = document.getElementById('publish-modal');
const showPublishModalBtn = document.getElementById('show-publish-modal-btn');
const cancelPublishBtn = document.getElementById('cancel-publish-btn');
const publishForm = document.getElementById('publish-form');

const topicDetailContent = document.getElementById('topic-detail-content');
const commentsList = document.getElementById('comments-list');
const commentForm = document.getElementById('comment-form');
const commentInput = document.getElementById('comment-input');
// chat const
const gotoChatBtn = document.getElementById('goto-chat-btn'); // 确保你的主页有这个按钮
const chatListView = document.getElementById('chat-list-view');
const chatWindowView = document.getElementById('chat-window-view');
const chatUserList = document.getElementById('chat-user-list');
const chatPartnerName = document.getElementById('chat-partner-name');
const chatMessagesContainer = document.getElementById('chat-messages-container');
const chatMessageForm = document.getElementById('chat-message-form');
const chatMessageInput = document.getElementById('chat-message-input');

// --- 核心辅助函数 (非常重要) ---

// 获取认证头
function getAuthHeaders() {
    const token = localStorage.getItem('spaceToken');
    if (!token) return { 'Content-Type': 'application/json' };
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}
//avatar
async function fetchAvailableAvatars() {
    if (availableAvatars.length > 0) return; // 如果已经获取过，就不再重复获取
    try {
        const response = await fetch(`${API_BASE_URL}/api/avatars`);
        if (response.ok) {
            availableAvatars = await response.json();
        } else {
            console.error('Failed to fetch avatars');
        }
    } catch (error) {
        console.error('Error fetching avatars:', error);
    }
}

// 2. 显示头像选择弹窗
async function showAvatarPicker(title, message, callback) {
    // 先确保我们有头像数据
    await fetchAvailableAvatars();

    // 更新弹窗的标题和提示信息
    avatarModalTitle.textContent = title;
    avatarModalMessage.textContent = message;
    
    // 动态生成头像选项
    avatarChoicesContainer.innerHTML = '';
    availableAvatars.forEach(avatarUrl => {
        const img = document.createElement('img');
        img.src = avatarUrl;
        img.className = 'avatar-choice';
        img.onclick = () => handleAvatarSelection(avatarUrl);
        avatarChoicesContainer.appendChild(img);
    });

    // 存储选择头像后要执行的动作
    afterAvatarSelectCallback = callback;
    
    // 显示弹窗
    avatarModal.classList.add('active');
}

// 3. 处理头像选择的逻辑
async function handleAvatarSelection(selectedUrl) {
    // 在视觉上标记选中的头像
    document.querySelectorAll('.avatar-choice').forEach(img => {
        img.classList.toggle('selected', img.src === selectedUrl);
    });

    // 调用我们预设的回调函数，并把选中的URL传给它
    if (afterAvatarSelectCallback) {
        // 让回调函数去处理后续逻辑（比如是注册后选择，还是更新头像）
        await afterAvatarSelectCallback(selectedUrl);
    }
}

// 4. 关闭弹窗的函数
function closeAvatarPicker() {
    avatarModal.classList.remove('active');
    // 清理工作
    afterAvatarSelectCallback = null;
    avatarModalMessage.textContent = '';
}
// --- 函数 ---

// 【【【修改这个函数】】】
function switchView(viewId) {
    // 【新增逻辑】在切换视图之前，检查是否需要停止聊天轮询
    // 如果轮询正在运行，并且我们将要切换到的不是聊天窗口，就停止它
    if (chatPollingInterval && viewId !== 'chat-window-view') {
         clearInterval(chatPollingInterval);
         chatPollingInterval = null;
         console.log('Chat polling stopped by switching view.');
    }
    
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}


// 【【【第二处修改：更新登录函数以保存头像URL】】】
async function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await response.json();
    if (response.ok) {
        // 保存Token和用户信息
        localStorage.setItem('spaceToken', data.token);
        localStorage.setItem('spaceUsername', data.username);
        localStorage.setItem('spaceUserId', data.user_id);
        localStorage.setItem('spaceAvatarUrl', data.avatar_url); // 【新增这一行】

        checkLoginStatus(); // 使用统一的函数来更新状态和视图
    } else {
        alert(data.message);
    }
}


// 注册逻辑基本不变，只是URL变了
// 【【【第一处修改：彻底重写注册函数】】】
async function handleRegister(event) {
    event.preventDefault();
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    
    // 我们可以在这里加一个简单的错误提示元素
    // const errorEl = document.getElementById('register-error');

    try {
        const response = await fetch(`${API_BASE_URL}/api/register`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();

        if (response.ok) {
            // 注册成功了！
            const newUser = data.user;

            // 1. 定义一个注册成功后选择头像的回调函数
            const afterRegisterAvatarSelect = async (selectedUrl) => {
                avatarModalMessage.textContent = 'Saving your choice...';
                // 2. 调用后端API更新头像
                const updateResponse = await fetch(`${API_BASE_URL}/api/user/avatar`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        username: newUser.username, // 传递用户名，因为此时没token
                        avatar_url: selectedUrl
                    })
                });

                if (updateResponse.ok) {
                    avatarModalMessage.textContent = 'Great! Now you can log in.';
                    // 3. 延迟2秒后关闭弹窗并切换到登录表单
                    setTimeout(() => {
                        closeAvatarPicker();
                        // 触发“显示登录表单”的链接点击事件
                        showLoginLink.click();
                    }, 2000);
                } else {
                    const errorData = await updateResponse.json();
                    avatarModalMessage.textContent = `Error: ${errorData.error}`;
                }
            };
            
            // 4. 调用我们通用的头像选择器
            showAvatarPicker(
                "Here we go!",
                "Choose an avatar and log in!",
                afterRegisterAvatarSelect
            );

        } else {
            // 用 alert 或 errorEl 显示错误信息
            alert(`Registration failed: ${data.message}`);
            // errorEl.textContent = data.message || '注册失败';
        }
    } catch (error) {
        alert('A network error occurred.');
        // errorEl.textContent = '发生网络错误';
    }
}


function handleLogout() {
    // 清除Token和用户名
    localStorage.removeItem('spaceToken');
    localStorage.removeItem('spaceUsername');
    currentUsername = null;
    switchView('auth-view');
    loginForm.reset();
}

// --- Plaza 功能函数 ---

async function showPlazaView() {
    switchView('plaza-view');
    plazaTopicsList.innerHTML = '<p>正在加载帖子...</p>';

    // 【【【修改】】】
    // 查看帖子不需要登录，所以不需要认证头
    const response = await fetch(`${API_BASE_URL}/api/plaza/topics`);
    const topics = await response.json();
    renderPlazaTopics(topics);
}

// 【【【第六处修改：让Plaza帖子列表显示头像】】】
// 修改 renderPlazaTopics 以支持动画延迟
function renderPlazaTopics(topics) {
    plazaTopicsList.innerHTML = '';
    if (topics.length === 0) { /* ... */ return; }

    topics.forEach((topic, index) => {
        const topicCard = document.createElement('div');
        topicCard.className = 'topic-card';
        topicCard.dataset.topicId = topic.id;
        topicCard.innerHTML = `
            <div class="topic-header">
                 <img src="${topic.author_avatar_url}" alt="${topic.author_username}" class="avatar">
                 <h3>${topic.title}</h3>
            </div>
            <p>${topic.content.substring(0, 100)}...</p>
            <div class="topic-meta">
                <span>By: ${topic.author_username}</span> | 
                <span>${new Date(topic.created_at).toLocaleString()}</span>
            </div>
        `;
        
        // 【【【核心修改】】】
        // 设置动画延迟，每个卡片比前一个晚出现 40 毫秒
        topicCard.style.animationDelay = `${index * 40}ms`;

        plazaTopicsList.appendChild(topicCard);
    });
}



async function handlePublishTopic(event) {
    event.preventDefault();
    const title = document.getElementById('publish-title').value;
    const content = document.getElementById('publish-content').value;
    const imageUrl = document.getElementById('publish-image-url').value;
    
    // 【【【修改】】】
    // 发布需要认证！
    const response = await fetch(`${API_BASE_URL}/api/plaza/topics`, {
        method: 'POST',
        headers: getAuthHeaders(), // 使用辅助函数获取认证头
        body: JSON.stringify({ title, content, image_url: imageUrl })
    });

    if (response.ok) {
        publishModal.classList.remove('active');
        publishForm.reset();
        await showPlazaView();
    } else {
        const data = await response.json();
        alert(`发布失败: ${data.error || data.message}`);
    }
}

// --- 帖子详情、评论、点赞函数 (全新) ---

async function showTopicDetailView(topicId) {
    currentTopicId = topicId;
    switchView('topic-detail-view');
    topicDetailContent.innerHTML = '<h2>正在加载...</h2>';
    commentsList.innerHTML = ''; // 先清空评论区

    try {
        const response = await fetch(`${API_BASE_URL}/api/plaza/topics/${topicId}`);
        if (!response.ok) {
            throw new Error("获取帖子详情失败");
        }
        const data = await response.json();
        
        console.log("获取到帖子详情:", data); // 调试日志

        renderTopicDetail(data.topic);
        renderComments(data.comments);

    } catch (error) {
        console.error(error);
        topicDetailContent.innerHTML = '<h2>无法加载帖子。</h2>';
    }
}

function renderTopicDetail(topic) {
    topicDetailContent.innerHTML = `
        <h2>${topic.title}</h2>
        <p>${topic.content}</p>
        <div class="topic-meta">
            <span>发布者: ${topic.author_username}</span> | 
            <span>${new Date(topic.created_at).toLocaleString()}</span>
        </div>
    `;
}

// 【【【第七处修改：让评论区显示头像】】】
function renderComments(comments) {
    commentsList.innerHTML = ''; 
    if (!Array.isArray(comments) || comments.length === 0) {
        commentsList.innerHTML = '<p>还没有评论，快来抢沙发！</p>';
        return;
    }

    comments.forEach(comment => {
        const commentCard = document.createElement('div');
        commentCard.className = 'comment-card';
        commentCard.dataset.commentId = comment.id;
        // 【更新HTML结构】
        commentCard.innerHTML = `
            <img src="${comment.author_avatar_url}" alt="${comment.author_username}" class="avatar">
            <div class="comment-content">
                <div class="comment-author">${comment.author_username}</div>
                <p>${comment.content}</p>
                <div class="comment-meta">
                    <span class="comment-time">${new Date(comment.created_at).toLocaleString()}</span>
                    <button class="like-btn">
                        <span class="icon">♥</span> ${comment.author_likes}
                    </button>
                </div>
            </div>
        `;
        commentsList.appendChild(commentCard);
    });
}



async function handleCommentSubmit(event) {
    event.preventDefault();
    const content = commentInput.value.trim();
    if (!content) return;

    // 【【【修改】】】
    // 评论需要认证！
    const response = await fetch(`${API_BASE_URL}/api/plaza/topics/${currentTopicId}/comments`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ content })
    });

    if (response.ok) {
        commentInput.value = '';
        await showTopicDetailView(currentTopicId);
    } else {
        const data = await response.json();
        alert(`评论失败: ${data.error}`);
    }
}
// 【请确认你的函数是这样的】
async function showChatListView() {
    // 1. 切换到正确的视图
    switchView('chat-list-view'); 
    
    // 2. 在【chat-user-list】里显示加载提示
    chatUserList.innerHTML = '<p>正在加载用户列表...</p>'; 

    try {
        const response = await fetch(`${API_BASE_URL}/api/users`, { headers: getAuthHeaders() });
        if (!response.ok) { // 增加错误检查
            throw new Error('获取用户列表失败');
        }
        const users = await response.json();

        // 3. 调用【renderUserList】来渲染用户列表
        renderUserList(users); 
    } catch (error) {
        console.error(error);
        chatUserList.innerHTML = '<p>无法加载用户列表。</p>';
    }
}

// 【【【第三处新增：创建当前用户操作栏的函数】】】
function renderCurrentUserBar() {
    const username = localStorage.getItem('spaceUsername');
    const avatarUrl = localStorage.getItem('spaceAvatarUrl');

    const currentUserBar = document.createElement('div');
    currentUserBar.className = 'user-card current-user-bar'; // 复用user-card样式
    currentUserBar.innerHTML = `
        <img src="${avatarUrl}" alt="${username}" class="avatar">
        <div class="user-card-info">${username} (You)</div>
        <div class="user-card-actions">
            <button id="change-avatar-btn">Avatar</button>
        </div>
    `;
    // 将这个操作栏作为列表的第一个子元素插入
    chatUserList.prepend(currentUserBar);

    // 为按钮添加事件监听
    document.getElementById('change-avatar-btn').addEventListener('click', handleChangeAvatarClick);
}
// 【【【第五处新增：处理更换头像的函数】】】
function handleChangeAvatarClick() {
    // 1. 定义一个更换头像成功后的回调函数
    const afterChangeAvatarSelect = async (selectedUrl) => {
        try {
            avatarModalMessage.textContent = 'Updating...';
            // 2. 调用后端API更新
            const response = await fetch(`${API_BASE_URL}/api/user/avatar`, {
                method: 'POST',
                headers: getAuthHeaders(), // 这里我们有token了
                body: JSON.stringify({ avatar_url: selectedUrl })
            });

            if (response.ok) {
                const data = await response.json();
                // 3. 更新 localStorage 和界面上的头像
                localStorage.setItem('spaceAvatarUrl', data.new_avatar_url);
                document.querySelector('.current-user-bar .avatar').src = data.new_avatar_url;
                
                avatarModalMessage.textContent = 'Avatar updated!';
                setTimeout(closeAvatarPicker, 1500);
            } else {
                const errorData = await response.json();
                avatarModalMessage.textContent = `Error: ${errorData.error}`;
            }
        } catch (error) {
            avatarModalMessage.textContent = 'Network error.';
        }
    };
    
    // 4. 调用我们通用的头像选择器
    showAvatarPicker(
        "Change Your Avatar",
        "Select a new look!",
        afterChangeAvatarSelect
    );
}

// 渲染用户列表
// 【请确认你的函数是这样的】
// 【【【第四处修改：让renderUserList显示头像并调用新函数】】】
function renderUserList(users) {
    chatUserList.innerHTML = ''; 

    // 【新增】第一步：渲染当前用户的操作栏
    renderCurrentUserBar();

    if (users.length === 0) {
        // 如果没有其他用户，只显示一个提示
        const noUsersP = document.createElement('p');
        noUsersP.textContent = '还没有其他用户加入。';
        chatUserList.appendChild(noUsersP);
        return;
    }

    // 第二步：渲染其他所有用户
    users.forEach(user => {
        const userCard = document.createElement('div');
        userCard.className = 'user-card';
        userCard.dataset.userId = user.id;
        userCard.dataset.username = user.username;
        // 【更新HTML结构】加入头像
        userCard.innerHTML = `
            <img src="${user.avatar_url}" alt="${user.username}" class="avatar">
            <div class="user-card-info">
                ${user.username}
                <span>♥ ${user.likes_received}</span>
            </div>
            <div class="user-card-actions">
                <button class="like-btn user-like-btn">点赞</button>
                <button class="chat-kick-btn">Chat</button> <!-- 改成Chat更直观 -->
            </div>
        `;
        chatUserList.appendChild(userCard); 
    });
}

// 显示聊天窗口视图
// 【【【修改】】】
// 【【【新增这个函数】】】
async function fetchNewMessages(partnerId) {
    // 1. 获取聊天容器里最后一条消息的元素
    const lastMessage = chatMessagesContainer.querySelector('.message-wrapper:last-child');
    // 2. 从元素中读取消息ID，如果没有消息，就设为0
    const lastMessageId = lastMessage ? lastMessage.dataset.messageId : 0;

    try {
        // 3. 调用后端的新API，只请求比lastMessageId更新的消息
        const response = await fetch(`${API_BASE_URL}/api/chat/${partnerId}/new?since=${lastMessageId}`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const newMessages = await response.json();
            // 4. 如果有新消息，就调用render函数进行追加
            if (newMessages.length > 0) {
                // 传入false表示我们是在“追加”新消息
                renderChatMessages(newMessages, false); 
            }
        } else {
            // 如果请求出错（比如token过期），就停止轮询防止无限报错
            console.error('Polling failed with status:', response.status);
            clearInterval(chatPollingInterval);
            chatPollingInterval = null;
        }
    } catch (error) {
        console.error('Network error during polling:', error);
        clearInterval(chatPollingInterval);
        chatPollingInterval = null;
    }
}

// 【【【修改这个函数】】】
async function showChatWindowView(otherUserId, otherUsername) {
    switchView('chat-window-view');
    currentChatPartner = { id: otherUserId, username: otherUsername };
    chatPartnerName.textContent = `与 ${otherUsername} 聊天中`;
    
    // 清理可能存在的旧轮询（以防万一）
    if (chatPollingInterval) {
        clearInterval(chatPollingInterval);
    }

    try {
        // 第一次加载，显示“加载中”并获取完整历史记录
        chatMessagesContainer.innerHTML = '<p>正在加载聊天记录...</p>';
        const response = await fetch(`${API_BASE_URL}/api/chat/${otherUserId}`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error('无法加载聊天记录');
        
        const messages = await response.json();
        // 【注意】调用修改后的render函数，传入true表示是第一次加载
        renderChatMessages(messages, true);

        // 【【【核心新增】】】 启动定时轮询，每3秒查询一次新消息
        chatPollingInterval = setInterval(() => {
            fetchNewMessages(otherUserId);
        }, 3000); // 3000毫秒 = 3秒

    } catch (error) {
        console.error("加载聊天记录时出错:", error);
        chatMessagesContainer.innerHTML = `<p style="color:red;">加载失败: ${error.message}</p>`;
    }
}




// 渲染聊天消息
// 【【【第八处修改：让聊天气泡带上头像】】】
// 【【【修改这个函数】】】
function renderChatMessages(messages, isFirstLoad) {
    // 1. 如果是第一次加载，才清空容器
    if (isFirstLoad) {
        chatMessagesContainer.innerHTML = '';
    }
    
    // 如果没有消息，就不执行后续操作
    if (!messages || messages.length === 0) {
        if (isFirstLoad) {
            chatMessagesContainer.innerHTML = '<p>还没有聊天记录，开始对话吧！</p>';
        }
        return;
    }

    const currentUserId = parseInt(localStorage.getItem('spaceUserId'), 10);
    const currentUserAvatar = localStorage.getItem('spaceAvatarUrl');
    
    let partnerAvatar = '';
    // 只有在第一次加载时才需要去消息里找对方头像
    if (isFirstLoad && messages.length > 0) {
       const firstMessage = messages[0];
       partnerAvatar = firstMessage.sender_id === currentUserId ? firstMessage.receiver_avatar_url : firstMessage.sender_avatar_url;
       // 把对方头像存起来，方便追加新消息时使用
       chatMessagesContainer.dataset.partnerAvatar = partnerAvatar;
    } else {
        // 后续追加消息时，直接从容器的dataset里读取
        partnerAvatar = chatMessagesContainer.dataset.partnerAvatar;
    }

    // 2. 遍历消息并追加到容器
    messages.forEach(msg => {
        const messageWrapper = document.createElement('div');
        messageWrapper.className = 'message-wrapper';
        messageWrapper.dataset.messageId = msg.id; // 【【【关键新增】】】

        if (msg.sender_id === currentUserId) {
            messageWrapper.classList.add('sent');
            messageWrapper.innerHTML = `
                <div class="message-bubble">${msg.content}</div>
                <img src="${currentUserAvatar}" class="avatar">
            `;
        } else {
            messageWrapper.classList.add('received');
            messageWrapper.innerHTML = `
                <img src="${partnerAvatar}" class="avatar">
                <div class="message-bubble">${msg.content}</div>
            `;
        }
        chatMessagesContainer.appendChild(messageWrapper);
    });
    
    // 3. 滚动到底部
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}


// 处理发送消息
// 【【【第九处修改：优化发送消息逻辑，实现丝滑追加】】】
async function handleSendMessage(event) {
    event.preventDefault();
    const content = chatMessageInput.value.trim();
    if (!content || !currentChatPartner) return;

    chatMessageInput.disabled = true;
    try {
        const response = await fetch(`${API_BASE_URL}/api/chat/send`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                receiver_id: currentChatPartner.id,
                content: content
            })
        });
        if (response.ok) {
            const newMessage = await response.json();
            
            // 【新逻辑】直接在前端构建新消息并追加，而不是刷新整个列表
            const messageWrapper = document.createElement('div');
            messageWrapper.className = 'message-wrapper sent'; // 自己发的肯定是sent
            messageWrapper.innerHTML = `
                <div class="message-bubble">${newMessage.content}</div>
                <img src="${localStorage.getItem('spaceAvatarUrl')}" class="avatar">
            `;
            chatMessagesContainer.appendChild(messageWrapper);
            
            chatMessageInput.value = '';
            chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

        } else {
            alert('发送失败');
        }
    } finally {
        chatMessageInput.disabled = false;
        chatMessageInput.focus();
    }
}



// 处理在用户列表中的点击事件（点赞或聊天）
async function handleChatListClick(event) {
    const target = event.target;
    const userCard = target.closest('.user-card');
    if (!userCard) return;

    const userId = parseInt(userCard.dataset.userId, 10);
    const username = userCard.dataset.username;

    // 如果点击的是 "Kick" 按钮
    if (target.classList.contains('chat-kick-btn')) {
        showChatWindowView(userId, username);
    }

    // 如果点击的是 "点赞" 按钮
    if (target.classList.contains('user-like-btn')) {
        target.disabled = true;
        const response = await fetch(`${API_BASE_URL}/api/users/${userId}/like`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        if (response.ok) {
            // 点赞成功后，刷新整个列表来更新点赞数
            await showChatListView();
        } else {
            alert('点赞失败');
            target.disabled = false;
        }
    }
}
async function handleLikeClick(event) {
    const likeButton = event.target.closest('.like-btn');
    if (!likeButton) return;
    
    // 防止重复点击
    likeButton.disabled = true; 

    const commentCard = likeButton.closest('.comment-card');
    const commentId = commentCard.dataset.commentId;

    // 【【【修改】】】
    // 点赞需要认证！
    const response = await fetch(`${API_BASE_URL}/api/plaza/comments/${commentId}/like`, {
        method: 'POST',
        headers: getAuthHeaders()
    });
    
    const data = await response.json();
    if (response.ok) {
        // 点赞成功后，刷新整个详情页以更新所有数据
        await showTopicDetailView(currentTopicId);
    } else {
        alert(`点赞失败: ${data.error}`);
        likeButton.disabled = false; // 失败了，把按钮恢复
    }
}

// --- 事件监听 ---
loginForm.addEventListener('submit', handleLogin);
registerForm.addEventListener('submit', handleRegister);
logoutBtn.addEventListener('click', handleLogout);
gotoChatBtn.addEventListener('click', showChatListView); // 新增
chatUserList.addEventListener('click', handleChatListClick); // 新增
chatMessageForm.addEventListener('submit', handleSendMessage); // 新增
showRegisterLink.addEventListener('click', (e) => { e.preventDefault(); loginForm.style.display = 'none'; registerForm.style.display = 'flex'; });
showLoginLink.addEventListener('click', (e) => { e.preventDefault(); registerForm.style.display = 'none'; loginForm.style.display = 'flex'; });

gotoPlazaBtn.addEventListener('click', showPlazaView);

backBtns.forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.target));
});

plazaTopicsList.addEventListener('click', (event) => {
    const topicCard = event.target.closest('.topic-card');
    if (topicCard) {
        // 加上 console.log 方便我们调试
        console.log("点击了帖子卡片，ID:", topicCard.dataset.topicId); 
        showTopicDetailView(topicCard.dataset.topicId);
    }
});

showPublishModalBtn.addEventListener('click', () => publishModal.classList.add('active'));
cancelPublishBtn.addEventListener('click', () => publishModal.classList.remove('active'));
publishForm.addEventListener('submit', handlePublishTopic);

commentForm.addEventListener('submit', handleCommentSubmit);
commentsList.addEventListener('click', handleLikeClick);

// --- 初始化逻辑 ---
function checkLoginStatus() {
    const token = localStorage.getItem('spaceToken');
    const username = localStorage.getItem('spaceUsername');
    const userId = localStorage.getItem('spaceUserId');
    if (token && username && userId) {
        currentUsername = username;
        currentUserId = parseInt(userId, 10);
        currentUsernameDisplay.textContent = ` Hi! ${currentUsername}`;
        switchView('main-view');
    } else {
        switchView('auth-view');
    }
}

checkLoginStatus(); // 页面加载时立即执行

