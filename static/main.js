// /static/main.js
document.addEventListener('DOMContentLoaded', () => {
    // This function loads the HTML content for each tab from separate files.
    const loadTabContent = async (filePath, targetElementId) => {
        try {
            const response = await fetch(filePath);
            if (!response.ok) throw new Error(`Network response was not ok for ${filePath}`);
            const html = await response.text();
            document.getElementById(targetElementId).innerHTML = html;
        } catch (error) {
            console.error('Failed to load tab content:', error);
            document.getElementById(targetElementId).innerHTML = `<p class="text-red-500 text-center p-8">Error: Could not load content for this tab.</p>`;
        }
    };

    // Defines all tabs and their corresponding HTML files.
    const tabsToLoad = [
        { path: '/static/components/offer.html', id: 'tab-content-generator' },
        { path: '/static/components/projects.html', id: 'tab-content-projects' },
        { path: '/static/components/shared-with-me.html', id: 'tab-content-shared-with-me' },
        { path: '/static/components/my-reviews.html', id: 'tab-content-my-reviews' },
        { path: '/static/components/purchase-order.html', id: 'tab-content-purchase-order' },
        { path: '/static/components/admin-review.html', id: 'tab-content-admin-review' },
        { path: '/static/components/activity-log.html', id: 'tab-content-activity-log' },
        { path: '/static/components/ai-helper.html', id: 'tab-content-ai-helper' },
        { path: '/static/components/messaging.html', id: 'tab-content-messaging' },
        { path: '/static/components/challan.html', id: 'tab-content-challan' },
        { path: '/static/components/chat.html', id: 'chat-ui-container' }
    ];

    // Fetches all tab HTML files in parallel and then initializes the main application logic.
    Promise.all(tabsToLoad.map(tab => loadTabContent(tab.path, tab.id)))
        .then(() => {
            console.log("All tab components loaded successfully.");
            initializeApp();
        })
        .catch(error => {
            console.error("A critical error occurred while loading tab components:", error);
            initializeApp(); // Attempt to initialize even if some tabs fail.
        });
});

