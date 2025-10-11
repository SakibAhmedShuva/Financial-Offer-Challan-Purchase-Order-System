// /static/search_result.js
/**
 * /static/search_result.js
 * This file contains a generic search handler and standardized rendering functions
 * to create interactive and consistent search inputs for clients and items
 * across different modules like 'Offer', 'Challan', and 'Purchase Order'.
 */

/**
 * Adds keyboard (ArrowUp, ArrowDown, Enter, Escape) navigation to a search result dropdown.
 * @param {HTMLElement} inputElem - The search input element.
 * @param {HTMLElement} resultsElem - The container element for search results.
 */
function addKeyboardNavigation(inputElem, resultsElem) {
    let selectedIdx = -1;
    inputElem.addEventListener('keydown', (e) => {
        const items = Array.from(resultsElem.querySelectorAll('.search-result-item'));
        if (!items.length || resultsElem.classList.contains('hidden')) return;
        
        let currentSelection = resultsElem.querySelector('.bg-sky-100');
        if (currentSelection) {
            currentSelection.classList.remove('bg-sky-100', 'dark:bg-sky-900');
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIdx = (selectedIdx + 1) % items.length;
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIdx = (selectedIdx - 1 + items.length) % items.length;
        } else if (e.key === 'Enter' && selectedIdx > -1) {
            e.preventDefault();
            items[selectedIdx].click();
            selectedIdx = -1;
        } else if (e.key === 'Escape') {
            resultsElem.classList.add('hidden');
            selectedIdx = -1;
        }

        if (selectedIdx > -1) {
            items[selectedIdx].classList.add('bg-sky-100', 'dark:bg-sky-900');
            items[selectedIdx].scrollIntoView({ block: 'nearest' });
        }
    });

    // Reset selection index on new input
    inputElem.addEventListener('input', () => {
        selectedIdx = -1;
    });
}


/**
 * Renders the search results for clients.
 * @param {Array<object>} clients - The array of client data from the API.
 * @param {function(object): void} onSelect - The callback function to execute when a client is selected.
 * @returns {DocumentFragment} A document fragment containing the rendered result elements.
 */
function renderClientResults(clients, onSelect) {
    const fragment = document.createDocumentFragment();
    clients.forEach(client => {
        const div = document.createElement('div');
        div.innerHTML = `<p class="font-bold">${client.client_name}</p><p class="text-xs text-slate-500">${client.client_address}</p>`;
        div.className = 'search-result-item cursor-pointer p-3 hover:bg-slate-100 dark:hover:bg-slate-600 border-b border-slate-200 dark:border-slate-700';
        div.onclick = () => onSelect(client);
        fragment.appendChild(div);
    });
    return fragment;
}

/**
 * Renders the search results for projects.
 * @param {Array<object>} projects - The array of project data from the API.
 * @param {function(object): void} onSelect - The callback function to execute when a project is selected.
 * @returns {DocumentFragment} A document fragment containing the rendered result elements.
 */
function renderProjectResults(projects, onSelect) {
    const fragment = document.createDocumentFragment();
    if (projects.length === 0) {
        const div = document.createElement('div');
        div.className = 'p-3 text-center text-slate-500';
        div.textContent = 'No projects found.';
        fragment.appendChild(div);
        return fragment;
    }
    projects.forEach(project => {
        const div = document.createElement('div');
        div.className = 'search-result-item p-3 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-200 dark:border-slate-600';
        div.innerHTML = `<div class="font-bold text-slate-800 dark:text-slate-200">${project.referenceNumber}</div><p class="text-sm text-slate-500 dark:text-slate-400">${project.clientName}</p>`;
        div.onclick = () => onSelect(project);
        fragment.appendChild(div);
    });
    return fragment;
}


/**
 * Renders the search results for items in a standardized table format.
 * @param {Array<object>} items - The array of item data from the API.
 * @param {function(object): void} onSelect - The callback function to execute when an item is selected.
 * @param {object} currentUser - The current user object, used to determine if admin-only fields are visible.
 * @returns {HTMLElement} A table element containing the rendered result rows.
 */
