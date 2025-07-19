// /static/challan.js
function initializeChallanModule(deps) {
    const { API_URL, currentUser, showToast, addKeyboardNavigation, updateProjectState, setDirty, getDirty, saveAsModal, showConfirmModal } = deps;

    // --- STATE ---
    let selectedChallanClient = null, challanItems = [], currentChallanReferenceNumber = null, currentChallanId = null, includeSignature = true;
    let searchSettings = { foreign: false, local: true };
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

    // --- DOM ELEMENTS ---
    const clientSearchInput = document.getElementById('challan-client-search-input'), clientSearchResults = document.getElementById('challan-client-search-results'), selectedClientInfo = document.getElementById('challan-selected-client-info');
    const itemSearchInput = document.getElementById('challan-item-search-input'), itemSearchResults = document.getElementById('challan-item-search-results'), itemSearchLoader = document.getElementById('challan-item-search-loader');
    const tableHead = document.getElementById('challan-table-head'), tableBody = document.getElementById('challan-table-body'), placeholder = document.getElementById('challan-table-placeholder');
    const pdfBtn = document.getElementById('export-challan-pdf-btn'), xlsxBtn = document.getElementById('export-challan-xlsx-btn');
    const saveBtn = document.getElementById('save-challan-btn'), saveAsBtn = document.getElementById('save-challan-as-btn');
    const refDisplay = document.getElementById('challan-ref-display');
    const categoryCheckboxes = document.getElementById('challan-category-checkboxes');
    const filenamePreview = document.getElementById('challan-filename-preview');
    const newChallanBtn = document.getElementById('new-challan-btn');
    const challanUserName = document.getElementById('challan-user-name');
    const includeSignatureCheckbox = document.getElementById('challan-include-signature');
    const sheetFilterContainer = document.getElementById('challan-sheet-filter-container');
    const searchForeignCheckbox = document.getElementById('challan-search-foreign');
    const searchLocalCheckbox = document.getElementById('challan-search-local');
    const sortToggleBtn = document.getElementById('challan-sort-toggle-btn'); 
    const sortDropdown = document.getElementById('challan-sort-dropdown'); 
    const tableActions = document.getElementById('challan-table-actions');
    const addCustomItemBtn = document.getElementById('challan-add-custom-item-btn');

    // --- HISTORY MANAGEMENT ---
    const captureState = () => {
        if (isRestoringState) return;

        clearTimeout(captureTimeout);
        captureTimeout = setTimeout(() => {
            const state = {
                selectedChallanClient: JSON.parse(JSON.stringify(selectedChallanClient)),
                challanItems: JSON.parse(JSON.stringify(challanItems)),
                challanRef: refDisplay.textContent,
                includeSignature: includeSignature,
                searchSettings: JSON.parse(JSON.stringify(searchSettings)),
                currentSortOrder: currentSortOrder,
                categories: Array.from(document.querySelectorAll('#challan-category-checkboxes input:checked')).map(cb => cb.value)
            };

            if (history.length > 0) {
                const lastState = JSON.stringify(history[historyIndex]);
                if (lastState === JSON.stringify(state)) {
                    return;
                }
            }

            if (historyIndex < history.length - 1) {
                history = history.slice(0, historyIndex + 1);
            }
            
            history.push(state);
            historyIndex++;
            
            if (historyIndex > 0) {
                setDirty(true);
            }
        }, 300);
    };

    const restoreState = (state) => {
        if (!state) return;
        isRestoringState = true;

        selectedChallanClient = state.selectedChallanClient;
        challanItems = state.challanItems;
        currentChallanReferenceNumber = state.challanRef;
        includeSignature = state.includeSignature;
        searchSettings = state.searchSettings;
        currentSortOrder = state.currentSortOrder;

        refDisplay.textContent = currentChallanReferenceNumber;

        if(selectedChallanClient) {
            document.getElementById('challan-client-name').textContent = selectedChallanClient.name;
            document.getElementById('challan-client-address').textContent = selectedChallanClient.address;
            selectedClientInfo.style.display = 'block';
            clientSearchInput.value = selectedChallanClient.name;
        } else {
            selectedClientInfo.style.display = 'none';
            clientSearchInput.value = '';
        }

        includeSignatureCheckbox.checked = includeSignature;
        searchForeignCheckbox.checked = searchSettings.foreign;
        searchLocalCheckbox.checked = searchSettings.local;
        
        setupSortDropdown();
        renderChallanTable();
        renderChallanCategoryCheckboxes(state.categories);
        updateChallanActionButtons();
        updateChallanFilenamePreview();

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
    
    // --- RENDER & LOGIC FUNCTIONS ---
    const cleanupSuggestions = () => {
        const dropdown = document.getElementById('challan-description-suggestions');
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

    const updateChallanFilenamePreview = () => {
        if (!filenamePreview || !selectedChallanClient || !refDisplay.textContent) return;
        
        const cats = Array.from(document.querySelectorAll('#challan-category-checkboxes input:checked')).map(cb => cb.value);
        
        const previewName = NameController.generateChallanFilename({
            challanRef: refDisplay.textContent.trim(),
            clientName: selectedChallanClient.name,
            categories: cats,
            fileType: 'pdf'
        });
        filenamePreview.textContent = `Preview: ${previewName}`;
    };

    const sortChallanItems = () => {
        const indexedItems = challanItems.map((item, index) => ({ item, originalIndex: index }));

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
        challanItems = indexedItems.map(i => i.item);
    };

    const renderChallanTable = () => {
        cleanupSuggestions();
        sortChallanItems(); 
        tableHead.innerHTML=''; tableBody.innerHTML='';
        const hasItems = challanItems.length > 0;
        placeholder.style.display = hasItems ? 'none':'block';
        tableActions.style.display = 'block';

        if(challanItems.length === 0) return;
        const headers = ['<i class="fas fa-grip-vertical text-slate-400"></i>', 'Sl.', 'Description', 'Qty', 'Unit', 'Action'];
        tableHead.innerHTML = `<tr>${headers.map(h => `<th class="p-2 text-center border border-slate-300 dark:border-slate-600">${h}</th>`).join('')}</tr>`;
        
        challanItems.forEach((item,index)=>{
            const row=document.createElement('tr'); row.dataset.itemIndex=index; row.className="border-t border-slate-200 dark:border-slate-700";
            row.innerHTML=`
                <td class="px-2 py-2 text-center border border-slate-300 dark:border-slate-600 cursor-grab move-handle" draggable="true"><i class="fas fa-grip-vertical text-slate-400 pointer-events-none"></i></td>
                <td class="text-center p-2 w-[5%] border border-slate-300 dark:border-slate-600">${item.sl||index+1}</td>
                <td class="p-2 w-[60%] border border-slate-300 dark:border-slate-600 preserve-lines" contenteditable="true" data-field="description">${item.description || ''}</td>
                <td class="p-2 w-[10%] border border-slate-300 dark:border-slate-600"><input type="number" class="challan-qty-input w-20 p-1 bg-transparent dark:bg-transparent rounded text-center" min="1" value="${item.qty||1}"></td>
                <td class="p-2 w-[15%] border border-slate-300 dark:border-slate-600 text-center" contenteditable="true" data-field="unit">${item.unit||'Pcs'}</td>
                <td class="text-center p-2 w-[10%] border border-slate-300 dark:border-slate-600 space-x-1">
                    <button class="add-row-after-btn text-slate-400 hover:text-green-500 p-1" title="Add Row After"><i class="fas fa-plus-circle"></i></button>
                    <button class="remove-challan-item-btn text-slate-400 hover:text-red-500 p-1" title="Remove"><i class="fas fa-trash"></i></button>
                </td>`;
            tableBody.appendChild(row);
        });
    };

    const renderChallanCategoryCheckboxes = (savedCategories = null) => {
        const cats=['FDS','FPS','FD','FC'];
        if(!categoryCheckboxes) return;
        const itemCats = savedCategories !== null ? savedCategories : [...new Set(challanItems.map(i=>i.product_type))];
        categoryCheckboxes.innerHTML=cats.map(c=>`<div class="flex items-center"><input id="challan-cat-${c}" type="checkbox" value="${c}" name="challan_category" class="h-4 w-4 rounded" ${itemCats.includes(c)?'checked':''}><label for="challan-cat-${c}" class="ml-3 block text-sm">${c}</label></div>`).join('');
        updateChallanFilenamePreview();
    };
    
    const resetChallanState = () => {
        selectedChallanClient=null; challanItems=[]; currentChallanId=null;
        currentSortOrder = 'custom'; 
        searchSettings = { foreign: false, local: true };
        clientSearchInput.value=''; itemSearchInput.value=''; selectedClientInfo.style.display='none';
        refDisplay.textContent='Loading...'; filenamePreview.textContent='';
        includeSignature = true;
        if(includeSignatureCheckbox) includeSignatureCheckbox.checked = true;
        searchForeignCheckbox.checked = searchSettings.foreign;
        searchLocalCheckbox.checked = searchSettings.local;
        renderChallanTable(); renderChallanCategoryCheckboxes(); updateChallanActionButtons();
        setupSortDropdown(); 
        fetchNewChallanReference(); 
        
        history = [];
        historyIndex = -1;
        setDirty(false);
        setTimeout(captureState, 50);
    };

    const updateChallanActionButtons = () => {
        const dis=challanItems.length===0||!selectedChallanClient;
        [pdfBtn,xlsxBtn,saveBtn,saveAsBtn].forEach(b=> { if(b) b.disabled=dis });
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
                    <input type="radio" id="challan-sort-${key}" name="challan_sort_option" value="${key}" class="h-4 w-4 text-sky-600 focus:ring-sky-500" ${isChecked ? 'checked' : ''}>
                    <label for="challan-sort-${key}" class="ml-2 text-sm text-slate-700 dark:text-slate-300">${value}</label>
                </div>
            `;
        }
    };
    
    const fetchNewChallanReference = async () => {
        try {
            const res=await fetch(`${API_URL}/get_new_challan_ref`);
            const data=await res.json();
            if(data.success) {currentChallanReferenceNumber=data.referenceNumber; refDisplay.textContent=currentChallanReferenceNumber;}
            else {refDisplay.textContent='Error'; showToast(data.message,true);}
        } catch(err){refDisplay.textContent='Error'; showToast(`Failed to fetch ref: ${err.message}`,true);}
        updateChallanFilenamePreview();
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
        dropdown.id = 'challan-description-suggestions';
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
                        qty: challanItems[itemIndex].qty || 1,
                        unit: item.unit || 'Pcs',
                    };

                    challanItems[itemIndex] = newItem;

                    cleanupSuggestions();
                    renderChallanTable();
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


    const handleChallanExport = async (fileType) => {
        const btn = fileType === 'pdf' ? pdfBtn : xlsxBtn;
        btn.innerHTML = `<div class="loader !w-4 !h-4 !border-2"></div><span class="ml-2">Generating...</span>`;
        btn.disabled = true;
        try {
            const cats = Array.from(document.querySelectorAll('#challan-category-checkboxes input:checked')).map(cb => cb.value);
            
            const filename = NameController.generateChallanFilename({
                challanRef: refDisplay.textContent.trim(),
                clientName: selectedChallanClient.name,
                categories: cats,
                fileType: fileType
            });

            const payload = {
                items: challanItems,
                client: selectedChallanClient,
                referenceNumber: parseInt(refDisplay.textContent.trim()) || currentChallanReferenceNumber,
                user: currentUser,
                fileType,
                categories: cats,
                projectId: currentChallanId,
                includeSignature: includeSignature,
                filename: filename
            };
            const res = await fetch(`${API_URL}/export_challan`, {
                method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.message || res.statusText); }
            const blob = await res.blob();
            
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a); a.click(); a.remove();
            showToast('Challan logged and generated.');
        } catch (err) { showToast(`Export failed: ${err.message}`, true);
        } finally { btn.innerHTML = fileType === 'pdf' ? '<i class="fa-solid fa-file-pdf"></i> PDF' : '<i class="fa-solid fa-file-excel"></i> Excel'; updateChallanActionButtons(); }
    };

    const handleSaveChallan = async (isSaveAs = false, newName = null) => {
        const button = isSaveAs ? saveAsBtn : saveBtn;
        button.innerHTML = `<div class="loader !w-4 !h-4 !border-2"></div><span class="ml-2">Saving...</span>`;
        button.disabled = true;

        try {
            let refToSave = isSaveAs ? newName : (currentChallanReferenceNumber || refDisplay.textContent);
            let idToSave = isSaveAs ? null : currentChallanId;
            const cats = Array.from(document.querySelectorAll('#challan-category-checkboxes input:checked')).map(cb => cb.value);

            const payload = {
                projectId: idToSave, referenceNumber: refToSave, client: selectedChallanClient,
                items: challanItems, user: currentUser, projectType: 'challan', includeSignature: includeSignature,
                categories: cats,
                searchSettings: searchSettings,
            };
            const response = await fetch(`${API_URL}/project`, {
                method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.success) {
                currentChallanId = result.projectId; currentChallanReferenceNumber = result.referenceNumber;
                refDisplay.textContent = currentChallanReferenceNumber;
                showToast(`Challan saved with reference: ${currentChallanReferenceNumber}`);
                setDirty(false);
            } else { showToast(`Error saving challan: ${result.message}`, true); }
        } catch (err) { showToast(`An error occurred: ${err.message}`, true); }
        finally { button.innerHTML = isSaveAs ? '<i class="fa-solid fa-copy"></i> Save As' : '<i class="fa-solid fa-save"></i> Save'; updateChallanActionButtons(); }
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
                            <input id="challan-sheet-${name.replace(/\s/g, '-')}" type="checkbox" value="${name}" name="sheet_filter" class="h-4 w-4 text-sky-600 border-slate-300 dark:border-slate-600 rounded focus:ring-sky-500 bg-slate-100 dark:bg-slate-900" checked>
                            <label for="challan-sheet-${name.replace(/\s/g, '-')}" class="ml-2 block text-sm text-slate-900 dark:text-slate-300">${name}</label>
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

    if(newChallanBtn)newChallanBtn.addEventListener('click', async ()=>{ if(getDirty()){ const confirmed = await showConfirmModal( "You have unsaved changes that will be lost. Are you sure you want to start a new challan?", "Unsaved Changes", "bg-amber-600 hover:bg-amber-700", "Continue" ); if (!confirmed) return; } resetChallanState(); });
    if(selectedClientInfo)selectedClientInfo.addEventListener('input', e=>{if(!selectedClientInfo)return; if(e.target.id==='challan-client-name')selectedChallanClient.name=e.target.textContent; else if(e.target.id==='challan-client-address')selectedChallanClient.address=e.target.textContent; updateChallanFilenamePreview(); captureState();});
    if(categoryCheckboxes)categoryCheckboxes.addEventListener('change',()=>{updateChallanFilenamePreview();captureState();});
    if(includeSignatureCheckbox) { includeSignatureCheckbox.addEventListener('change', e => { includeSignature = e.target.checked; captureState(); }); }
    
    if (addCustomItemBtn) {
        addCustomItemBtn.addEventListener('click', () => {
            const newItem = {
                sl: challanItems.length + 1,
                description: '',
                qty: 1,
                unit: 'Pcs',
                product_type: 'Custom',
                isCustom: true
            };
            challanItems.push(newItem);
            renderChallanTable();
            updateChallanActionButtons();
            captureState();
            
            const newRow = tableBody.querySelector(`tr[data-item-index="${challanItems.length - 1}"]`);
            if (newRow) {
                const descCell = newRow.querySelector('[data-field="description"]');
                if (descCell) {
                    descCell.focus();
                }
            }
        });
    }

    sortToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sortDropdown.classList.toggle('hidden');
    });

    sortDropdown.addEventListener('change', (e) => {
        if (e.target.name === 'challan_sort_option') {
            currentSortOrder = e.target.value;
            renderChallanTable();
            sortDropdown.classList.add('hidden');
            captureState();
        }
    });

     window.addEventListener('click', (e) => {
        if (!sortDropdown.classList.contains('hidden') && !sortToggleBtn.contains(e.target) && !sortDropdown.contains(e.target)) {
            sortDropdown.classList.add('hidden');
        }
        if (activeDescriptionCell && !activeDescriptionCell.contains(e.target)) {
           const dropdown = document.getElementById('challan-description-suggestions');
           if(dropdown && !dropdown.contains(e.target)) {
               cleanupSuggestions();
           }
        }
    });


    createSearchHandler({ 
        searchInput:itemSearchInput, 
        resultsContainer:itemSearchResults, 
        loaderElement:itemSearchLoader, 
        apiEndpoint:`${API_URL}/search_items`, 
        currentUser, 
        minQueryLength:3, 
        buildQuery:q=>{
            const selectedSheets = Array.from(sheetFilterContainer.querySelectorAll('input[name="sheet_filter"]:checked'))
                                        .map(cb => cb.value)
                                        .join(',');
            return `q=${encodeURIComponent(q)}&role=${currentUser.role}&source=${searchSettings.foreign && searchSettings.local ? 'all' : searchSettings.foreign ? 'foreign' : 'local'}&types=${encodeURIComponent(selectedSheets)}`;
        }, 
        renderResults:renderItemResults,
        onResultSelected:item => { const newItem = { ...item, qty: 1, unit: item.unit || 'Pcs' }; challanItems.push(newItem); currentSortOrder = 'custom'; setupSortDropdown(); renderChallanTable(); renderChallanCategoryCheckboxes(); updateChallanActionButtons(); itemSearchInput.focus(); captureState(); }
    });
    
    createSearchHandler({ searchInput:clientSearchInput, resultsContainer:clientSearchResults, apiEndpoint:`${API_URL}/search_clients`, buildQuery:q=>`q=${encodeURIComponent(q)}`, renderResults:renderClientResults,
        onResultSelected:client=>{ selectedChallanClient={name:client.client_name,address:client.client_address}; document.getElementById('challan-client-name').textContent=selectedChallanClient.name; document.getElementById('challan-client-address').textContent=selectedChallanClient.address; selectedClientInfo.style.display='block'; updateChallanActionButtons(); updateChallanFilenamePreview(); captureState(); }
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

    tableBody.addEventListener('click',e=>{
        const button = e.target.closest('button');
        if (!button) return;
        const row = button.closest('tr');
        if (!row) return;
        const itemIndex = parseInt(row.dataset.itemIndex, 10);
        
        if(button.classList.contains('remove-challan-item-btn')){
            challanItems.splice(itemIndex, 1);
        } else if (button.classList.contains('add-row-after-btn')) {
            const newItem = {
                sl: challanItems.length + 1, description: '', qty: 1, unit: 'Pcs',
                product_type: 'Custom', isCustom: true
            };
            challanItems.splice(itemIndex + 1, 0, newItem);
        }
        renderChallanTable(); renderChallanCategoryCheckboxes(); updateChallanActionButtons(); captureState();
    });

    tableBody.addEventListener('input', e => {
        const target = e.target;
        const r = target.closest('tr');
        if (!r) return;
        const i = challanItems[parseInt(r.dataset.itemIndex, 10)];
        if (!i) return;

        if (target.classList.contains('challan-qty-input')) {
            i.qty = parseInt(target.value) || 1;
        } else if (target.dataset.field === 'description') {
            handleDescriptionInput(e);
            i.description = target.innerHTML; // Changed from innerText
        } else if (target.dataset.field === 'unit') {
            i.unit = target.textContent;
        }
        captureState();
    });

    pdfBtn.addEventListener('click',()=>handleChallanExport('pdf'));
    xlsxBtn.addEventListener('click',()=>handleChallanExport('xlsx'));
    
    saveBtn.addEventListener('click', () => {
        if (saveBtn.disabled) return;
        if (!currentChallanId) {
            saveAsBtn.click();
        } else {
            handleSaveChallan(false);
        }
    });

    saveAsBtn.addEventListener('click', () => { 
        if (saveAsBtn.disabled) return;
        
        let suggestedName = '';
        const cats = Array.from(document.querySelectorAll('#challan-category-checkboxes input:checked')).map(cb => cb.value);
        const currentName = NameController.generateChallanFilename({
            challanRef: refDisplay.textContent.trim(),
            clientName: selectedChallanClient.name,
            categories: cats,
            fileType: 'pdf'
        }).replace(/\.pdf$/, '');

        if (currentChallanId) {
            // Logic for existing, loaded challans: add or increment version
            const versionRegex = /(DC_)(\d+)(V)(\d+)/;
            const versionMatch = currentName.match(versionRegex);

            if (versionMatch) {
                const prefix = versionMatch[1];
                const challanNum = versionMatch[2];
                const currentVersion = parseInt(versionMatch[4], 10);
                suggestedName = currentName.replace(versionRegex, `${prefix}${challanNum}V${currentVersion + 1}`);
            } else {
                const baseRegex = /(DC_)(\d+)/;
                suggestedName = currentName.replace(baseRegex, `$1$2V2`);
            }
        } else {
            // Logic for a brand new challan being saved for the first time
            suggestedName = currentName;
        }

        document.getElementById('save-as-type').value = 'challan'; 
        document.getElementById('save-as-name').value = suggestedName; 
        saveAsModal.classList.remove('hidden'); 
    });
    
    // Drag and Drop Listeners
    tableBody.addEventListener('dragstart', (e) => {
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

    tableBody.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    tableBody.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetRow = e.target.closest('tr');
        if (targetRow && draggedItemIndex !== null) {
            const targetIndex = parseInt(targetRow.dataset.itemIndex, 10);
            const draggedItem = challanItems.splice(draggedItemIndex, 1)[0];
            challanItems.splice(targetIndex, 0, draggedItem);
            currentSortOrder = 'custom';
            setupSortDropdown();
            renderChallanTable();
            captureState();
        }
    });

    tableBody.addEventListener('dragend', (e) => {
        const draggedRow = tableBody.querySelector('.bg-yellow-200');
        if (draggedRow) {
            draggedRow.classList.remove('bg-yellow-200', 'dark:bg-yellow-800/50');
        }
        draggedItemIndex = null;
    });


    // --- GLOBAL FUNCTIONS & INITIALIZATION ---
    window.addItemsToChallan = (itemsToAdd) => {
        if (!itemsToAdd || itemsToAdd.length === 0) return;
        itemsToAdd.forEach(item => {
            const newItem = {
                description: item.description,
                qty: item.qty || 1,
                unit: item.unit || 'Pcs',
                product_type: item.product_type || 'Custom'
            };
            challanItems.push(newItem);
        });
        currentSortOrder = 'custom'; 
        setupSortDropdown(); 
        renderChallanTable();
        renderChallanCategoryCheckboxes();
        updateChallanActionButtons();
        captureState();
    };
    
    window.loadChallanData=(data)=>{
        resetChallanState(); // Clear old state and history first
        
        currentChallanId=data.projectId; 
        selectedChallanClient=data.client; 
        challanItems=data.items;
        currentChallanReferenceNumber = data.referenceNumber;
        includeSignature = data.includeSignature === undefined ? true : data.includeSignature;
        searchSettings = data.searchSettings || { foreign: false, local: true };

        if(includeSignatureCheckbox) includeSignatureCheckbox.checked = includeSignature;
        refDisplay.textContent=data.referenceNumber; 
        document.getElementById('challan-client-name').textContent=selectedChallanClient.name; 
        document.getElementById('challan-client-address').textContent=selectedChallanClient.address;
        selectedClientInfo.style.display='block'; clientSearchInput.value=selectedChallanClient.name;
        searchForeignCheckbox.checked = searchSettings.foreign;
        searchLocalCheckbox.checked = searchSettings.local;
        
        setupSortDropdown(); 
        renderChallanTable(); 
        renderChallanCategoryCheckboxes(data.categories); 
        updateChallanActionButtons(); 
        
        history = [];
        historyIndex = -1;
        setDirty(false);
        setTimeout(captureState, 50);
    };

    window.handleChallanSaveAs = async (newName) => {
        await handleSaveChallan(true, newName);
    };
    
    window.performReplaceInChallan = (findText, replaceText, isCaseSensitive, isBold) => {
        if (!challanItems || challanItems.length === 0) {
            showToast('No items to perform replacement on.', true);
            return;
        }

        let replacement = isBold ? `<b>${replaceText}</b>` : replaceText;
        const escapedFindText = findText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regexFlags = isCaseSensitive ? 'g' : 'gi';
        const regex = new RegExp(escapedFindText, regexFlags);
        
        let replacementsMade = 0;
        challanItems.forEach(item => {
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
            renderChallanTable();
            captureState();
            showToast(`Made replacements in ${replacementsMade} item(s).`);
        } else {
            showToast('No matches found to replace.', false);
        }
    };

    if(challanUserName) challanUserName.textContent=`Prepared by: ${currentUser.name}`;
    resetChallanState();
    loadSheetFilters();
}