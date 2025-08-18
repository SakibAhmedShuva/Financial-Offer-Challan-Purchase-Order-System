// /static/activity_log.js
function initializeActivityLogModule(deps) {
    const { API_URL, currentUser, showToast, handleProjectTableClick } = deps;

    if (currentUser.role !== 'admin') {
        const container = document.getElementById('tab-content-activity-log');
        if (container) {
            container.innerHTML = `<div class="p-8 text-center text-red-500 font-semibold">Access Denied. This view is for administrators only.</div>`;
        }
        return;
    }

    let allProjects = [];

    const searchInput = document.getElementById('activity-log-search-input');
    const userFilter = document.getElementById('activity-log-user-filter');
    const typeFilter = document.getElementById('activity-log-type-filter');
    const sortBy = document.getElementById('activity-log-sort-by');
    const tableBody = document.getElementById('activity-log-table-body');
    const placeholder = document.getElementById('activity-log-placeholder');

    const fetchAllProjectsAndUsers = async () => {
        if (!placeholder || !tableBody) return;
        placeholder.classList.remove('hidden');
        placeholder.innerHTML = `<div class="flex flex-col items-center"><div class="loader"></div><p class="mt-4 font-semibold">Loading all projects...</p></div>`;

        try {
            const [projectsRes, usersRes] = await Promise.all([
                fetch(`${API_URL}/all_projects_for_admin?role=${currentUser.role}`), // FIX: Call the new admin-only endpoint
                fetch(`${API_URL}/get_all_users`)
            ]);

            if (!projectsRes.ok) throw new Error('Failed to fetch projects.');
            if (!usersRes.ok) throw new Error('Failed to fetch users.');

            allProjects = await projectsRes.json();
            const allUsers = await usersRes.json();

            populateUserFilter(allUsers);
            applyFiltersAndSort();
        } catch (err) {
            placeholder.innerHTML = `<p class="text-red-500 font-semibold">Error: ${err.message}</p>`;
            showToast('Failed to load data for the log.', true);
        }
    };

    const populateUserFilter = (users) => {
        userFilter.innerHTML = '<option value="">All Users</option>';
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.email;
            option.textContent = user.name;
            userFilter.appendChild(option);
        });
    };

    const applyFiltersAndSort = () => {
        let processedProjects = [...allProjects];

        const searchQuery = searchInput.value.toLowerCase().trim();
        const userQuery = userFilter.value;
        const typeQuery = typeFilter.value;

        if (searchQuery) {
            processedProjects = processedProjects.filter(p =>
                (p.referenceNumber && p.referenceNumber.toLowerCase().includes(searchQuery)) ||
                (p.clientName && p.clientName.toLowerCase().includes(searchQuery))
            );
        }

        if (userQuery) {
            processedProjects = processedProjects.filter(p => p.owner_email === userQuery);
        }

        if (typeQuery) {
            processedProjects = processedProjects.filter(p => p.projectType === typeQuery);
        }

        const sortQuery = sortBy.value;
        processedProjects.sort((a, b) => {
            switch (sortQuery) {
                case 'date_asc':
                    return new Date(a.dateModified) - new Date(b.dateModified);
                case 'ref_asc':
                    return (a.referenceNumber || '').localeCompare(b.referenceNumber || '', undefined, { numeric: true });
                case 'ref_desc':
                    return (b.referenceNumber || '').localeCompare(a.referenceNumber || '', undefined, { numeric: true });
                case 'date_desc':
                default:
                    return new Date(b.dateModified) - new Date(a.dateModified);
            }
        });

        renderProjectsTable(processedProjects);
    };

    const renderProjectsTable = (projects) => {
        tableBody.innerHTML = '';
        if (projects.length === 0) {
            placeholder.classList.remove('hidden');
            placeholder.innerHTML = `<div class="text-center py-10"><p class="font-semibold">No projects found matching your criteria.</p></div>`;
            return;
        }

        placeholder.classList.add('hidden');

        projects.forEach((p, idx) => {
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
                default:
                    typeBadge = `<span class="px-2 py-1 font-semibold text-xs leading-tight text-sky-700 bg-sky-100 rounded-full dark:bg-sky-700 dark:text-sky-100">Offer</span>`;
            }

            const ownerName = p.owner_email ? p.owner_email.split('@')[0] : 'N/A';
            const statusHtml = isDelivered ?
                `<span class="px-2 py-1 font-semibold text-xs leading-tight text-green-700 bg-green-100 rounded-full dark:bg-green-700 dark:text-green-100">${p.status}</span>` :
                `<button data-id="${p.projectId}" class="deliver-project-btn px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600">${p.status}</button>`;

            const actionsHtml = `
                <button data-id="${p.projectId}" class="share-project-btn text-purple-500 hover:text-purple-600" title="Share"><i class="fas fa-share-alt"></i></button>
                <button data-id="${p.projectId}" data-ref="${p.referenceNumber}" class="rename-project-btn text-blue-500 hover:text-blue-600" title="Rename"><i class="fas fa-pencil-alt"></i></button>
                <button data-id="${p.projectId}" data-type="${type}" class="load-project-btn text-green-500 hover:text-green-600" title="Load"><i class="fas fa-upload"></i></button>
                <button data-id="${p.projectId}" class="delete-project-btn text-red-500 hover:text-red-600" title="Delete"><i class="fas fa-trash"></i></button>
            `;

            row.innerHTML = `
                <td class="px-6 py-4 text-center">${idx + 1}</td>
                <td class="px-6 py-4">${p.referenceNumber}</td>
                <td class="px-6 py-4 text-center no-wrap">${typeBadge}</td>
                <td class="px-6 py-4">${ownerName}</td>
                <td class="px-6 py-4">${date}</td>
                <td class="px-6 py-4">${p.clientName}</td>
                <td class="px-6 py-4 text-center">${p.productTypes}</td>
                <td class="px-6 py-4 text-center">${statusHtml}</td>
                <td class="px-6 py-4 space-x-2 text-center no-wrap">${actionsHtml}</td>
            `;
            tableBody.appendChild(row);
        });
    };

    if (searchInput) searchInput.addEventListener('input', applyFiltersAndSort);
    if (userFilter) userFilter.addEventListener('change', applyFiltersAndSort);
    if (typeFilter) typeFilter.addEventListener('change', applyFiltersAndSort);
    if (sortBy) sortBy.addEventListener('change', applyFiltersAndSort);

    if (tableBody) {
        tableBody.addEventListener('click', (e) => {
            handleProjectTableClick(e);
        });
    }

    fetchAllProjectsAndUsers();
}
