// /static/chat.js
function initializeChatModule(deps) {
    const { API_URL, currentUser, showToast } = deps;
    if (!currentUser) return;

    window.socket = io(API_URL); // Make socket globally accessible for disconnection on logout

    const onlineUsersToggle = document.getElementById('online-users-toggle');
    const onlineUsersList = document.getElementById('online-users-list');
    const onlineUsersCount = document.getElementById('online-users-count');
    const chatBoxesContainer = document.getElementById('chat-boxes-container');
    const minimizedChatsContainer = document.getElementById('minimized-chats-container');
    const hideOfflineBtn = document.getElementById('hide-offline-btn');

    let activeChats = {}; // track all chats (open or minimized) by email
                          // Structure: { element, state: 'open' | 'minimized', unread: 0, user }
    let hideOfflineUsers = false; // state for the offline user filter

    // --- Socket.IO Event Handlers ---

    window.socket.on('connect', () => {
        console.log('Connected to chat server.');
        window.socket.emit('user_online', { email: currentUser.email });
    });

    window.socket.on('update_user_list', (data) => {
        renderUserList(data.all_users, data.online_users);
    });

    window.socket.on('new_message', (data) => {
        const { sender_email, recipient_email, message, timestamp } = data;
        const chatPartnerEmail = sender_email === currentUser.email ? recipient_email : sender_email;
 
        const chat = activeChats[chatPartnerEmail];
        
        if (sender_email !== currentUser.email) {
            if(window.playNotificationSound) window.playNotificationSound();
            if(window.triggerTitleNotification) window.triggerTitleNotification('New Message!');
        }

        if (!chat) {
            const allUsers = JSON.parse(sessionStorage.getItem('all_users') || '[]');
            let user = allUsers.find(u => u.email === chatPartnerEmail) || { email: chatPartnerEmail, name: chatPartnerEmail.split('@')[0] };
            openChatBox(user, true).then(() => {
                 addMessageToBox(chatPartnerEmail, sender_email, message, timestamp);
            });
        } else if (chat.state === 'minimized') {
            chat.unread++;
            addMessageToBox(chatPartnerEmail, sender_email, message, timestamp);
            updateMinimizedBadge(chatPartnerEmail);
        } else {
            addMessageToBox(chatPartnerEmail, sender_email, message, timestamp);
        }
    });

    window.socket.on('disconnect', () => {
        console.log('Disconnected from chat server.');
    });

    // --- UI Rendering and Management ---

    function renderUserList(allUsers, onlineUsers) {
        sessionStorage.setItem('all_users', JSON.stringify(allUsers));
        sessionStorage.setItem('online_users', JSON.stringify(onlineUsers));

        const itemsToRemove = onlineUsersList.querySelectorAll('li[data-email], li.text-slate-400');
        itemsToRemove.forEach(item => item.remove());
        
        let usersToRender = hideOfflineUsers
            ? allUsers.filter(u => onlineUsers.includes(u.email))
            : allUsers;
        
        const onlineCount = onlineUsers.filter(email => email !== currentUser.email).length;
        onlineUsersCount.textContent = onlineCount;

        if (allUsers.length <= 1) {
            onlineUsersList.insertAdjacentHTML('beforeend', '<li class="text-slate-400 text-center py-4">No other users in the system.</li>');
            return;
        }

        usersToRender.sort((a, b) => {
            const aIsOnline = onlineUsers.includes(a.email);
            const bIsOnline = onlineUsers.includes(b.email);
            if (aIsOnline && !bIsOnline) return -1;
            if (!aIsOnline && bIsOnline) return 1;
            return a.name.localeCompare(b.name);
        });

        let renderedCount = 0;
        usersToRender.forEach(user => {
            if (user.email === currentUser.email) return;

            const isOnline = onlineUsers.includes(user.email);
            const li = document.createElement('li');
            li.className = 'flex items-center justify-between p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md cursor-pointer';
            li.dataset.email = user.email;
            li.innerHTML = `
                <span class="font-medium text-sm">${user.name}</span>
                <span class="w-2 h-2 ${isOnline ? 'bg-green-500' : 'bg-slate-400'} rounded-full"></span>
            `;
            li.addEventListener('click', () => openChatBox(user));
            onlineUsersList.appendChild(li);
            renderedCount++;
        });

        if (renderedCount === 0) {
            onlineUsersList.insertAdjacentHTML('beforeend', '<li class="text-slate-400 text-center py-4">No users match the current filter.</li>');
        }
    }

    async function openChatBox(user, fetchHistory = true) {
        const userEmail = user.email;
        if (activeChats[userEmail]) {
            if (activeChats[userEmail].state === 'minimized') {
                restoreChat(userEmail);
            }
            activeChats[userEmail].element.querySelector('input[type="text"]').focus();
            return;
        }

        const chatBox = document.createElement('div');
        chatBox.className = 'chat-box w-72 h-96 bg-white dark:bg-slate-800 rounded-t-lg shadow-xl flex flex-col pointer-events-auto';
        chatBox.dataset.chatWith = userEmail;
        chatBox.dataset.lastMessageDate = '';

        const uniqueFileId = `chat-file-input-${userEmail.replace(/[^a-zA-Z0-9]/g, '')}`;

        chatBox.innerHTML = `
            <div class="chat-header flex justify-between items-center p-2 bg-slate-700 text-white rounded-t-lg cursor-pointer">
                <span class="font-bold text-sm">${user.name}</span>
                <button class="close-chat-btn text-lg leading-none px-2 hover:text-red-400">&times;</button>
            </div>
            <div class="chat-messages flex-1 p-2 space-y-2 overflow-y-auto"></div>
            <div class="chat-input p-2 border-t dark:border-slate-700">
                <form class="chat-form flex items-center gap-2">
                    <label for="${uniqueFileId}" class="cursor-pointer text-slate-500 hover:text-sky-500 p-2 transition-colors">
                        <i class="fas fa-paperclip"></i>
                    </label>
                    <input type="file" id="${uniqueFileId}" class="hidden">
                    <input type="text" placeholder="Type a message..." class="w-full p-2 border rounded-md bg-slate-100 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm flex-grow">
                    <button type="submit" class="p-2 text-sky-500 hover:text-sky-600 transition-colors" title="Send Message">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </form>
            </div>
        `;

        activeChats[userEmail] = { element: chatBox, state: 'open', unread: 0, user: user };
        chatBoxesContainer.appendChild(chatBox);

        chatBox.querySelector('.chat-header').addEventListener('click', (e) => {
            if (e.target.classList.contains('close-chat-btn')) return;
            minimizeChat(userEmail);
        });

        chatBox.querySelector('.close-chat-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            closeChat(userEmail);
        });

        chatBox.querySelector('.chat-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const input = e.target.querySelector('input[type="text"]');
            const messageContent = input.value.trim();
            if (messageContent) {
                const messageObject = { type: 'text', content: messageContent };
                window.socket.emit('private_message', {
                    recipient_email: userEmail,
                    message: messageObject
                });
                input.value = '';
            }
        });
        
        // ADDED: Listener for file input
        const fileInput = chatBox.querySelector(`#${uniqueFileId}`);
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleFileUpload(file, userEmail, chatBox);
            }
        });

        const messagesContainer = chatBox.querySelector('.chat-messages');
        messagesContainer.innerHTML = `<div class="loader-container text-center p-4"><div class="loader !w-6 !h-6 mx-auto"></div></div>`;
        if (fetchHistory) {
            try {
                const res = await fetch(`${API_URL}/chat_history/${currentUser.email}/${userEmail}`);
                const data = await res.json();
                messagesContainer.innerHTML = '';
                if (data.success && data.history) {
                    data.history.forEach(msg => {
                        addMessageToBox(userEmail, msg.sender_email, msg.message, msg.timestamp, true);
                    });
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            } catch (err) {
                showToast('Could not load chat history.', true);
                messagesContainer.innerHTML = '<p class="text-red-500 text-xs text-center">Failed to load history</p>';
            }
        } else {
            const loader = messagesContainer.querySelector('.loader-container');
            if(loader) loader.remove();
        }
    }
    
    // ADDED: Function to handle file upload process
    async function handleFileUpload(file, recipientEmail, chatBox) {
        const formData = new FormData();
        formData.append('file', file);

        // Show a temporary "uploading" message
        const tempId = `temp-upload-${Date.now()}`;
        const tempMessageHTML = `
            <div id="${tempId}" class="w-full flex justify-end">
                <div class="max-w-[80%] p-2 rounded-lg bg-sky-500/50 text-white animate-pulse">
                    <p class="text-sm break-words"><i>Uploading ${file.name}...</i></p>
                </div>
            </div>
        `;
        chatBox.querySelector('.chat-messages').insertAdjacentHTML('beforeend', tempMessageHTML);

        try {
            const response = await fetch(`${API_URL}/upload_chat_attachment`, {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            
            // Remove temporary message
            document.getElementById(tempId)?.remove();

            if (result.success) {
                const messageObject = { 
                    type: 'file', 
                    url: result.url,
                    filename: result.filename,
                    size: file.size
                };
                window.socket.emit('private_message', {
                    recipient_email: recipientEmail,
                    message: messageObject
                });
            } else {
                showToast(result.message || 'File upload failed.', true);
            }
        } catch (error) {
            document.getElementById(tempId)?.remove();
            showToast('An error occurred during upload.', true);
            console.error('File upload error:', error);
        }
    }

    // MODIFIED: Function to render different message types
    function addMessageToBox(partnerEmail, senderEmail, messageObject, timestamp, isHistory = false) {
        const chat = activeChats[partnerEmail];
        if (!chat) return;

        const messagesContainer = chat.element.querySelector('.chat-messages');
        const loader = messagesContainer.querySelector('.loader-container');
        if (loader) loader.remove();

        const messageDate = new Date(timestamp).toDateString();
        const lastMessageDate = chat.element.dataset.lastMessageDate;

        if (messageDate !== lastMessageDate) {
            const dateSeparator = document.createElement('div');
            dateSeparator.className = 'w-full text-center my-2';
            dateSeparator.innerHTML = `<span class="bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-semibold px-2 py-1 rounded-full">${new Date(timestamp).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>`;
            messagesContainer.appendChild(dateSeparator);
            chat.element.dataset.lastMessageDate = messageDate;
        }

        const messageDiv = document.createElement('div');
        const isMe = senderEmail === currentUser.email;
        messageDiv.className = `w-full flex ${isMe ? 'justify-end' : 'justify-start'}`;

        const timeString = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let messageContentHTML = '';
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        
        switch (messageObject.type) {
            case 'file':
                const isImage = imageExtensions.some(ext => messageObject.filename.toLowerCase().endsWith(ext));
                if (isImage) {
                    messageContentHTML = `
                        <a href="${API_URL}${messageObject.url}" target="_blank" rel="noopener noreferrer">
                            <img src="${API_URL}${messageObject.url}" alt="${messageObject.filename}" class="max-w-full h-auto rounded-md my-1">
                        </a>
                    `;
                } else {
                    const fileSize = messageObject.size ? `(${(messageObject.size / 1024).toFixed(1)} KB)` : '';
                    messageContentHTML = `
                        <a href="${API_URL}${messageObject.url}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 p-2 bg-slate-300/50 dark:bg-slate-500/50 rounded-md hover:bg-slate-300 dark:hover:bg-slate-500">
                            <i class="fas fa-file-alt text-xl"></i>
                            <div>
                                <p class="text-sm font-semibold break-all">${messageObject.filename}</p>
                                <p class="text-xs">${fileSize}</p>
                            </div>
                        </a>
                    `;
                }
                break;
            case 'text':
            default:
                messageContentHTML = `<p class="text-sm break-words">${messageObject.content}</p>`;
                break;
        }

        messageDiv.innerHTML = `
            <div class="max-w-[80%] p-2 rounded-lg ${isMe ? 'bg-sky-500 text-white' : 'bg-slate-200 dark:bg-slate-600'}">
                ${messageContentHTML}
                <p class="text-xs text-right mt-1 ${isMe ? 'text-slate-200/80' : 'text-slate-500 dark:text-slate-400'}">${timeString}</p>
            </div>
        `;
        messagesContainer.appendChild(messageDiv);

        if (!isHistory) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }


    function closeChat(userEmail) {
        const chat = activeChats[userEmail];
        if (!chat) return;

        if (chat.state === 'minimized') {
            chat.minimizedElement.remove();
        }
        chat.element.remove();
        delete activeChats[userEmail];
    }

    function minimizeChat(userEmail) {
        const chat = activeChats[userEmail];
        if (!chat || chat.state === 'minimized') return;

        chat.state = 'minimized';
        chat.element.classList.add('hidden');

        const minimizedBar = document.createElement('div');
        minimizedBar.className = 'minimized-chat-bar';
        minimizedBar.dataset.chatWith = userEmail;
        minimizedBar.innerHTML = `<span>${chat.user.name}</span>`;
        minimizedBar.addEventListener('click', () => restoreChat(userEmail));

        chat.minimizedElement = minimizedBar;
        minimizedChatsContainer.appendChild(minimizedBar);
        updateMinimizedBadge(userEmail);
    }

    function restoreChat(userEmail) {
        const chat = activeChats[userEmail];
        if (!chat || chat.state === 'open') return;

        chat.state = 'open';
        chat.unread = 0;
        chat.element.classList.remove('hidden');
        if (chat.minimizedElement) {
            chat.minimizedElement.remove();
            chat.minimizedElement = null;
        }
        const messagesContainer = chat.element.querySelector('.chat-messages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        chat.element.querySelector('input[type="text"]').focus();
    }

    function updateMinimizedBadge(userEmail) {
        const chat = activeChats[userEmail];
        if (!chat || !chat.minimizedElement) return;

        let badge = chat.minimizedElement.querySelector('.minimized-chat-badge');
        if (chat.unread > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'minimized-chat-badge';
                chat.minimizedElement.appendChild(badge);
            }
            badge.textContent = chat.unread;
        } else if (badge) {
            badge.remove();
        }
    }

    // --- Main UI Listeners ---
    if (hideOfflineBtn) {
        hideOfflineBtn.addEventListener('click', () => {
            hideOfflineUsers = !hideOfflineUsers;

            if (hideOfflineUsers) {
                hideOfflineBtn.textContent = 'Show All Users';
                hideOfflineBtn.classList.add('active-filter');
            } else {
                hideOfflineBtn.textContent = 'Hide Offline';
                hideOfflineBtn.classList.remove('active-filter');
            }

            const allUsers = JSON.parse(sessionStorage.getItem('all_users') || '[]');
            const onlineUsers = JSON.parse(sessionStorage.getItem('online_users') || '[]');
            renderUserList(allUsers, onlineUsers);
        });
    }
    if(onlineUsersToggle) {
        onlineUsersToggle.addEventListener('click', () => {
            onlineUsersList.classList.toggle('hidden');
        });
    }
}