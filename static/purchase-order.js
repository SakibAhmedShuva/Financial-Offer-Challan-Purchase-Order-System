// /static/purchase-order.js
function initializePurchaseOrderModule(deps) {
    const { API_URL, currentUser, showToast, updateProjectState, showConfirmModal, saveAsModal, getProjectData } = deps;

    // --- STATE ---
    let selectedClient = null, poItems = [], currentPOId = null, currentPOReferenceNumber = null;
    let offerReferenceNumberForPO = null;
    let searchSettings = { foreign: true, local: false };
    let currentSortOrder = 'custom';
    let descriptionSearchTimeout = null;
    let activeDescriptionCell = null;
    let activeScrollListener = null;
    let activeKeydownHandler = null;
    let draggedItemIndex = null; // For drag and drop

    // --- UNDO/REDO STATE ---
    let history = [];
    let historyIndex = -1;
    let isRestoringState = false;
    let captureTimeout;

    const getDefaultFinancialLabels = () => ({
        poUsdPrice: 'PO Total (USD)',
        subtotalUsd: 'Subtotal:',
        freight: 'Freight:',
        discountUsd: 'Discount:',
        grandtotalUsd: 'Grand Total, Ex-Works (USD):',
        poBdtPrice: 'PO Total (BDT)',
        subtotalBdt: 'Subtotal:',
        discountBdt: 'Discount:',
        grandtotalBdt: 'Grand Total (BDT):'
    });

    let poFinancialLabels = getDefaultFinancialLabels();

    let poFinancials = {
        freight_usd_value: 0,
        discount_usd_value: 0,
        discount_bdt_value: 0,
        use_freight_usd: false,
        use_discount_usd: false,
        use_discount_bdt: false
    };

    // --- DOM ELEMENTS ---
    const newPOBtn = document.getElementById('po-new-btn');
    const clientSearchInput = document.getElementById('po-client-search-input'), clientSearchResults = document.getElementById('po-client-search-results'), selectedClientInfo = document.getElementById('po-selected-client-info');
    const itemSearchInput = document.getElementById('po-item-search-input'), itemSearchResults = document.getElementById('po-item-search-results'), itemSearchLoader = document.getElementById('po-item-search-loader');
    const poTableHead = document.getElementById('po-table-head'), poTableBody = document.getElementById('po-table-body'), tablePlaceholder = document.getElementById('po-table-placeholder');
    const poCategoryCheckboxes = document.getElementById('po-category-checkboxes');
    const savePOBtn = document.getElementById('po-save-btn'), exportPdfBtn = document.getElementById('po-export-pdf-btn'), exportXlsxBtn = document.getElementById('po-export-xlsx-btn');
    const financialsSection = document.getElementById('po-financials-section'), poTableActions = document.getElementById('po-table-actions');
    const addCustomItemBtn = document.getElementById('po-add-custom-item-btn');
    const poProjectName = document.getElementById('po-project-name');
    const tncTextarea = document.getElementById('po-tnc-textarea');
    const sheetFilterContainer = document.getElementById('po-sheet-filter-container');
    const searchForeignCheckbox = document.getElementById('po-search-foreign');
    const searchLocalCheckbox = document.getElementById('po-search-local');
    const sortToggleBtn = document.getElementById('po-sort-toggle-btn');
    const sortDropdown = document.getElementById('po-sort-dropdown');

    const cleanupSuggestions = () => {
        const dropdown = document.getElementById('po-description-suggestions');
        if (dropdown) dropdown.remove();
        
        const mainScroller = document.querySelector('main');
        if (mainScroller && activeScrollListener) {
            mainScroller.removeEventListener('scroll', activeScrollListener);
        }
        if (activeDescriptionCell && activeKeydownHandler) {
            activeDescriptionCell.removeEventListener('keydown', activeKeydownHandler);
        }
        activeDescriptionCell = null;
        activeScrollListener = null;
        activeKeydownHandler = null;
    };

    // --- HISTORY MANAGEMENT ---
    const captureState = () => {
        if (isRestoringState) return;

        clearTimeout(captureTimeout);
        captureTimeout = setTimeout(() => {
            const state = {
                selectedClient: JSON.parse(JSON.stringify(selectedClient)),
                poItems: JSON.parse(JSON.stringify(poItems)),
                poFinancials: JSON.parse(JSON.stringify(poFinancials)),
                poFinancialLabels: JSON.parse(JSON.stringify(poFinancialLabels)),
                projectName: poProjectName.textContent,
                tnc: tncTextarea.value,
                categories: Array.from(document.querySelectorAll('#po-category-checkboxes input:checked')).map(cb => cb.value)
            };

            if (history.length > 0) {
                if (JSON.stringify(history[historyIndex]) === JSON.stringify(state)) {
                    return;
                }
            }

            if (historyIndex < history.length - 1) {
                history = history.slice(0, historyIndex + 1);
            }
            
            history.push(state);
            historyIndex++;
        }, 300);
    };

    const restoreState = (state) => {
        if (!state) return;
        isRestoringState = true;

        selectedClient = state.selectedClient;
        poItems = state.poItems;
        poFinancials = state.poFinancials;
        poFinancialLabels = state.poFinancialLabels;
        poProjectName.textContent = state.projectName;
        tncTextarea.value = state.tnc;

        if (selectedClient) {
            document.getElementById('po-client-name').textContent = selectedClient.name;
            document.getElementById('po-client-address').textContent = selectedClient.address;
            selectedClientInfo.style.display = 'block';
            clientSearchInput.value = selectedClient.name;
        } else {
            selectedClientInfo.style.display = 'none';
            clientSearchInput.value = '';
        }

        for (const key in poFinancials) {
            if (key.startsWith('use_')) continue;
            const input = financialsSection.querySelector(`[data-type="${key}"]`);
            if (input) input.value = poFinancials[key];
        }

        updateFinancialLabelsInDOM();
        setupFinancialsUI();
        renderPOTable();
        renderPOCategoryCheckboxes(state.categories);
        updatePOActionButtons();

        isRestoringState = false;
    };

    const handleUndo = () => {
        if (historyIndex > 0) {
            historyIndex--;
            restoreState(history[historyIndex]);
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            restoreState(history[historyIndex]);
        }
    };

    // --- RENDER FUNCTIONS ---

    const updateFinancialLabelsInDOM = () => {
        for (const key in poFinancialLabels) {
            const el = document.getElementById(`po-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}-label`);
            if (el && el.textContent !== poFinancialLabels[key]) {
                el.textContent = poFinancialLabels[key];
            }
        }
    };

    const sortPOItems = () => {
        const indexedItems = poItems.map((item, index) => ({ item, originalIndex: index }));

        switch (currentSortOrder) {
            case 'category_asc':
                indexedItems.sort((a, b) => (a.item.product_type || '').localeCompare(b.item.product_type || ''));
                break;
            case 'category_desc':
                indexedItems.sort((a, b) => (b.item.product_type || '').localeCompare(a.item.product_type || ''));
                break;
             case 'source_foreign':
                 indexedItems.sort((a, b) => {
                    const aIsForeign = a.item.source_type === 'foreign';
                    const bIsForeign = b.item.source_type === 'local';
                    if (aIsForeign && !bIsForeign) return -1;
                    if (!aIsForeign && bIsForeign) return 1;
                    return a.originalIndex - b.originalIndex; 
                });
                break;
            case 'custom':
            default:
                 indexedItems.sort((a, b) => a.originalIndex - b.originalIndex);
                break;
        }
        poItems = indexedItems.map(i => i.item);
    };

    const renderPOTable = () => {
        cleanupSuggestions();
        sortPOItems(); 
        poTableHead.innerHTML = ''; poTableBody.innerHTML = '';

        const hasItems = poItems.length > 0;
        const hasUsdItems = poItems.some(item => parseFloat(item.po_price_usd || 0) > 0);
        const hasBdtItems = poItems.some(item => parseFloat(item.po_price_bdt || 0) > 0);

        financialsSection.classList.toggle('hidden', !hasItems);
        tablePlaceholder.style.display = hasItems ? 'none' : 'block';
        poTableActions.style.display = 'block';

        if (!hasItems) {
            updatePOFinancialSummary();
            return;
        }

        const headerRow1 = document.createElement('tr');
        const headerRow2 = document.createElement('tr');
        const addHeader = (row, text, opts = {}) => {
            const th = document.createElement('th');
            th.innerHTML = text;
            th.className = `px-2 py-2 border border-slate-300 dark:border-slate-600 text-center align-middle ${opts.className || ''}`;
            if(opts.rowSpan) th.rowSpan = opts.rowSpan;
            if(opts.colSpan) th.colSpan = opts.colSpan;
            row.appendChild(th);
        };
        
        addHeader(headerRow1, '<i class="fas fa-grip-vertical text-slate-400"></i>', { rowSpan: 2 });
        addHeader(headerRow1, 'SL NO', { rowSpan: 2 });
        addHeader(headerRow1, 'DESCRIPTION', { rowSpan: 2, className: 'w-2/5' });
        addHeader(headerRow1, 'QTY', { rowSpan: 2 });
        addHeader(headerRow1, 'UNIT', { rowSpan: 2 });

        if (hasUsdItems) {
            addHeader(headerRow1, 'PO PRICE (USD)', { colSpan: 2 });
            addHeader(headerRow2, 'PRICE (USD)');
            addHeader(headerRow2, 'TOTAL (USD)');
        }
        if (hasBdtItems) {
            addHeader(headerRow1, 'PO PRICE (BDT)', { colSpan: 2 });
            addHeader(headerRow2, 'PRICE (BDT)');
            addHeader(headerRow2, 'TOTAL (BDT)');
        }
        
        addHeader(headerRow1, 'Action', { rowSpan: 2 });
        poTableHead.appendChild(headerRow1);
        poTableHead.appendChild(headerRow2);
        
        poItems.forEach((item, index) => {
            const row = document.createElement('tr');
            row.dataset.itemIndex = index;
            row.className = "border-t border-slate-200 dark:border-slate-700";
            let rowHTML = `
                <td class="px-2 py-2 text-center border border-slate-300 dark:border-slate-600 cursor-grab move-handle" draggable="true"><i class="fas fa-grip-vertical text-slate-400 pointer-events-none"></i></td>
                <td class="px-2 py-2 text-center border border-slate-300 dark:border-slate-600">${index + 1}</td>
                <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 preserve-lines" contenteditable="true" data-field="description">${item.description || ''}</td>
                <td class="px-2 py-2 border border-slate-300 dark:border-slate-600"><input type="number" class="w-16 p-1 bg-transparent dark:bg-transparent rounded text-right" min="1" value="${item.qty || 1}" data-field="qty"></td>
                <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-center" contenteditable="true" data-field="unit">${item.unit || 'Pcs'}</td>`;

            if (hasUsdItems) {
                const unitPrice = parseFloat(item.po_price_usd || 0).toFixed(2);
                const totalPrice = parseFloat(item.po_total_usd || 0).toFixed(2);
                rowHTML += `
                    <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right" contenteditable="true" data-field="po_price_usd">${unitPrice}</td>
                    <td class="px-2 py-2 font-semibold border border-slate-300 dark:border-slate-600 text-right" data-field="po_total_usd">${totalPrice}</td>`;
            }
            if (hasBdtItems) {
                const unitPrice = parseFloat(item.po_price_bdt || 0).toFixed(2);
                const totalPrice = parseFloat(item.po_total_bdt || 0).toFixed(2);
                 rowHTML += `
                    <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right" contenteditable="true" data-field="po_price_bdt">${unitPrice}</td>
                    <td class="px-2 py-2 font-semibold border border-slate-300 dark:border-slate-600 text-right" data-field="po_total_bdt">${totalPrice}</td>`;
            }

            rowHTML += `<td class="text-center px-2 py-2 border border-slate-300 dark:border-slate-600 space-x-2">
                <button class="add-row-after-btn text-slate-400 hover:text-green-500 p-1" title="Add Row After"><i class="fas fa-plus-circle"></i></button>
                <button class="remove-po-item-btn text-slate-400 hover:text-red-500" title="Remove Item"><i class="fas fa-trash"></i></button>
            </td>`;
            row.innerHTML = rowHTML;
            poTableBody.appendChild(row);
        });
        updatePOFinancialSummary();
    };
    
    const addDescriptionSuggestionNav = (targetCell, dropdown) => {
        let selectedIdx = -1;
    
        activeKeydownHandler = (e) => {
            const items = Array.from(dropdown.querySelectorAll('.search-result-item'));
            if (!items.length || dropdown.classList.contains('hidden')) return;
    
            let currentSelection = dropdown.querySelector('.bg-sky-100');
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
                e.preventDefault();
                cleanupSuggestions();
                selectedIdx = -1;
            }
    
            if (selectedIdx > -1) {
                items[selectedIdx].classList.add('bg-sky-100', 'dark:bg-sky-900');
                items[selectedIdx].scrollIntoView({ block: 'nearest' });
            }
        };
    
        targetCell.addEventListener('keydown', activeKeydownHandler);
    };
    
    const renderDescriptionSuggestions = (items, targetCell) => {
        cleanupSuggestions();

        const dropdown = document.createElement('div');
        dropdown.id = 'po-description-suggestions';
        dropdown.className = 'search-results-dropdown z-30';
        document.body.appendChild(dropdown);

        dropdown.innerHTML = '';
        if (items.length === 0) {
            dropdown.innerHTML = '<div class="p-2 text-center text-xs text-slate-500">No matches found</div>';
        } else {
            items.slice(0, 10).forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'search-result-item cursor-pointer p-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600 border-b border-slate-200 dark:border-slate-700 whitespace-normal';
                itemDiv.innerHTML = item.description; // MODIFIED: Use innerHTML
                itemDiv.onclick = () => {
                    const row = targetCell.closest('tr');
                    const itemIndex = parseInt(row.dataset.itemIndex, 10);
                    
                    const newItem = {
                        ...item,
                        qty: poItems[itemIndex].qty || 1,
                        unit: item.unit || 'Pcs',
                        po_price_usd: item.source_type === 'foreign' ? (item.po_price || item.offer_price || 0) : 0,
                        po_price_bdt: item.source_type === 'local' ? (item.offer_price || 0) : 0,
                    };
                    const qty = parseFloat(newItem.qty);
                    newItem.po_total_usd = (qty * parseFloat(newItem.po_price_usd)).toFixed(2);
                    newItem.po_total_bdt = (qty * parseFloat(newItem.po_price_bdt)).toFixed(2);
                    
                    poItems[itemIndex] = newItem;

                    cleanupSuggestions();
                    renderPOTable();
                    captureState();
                };
                dropdown.appendChild(itemDiv);
            });
        }
        
        const mainScroller = document.querySelector('main');
        const updatePosition = () => {
            if (!activeDescriptionCell || !document.body.contains(activeDescriptionCell)) {
                cleanupSuggestions();
                return;
            }
            const rect = activeDescriptionCell.getBoundingClientRect();
            dropdown.style.left = `${rect.left}px`;
            dropdown.style.top = `${rect.bottom}px`;
        };

        const rect = targetCell.getBoundingClientRect();
        dropdown.style.position = 'fixed';
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.top = `${rect.bottom}px`;
        dropdown.style.width = 'auto';
        dropdown.style.minWidth = `${rect.width}px`;
        dropdown.style.maxWidth = '500px';
        
        activeScrollListener = updatePosition;
        if(mainScroller) mainScroller.addEventListener('scroll', activeScrollListener);
        
        dropdown.classList.remove('hidden');
        
        addDescriptionSuggestionNav(targetCell, dropdown);
    };

    const handleDescriptionInput = (e) => {
        const cell = e.target;
        activeDescriptionCell = cell;
        const query = cell.textContent.trim();

        if (query.length < 3) {
            cleanupSuggestions();
            return;
        }

        clearTimeout(descriptionSearchTimeout);
        descriptionSearchTimeout = setTimeout(async () => {
            if (cell !== activeDescriptionCell) return;
            try {
                const selectedSheets = Array.from(sheetFilterContainer.querySelectorAll('input[name="sheet_filter"]:checked')).map(cb => cb.value).join(',');
                const source = searchSettings.foreign && searchSettings.local ? 'all' : searchSettings.foreign ? 'foreign' : 'local';
                const apiUrl = `${API_URL}/search_items?q=${encodeURIComponent(query)}&role=${currentUser.role}&source=${source}&types=${encodeURIComponent(selectedSheets)}`;
                
                const res = await fetch(apiUrl);
                if (!res.ok) throw new Error('Search failed');
                const items = await res.json();

                renderDescriptionSuggestions(items, cell);
            } catch (err) {
                console.error("Description search failed:", err);
                cleanupSuggestions();
            }
        }, 300);
    };

    const renderPOCategoryCheckboxes = (savedCategories = null) => {
        const allCategories = ['FDS', 'FPS', 'FD', 'FC'];
        const itemCategories = savedCategories !== null ? savedCategories : [...new Set(poItems.map(item => item.product_type))];
        if (poCategoryCheckboxes) {
            poCategoryCheckboxes.innerHTML = allCategories.map(cat => {
                const checked = itemCategories.includes(cat) ? 'checked' : '';
                return `<div class="flex items-center"><input id="po-cat-${cat}" type="checkbox" value="${cat}" name="po_category" class="h-4 w-4 text-sky-600 rounded" ${checked}><label for="po-cat-${cat}" class="ml-3 block text-sm">${cat}</label></div>`;
            }).join('');
        }
    };

    const updatePOFinancialSummary = () => {
        const subtotalUsd = poItems.reduce((acc, item) => acc + parseFloat(item.po_total_usd || 0), 0);
        const subtotalBdt = poItems.reduce((acc, item) => acc + parseFloat(item.po_total_bdt || 0), 0);

        const freight = poFinancials.use_freight_usd ? parseFloat(poFinancials.freight_usd_value || 0) : 0;
        const discountUsd = poFinancials.use_discount_usd ? parseFloat(poFinancials.discount_usd_value || 0) : 0;
        const discountBdt = poFinancials.use_discount_bdt ? parseFloat(poFinancials.discount_bdt_value || 0) : 0;

        const grandTotalUsd = subtotalUsd + freight - discountUsd;
        const grandTotalBdt = subtotalBdt - discountBdt;

        const hasFreight = freight > 0;
        if (hasFreight) {
            poFinancialLabels.subtotalUsd = 'Subtotal, Ex-Works:';
            poFinancialLabels.grandtotalUsd = 'Grand Total, CFR, Chattogram (USD):';
        } else {
            poFinancialLabels.subtotalUsd = 'Subtotal:';
            poFinancialLabels.grandtotalUsd = 'Grand Total, Ex-Works (USD):';
        }
        updateFinancialLabelsInDOM();

        document.getElementById('po-subtotal-usd').textContent = subtotalUsd.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        document.getElementById('po-grand-total-usd').textContent = grandTotalUsd.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        document.getElementById('po-subtotal-bdt').textContent = subtotalBdt.toLocaleString('en-BD', { style: 'currency', currency: 'BDT' });
        document.getElementById('po-grand-total-bdt').textContent = grandTotalBdt.toLocaleString('en-BD', { style: 'currency', currency: 'BDT' });
    };

    const resetPOState = () => {
        selectedClient = null; poItems = []; currentPOId = null; currentPOReferenceNumber = null; offerReferenceNumberForPO = null;
        searchSettings = { foreign: true, local: false };
        currentSortOrder = 'custom';
        poFinancialLabels = getDefaultFinancialLabels();
        poFinancials = {
            freight_usd_value: 0, discount_usd_value: 0, discount_bdt_value: 0,
            use_freight_usd: false, use_discount_usd: false, use_discount_bdt: false
        };

        clientSearchInput.value = ''; itemSearchInput.value = ''; 
        if(selectedClientInfo) selectedClientInfo.style.display = 'none';
        if (poProjectName) poProjectName.textContent = 'New Purchase Order';
        if (tncTextarea) tncTextarea.value = "";
        searchForeignCheckbox.checked = searchSettings.foreign;
        searchLocalCheckbox.checked = searchSettings.local;
        
        updateFinancialLabelsInDOM();
        setupFinancialsUI();
        renderPOTable(); 
        renderPOCategoryCheckboxes(); 
        updatePOActionButtons();
        setupSortDropdown();

        history = [];
        historyIndex = -1;
        setTimeout(captureState, 50);
    };

    const updatePOActionButtons = () => {
        const disabled = poItems.length === 0 || !selectedClient;
        exportPdfBtn.disabled = disabled; exportXlsxBtn.disabled = disabled; savePOBtn.disabled = disabled;
    };

    const setupSortDropdown = () => {
        const sortOptions = {
            'custom': 'Custom Order',
            'category_asc': 'Category (A-Z)',
            'category_desc': 'Category (Z-A)',
            'source_foreign': 'Source (Foreign First)',
        };
        sortDropdown.innerHTML = '';
        for (const [key, value] of Object.entries(sortOptions)) {
            const isChecked = currentSortOrder === key;
            sortDropdown.innerHTML += `
                <div class="flex items-center p-1">
                    <input type="radio" id="po-sort-${key}" name="po_sort_option" value="${key}" class="h-4 w-4 text-sky-600 focus:ring-sky-500" ${isChecked ? 'checked' : ''}>
                    <label for="po-sort-${key}" class="ml-2 text-sm text-slate-700 dark:text-slate-300">${value}</label>
                </div>
            `;
        }
    };
    
    const handleSavePO = async (isSaveAs = false, newName = null) => {
        const btn = isSaveAs ? document.getElementById('save-as-modal-ok-btn') : savePOBtn;
        btn.innerHTML = `<div class="loader !w-4 !h-4 !border-2"></div><span class="ml-2">Saving...</span>`;
        btn.disabled = true;

        try {
            let refToSave = isSaveAs ? newName : (currentPOReferenceNumber || poProjectName.textContent);
            let idToSave = isSaveAs ? null : currentPOId;
            const checkedCategories = Array.from(document.querySelectorAll('#po-category-checkboxes input:checked')).map(cb => cb.value);

            const payload = {
                projectId: idToSave, referenceNumber: refToSave, client: selectedClient,
                items: poItems, 
                financials: poFinancials, 
                financialLabels: poFinancialLabels,
                user: currentUser, projectType: 'po',
                categories: checkedCategories,
                termsAndConditions: tncTextarea.value,
                originalOfferRef: offerReferenceNumberForPO,
                searchSettings: searchSettings
            };

            const response = await fetch(`${API_URL}/project`, {
                method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.success) {
                currentPOId = result.projectId;
                currentPOReferenceNumber = result.referenceNumber;
                poProjectName.textContent = currentPOReferenceNumber;
                showToast(`PO saved with reference: ${currentPOReferenceNumber}`);
            } else { showToast(`Error saving PO: ${result.message}`, true); }
        } catch (err) { showToast(`An error occurred: ${err.message}`, true); }
        finally { 
            savePOBtn.innerHTML = '<i class="fa-solid fa-save"></i> Save PO';
            updatePOActionButtons(); 
        }
    };
    
    const handlePOExport = async (fileType) => {
        const button = fileType === 'xlsx' ? exportXlsxBtn : exportPdfBtn;
        button.innerHTML = `<div class="loader !w-4 !h-4 !border-2"></div><span class="ml-2">Generating...</span>`;
        button.disabled = true;

        try {
            const filename = NameController.generatePOFilename({
                offerReferenceNumber: poProjectName.textContent,
                fileType: fileType
            });

            const payload = {
                items: poItems,
                client: selectedClient,
                referenceNumber: poProjectName.textContent,
                financials: poFinancials,
                financialLabels: poFinancialLabels,
                termsAndConditions: tncTextarea.value,
                user: currentUser,
                file_type: fileType,
                filename: filename
            };
            const exportRes = await fetch(`${API_URL}/export_built_po`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            if (!exportRes.ok) throw new Error(`Server error: ${exportRes.statusText}`);

            const blob = await exportRes.blob();
            const a = document.createElement('a');
            a.href = window.URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(a.href);
        } catch (err) { console.error(`PO Export failed: ${err.message}`); showToast(`Failed to generate PO file: ${err.message}`, true); }
        finally { button.innerHTML = fileType === 'pdf' ? '<i class="fa-solid fa-file-pdf"></i> PDF' : '<i class="fa-solid fa-file-excel"></i> Excel'; updatePOActionButtons(); }
    };
    
    const loadSheetFilters = async () => {
        try {
            const response = await fetch(`${API_URL}/get_sheet_names`);
            if (!response.ok) throw new Error('Failed to load sheet names');
            const sheetNames = await response.json();

            if (sheetFilterContainer) {
                sheetFilterContainer.innerHTML = '';
                if (sheetNames.length > 0) {
                    sheetNames.forEach(name => {
                        const div = document.createElement('div');
                        div.className = 'flex items-center';
                        div.innerHTML = `
                            <input id="po-sheet-${name.replace(/\s/g, '-')}" type="checkbox" value="${name}" name="sheet_filter" class="h-4 w-4 text-sky-600 border-slate-300 dark:border-slate-600 rounded focus:ring-sky-500 bg-slate-100 dark:bg-slate-900" checked>
                            <label for="po-sheet-${name.replace(/\s/g, '-')}" class="ml-2 block text-sm text-slate-900 dark:text-slate-300">${name}</label>
                        `;
                        sheetFilterContainer.appendChild(div);
                    });
                } else {
                    sheetFilterContainer.innerHTML = '<p class="text-slate-400 text-xs">No sheets found.</p>';
                }
            }
        } catch (error) {
            console.error('Error loading sheet filters:', error);
            if (sheetFilterContainer) {
                sheetFilterContainer.innerHTML = '<p class="text-red-500 text-xs">Error loading sheets.</p>';
            }
        }
    };

    const setupFinancialsUI = () => {
        const allToggles = [
            { useKey: 'use_freight_usd', type: 'freight_usd' },
            { useKey: 'use_discount_usd', type: 'discount_usd' },
            { useKey: 'use_discount_bdt', type: 'discount_bdt' }
        ];

        allToggles.forEach(({ useKey, type }) => {
            const addBtn = financialsSection.querySelector(`.add-charge-btn[data-type="${type}"]`);
            const removeBtn = financialsSection.querySelector(`.remove-charge-btn[data-type="${type}"]`);
            const input = addBtn.closest('.flex').querySelector('.financial-input');
            
            const isVisible = poFinancials[useKey];
            
            if(input) input.classList.toggle('hidden', !isVisible);
            if(removeBtn) removeBtn.classList.toggle('hidden', !isVisible);
            if(addBtn) addBtn.classList.toggle('hidden', isVisible);
        });
        updatePOFinancialSummary();
    };

    // --- EVENT LISTENERS ---
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') {
                e.preventDefault();
                handleUndo();
            } else if (e.key === 'y') {
                e.preventDefault();
                handleRedo();
            }
        }
    });

    newPOBtn.addEventListener('click', async () => {
        resetPOState();
    });

    sortToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sortDropdown.classList.toggle('hidden');
    });

    sortDropdown.addEventListener('change', (e) => {
        if (e.target.name === 'po_sort_option') {
            currentSortOrder = e.target.value;
            renderPOTable();
            sortDropdown.classList.add('hidden');
            captureState();
        }
    });

    window.addEventListener('click', (e) => {
        if (!sortDropdown.classList.contains('hidden') && !sortToggleBtn.contains(e.target) && !sortDropdown.contains(e.target)) {
            sortDropdown.classList.add('hidden');
        }
        if (activeDescriptionCell && !activeDescriptionCell.contains(e.target)) {
            const dropdown = document.getElementById('po-description-suggestions');
            if(dropdown && !dropdown.contains(e.target)) {
                cleanupSuggestions();
            }
         }
    });

    financialsSection.addEventListener('paste', e => {
        if (e.target.matches('input[type="number"]')) {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text');
            const sanitizedText = text.replace(/,/g, '');

            const input = e.target;
            const start = input.selectionStart;
            const end = input.selectionEnd;
            const oldValue = input.value;
            const newValue = oldValue.substring(0, start) + sanitizedText + oldValue.substring(end);

            if (!isNaN(newValue) && newValue !== '') {
                input.value = newValue;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    });

    financialsSection.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if(!button) return;
        
        const type = button.dataset.type;
        if (!type) return;

        let stateChanged = false;
        const useKey = `use_${type}`;

        if(button.classList.contains('add-charge-btn')) {
            poFinancials[useKey] = true;
            stateChanged = true;
        } else if(button.classList.contains('remove-charge-btn')) {
            poFinancials[useKey] = false;
            
            const input = button.closest('.flex').querySelector('.financial-input');
            if (input) {
                const valueKey = input.dataset.type;
                poFinancials[valueKey] = 0;
                input.value = 0; 
            }
            stateChanged = true;
        }

        if(stateChanged) {
            setupFinancialsUI();
            captureState();
        }
    });

    financialsSection.addEventListener('input', (e) => {
        const target = e.target;
        if (target.classList.contains('financial-input')) {
            const type = target.dataset.type;
            poFinancials[type] = target.value;
            updatePOFinancialSummary();
            captureState();
        }
        if (target.isContentEditable && target.dataset.labelKey) {
            const key = target.dataset.labelKey;
            poFinancialLabels[key] = target.textContent;
            captureState();
        }
    });


    createSearchHandler({
        searchInput: clientSearchInput, resultsContainer: clientSearchResults, apiEndpoint: `${API_URL}/search_clients`,
        buildQuery: (query) => `q=${encodeURIComponent(query)}`,
        renderResults: renderClientResults, 
        onResultSelected: (client) => {
            selectedClient = { name: client.client_name, address: client.client_address };
            document.getElementById('po-client-name').textContent = selectedClient.name;
            document.getElementById('po-client-address').textContent = selectedClient.address;
            selectedClientInfo.style.display = 'block';
            clientSearchInput.value = selectedClient.name;
            updatePOActionButtons();
            captureState();
        }
    });

    createSearchHandler({
        searchInput: itemSearchInput, resultsContainer: itemSearchResults, loaderElement: itemSearchLoader, apiEndpoint: `${API_URL}/search_items`, currentUser, minQueryLength: 3,
        buildQuery: (query) => {
            const selectedSheets = Array.from(sheetFilterContainer.querySelectorAll('input[name="sheet_filter"]:checked'))
                                        .map(cb => cb.value)
                                        .join(',');

            return `q=${encodeURIComponent(query)}&role=${currentUser.role}&source=${searchSettings.foreign && searchSettings.local ? 'all' : searchSettings.foreign ? 'foreign' : 'local'}&types=${encodeURIComponent(selectedSheets)}`;
        },
        renderResults: renderItemResults,
        onResultSelected: (item) => {
            const newItem = {
                ...item, qty: 1, unit: item.unit || 'Pcs',
                po_price_usd: item.source_type === 'foreign' ? (item.po_price || item.offer_price || 0) : 0,
                po_price_bdt: item.source_type === 'local' ? (item.offer_price || 0) : 0,
            };
            newItem.po_total_usd = (newItem.qty * parseFloat(newItem.po_price_usd)).toFixed(2);
            newItem.po_total_bdt = (newItem.qty * parseFloat(newItem.po_price_bdt)).toFixed(2);
            poItems.push(newItem);
            currentSortOrder = 'custom';
            setupSortDropdown();
            renderPOTable(); renderPOCategoryCheckboxes(); updatePOActionButtons();
            itemSearchInput.value = '';
            itemSearchInput.focus();
            captureState();
        }
    });
    
    if (sheetFilterContainer) {
        sheetFilterContainer.addEventListener('change', (e) => {
            if (e.target.name === 'sheet_filter') {
                if (itemSearchInput.value.length >= 3) {
                     itemSearchInput.dispatchEvent(new Event('keyup', { bubbles:true }));
                }
            }
        });
    }

    searchForeignCheckbox.addEventListener('change', (e) => {
        searchSettings.foreign = e.target.checked;
        if (itemSearchInput.value.length >= 3) itemSearchInput.dispatchEvent(new Event('keyup', { bubbles:true }));
    });
    searchLocalCheckbox.addEventListener('change', (e) => {
        searchSettings.local = e.target.checked;
        if (itemSearchInput.value.length >= 3) itemSearchInput.dispatchEvent(new Event('keyup', { bubbles:true }));
    });

    poTableBody.addEventListener('paste', e => {
        const target = e.target;
        const field = target.dataset.field;
        const isNumericField = field && (field.includes('price') || field === 'qty');

        if (target.matches('[contenteditable]') && isNumericField) {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text');
            const sanitizedText = text.replace(/,/g, '');
            document.execCommand('insertText', false, sanitizedText);
        }
    });

    poTableBody.addEventListener('input', (e) => {
        const target = e.target;
        const row = target.closest('tr'); if (!row) return;
        const itemIndex = parseInt(row.dataset.itemIndex, 10);
        const item = poItems[itemIndex]; if (!item) return;

        const field = target.dataset.field;
        if (field) {
            if (field === 'description') {
                handleDescriptionInput(e);
                item.description = target.innerHTML; // Changed from innerText to save HTML
            } else {
                item[field] = target.matches('[contenteditable]') ? target.innerHTML : target.value;
            }
            
            const qty = parseFloat(item.qty || 1);
            
            if (field === 'po_price_usd' || field === 'qty') {
                item.po_total_usd = (qty * parseFloat(item.po_price_usd || 0)).toFixed(2);
                const totalCell = row.querySelector(`[data-field="po_total_usd"]`);
                if (totalCell) totalCell.textContent = item.po_total_usd;
            }
            if (field === 'po_price_bdt' || field === 'qty') {
                 item.po_total_bdt = (qty * parseFloat(item.po_price_bdt || 0)).toFixed(2);
                const totalCell = row.querySelector(`[data-field="po_total_bdt"]`);
                if (totalCell) totalCell.textContent = item.po_total_bdt;
            }

            updatePOFinancialSummary();
            captureState();
        }
    });

    poTableBody.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        const row = button.closest('tr');
        if (!row) return;
        
        const itemIndex = parseInt(row.dataset.itemIndex, 10);

        if (button.classList.contains('remove-po-item-btn')) {
            poItems.splice(itemIndex, 1);
        } else if (button.classList.contains('add-row-after-btn')) {
            const newItem = {
                customId: `custom_po_${Date.now()}`,
                description: '',
                qty: 1,
                unit: 'Pcs',
                po_price_usd: '0.00',
                po_total_usd: '0.00',
                po_price_bdt: '0.00',
                po_total_bdt: '0.00',
                isCustom: true,
                source_type: 'custom', 
                product_type: 'Custom'
            };
            poItems.splice(itemIndex + 1, 0, newItem);
        }

        renderPOTable(); 
        renderPOCategoryCheckboxes(); 
        updatePOActionButtons();
        captureState();
    });

    savePOBtn.addEventListener('click', () => {
        if (savePOBtn.disabled) return;
        if (!currentPOId) {
            document.getElementById('save-as-type').value = 'po';
            const currentName = poProjectName.textContent;
            let suggestedName = '';
    
            const versionMatch = currentName.match(/(V)(\d+)$/);
            if (versionMatch) {
                const currentVersion = parseInt(versionMatch[2], 10);
                const newVersion = currentVersion + 1;
                suggestedName = currentName.replace(/(V)(\d+)$/, `V${newVersion}`);
            } else {
                suggestedName = `${currentName}V2`;
            }
            
            document.getElementById('save-as-name').value = suggestedName;
            saveAsModal.classList.remove('hidden');
        } else {
            handleSavePO(false);
        }
    });

    exportPdfBtn.addEventListener('click', () => handlePOExport('pdf'));
    exportXlsxBtn.addEventListener('click', () => handlePOExport('xlsx'));

    addCustomItemBtn.addEventListener('click', () => {
        const newItem = {
            customId: `custom_po_${Date.now()}`,
            description: '',
            qty: 1,
            unit: 'Pcs',
            po_price_usd: '0.00',
            po_total_usd: '0.00',
            po_price_bdt: '0.00',
            po_total_bdt: '0.00',
            isCustom: true,
            source_type: 'custom', 
            product_type: 'Custom'
        };
        poItems.push(newItem);
        renderPOTable();
        updatePOActionButtons();
        captureState();
        
        const newRow = poTableBody.querySelector(`tr[data-item-index="${poItems.length - 1}"]`);
        if (newRow) {
            const descCell = newRow.querySelector('[data-field="description"]');
            if (descCell) {
                descCell.focus();
            }
        }
    });
    
    // Drag and Drop Listeners
    poTableBody.addEventListener('dragstart', (e) => {
        const handle = e.target.closest('.move-handle');
        if (handle) {
            const row = handle.closest('tr');
            draggedItemIndex = parseInt(row.dataset.itemIndex, 10);
            e.dataTransfer.effectAllowed = 'move';
            row.classList.add('bg-yellow-200', 'dark:bg-yellow-800/50');
        } else {
            e.preventDefault();
        }
    });

    poTableBody.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    poTableBody.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetRow = e.target.closest('tr');
        if (targetRow && draggedItemIndex !== null) {
            const targetIndex = parseInt(targetRow.dataset.itemIndex, 10);
            const draggedItem = poItems.splice(draggedItemIndex, 1)[0];
            poItems.splice(targetIndex, 0, draggedItem);
            currentSortOrder = 'custom';
            setupSortDropdown();
            renderPOTable();
            captureState();
        }
    });

    poTableBody.addEventListener('dragend', (e) => {
        const draggedRow = poTableBody.querySelector('.bg-yellow-200');
        if (draggedRow) {
            draggedRow.classList.remove('bg-yellow-200', 'dark:bg-yellow-800/50');
        }
        draggedItemIndex = null;
    });


    window.loadPOData = (projectData) => {
        resetPOState();
        currentPOId = projectData.projectId;
        currentPOReferenceNumber = projectData.referenceNumber;
        selectedClient = projectData.client;
        poItems = projectData.items || [];
        poFinancials = { ...poFinancials, ...(projectData.financials || {}) };
        poFinancialLabels = projectData.financialLabels || getDefaultFinancialLabels();
        offerReferenceNumberForPO = projectData.originalOfferRef || null;
        searchSettings = projectData.searchSettings || { foreign: true, local: false };


        if (poProjectName) poProjectName.textContent = currentPOReferenceNumber;
        if (selectedClientInfo && selectedClient) {
            document.getElementById('po-client-name').textContent = selectedClient.name;
            document.getElementById('po-client-address').textContent = selectedClient.address;
            selectedClientInfo.style.display = 'block';
            clientSearchInput.value = selectedClient.name;
        }
        
        if (tncTextarea) tncTextarea.value = projectData.termsAndConditions || "";
        searchForeignCheckbox.checked = searchSettings.foreign;
        searchLocalCheckbox.checked = searchSettings.local;

        updateFinancialLabelsInDOM();
        setupFinancialsUI();
        renderPOTable();
        renderPOCategoryCheckboxes(projectData.categories);
        updatePOActionButtons();

        history = [];
        historyIndex = -1;
        setTimeout(captureState, 50);
    };

    window.addItemsToPO = (itemsToAdd) => {
        if (!itemsToAdd || itemsToAdd.length === 0) return;

        itemsToAdd.forEach(item => {
            const newItem = { ...item }; 
            const qty = parseFloat(newItem.qty || 1);
            newItem.po_price_usd = newItem.po_price_usd || '0.00';
            newItem.po_total_usd = (qty * parseFloat(newItem.po_price_usd)).toFixed(2);
            newItem.po_price_bdt = newItem.po_price_bdt || '0.00';
            newItem.po_total_bdt = (qty * parseFloat(newItem.po_price_bdt)).toFixed(2);
            poItems.push(newItem);
        });
        
        currentSortOrder = 'custom';
        setupSortDropdown();
        renderPOTable(); renderPOCategoryCheckboxes(); updatePOActionButtons();
        captureState();
    };

    window.handlePOSaveAs = async (newName) => {
        await handleSavePO(true, newName);
    };

    window.performReplaceInPO = (findText, replaceText, isCaseSensitive, isBold) => {
        if (!poItems || poItems.length === 0) {
            showToast('No items to perform replacement on.', true);
            return;
        }

        let replacement = isBold ? `<b>${replaceText}</b>` : replaceText;
        const escapedFindText = findText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regexFlags = isCaseSensitive ? 'g' : 'gi';
        const regex = new RegExp(escapedFindText, regexFlags);
        
        let replacementsMade = 0;
        poItems.forEach(item => {
            if (item.description) {
                const originalDescription = item.description;
                const newDescription = item.description.replace(regex, replacement);
                if(originalDescription !== newDescription) {
                    item.description = newDescription;
                    replacementsMade++;
                }
            }
        });

        if (replacementsMade > 0) {
            renderPOTable();
            captureState();
            showToast(`Made replacements in ${replacementsMade} item(s).`);
        } else {
            showToast('No matches found to replace.', false);
        }
    };

    resetPOState();
    loadSheetFilters();
}