function renderItemResults(items, onSelect, currentUser) {
    const table = document.createElement('table');
    table.className = 'w-full text-xs table-fixed';
    
    const headers = ['Make', 'Type', 'Approvals', 'Item Code', 'Description', 'Model', 'Offer Price'];
    const colgroup = `
        <colgroup>
            <col style="width: 10%;">
            <col style="width: 8%;">
            <col style="width: 10%;">
            <col style="width: 10%;">
            <col style="width: 44%;">
            <col style="width: 10%;">
            <col style="width: 8%;">
        </colgroup>
    `;

    table.innerHTML = `
        ${colgroup}
        <thead class="bg-slate-100 dark:bg-slate-700">
            <tr>
                ${headers.map((h, index) => `<th class="p-2 text-center font-semibold align-middle ${index < headers.length - 1 ? 'border-r border-slate-300 dark:border-slate-600' : ''}">${h}</th>`).join('')}
            </tr>
        </thead>
        <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');
    items.forEach(item => {
        const row = document.createElement('tr');
        let rowClass = 'search-result-item cursor-pointer border-b border-slate-200 dark:border-slate-600 hover:bg-sky-50 dark:hover:bg-slate-600';
        if (item.source_type === 'local') {
            rowClass += ' bg-slate-100 dark:bg-slate-700/50';
        }
        row.className = rowClass;

        const priceValue = parseFloat(item.offer_price);
        const formattedPrice = !isNaN(priceValue) ? priceValue.toFixed(2) : '-';

        const cells = [
            { value: item.make || '-', align: 'center', truncate: true },
            // FIX: This now correctly uses item.product_type for the 'Type' column.
            { value: item.product_type || '-', align: 'center', truncate: true },
            { value: item.approvals || '-', align: 'center', truncate: true },
            { value: item.item_code || '-', align: 'center', truncate: true },
            { value: item.description || '-', align: 'left', truncate: false },
            { value: item.model || '-', align: 'center', truncate: true },
            { value: formattedPrice, align: 'right', truncate: true },
        ];

        row.innerHTML = cells.map((cell, index) => {
            const borderClass = index < cells.length - 1 ? 'border-r border-slate-200 dark:border-slate-600' : '';
            const alignClass = `text-${cell.align}`;
            const truncateClass = cell.truncate ? 'truncate' : 'whitespace-normal break-words';
            return `<td class="p-2 align-middle ${borderClass} ${alignClass} ${truncateClass}" title="${cell.value}">${cell.value}</td>`;
        }).join('');

        row.onclick = () => onSelect(item);
        tbody.appendChild(row);
    });
    return table;
}


/**
 * Creates a debounced search handler for an input field.
 * @param {object} config - The configuration object.
 */
function createSearchHandler({
    searchInput,
    resultsContainer,
    apiEndpoint,
    buildQuery,
    renderResults,
    onResultSelected,
    currentUser = null,
    loaderElement = null,
    minQueryLength = 2
}) {
    let searchTimeout;

    // If this search handler is for item results, make the dropdown wider
    if (renderResults.name === 'renderItemResults') {
        resultsContainer.style.width = '250%';
    }

    const handleInput = (e) => {
        if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) return;
        
        clearTimeout(searchTimeout);
        const query = e.target.value;

        if (query.length < minQueryLength) {
            resultsContainer.classList.add('hidden');
            return;
        }

        if (loaderElement) loaderElement.style.display = 'block';

        searchTimeout = setTimeout(() => {
            const finalQuery = buildQuery(query);
            if (finalQuery === null) {
                if (loaderElement) loaderElement.style.display = 'none';
                resultsContainer.innerHTML = '<div class="p-2 text-center text-slate-500">Please select a source to search in.</div>';
                resultsContainer.classList.remove('hidden');
                return;
            }

            fetch(`${apiEndpoint}?${finalQuery}`)
                .then(res => {
                    if (!res.ok) {
                        throw new Error(`Network response was not ok: ${res.status} ${res.statusText}`);
                    }
                    return res.json();
                })
                .then(data => {
                    resultsContainer.innerHTML = '';
                    resultsContainer.scrollTop = 0; // Fix: Reset scroll position
                    if (data.length > 0) {
                        const resultsContent = renderResults(data, (selectedItem) => {
                            onResultSelected(selectedItem);
                            searchInput.value = '';
                            resultsContainer.classList.add('hidden');
                        }, currentUser);
                        resultsContainer.appendChild(resultsContent);
                        resultsContainer.classList.remove('hidden');
                    } else {
                        resultsContainer.classList.add('hidden');
                    }
                })
                .catch(err => {
                    console.error('Search failed:', err);
                    resultsContainer.innerHTML = `<div class="p-2 text-center text-red-500">Search failed</div>`;
                    resultsContainer.classList.remove('hidden');
                })
                .finally(() => {
                    if (loaderElement) loaderElement.style.display = 'none';
                });
        }, 300);
    };
    
    searchInput.addEventListener('keyup', handleInput);
    searchInput.addEventListener('focus', handleInput);

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
            resultsContainer.classList.add('hidden');
        }
    });

    // Automatically apply keyboard navigation to every search handler created
    addKeyboardNavigation(searchInput, resultsContainer);
}