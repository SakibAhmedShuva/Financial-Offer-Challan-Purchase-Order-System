// /static/ai-helper.js

/**
 * Initializes the functionality for the AI Helper tab.
 * This function is called from main.js the first time the tab is opened.
 * @param {object} dependencies - An object containing shared functions and state from the main app (e.g., API_URL, showToast).
 */
const initializeAiHelperModule = (dependencies) => {
    // --- DOM ELEMENTS ---
    const fileInput = document.getElementById('ai-file-input');
    const processBtn = document.getElementById('ai-process-btn');
    const saveBtn = document.getElementById('ai-save-btn');
    const saveAsBtn = document.getElementById('ai-save-as-btn');
    const clearBtn = document.getElementById('ai-clear-btn');
    const resultsContainer = document.getElementById('ai-results-container');
    const resultsPlaceholder = document.getElementById('ai-results-placeholder');
    const loader = document.getElementById('ai-helper-loader');
    const resultsToolbar = document.getElementById('ai-results-toolbar');
    const addToOfferBtn = document.getElementById('ai-add-to-offer-btn');
    const addToPoBtn = document.getElementById('ai-add-to-po-btn');
    const addToChallanBtn = document.getElementById('ai-add-to-challan-btn');
    const sourceForeignCheckbox = document.getElementById('ai-source-foreign');
    const sourceLocalCheckbox = document.getElementById('ai-source-local');
    const categoryCheckboxesContainer = document.getElementById('ai-category-checkboxes');


    // Dependencies from main.js
    const { API_URL, showToast, currentUser, setDirty, saveAsModal, switchTab } = dependencies;

    // --- State ---
    let descriptionColumnIndex = -1, quantityColumnIndex = -1, unitColumnIndex = -1, unitPriceColumnIndex = -1;
    let lastSelectedFile = null;
    let lastProcessedRows = []; // Store the original processed data for saving
    let currentAiHelperId = null; // To track the currently loaded/saved AI project
    let currentReferenceNumber = null; // To track the current reference number

    if (currentUser && currentUser.role !== 'admin') {
        addToPoBtn.style.display = 'none';
    }
    
    // --- RENDER CATEGORIES ---
    const renderAICategoryCheckboxes = () => {
        const allCategories = ['FDS', 'FPS', 'FD', 'FC'];
        if (categoryCheckboxesContainer) {
            categoryCheckboxesContainer.innerHTML = allCategories.map(cat => {
                return `<div class="flex items-center"><input id="ai-cat-${cat}" type="checkbox" value="${cat}" name="ai_category" class="h-4 w-4 text-sky-600 border-slate-300 dark:border-slate-600 rounded focus:ring-sky-500 bg-slate-100 dark:bg-slate-900"><label for="ai-cat-${cat}" class="ml-2 block text-sm">${cat}</label></div>`;
            }).join('');
        }
    };
    renderAICategoryCheckboxes(); // Initial render


    // --- EVENT LISTENERS ---
    processBtn.addEventListener('click', handleFileProcessing);

    saveBtn.addEventListener('click', () => {
        if (saveBtn.disabled) return;
        if (!currentAiHelperId) {
            saveAsBtn.click();
        } else {
            handleSaveAiHelper(false);
        }
    });
    
    saveAsBtn.addEventListener('click', () => handleSaveAiHelper(true));
    clearBtn.addEventListener('click', resetAiHelperState);
    addToOfferBtn.addEventListener('click', () => addProcessedItemsToModule('offer'));
    addToPoBtn.addEventListener('click', () => addProcessedItemsToModule('po'));
    addToChallanBtn.addEventListener('click', () => addProcessedItemsToModule('challan'));

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            lastSelectedFile = fileInput.files[0];
        }
    });
    
    resultsContainer.addEventListener('change', () => setDirty(true));
    resultsContainer.addEventListener('input', () => setDirty(true));


    // --- FUNCTIONS ---
    
    // ADDED: Expose a function to the window to be called from other modules
    window.loadFileInAiHelper = async (file) => {
        if (!file) {
            showToast('No file provided to process.', true);
            return;
        }
        await switchTab('ai-helper');
        lastSelectedFile = file;
        // Use a small timeout to ensure the tab has switched before clicking
        setTimeout(() => processBtn.click(), 100);
    };

    function resetAiHelperState() {
        fileInput.value = '';
        lastSelectedFile = null;
        lastProcessedRows = [];
        currentAiHelperId = null;
        currentReferenceNumber = null;
        descriptionColumnIndex = -1;
        quantityColumnIndex = -1;
        unitColumnIndex = -1;
        unitPriceColumnIndex = -1;
        resultsContainer.innerHTML = '';
        resultsPlaceholder.style.display = 'block';
        resultsContainer.appendChild(resultsPlaceholder);
        resultsToolbar.classList.add('hidden');
        saveBtn.disabled = true;
        saveAsBtn.disabled = true;
        setDirty(false);
    }
    
    function updateActionButtons() {
        const disabled = lastProcessedRows.length === 0;
        saveBtn.disabled = disabled;
        saveAsBtn.disabled = disabled;
    }

    async function handleFileProcessing() {
        const fileToProcess = fileInput.files[0] || lastSelectedFile;
        if (!fileToProcess) {
            showToast('Please select a file first.', true);
            return;
        }

        const useForeign = sourceForeignCheckbox.checked;
        const useLocal = sourceLocalCheckbox.checked;
        if (!useForeign && !useLocal) {
            showToast('Please select at least one source to match against.', true);
            return;
        }

        const formData = new FormData();
        formData.append('sheet', fileToProcess);
        formData.append('use_foreign', useForeign);
        formData.append('use_local', useLocal);

        loader.style.display = 'block';
        resultsPlaceholder.style.display = 'none';
        resultsContainer.innerHTML = '';
        resultsToolbar.classList.add('hidden');
        processBtn.disabled = true;
        updateActionButtons();
        processBtn.innerHTML = '<div class="loader !w-4 !h-4 !border-2"></div><span class="ml-2">Processing...</span>';

        try {
            const response = await fetch(`${API_URL}/ai_helper/process_file`, { method: 'POST', body: formData });
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message);
            }
            
            descriptionColumnIndex = result.description_column_index;
            quantityColumnIndex = result.quantity_column_index;
            unitColumnIndex = result.unit_column_index;
            unitPriceColumnIndex = result.unit_price_column_index;

            lastProcessedRows = result.processed_rows; 
            currentAiHelperId = null;
            currentReferenceNumber = null;

            renderResultsTable(result.processed_rows);
            resultsToolbar.classList.remove('hidden');
            updateActionButtons();
            setDirty(true);

        } catch (error) {
            resultsContainer.innerHTML = `<p class="text-red-500 text-center p-8">Error: ${error.message}</p>`;
        } finally {
            loader.style.display = 'none';
            processBtn.disabled = false;
            processBtn.innerHTML = '<i class="fas fa-cogs"></i> Process';
        }
    }
    
    async function performSave(id, ref) {
         if (lastProcessedRows.length === 0) {
            showToast('Nothing to save.', true);
            return;
        }

        const selections = [];
        const rows = resultsContainer.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const checkedRadio = row.querySelector('input[type="radio"]:checked');
            const qtyInput = row.querySelector('.ai-item-qty');
            const unitInput = row.querySelector('.ai-item-unit');

            if (checkedRadio && qtyInput && unitInput) {
                selections.push({
                    selected_radio_value: checkedRadio.value,
                    qty: qtyInput.value,
                    unit: unitInput.value
                });
            }
        });
        
        const matchSources = {
            foreign: sourceForeignCheckbox.checked,
            local: sourceLocalCheckbox.checked
        };
        const namingCategories = Array.from(categoryCheckboxesContainer.querySelectorAll('input:checked')).map(cb => cb.value);

        const payload = {
            projectId: id,
            projectType: 'ai_helper',
            referenceNumber: ref,
            items: lastProcessedRows,
            selections: selections,
            matchSources: matchSources,
            namingCategories: namingCategories,
            user: currentUser,
            client: {},
            descriptionColumnIndex: descriptionColumnIndex,
            quantityColumnIndex: quantityColumnIndex,
            unitColumnIndex: unitColumnIndex,
            unitPriceColumnIndex: unitPriceColumnIndex
        };
        
        const activeSaveBtn = document.activeElement.id === 'ai-save-as-btn' ? saveAsBtn : saveBtn;
        activeSaveBtn.disabled = true;
        activeSaveBtn.innerHTML = '<div class="loader !w-4 !h-4 !border-2"></div><span class="ml-2">Saving...</span>';

        try {
            const response = await fetch(`${API_URL}/project`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.success) {
                currentAiHelperId = result.projectId;
                currentReferenceNumber = result.referenceNumber;
                showToast(`AI Helper project saved: ${result.referenceNumber}`);
                setDirty(false);
            } else {
                showToast(`Error saving: ${result.message}`, true);
            }
        } catch (err) {
            showToast(`An error occurred: ${err.message}`, true);
        } finally {
            updateActionButtons();
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
            saveAsBtn.innerHTML = '<i class="fas fa-copy"></i> Save As';
        }
    }

    async function handleSaveAiHelper(isSaveAs = false) {
        if (!currentAiHelperId || isSaveAs) {
             const checkedCategories = Array.from(categoryCheckboxesContainer.querySelectorAll('input:checked')).map(cb => cb.value);
            
            const suggestedName = NameController.generateAiHelperReference({
                categories: checkedCategories
            });

            document.getElementById('save-as-type').value = 'ai_helper';
            document.getElementById('save-as-name').value = suggestedName;
            saveAsModal.classList.remove('hidden');
        } else {
            await performSave(currentAiHelperId, currentReferenceNumber);
        }
    }
    
    window.handleAiHelperSaveAs = async (newName) => {
        await performSave(null, newName);
    };

    function renderResultsTable(processedRows) {
        if (!processedRows || processedRows.length === 0) {
            resultsContainer.innerHTML = '<p class="text-center p-8">No items found in the uploaded file.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'w-full text-sm text-left text-gray-500 dark:text-gray-400 excel-table';

        const thead = table.createTHead();
        thead.innerHTML = `
            <tr class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <th scope="col" class="px-6 py-3">#</th>
                <th scope="col" class="px-6 py-3">Original Description</th>
                <th scope="col" class="px-6 py-3">Qty</th>
                <th scope="col" class="px-6 py-3">Unit</th>
                <th scope="col" class="px-6 py-3">Original Price</th>
                <th scope="col" class="px-6 py-3 w-1/2">Matched Item Suggestion (Select One)</th>
            </tr>
        `;

        const tbody = table.createTBody();
        processedRows.forEach((row, index) => {
            const tr = tbody.insertRow();
            tr.className = 'bg-white border-b dark:bg-gray-800 dark:border-gray-700';

            const originalDescription = row.original_data[descriptionColumnIndex] || 'N/A';
            const originalQty = (quantityColumnIndex !== -1 ? row.original_data[quantityColumnIndex] : null) || '1';
            const originalUnit = (unitColumnIndex !== -1 ? row.original_data[unitColumnIndex] : null) || 'Pcs';
            const originalUnitPrice = (unitPriceColumnIndex !== -1 ? row.original_data[unitPriceColumnIndex] : null) || 'N/A';
            
            let cell = tr.insertCell();
            cell.className = 'px-6 py-4 font-medium text-gray-900 dark:text-white';
            cell.textContent = index + 1;

            cell = tr.insertCell();
            cell.className = 'px-6 py-4';
            cell.innerHTML = `<div class="ai-item-description max-h-24 overflow-y-auto p-1 border rounded bg-slate-50 dark:bg-slate-900/50" contenteditable="true">${originalDescription}</div>`;
            
            cell = tr.insertCell();
            cell.className = 'px-6 py-4';
            cell.innerHTML = `<input type="number" class="ai-item-qty w-20 p-1.5 text-center bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md" value="${originalQty}" min="0">`;
        
            cell = tr.insertCell();
            cell.className = 'px-6 py-4';
            cell.innerHTML = `<input type="text" class="ai-item-unit w-24 p-1.5 text-center bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md" value="${originalUnit}">`;

            cell = tr.insertCell();
            cell.className = 'px-6 py-4 font-mono text-right';
            cell.innerHTML = `<div class="ai-item-price text-right" contenteditable="true">${originalUnitPrice}</div>`;

            cell = tr.insertCell();
            cell.className = 'px-6 py-4';
            let suggestionsHTML = '<div class="space-y-3">';
            const encodeHTML = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            const originalItemData = encodeHTML(JSON.stringify({ 
                is_custom: true, 
            }));

            suggestionsHTML += `
                <div class="flex items-start p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/50">
                    <input id="row-${index}-sug-custom" type="radio" name="suggestion_row_${index}" value="custom" class="mt-1 h-4 w-4 text-sky-600 focus:ring-sky-500" data-item="${originalItemData}" checked>
                    <label for="row-${index}-sug-custom" class="ml-3 text-sm flex-1 cursor-pointer">
                        <span class="font-bold text-gray-800 dark:text-gray-200">Use Original Description (As Custom Item)</span>
                        <p class="text-gray-600 dark:text-gray-400 italic">${originalDescription}</p>
                    </label>
                </div>`;

            if (row.suggestions && row.suggestions.length > 0) {
                suggestionsHTML += `<div class="border-t border-slate-200 dark:border-slate-600 my-2 pt-2"><span class="text-xs font-semibold text-slate-500">Or select a database match:</span></div>`;
                row.suggestions.forEach((suggestion, sugIndex) => {
                    const itemId = `row-${index}-sug-${sugIndex}`;
                    const itemData = encodeHTML(JSON.stringify(suggestion));
                    suggestionsHTML += `
                        <div class="flex items-start p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/50">
                            <input id="${itemId}" type="radio" name="suggestion_row_${index}" value="${suggestion.item_code}" class="mt-1 h-4 w-4 text-sky-600 focus:ring-sky-500" data-item="${itemData}">
                            <label for="${itemId}" class="ml-3 text-sm flex-1 cursor-pointer">
                                <span class="font-bold text-gray-800 dark:text-gray-200">${suggestion.item_code || ''}</span>
                                <p class="text-gray-600 dark:text-gray-400">${suggestion.description}</p>
                            </label>
                        </div>`;
                });
            }
            
            suggestionsHTML += `</div>`;
            cell.innerHTML = suggestionsHTML;
        });
        
        resultsContainer.innerHTML = '';
        resultsContainer.appendChild(table);
    }

    function addProcessedItemsToModule(moduleName) {
        const selectedItems = [];
        const rows = resultsContainer.querySelectorAll('tbody tr');
        
        const priceTypeRadio = document.querySelector('input[name="ai_price_type"]:checked');
        const originalPriceIsForeign = priceTypeRadio && priceTypeRadio.value === 'foreign';

        rows.forEach((row, index) => {
            const checkedRadio = row.querySelector('input[type="radio"]:checked');
            if (checkedRadio) {
                const itemDataString = checkedRadio.getAttribute('data-item');
                const itemData = JSON.parse(itemDataString);
                
                const editedQty = row.querySelector('.ai-item-qty').value;
                const editedUnit = row.querySelector('.ai-item-unit').value;
                
                let finalItem;

                if (itemData.is_custom) {
                    const editedPrice = parseFloat(row.querySelector('.ai-item-price').textContent) || 0;
                    const editedDescription = row.querySelector('.ai-item-description').innerHTML;
                    
                    finalItem = {
                        item_code: `custom_${Date.now()}_${index}`,
                        description: editedDescription,
                        qty: parseFloat(editedQty),
                        unit: editedUnit,
                        product_type: 'Custom',
                        isCustom: true,
                        // Set all price fields to 0 initially
                        foreign_price_usd: 0,
                        local_supply_price_bdt: 0,
                        po_price_usd: 0,
                        po_price_bdt: 0, // new field
                        installation_price_bdt: 0,
                        source_type: originalPriceIsForeign ? 'foreign' : 'local',
                    };

                    if (moduleName === 'po') {
                        if (originalPriceIsForeign) {
                            finalItem.po_price_usd = editedPrice;
                        } else {
                            finalItem.po_price_bdt = editedPrice;
                        }
                    } else { // For Offer & Challan
                        if (originalPriceIsForeign) {
                            finalItem.foreign_price_usd = editedPrice;
                        } else {
                            finalItem.local_supply_price_bdt = editedPrice;
                        }
                    }

                } else { // Item is from a database match
                    finalItem = {
                        item_code: itemData.item_code,
                        description: itemData.description,
                        product_type: itemData.product_type,
                        source_type: itemData.source_type,
                        qty: parseFloat(editedQty),
                        unit: editedUnit,
                        isCustom: false,
                        // Set all price fields to 0 initially
                        foreign_price_usd: 0,
                        local_supply_price_bdt: 0,
                        installation_price_bdt: 0,
                        po_price_usd: 0,
                        po_price_bdt: 0, // new field
                    };

                    if (moduleName === 'po') {
                        if (itemData.source_type === 'foreign') {
                            finalItem.po_price_usd = itemData.po_price || itemData.offer_price || 0;
                        } else { // local item
                            finalItem.po_price_bdt = itemData.offer_price || 0;
                        }
                    } else { // For Offer & Challan
                        if (itemData.source_type === 'foreign') {
                            finalItem.foreign_price_usd = itemData.offer_price || 0;
                        } else {
                            finalItem.local_supply_price_bdt = itemData.offer_price || 0;
                        }
                        finalItem.installation_price_bdt = itemData.installation || 0;
                        // carry over po_price for reference if needed, though not directly used in offer
                        finalItem.po_price_usd = itemData.po_price || 0;
                    }
                }
                selectedItems.push(finalItem);
            }
        });

        if (selectedItems.length === 0) {
            showToast('No items selected to add.', true);
            return;
        }
        
        if (window.addItemsToModule) {
            window.addItemsToModule(moduleName, selectedItems);
        } else {
            showToast('Critical error: Cannot communicate with main modules.', true);
        }
    }


    window.loadAiHelperData = (data) => {
        resetAiHelperState();
        currentAiHelperId = data.projectId;
        currentReferenceNumber = data.referenceNumber;
        lastProcessedRows = data.items;
        descriptionColumnIndex = data.descriptionColumnIndex || -1;
        quantityColumnIndex = data.quantityColumnIndex || -1;
        unitColumnIndex = data.unitColumnIndex || -1;
        unitPriceColumnIndex = data.unitPriceColumnIndex || -1;
        const selections = data.selections || [];

        if (data.matchSources) {
            sourceForeignCheckbox.checked = data.matchSources.foreign === undefined ? true : data.matchSources.foreign;
            sourceLocalCheckbox.checked = data.matchSources.local === undefined ? true : data.matchSources.local;
        }
        
        categoryCheckboxesContainer.querySelectorAll('input:checked').forEach(cb => cb.checked = false);
        if (data.namingCategories) {
            data.namingCategories.forEach(catValue => {
                const checkbox = categoryCheckboxesContainer.querySelector(`input[value="${catValue}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }

        resultsPlaceholder.innerHTML = `<p class="text-center text-gray-500 dark:text-gray-400 py-12">Loaded project: <strong>${data.referenceNumber}</strong></p>`;

        renderResultsTable(lastProcessedRows);

        const rows = resultsContainer.querySelectorAll('tbody tr');
        if (rows.length > 0 && selections.length === rows.length) {
            rows.forEach((row, index) => {
                const selection = selections[index];
                const radioToSelect = row.querySelector(`input[type="radio"][value="${selection.selected_radio_value}"]`);
                if (radioToSelect) radioToSelect.checked = true;
                
                const qtyInput = row.querySelector('.ai-item-qty');
                if (qtyInput) qtyInput.value = selection.qty;
                
                const unitInput = row.querySelector('.ai-item-unit');
                if (unitInput) unitInput.value = selection.unit;
            });
        }
        
        loader.style.display = 'none';
        resultsPlaceholder.style.display = 'none';
        resultsToolbar.classList.remove('hidden');
        updateActionButtons();
        setDirty(false); 
    };
};