const initializeApp = () => {
    // --- STATE MANAGEMENT ---
    const API_URL = '';
    let currentUser = null, currentProjectId = null, currentReferenceNumber = null;
    let notificationPollInterval;
    const tabInitializationState = {
        generator: false,
        challan: false,
        'purchase-order': false,
        'ai-helper': false,
        messaging: false,
        chat: false,
        'activity-log': false,
    };
    let isDirty = false;
    let activeTab = 'generator'; // Track the current active tab

    // --- DOM ELEMENTS (Shared & Core) ---
    const loginPage = document.getElementById('login-page'), appPage = document.getElementById('app-page');
    const loginForm = document.getElementById('login-form'), loginError = document.getElementById('login-error');
    const userInfo = document.getElementById('user-info'), logoutBtn = document.getElementById('logout-btn'), reinitBtn = document.getElementById('reinit-btn'), profileBtn = document.getElementById('profile-btn');
    const mainNav = document.getElementById('main-nav'), pageTitle = document.getElementById('page-title');
    const tabGenerator = document.getElementById('tab-content-generator'), tabActivityLog = document.getElementById('tab-content-activity-log'), tabProjects = document.getElementById('tab-content-projects');
    const tabPurchaseOrder = document.getElementById('tab-content-purchase-order'), tabAdminReview = document.getElementById('tab-content-admin-review'), tabMyReviews = document.getElementById('tab-content-my-reviews');
    const tabSharedWithMe = document.getElementById('tab-content-shared-with-me'), tabMessaging = document.getElementById('tab-content-messaging'), tabChallan = document.getElementById('tab-content-challan'), tabAiHelper = document.getElementById('tab-content-ai-helper');
    const projectsTableBody = document.getElementById('projects-table-body'), projectsTablePlaceholder = document.getElementById('projects-table-placeholder');
    const sharedProjectsBody = document.getElementById('shared-projects-body'), sharedProjectsPlaceholder = document.getElementById('shared-projects-placeholder');
    const myReviewsBody = document.getElementById('my-reviews-body'), myReviewsPlaceholder = document.getElementById('my-reviews-placeholder');
    const adminReviewBody = document.getElementById('admin-review-body'), adminReviewPlaceholder = document.getElementById('admin-review-placeholder');
    const themeToggleButton = document.getElementById('theme-toggle-btn');
    const adminOnlyTabs = document.getElementById('admin-only-tabs');
    const profileModal = document.getElementById('profile-modal'), profileForm = document.getElementById('profile-form'), profileModalClose = document.getElementById('profile-modal-close');
    const shareModal = document.getElementById('share-modal'), shareForm = document.getElementById('share-form'), shareModalClose = document.getElementById('share-modal-close');
    const saveAsModal = document.getElementById('save-as-modal'), saveAsForm = document.getElementById('save-as-form'), saveAsCancelBtn = document.getElementById('save-as-cancel-btn'), saveAsModalClose = document.getElementById('save-as-modal-close');
    const toastContainer = document.getElementById('toast-container');
    const userMenuButton = document.getElementById('user-menu-button'), userMenu = document.getElementById('user-menu');
    const projectSearchInput = document.getElementById('project-search-input');
    const projectSearchResults = document.getElementById('project-search-results');
    const notificationsBtn = document.getElementById('notifications-btn'), notificationsDropdown = document.getElementById('notifications-dropdown'), notificationBadge = document.getElementById('notification-badge-count'), notificationItemsContainer = document.getElementById('notification-items-container');
    const sidebar = document.getElementById('sidebar'), sidebarOverlay = document.getElementById('sidebar-overlay'), sidebarOpen = document.getElementById('sidebar-open'), sidebarClose = document.getElementById('sidebar-close');
    const sidebarHoverTrigger = document.getElementById('sidebar-hover-trigger');
    const chatUiContainer = document.getElementById('chat-ui-container');


    // --- GLOBAL FUNCTION FOR AI HELPER TO ADD ITEMS TO OTHER MODULES ---
    window.addItemsToModule = (moduleName, items) => {
        if (!items || items.length === 0) {
            showToast('No items to add.', true);
            return;
        }

        const dependencies = { API_URL, currentUser, showToast, getProjectData, updateProjectState, setDirty, getDirty, saveAsModal, showConfirmModal, handleProjectTableClick, shareModal, switchTab };

        switch (moduleName) {
            case 'offer':
                // FIX: Initialize the module if it hasn't been already
                if (!tabInitializationState.generator) {
                    initializeOfferModule(dependencies);
                    tabInitializationState.generator = true;
                }
                if (window.addItemsToOffer) {
                    window.addItemsToOffer(items);
                    switchTab('generator');
                    showToast(`${items.length} items added to the Offer.`);
                } else {
                    showToast('Offer module could not be initialized.', true);
                }
                break;
            case 'po':
                if (currentUser.role !== 'admin') {
                    showToast('You do not have permission to create Purchase Orders.', true);
                    return;
                }
                // FIX: Initialize the module if it hasn't been already
                if (!tabInitializationState['purchase-order']) {
                    initializePurchaseOrderModule(dependencies);
                    tabInitializationState['purchase-order'] = true;
                }
                if (window.addItemsToPO) {
                    window.addItemsToPO(items);
                    switchTab('purchase-order');
                    showToast(`${items.length} items added to the Purchase Order.`);
                } else {
                    showToast('Purchase Order module is not ready.', true);
                }
                break;
            case 'challan':
                // FIX: Initialize the module if it hasn't been already
                if (!tabInitializationState.challan) {
                    initializeChallanModule(dependencies);
                    tabInitializationState.challan = true;
                }
                if (window.addItemsToChallan) {
                    window.addItemsToChallan(items);
                    switchTab('challan');
                    showToast(`${items.length} items added to the Challan.`);
                } else {
                    showToast('Challan module is not ready.', true);
                }
                break;
            default:
                showToast(`Unknown module: ${moduleName}`, true);
        }
    };

    // --- HELPER FUNCTIONS ---
    const setDirty = (state) => {
        isDirty = state;
    };
    const getDirty = () => isDirty;

    window.addEventListener('beforeunload', (e) => {
        if (isDirty) {
            e.preventDefault();
            e.returnValue = ''; // Required for Chrome
        }
    });

    const showToast = (message, isError = false) => {
        const toast = document.createElement('div');
        toast.className = `toast ${isError ? 'error' : ''}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.5s forwards';
            toast.addEventListener('animationend', () => toast.remove());
        }, 5000);
    };

    const showConfirmModal = (text, title = 'Confirmation', okClass = 'bg-red-600 hover:bg-red-700', okText = 'Confirm') => {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirm-modal');
            const modalTitle = document.getElementById('confirm-modal-title');
            const modalText = document.getElementById('confirm-modal-text');
            const okBtn = document.getElementById('confirm-modal-ok-btn');
            const cancelBtn = document.getElementById('confirm-modal-cancel-btn');

            modalTitle.textContent = title;
            modalText.innerHTML = text; // Use innerHTML to allow for simple styling if needed
            okBtn.textContent = okText;

            okBtn.className = 'px-5 py-2.5 rounded-lg text-white transition-all';
            okBtn.classList.add(...okClass.split(' '));
            
            modal.classList.remove('hidden');

            const cleanup = () => {
                modal.classList.add('hidden');
                okBtn.removeEventListener('click', handleOk);
                cancelBtn.removeEventListener('click', handleCancel);
            };

            const handleOk = () => {
                cleanup();
                resolve(true);
            };

            const handleCancel = () => {
                cleanup();
                resolve(false);
            };
            
            okBtn.addEventListener('click', handleOk);
            cancelBtn.addEventListener('click', handleCancel);
        });
    };

    // --- THEME & SIDEBAR LOGIC ---
    themeToggleButton.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    });

    const openSidebar = () => {
        sidebar.classList.remove('-translate-x-full');
        sidebarOverlay.classList.remove('hidden');
    };
    const closeSidebar = () => {
        sidebar.classList.add('-translate-x-full');
        sidebarOverlay.classList.add('hidden');
    };
    
    sidebarOpen.addEventListener('click', openSidebar);
    sidebarClose.addEventListener('click', closeSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

    if (sidebarHoverTrigger && sidebar) {
        const openSidebarDesktop = () => {
            if (window.innerWidth >= 1024) {
                sidebar.classList.remove('-translate-x-full');
            }
        };
        const closeSidebarDesktop = () => {
            if (window.innerWidth >= 1024) {
                sidebar.classList.add('-translate-x-full');
            }
        };

        sidebarHoverTrigger.addEventListener('mouseenter', openSidebarDesktop);
        sidebar.addEventListener('mouseleave', closeSidebarDesktop);
    }


    // --- CORE APP LOGIC ---
    async function populateUserSuggestions() {
        try {
            const response = await fetch(`${API_URL}/get_all_users`);
            const users = await response.json();
            const datalist = document.getElementById('user-emails');
            if (datalist) {
                datalist.innerHTML = '';
                users.forEach(user => {
                    if (user.email !== currentUser.email) {
                        const option = document.createElement('option');
                        option.value = user.email;
                        datalist.appendChild(option);
                    }
                });
            }
        } catch (err) {
            console.error('Failed to populate user suggestions:', err);
        }
    }

    function showLoginPage() {
        appPage.classList.add('hidden'); appPage.classList.remove('flex');
        loginPage.classList.remove('hidden'); loginPage.classList.add('flex');
        if (chatUiContainer) chatUiContainer.style.display = 'none'; // Hide chat on login
        currentUser = null;
        localStorage.removeItem('fogen_user');
        clearInterval(notificationPollInterval);
        if (window.socket) {
            window.socket.disconnect();
        }
    }

    function showAppPage() {
        loginPage.classList.add('hidden'); loginPage.classList.remove('flex');
        appPage.classList.remove('hidden'); appPage.classList.add('flex');
        if (chatUiContainer) chatUiContainer.style.display = 'block'; // Show chat on app page
        userInfo.textContent = `${currentUser.name}`;
        const isAdmin = currentUser.role === 'admin';
        adminOnlyTabs.style.display = isAdmin ? 'block' : 'none';
        reinitBtn.style.display = isAdmin ? 'flex' : 'none';
        populateUserSuggestions();
        pollNotifications();
        notificationPollInterval = setInterval(pollNotifications, 15000);
        
        if (!tabInitializationState.chat) {
            initializeChatModule({ API_URL, currentUser, showToast });
            tabInitializationState.chat = true;
        }

        // UPDATED: Use the createSearchHandler for the main project search
        createSearchHandler({
            searchInput: projectSearchInput,
            resultsContainer: projectSearchResults,
            apiEndpoint: `${API_URL}/projects`,
            buildQuery: (query) => `email=${currentUser.email}&role=${currentUser.role}&search=${encodeURIComponent(query)}`,
            renderResults: renderProjectResults, // This function is now in search_result.js
            onResultSelected: async (project) => {
                const result = await getProjectData(project.projectId);
                if (result.success) {
                    handleProjectLoad(result.data);
                    // Clear input and hide results after selection
                    projectSearchInput.value = '';
                    projectSearchResults.classList.add('hidden');
                } else {
                    showToast(`Error loading project: ${result.message}`, true);
                }
            },
            currentUser: currentUser,
            minQueryLength: 2 // Start search after 2 characters
        });
        
        switchTab('generator');
    }

    async function renderProjectsList(searchTerm = '') {
        projectsTableBody.innerHTML = '';
        try {
            const response = await fetch(`${API_URL}/projects?email=${currentUser.email}&search=${encodeURIComponent(searchTerm)}&role=${currentUser.role}`);
            const projects = await response.json();
            if (!response.ok || projects.length === 0) {
                projectsTablePlaceholder.style.display = 'table-row';
                const placeholderCell = projectsTablePlaceholder.querySelector('td');
                if (placeholderCell) {
                    placeholderCell.innerHTML = `<div class="text-center py-10"><p class="font-semibold">${searchTerm ? 'No projects found matching your search.' : 'No saved projects found.'}</p></div>`;
                }
                return;
            }
            projectsTablePlaceholder.style.display = 'none';
            projects.forEach(p => {
                const row = document.createElement('tr');
                const date = new Date(p.dateModified).toLocaleString();
                const isDelivered = p.status === 'Delivered';
                
                const type = p.projectType || 'offer';
                let typeBadge = '';
                switch (type) {
                    case 'challan':
                        typeBadge = `<span class="px-2 py-1 font-semibold text-xs leading-tight text-amber-700 bg-amber-100 rounded-full dark:bg-amber-700 dark:text-amber-100">Challan</span>`;
                        break;
                    case 'po':
                        typeBadge = `<span class="px-2 py-1 font-semibold text-xs leading-tight text-indigo-700 bg-indigo-100 rounded-full dark:bg-indigo-700 dark:text-indigo-100">PO</span>`;
                        break;
                    case 'ai_helper':
                        typeBadge = `<span class="px-2 py-1 font-semibold text-xs leading-tight text-purple-700 bg-purple-100 rounded-full dark:bg-purple-700 dark:text-purple-100">AI Helper</span>`;
                        break;
                    default: // offer
                        typeBadge = `<span class="px-2 py-1 font-semibold text-xs leading-tight text-sky-700 bg-sky-100 rounded-full dark:bg-sky-700 dark:text-sky-100">Offer</span>`;
                }

                row.innerHTML = `
                    <td class="text-center">${p.sl}</td>
                    <td>${p.referenceNumber}</td>
                    <td class="text-center">${typeBadge}</td>
                    <td>${date}</td>
                    <td>${p.clientName}</td>
                    <td class="text-center">${p.productTypes}</td>
                    <td class="text-center">${isDelivered ? `<span class="px-2 py-1 font-semibold text-xs leading-tight text-green-700 bg-green-100 rounded-full dark:bg-green-700 dark:text-green-100">${p.status}</span>` : `<button data-id="${p.projectId}" class="deliver-project-btn px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600">${p.status}</button>`}</td>
                    <td class="space-x-2 text-center">
                        <button data-id="${p.projectId}" class="share-project-btn text-purple-500 hover:text-purple-600" title="Share"><i class="fas fa-share-alt"></i></button>
                        <button data-id="${p.projectId}" data-ref="${p.referenceNumber}" class="rename-project-btn text-blue-500 hover:text-blue-600" title="Rename"><i class="fas fa-pencil-alt"></i></button>
                        <button data-id="${p.projectId}" data-type="${p.projectType || 'offer'}" class="load-project-btn text-green-500 hover:text-green-600" title="Load"><i class="fas fa-upload"></i></button>
                        <button data-id="${p.projectId}" class="delete-project-btn text-red-500 hover:text-red-600" title="Delete"><i class="fas fa-trash"></i></button>
                    </td>`;
                projectsTableBody.appendChild(row);
            });
        } catch (err) { 
            projectsTablePlaceholder.style.display = 'table-row';
            const placeholderCell = projectsTablePlaceholder.querySelector('td');
            if (placeholderCell) {
                placeholderCell.innerHTML = `<div class="text-center py-10 text-red-500"><p class="font-semibold">Error loading projects: ${err.message}</p></div>`;
            }
        }
    }
    
    async function renderSharedProjects() {
        sharedProjectsBody.innerHTML = '';
        try {
            const response = await fetch(`${API_URL}/get_shared_projects?email=${currentUser.email}`);
            const projects = await response.json();
            if (!response.ok || projects.length === 0) { sharedProjectsPlaceholder.style.display = 'block'; return; }
            sharedProjectsPlaceholder.style.display = 'none';
            projects.forEach(p => {
                const row = document.createElement('tr');
                const sharedDate = new Date(p.share_timestamp).toLocaleString();
                row.innerHTML = `
                    <td class="text-center">${p.sl}</td>
                    <td>${p.referenceNumber}</td>
                    <td>${p.owner_email}</td>
                    <td>${p.clientName}</td>
                    <td class="text-center">${p.productTypes}</td>
                    <td>${sharedDate}</td>
                    <td class="space-x-2 text-center"><button data-id="${p.projectId}" data-type="${p.projectType || 'offer'}" class="load-project-btn text-green-500 hover:text-green-600" title="Load"><i class="fas fa-upload"></i></button></td>`;
                sharedProjectsBody.appendChild(row);
            });
        } catch (err) { sharedProjectsPlaceholder.textContent = `Error loading shared projects: ${err.message}`; }
    }

    async function renderMyReviews() {
            myReviewsBody.innerHTML = '';
            myReviewsPlaceholder.style.display = 'block';
            try {
                const res = await fetch(`${API_URL}/get_my_requests?email=${currentUser.email}`);
                const requests = await res.json();
                if (requests.length > 0) myReviewsPlaceholder.style.display = 'none';

                requests.forEach(req => {
                    const details = JSON.parse(req.details);
                    let detailHtml = '';
                    if (req.request_type === 'description_change') {
                        detailHtml = `<strong>Item Code:</strong> ${req.item_code}<br><strong>New Desc:</strong><div class="mt-1 p-1 border rounded bg-slate-200 dark:bg-slate-900">${details.new}</div>`;
                    } else if (req.request_type === 'item_addition') {
                        detailHtml = `<strong>Custom Item:</strong><div class="mt-1 p-1 border rounded bg-slate-200 dark:bg-slate-900">${details.description}</div>`;
                    }

                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="align-top text-xs">${req.request_type.replace(/_/g, ' ')}</td>
                        <td class="align-top text-xs">${detailHtml}</td>
                        <td class="align-top"><textarea class="remarks-input w-full p-1 text-xs bg-slate-100 dark:bg-slate-700 border rounded" data-id="${req.request_id}" placeholder="Add remarks...">${req.remarks || ''}</textarea></td>
                        <td class="align-top text-xs space-y-1">
                            <button class="send-to-admin-btn w-full px-2 py-1 bg-blue-500 text-white rounded" data-id="${req.request_id}">Send to Admin</button>
                            <button class="revoke-request-btn w-full px-2 py-1 bg-red-500 text-white rounded" data-id="${req.request_id}">Revoke</button>
                        </td>`;
                    myReviewsBody.appendChild(row);
                });
            } catch (err) { myReviewsPlaceholder.textContent = `Error loading your reviews: ${err.message}`; }
        }

    async function renderAdminReviews() {
        adminReviewBody.innerHTML = '';
        adminReviewPlaceholder.style.display = 'block';
        try {
            const res = await fetch(`${API_URL}/get_admin_requests?role=${currentUser.role}`);
            const requests = await res.json();
            if (requests.length > 0) adminReviewPlaceholder.style.display = 'none';
            requests.forEach(req => {
                const details = JSON.parse(req.details);
                let detailHtml = '';
                    if (req.request_type === 'description_change') {
                    detailHtml = `<strong>Item:</strong> ${req.item_code}<br><strong>Old:</strong> <div class="p-1 border">${details.old}</div><strong>New:</strong> <div class="p-1 border">${details.new}</div>`;
                } else if (req.request_type === 'item_addition') {
                    detailHtml = `<strong>Desc:</strong> <div class="p-1 border">${details.description}</div><strong>Price:</strong> ${details.offer_price}`;
                } else if (req.request_type === 'item_removal') {
                        detailHtml = `Request to remove item:<br><strong>Code:</strong> ${req.item_code}<br><strong>Desc:</strong> ${details.description}`;
                }
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="align-top text-xs">${req.user_email}</td>
                    <td class="align-top text-xs">${req.request_type.replace(/_/g, ' ')}</td>
                    <td class="align-top text-xs">${detailHtml}</td>
                    <td class="align-top text-xs">${req.remarks || ''}</td>
                    <td class="align-top text-xs space-y-1">
                        <button class="approve-request-btn w-full px-2 py-1 bg-green-500 text-white rounded" data-id="${req.request_id}">Approve</button>
                        <button class="reject-request-btn w-full px-2 py-1 bg-red-500 text-white rounded" data-id="${req.request_id}">Reject</button>
                    </td>`;
                adminReviewBody.appendChild(row);
            });
        } catch (err) { adminReviewPlaceholder.textContent = `Error loading admin reviews: ${err.message}`; }
    }
    
    async function pollNotifications() {
        if (!currentUser) return;
        try {
            const res = await fetch(`${API_URL}/get_notifications?email=${currentUser.email}`);
            const notifications = await res.json();
            const adminRes = await fetch(`${API_URL}/get_admin_requests?role=${currentUser.role}`);
            const adminRequests = await adminRes.json();
            const unreadCount = notifications.filter(n => n.is_read === 'no').length;
            notificationBadge.textContent = unreadCount;
            notificationBadge.classList.toggle('hidden', unreadCount === 0);
            
            const adminReviewTab = document.querySelector('[data-tab="admin-review"]');
            let adminReviewBadge = adminReviewTab.querySelector('.notification-badge');
            if (currentUser.role === 'admin' && adminRequests.length > 0) {
                if (!adminReviewBadge) {
                    adminReviewBadge = document.createElement('span');
                    adminReviewBadge.className = 'notification-badge';
                    adminReviewTab.appendChild(adminReviewBadge);
                }
                adminReviewBadge.textContent = adminRequests.length;
            } else if (adminReviewBadge) {
                adminReviewBadge.remove();
            }
            renderNotifications(notifications);
        } catch (err) { console.error('Failed to poll notifications:', err); }
    }

    function renderNotifications(notifications) {
        notificationItemsContainer.innerHTML = notifications.length === 0 ? '<p class="text-center text-slate-500 py-4">No notifications</p>' : '';
        notifications.forEach(notif => {
            const notifDiv = document.createElement('div');
            // Add a class for positioning the delete button
            notifDiv.className = `notification-item px-4 py-2 text-sm border-b dark:border-slate-700 relative`;
    
            const isUnread = notif.is_read === 'no';
            if (isUnread) {
                notifDiv.classList.add('font-bold', 'text-slate-800', 'dark:text-slate-100', 'bg-sky-50', 'dark:bg-sky-900/50', 'cursor-pointer');
                // Allow clicking anywhere on the notification to mark it as read
                notifDiv.addEventListener('click', async (e) => {
                    // Prevent the click from triggering if the delete button was the target
                    if (e.target.closest('.delete-notification-btn')) {
                        return;
                    }
                    try {
                        const res = await fetch(`${API_URL}/mark_notification_read`, { 
                            method: 'POST', 
                            headers: {'Content-Type': 'application/json'}, 
                            body: JSON.stringify({ notification_id: notif.notification_id, email: currentUser.email }) 
                        });
                        if (res.ok) {
                           const result = await res.json();
                           if (result.success) {
                               renderNotifications(result.notifications);
                               const unreadCount = result.notifications.filter(n => n.is_read === 'no').length;
                               notificationBadge.textContent = unreadCount;
                               notificationBadge.classList.toggle('hidden', unreadCount === 0);
                           }
                        }
                    } catch (err) {
                        console.error("Failed to mark notification as read:", err);
                    }
                });
            } else {
                notifDiv.classList.add('text-slate-600', 'dark:text-slate-400');
            }
    
            // Create the content of the notification
            const content = document.createElement('div');
            content.innerHTML = `<p>${notif.message}</p><p class="text-xs text-slate-500 mt-1">${new Date(notif.timestamp).toLocaleString()}</p>`;
    
            // Create the delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-notification-btn absolute top-1 right-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-1 rounded-full';
            deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
            deleteBtn.title = 'Delete notification';
    
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent the mark-as-read click listener from firing
                try {
                    const res = await fetch(`${API_URL}/delete_notification`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ notification_id: notif.notification_id, email: currentUser.email })
                    });
                    const result = await res.json();
                    if (result.success) {
                        // Re-render the list with the data from the server
                        renderNotifications(result.notifications);
                        const unreadCount = result.notifications.filter(n => n.is_read === 'no').length;
                        notificationBadge.textContent = unreadCount;
                        notificationBadge.classList.toggle('hidden', unreadCount === 0);
                    } else {
                        showToast(result.message, true);
                    }
                } catch (err) {
                    console.error("Failed to delete notification:", err);
                    showToast("An error occurred while deleting the notification.", true);
                }
            });
    
            notifDiv.appendChild(content);
            notifDiv.appendChild(deleteBtn);
            notificationItemsContainer.appendChild(notifDiv);
        });
    }

    // --- TAB SWITCHING ---
    async function switchTab(tabName) {
        if (isDirty) {
            const confirmation = await showConfirmModal(
                "You have unsaved changes that will be lost. Are you sure you want to switch tabs?",
                "Unsaved Changes",
                "bg-amber-600 hover:bg-amber-700",
                "Leave Page"
            );
            if (!confirmation) {
                return;
            }
        }
        setDirty(false);

        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            pageTitle.textContent = activeBtn.querySelector('span').textContent.trim();
        }
        
        activeTab = tabName; // Update the global active tab state

        [tabGenerator, tabActivityLog, tabProjects, tabPurchaseOrder, tabAdminReview, tabMyReviews, tabSharedWithMe, tabAiHelper, tabMessaging, tabChallan].forEach(t => {
            if (t) t.style.display = 'none';
        });
        document.getElementById(`tab-content-${tabName}`).style.display = 'block';

        const dependencies = { API_URL, currentUser, showToast, getProjectData, updateProjectState, setDirty, getDirty, saveAsModal, showConfirmModal, handleProjectTableClick, shareModal, switchTab };

        if (tabName === 'generator' && !tabInitializationState.generator) {
            initializeOfferModule(dependencies);
            tabInitializationState.generator = true;
        }
        if (tabName === 'challan' && !tabInitializationState.challan) {
            initializeChallanModule(dependencies);
            tabInitializationState.challan = true;
        }
        if (tabName === 'purchase-order' && !tabInitializationState['purchase-order']) {
             if (currentUser.role === 'admin') {
                initializePurchaseOrderModule(dependencies);
                tabInitializationState['purchase-order'] = true;
             }
        }
        if (tabName === 'ai-helper' && !tabInitializationState['ai-helper']) {
            initializeAiHelperModule(dependencies);
            tabInitializationState['ai-helper'] = true;
        }
        if (tabName === 'messaging' && !tabInitializationState.messaging) {
            initializeMessagingModule(dependencies);
            tabInitializationState.messaging = true;
        }
        
        if (tabName === 'activity-log' && !tabInitializationState['activity-log']) {
            initializeActivityLogModule(dependencies);
            tabInitializationState['activity-log'] = true;
        }
        
        if (tabName === 'projects') renderProjectsList();
        if (tabName === 'shared-with-me') renderSharedProjects();
        if (tabName === 'admin-review' && currentUser.role === 'admin') renderAdminReviews();
        if (tabName === 'my-reviews') renderMyReviews();
        if (tabName === 'messaging') document.getElementById('message-recipient').setAttribute('list', 'user-emails');

    }

    function getProjectData(projectId) {
        return fetch(`${API_URL}/project/${projectId}?email=${currentUser.email}&role=${currentUser.role}`).then(res => res.json());
    }
    
    function updateProjectState(p) {
        currentProjectId = p.projectId;
        currentReferenceNumber = p.referenceNumber;
    }

    // --- EVENT LISTENERS (Shared & Core) ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.classList.add('hidden');
        try {
            const response = await fetch(`${API_URL}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.value, password: password.value }) });
            const data = await response.json();
            if (data.success) {
                currentUser = data.user;
                localStorage.setItem('fogen_user', JSON.stringify(currentUser));
                showAppPage();
            } else {
                loginError.textContent = data.message;
                loginError.classList.remove('hidden');
            }
        } catch (err) {
            loginError.textContent = 'Failed to connect to the server.';
            loginError.classList.remove('hidden');
        }
    });

    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showLoginPage();
    });

    reinitBtn.addEventListener('click', async () => {
        const reinitConfirmation = await showConfirmModal(
            'Are you sure you want to re-initialize all data? This is a slow process and cannot be undone.',
            'Re-initialize Data'
        );
        if (!reinitConfirmation) return;
        reinitBtn.disabled = true; reinitBtn.innerHTML = `<div class="loader !w-4 !h-4 !border-2"></div><span class="ml-2">Initializing...</span>`;
        try {
            const response = await fetch(`${API_URL}/reinitialize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: currentUser.role }) });
            alert((await response.json()).message);
        } catch (err) { alert('An error occurred during re-initialization.'); } 
        finally { reinitBtn.disabled = false; reinitBtn.textContent = 'Re-init Data'; }
    });

    mainNav.addEventListener('click', (e) => {
        e.preventDefault();
        const tabButton = e.target.closest('.tab-button');
        if (tabButton) switchTab(tabButton.dataset.tab);
    });
    
    // Global keyboard shortcuts for saving
    document.addEventListener('keydown', (e) => {
        // Check for Ctrl key (or Cmd on Mac) and not Alt
        if ((e.ctrlKey || e.metaKey) && !e.altKey) { 
            let saveBtn, saveAsBtn;

            // Determine which save buttons are active based on the current tab
            switch(activeTab) {
                case 'generator':
                    saveBtn = document.getElementById('save-project-btn');
                    saveAsBtn = document.getElementById('save-as-btn');
                    break;
                case 'ai-helper':
                    saveBtn = document.getElementById('ai-save-btn');
                    saveAsBtn = document.getElementById('ai-save-as-btn');
                    break;
                // Corrected case for the Challan tab to enable save shortcuts
                case 'challan':
                     saveBtn = document.getElementById('save-challan-btn');
                     saveAsBtn = document.getElementById('save-challan-as-btn');
                    break;
                // ADDED: Case for the Purchase Order tab.
                // Note: This module has no explicit "Save As" button, so only Ctrl+S will work.
                case 'purchase-order':
                    saveBtn = document.getElementById('po-save-btn');
                    saveAsBtn = null; // No dedicated "Save As" button in this module's UI
                    break;
            }

            // Handle the 's' key for saving
            if (e.key.toLowerCase() === 's') {
                e.preventDefault(); // Prevent the browser's default save action
                if (e.shiftKey && saveAsBtn) {
                    // Ctrl+Shift+S for "Save As"
                    saveAsBtn.click();
                } else if (saveBtn) {
                    // Ctrl+S for regular "Save"
                    saveBtn.click();
                }
            }
            if (e.key.toLowerCase() === 'b') {
                const activeEl = document.activeElement;
                // Check if the focused element is a description cell in any of the relevant tables
                if (activeEl && activeEl.matches('#offer-table-body [data-field="description"], #po-table-body [data-field="description"], #challan-table-body [data-field="description"]')) {
                    e.preventDefault();
                    document.execCommand('bold', false, null);
                }
            }
        }
    });

    projectSearchInput.addEventListener('input', (e) => {
        const activeTab = document.querySelector('.tab-button.active');
        if (activeTab && activeTab.dataset.tab === 'projects') {
            renderProjectsList(e.target.value);
        }
    });

    userMenuButton.addEventListener('click', () => {
        userMenu.classList.toggle('hidden');
        notificationsDropdown.classList.add('hidden');
    });

    notificationsBtn.addEventListener('click', () => {
        notificationsDropdown.classList.toggle('hidden');
        userMenu.classList.add('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!projectSearchInput.contains(e.target) && !projectSearchResults.contains(e.target)) {
            projectSearchResults.classList.add('hidden');
        }
        if (!userMenuButton.contains(e.target) && !userMenu.contains(e.target)) {
            userMenu.classList.add('hidden');
        }
        if (!notificationsBtn.contains(e.target) && !notificationsDropdown.contains(e.target)) {
            notificationsDropdown.classList.add('hidden');
        }
    });

    const handleProjectLoad = async (projectData) => { // Make the function async
        const projectType = projectData.projectType || 'offer';
    
        let targetTabId;
        switch(projectType) {
            case 'offer':
                targetTabId = 'generator';
                break;
            case 'po': // FIX: Correctly route PO projects to the purchase-order tab
                targetTabId = 'purchase-order';
                break;
            case 'challan':
                targetTabId = 'challan';
                break;
            case 'ai_helper':
                targetTabId = 'ai-helper';
                break;
            default:
                targetTabId = 'generator'; // Fallback to offer/generator tab
        }
        
        // Await the tab switch. This initializes the module if needed and handles the "unsaved changes" dialog.
        await switchTab(targetTabId);
    
        // After a successful switch, the module's global functions should be available.
        // Use a small timeout to let the DOM updates from the tab switch settle before loading data.
        setTimeout(() => {
            switch (projectType) {
                case 'challan':
                    if (window.loadChallanData) {
                        window.loadChallanData(projectData);
                        showToast('Challan project loaded successfully.');
                    } else {
                        showToast("Error initializing Challan module.", true);
                    }
                    break;
                case 'ai_helper':
                    if (window.loadAiHelperData) {
                        window.loadAiHelperData(projectData);
                        showToast('AI Helper project loaded successfully.');
                    } else {
                        showToast("Error initializing AI Helper module.", true);
                    }
                    break;
                case 'po': // ADDED: Case to handle loading PO data
                    if (window.loadPOData) {
                        window.loadPOData(projectData);
                        showToast('Purchase Order project loaded successfully.');
                    } else {
                        showToast("Error initializing Purchase Order module.", true);
                    }
                    break;
                case 'offer':
                default:
                    if (window.loadOfferData) {
                        window.loadOfferData(projectData);
                        showToast('Project loaded successfully.');
                    } else {
                        showToast("Error initializing Offer module.", true);
                    }
                    break;
            }
        }, 50); // A 50ms delay helps ensure the tab's DOM is fully ready.
    };

    const handleProjectTableClick = async (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        const projectId = button.dataset.id;
        if (!projectId) return;

        if (button.classList.contains('load-project-btn')) {
            try {
                const result = await getProjectData(projectId);
                if (result.success) {
                    handleProjectLoad(result.data);
                } else { showToast(`Error loading project: ${result.message}`, true); }
            } catch (err) { showToast(`An error occurred: ${err.message}`, true); }
        } else if (button.classList.contains('delete-project-btn')) {
            const deleteConfirmation = await showConfirmModal(
                'Are you sure you want to delete this project? This action cannot be undone.',
                'Delete Project'
            );
            if (!deleteConfirmation) return;
            try {
                const res = await fetch(`${API_URL}/project/${projectId}?email=${currentUser.email}&role=${currentUser.role}`, { method: 'DELETE' });
                const result = await res.json();
                if (result.success) { showToast('Project deleted.'); renderProjectsList(); renderSharedProjects(); } 
                else { showToast(`Error deleting project: ${result.message}`, true); }
            } catch (err) { showToast(`An error occurred: ${err.message}`, true); }
        } else if (button.classList.contains('share-project-btn')) {
            document.getElementById('share-project-id').value = projectId;
            shareModal.classList.remove('hidden');
        } else if (button.classList.contains('rename-project-btn')) {
            document.getElementById('save-as-type').value = 'rename';
            document.getElementById('save-as-name').value = button.dataset.ref;
            document.getElementById('save-as-title').textContent = 'Rename Project';
            document.getElementById('save-as-label').textContent = 'New Project Name';
            saveAsModal.dataset.projectId = projectId;
            saveAsModal.classList.remove('hidden');
        } else if (button.classList.contains('deliver-project-btn')) {
            const deliverConfirmation = await showConfirmModal(
                'Are you sure you want to mark this project as Delivered?',
                'Deliver Project',
                'bg-yellow-500 hover:bg-yellow-600',
                'Mark as Delivered'
            );
            if (!deliverConfirmation) return;
            try {
                const res = await fetch(`${API_URL}/project/status/${projectId}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ status: 'Delivered', user: currentUser }) });
                const result = await res.json();
                if(result.success) { showToast('Project marked as delivered.'); renderProjectsList(); }
                else { showToast(`Error: ${result.message}`, true); }
            } catch (err) { showToast(`An error occurred: ${err.message}`, true); }
        }
    };
    if (projectsTableBody) projectsTableBody.addEventListener('click', handleProjectTableClick);
    if (sharedProjectsBody) sharedProjectsBody.addEventListener('click', handleProjectTableClick);

    profileBtn.addEventListener('click', () => {
        document.getElementById('profile-email').value = currentUser.email;
        profileModal.classList.remove('hidden');
        userMenu.classList.add('hidden');
    });
    profileModalClose.addEventListener('click', () => profileModal.classList.add('hidden'));
    profileForm.addEventListener('submit', async e => {
        e.preventDefault();
        const payload = { sl: currentUser.sl, email: document.getElementById('profile-email').value, password: document.getElementById('profile-password').value };
        const res = await fetch(`${API_URL}/update_user`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        const result = await res.json();
        showToast(result.message, !result.success);
        if(result.success) {
            currentUser.email = payload.email;
            localStorage.setItem('fogen_user', JSON.stringify(currentUser));
            profileModal.classList.add('hidden');
        }
    });

    shareModalClose.addEventListener('click', () => shareModal.classList.add('hidden'));
    shareForm.addEventListener('submit', async e => {
        e.preventDefault();
        const payload = { projectId: document.getElementById('share-project-id').value, ownerEmail: currentUser.email, sharedWithEmail: document.getElementById('share-email').value };
        const res = await fetch(`${API_URL}/share_project`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        const result = await res.json();
        showToast(result.message, !result.success);
        if (result.success) { shareModal.classList.add('hidden'); shareForm.reset(); }
    });

    const closeSaveAsModal = () => {
        saveAsModal.classList.add('hidden');
        // Reset modal to default "Save As" state
        document.getElementById('save-as-title').textContent = 'Save As New...';
        document.getElementById('save-as-label').textContent = 'New Name';
        delete saveAsModal.dataset.projectId;
    };

    if(saveAsCancelBtn) saveAsCancelBtn.addEventListener('click', closeSaveAsModal);
    if(saveAsModalClose) saveAsModalClose.addEventListener('click', closeSaveAsModal);
    if(saveAsForm) {
        saveAsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newName = document.getElementById('save-as-name').value;
            const type = document.getElementById('save-as-type').value;

            if (type === 'rename') {
                const projectId = saveAsModal.dataset.projectId;
                try {
                    const res = await fetch(`${API_URL}/project/reference/${projectId}`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ referenceNumber: newName, user: currentUser })
                    });
                    const result = await res.json();
                    if (result.success) {
                        showToast('Project renamed successfully.');
                        renderProjectsList(); // Refresh the list
                    } else {
                        showToast(`Error renaming project: ${result.message}`, true);
                    }
                } catch (err) {
                    showToast(`An error occurred: ${err.message}`, true);
                }
            } else if (type === 'offer' && window.handleOfferSaveAs) {
                await window.handleOfferSaveAs(newName);
            } else if (type === 'challan' && window.handleChallanSaveAs) {
                await window.handleChallanSaveAs(newName);
            } else if (type === 'po' && window.handlePOSaveAs) {
                await window.handlePOSaveAs(newName);
            } else if (type === 'ai_helper' && window.handleAiHelperSaveAs) { // ADDED: Case for AI Helper
                await window.handleAiHelperSaveAs(newName);
            }
            
            closeSaveAsModal();
        });
    }

    // --- INITIALIZATION ---
    const savedUser = localStorage.getItem('fogen_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showAppPage();
    } else {
        showLoginPage();
    }
};