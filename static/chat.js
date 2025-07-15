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
        
        // NEW: Play sound and blink title for incoming messages
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
            activeChats[userEmail].element.querySelector('input').focus();
            return;
        }

        const chatBox = document.createElement('div');
        chatBox.className = 'chat-box w-72 h-96 bg-white dark:bg-slate-800 rounded-t-lg shadow-xl flex flex-col pointer-events-auto';
        chatBox.dataset.chatWith = userEmail;
        chatBox.dataset.lastMessageDate = ''; // NEW: Initialize dataset for date tracking

        chatBox.innerHTML = `
            <div class="chat-header flex justify-between items-center p-2 bg-slate-700 text-white rounded-t-lg cursor-pointer">
                <span class="font-bold text-sm">${user.name}</span>
                <button class="close-chat-btn text-lg leading-none px-2 hover:text-red-400">&times;</button>
            </div>
            <div class="chat-messages flex-1 p-2 space-y-2 overflow-y-auto"></div>
            <div class="chat-input p-2">
                <form class="chat-form">
                    <input type="text" placeholder="Type a message..." class="w-full p-2 border rounded-md bg-slate-100 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm">
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
            const input = e.target.querySelector('input');
            const message = input.value.trim();
            if (message) {
                window.socket.emit('private_message', {
                    recipient_email: userEmail,
                    message: message
                });
                input.value = '';
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
                     // Scroll to bottom after loading history
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

    function addMessageToBox(partnerEmail, senderEmail, message, timestamp, isHistory = false) {
        const chat = activeChats[partnerEmail];
        if (!chat) return;

        const messagesContainer = chat.element.querySelector('.chat-messages');
        const loader = messagesContainer.querySelector('.loader-container');
        if (loader) loader.remove();

        const messageDate = new Date(timestamp).toDateString();
        const lastMessageDate = chat.element.dataset.lastMessageDate;

        // NEW: Add a date separator if the date has changed
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

        // MODIFIED: Changed max-w-xs to max-w-[80%] to prevent overflow.
        messageDiv.innerHTML = `
            <div class="max-w-[80%] p-2 rounded-lg ${isMe ? 'bg-sky-500 text-white' : 'bg-slate-200 dark:bg-slate-600'}">
                <p class="text-sm break-words">${message}</p>
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
        // Scroll to the bottom when restoring to see the latest messages
        const messagesContainer = chat.element.querySelector('.chat-messages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        chat.element.querySelector('input').focus();
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