// /static/offer.js
function initializeOfferModule(deps) {
    const { API_URL, currentUser, showToast, updateProjectState, saveAsModal, setDirty, getDirty, showConfirmModal } = deps;

    // --- STATE ---
    let selectedClient = null, offerItems = [], itemSearchTimeout, currentProjectId = null, currentReferenceNumber = null;
    let selectedCover = null;
    let isSummaryPageEnabled = true;
    let summaryScopeDescriptions = {};
    let includeSignature = true;
    let currentSortOrder = 'custom';
    let searchSettings = { foreign: true, local: false };
    let descriptionSearchTimeout = null;
    let activeDescriptionCell = null;
    let activeScrollListener = null;
    let activeKeydownHandler = null;
    let draggedItemIndex = null; // For drag and drop
    let offerConfig = { bdt_conversion_rate: 125, customs_duty_percentage: 0.16 };

    // --- NEW EXCEL-LIKE STATE ---
    let activeCell = { row: -1, col: -1 };
    let isEditing = false;

    let filterOptions = {};
    let activeFilters = { make: [], approvals: [], model: [], product_type: [] };


const getDefaultFinancialLabels = () => ({
        foreignPrice: 'Foreign Price',
        subtotalForeign: 'Subtotal:',
        freight: 'Freight:',
        discountForeign: 'Discount:',
        grandtotalForeign: 'Grand Total, Ex-Works (USD):',
        // START OF REVISED SECTION
        totalInBdt: 'Total in BDT:', // Renamed from grandtotalForeignBdt
        customsDuty: 'Customs Duty:',
        // END OF REVISED SECTION
        poPrice: 'PO Price',
        subtotalPO: 'Subtotal:',
        freightPO: 'Freight:',
        discountPO: 'Discount:',
        grandtotalPO: 'Grand Total (USD):',
        localPrice: 'Local Supply Price',
        subtotalLocal: 'Subtotal:',
        delivery: 'Delivery:',
        vat: 'VAT (7.5%):',
        ait: 'AIT (5%):',
        discountLocal: 'Discount:',
        grandtotalLocal: 'Grand Total (BDT):',
        installationPrice: 'Installation Price',
        subtotalInstallation: 'Subtotal:',
        discountInstallation: 'Discount:',
        grandtotalInstallation: 'Grand Total (BDT):'
    });

    let financialLabels = getDefaultFinancialLabels();

    let financials = { 
        freight_foreign_usd: 0, 
        discount_foreign_usd: 0,
        freight_po_usd: 0,
        discount_po_usd: 0,
        delivery_local_bdt: 0,
        vat_local_bdt: 0,
        ait_local_bdt: 0,
        discount_local_bdt: 0,
        discount_installation_bdt: 0,
        use_freight: false,
        use_discount_foreign: false,
        use_freight_po: false,
        use_discount_po: false,
        use_delivery: false,
        use_vat: false,
        use_ait: false,
        use_discount_local: false,
        use_discount_installation: false,
        vat_is_percentage: true,
        ait_is_percentage: true,
        vat_percentage: 7.5,
        ait_percentage: 5,
        // START OF REVISED SECTION
        use_total_in_bdt: false, // Renamed from use_grand_total_bdt
        use_customs_duty: false,
        total_in_bdt: 0, // Renamed from grandtotal_foreign_bdt
        customs_duty_bdt: 0,
        total_in_bdt_is_auto: true, // Renamed from grand_total_bdt_is_auto
        customs_duty_is_auto: true
        // END OF REVISED SECTION
    };
    let visibleColumns = {
        foreign_price: true,
        po_price: false,
        local_supply_price: false,
        installation_price: false
    };

    // --- UNDO/REDO STATE ---
    let history = [];
    let historyIndex = -1;
    let isRestoringState = false;
    let captureTimeout;

    // --- DOM ELEMENTS ---
    const newOfferBtn = document.getElementById('new-offer-btn');
    const clientSearchInput = document.getElementById('client-search-input'), clientSearchResults = document.getElementById('client-search-results'), selectedClientInfo = document.getElementById('selected-client-info');
    const itemSearchInput = document.getElementById('item-search-input'), itemSearchResults = document.getElementById('item-search-results'), itemSearchLoader = document.getElementById('item-search-loader');
    const offerTableHead = document.getElementById('offer-table-head'), offerTableBody = document.getElementById('offer-table-body'), tablePlaceholder = document.getElementById('table-placeholder');
    const offerCategoryCheckboxes = document.getElementById('offer-category-checkboxes');
    const saveProjectBtn = document.getElementById('save-project-btn'), saveAsBtn = document.getElementById('save-as-btn'), exportPdfBtn = document.getElementById('export-pdf-btn'), exportXlsxBtn = document.getElementById('export-xlsx-btn');
    const financialsSection = document.getElementById('financials-section'), offerTableActions = document.getElementById('offer-table-actions');
    const columnsToggleBtn = document.getElementById('columns-toggle-btn'), columnsDropdown = document.getElementById('columns-dropdown');
    const sortToggleBtn = document.getElementById('sort-toggle-btn'), sortDropdown = document.getElementById('sort-dropdown');
    const addCustomItemBtn = document.getElementById('add-custom-item-btn');
    const tncTextarea = document.getElementById('tnc-textarea'), tncInternationalCheckbox = document.getElementById('tnc-international'), tncLocalSupplyCheckbox = document.getElementById('tnc-local-supply'), tncLocalInstallationCheckbox = document.getElementById('tnc-local-installation');
    const offerProjectName = document.getElementById('offer-project-name');
    const coverSearchInput = document.getElementById('cover-search-input');
    const coverSearchResults = document.getElementById('cover-search-results');
    const suggestedCoversContainer = document.getElementById('suggested-covers-container');
    const coverPreviewContainer = document.getElementById('cover-preview-container');
    const selectedCoverInfo = document.getElementById('selected-cover-info');
    const selectedCoverName = document.getElementById('selected-cover-name');
    const noCoverSelected = document.getElementById('no-cover-selected');
    const removeCoverBtn = document.getElementById('remove-cover-btn');
    const coverUploadZone = document.getElementById('cover-upload-zone');
    const coverFileInput = document.getElementById('cover-file-input');
    const enableSummaryPageCheckbox = document.getElementById('enable-summary-page-checkbox');
    const financialSummaryContainer = document.getElementById('financial-summary-container');
    const includeSignatureCheckbox = document.getElementById('offer-add-signature');
    const excelFiltersContainer = document.getElementById('offer-excel-filters');
    const searchForeignCheckbox = document.getElementById('search-foreign');
    const searchLocalCheckbox = document.getElementById('search-local');
    const foreignSummaryBlock = document.getElementById('foreign-summary');
    const poSummaryBlock = document.getElementById('po-summary');
    const localSummaryBlock = document.getElementById('local-summary');
    const installationSummaryBlock = document.getElementById('installation-summary');
    const adminToolsDiv = document.getElementById('admin-offer-tools');
    const autoFillBtn = document.getElementById('admin-autofill-prices-btn');
    const adminMarkupInput = document.getElementById('admin-markup-input');

    // --- HELPER FUNCTIONS ---

    const createFilterDropdown = (filterKey, filterLabel, options) => {
        const container = document.createElement('div');
        container.className = 'filter-dropdown-container';

        const button = document.createElement('button');
        button.className = 'filter-dropdown-btn';
        button.innerHTML = `
            <span class="filter-label">${filterLabel}</span>
            <span class="filter-count-badge hidden">0</span>
            <i class="fas fa-chevron-down text-xs"></i>
        `;

        const panel = document.createElement('div');
        panel.className = 'filter-dropdown-panel hidden';
        panel.innerHTML = `
            <input type="text" class="filter-search-input" placeholder="Search options...">
            <div class="filter-options-list"></div>
        `;

        container.appendChild(button);
        container.appendChild(panel);
        excelFiltersContainer.appendChild(container);

        const optionsList = panel.querySelector('.filter-options-list');
        const searchInput = panel.querySelector('.filter-search-input');
        const badge = button.querySelector('.filter-count-badge');

        const renderOptions = (searchText = '') => {
            optionsList.innerHTML = '';
            const filteredOptions = options.filter(opt => opt.toLowerCase().includes(searchText.toLowerCase()));

            filteredOptions.forEach(option => {
                const optionEl = document.createElement('div');
                optionEl.className = 'filter-option';
                const isChecked = activeFilters[filterKey].includes(option);
                const safeOptionId = option.replace(/[^a-zA-Z0-9]/g, '-');
                optionEl.innerHTML = `
                    <input type="checkbox" id="filter-${filterKey}-${safeOptionId}" value="${option}" ${isChecked ? 'checked' : ''}>
                    <label for="filter-${filterKey}-${safeOptionId}">${option}</label>
                `;
                optionsList.appendChild(optionEl);
            });
        };

        renderOptions();

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.filter-dropdown-panel').forEach(p => {
                if (p !== panel) p.classList.add('hidden');
            });
            panel.classList.toggle('hidden');
        });

        searchInput.addEventListener('input', () => {
            const searchText = searchInput.value;
            const matchingOptions = options.filter(opt => opt.toLowerCase().includes(searchText.toLowerCase()));
            if (searchText.trim() !== '') {
                activeFilters[filterKey] = matchingOptions;
            } else {
                const checkedInputs = Array.from(optionsList.querySelectorAll('input[type="checkbox"]:checked'));
                activeFilters[filterKey] = checkedInputs.map(input => input.value);
            }
            renderOptions(searchText);
            updateBadge();
            itemSearchInput.dispatchEvent(new Event('keyup', { bubbles: true }));
        });

        // MODIFICATION: Add keydown listener for Enter key
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (searchInput.value.trim() === '') {
                    activeFilters[filterKey] = [...options]; // Select all
                    renderOptions();
                    updateBadge();
                    itemSearchInput.dispatchEvent(new Event('keyup', { bubbles: true }));
                }
                panel.classList.add('hidden');
            }
        });

        optionsList.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                const value = e.target.value;
                if (e.target.checked) {
                    if (!activeFilters[filterKey].includes(value)) {
                        activeFilters[filterKey].push(value);
                    }
                } else {
                    activeFilters[filterKey] = activeFilters[filterKey].filter(v => v !== value);
                }
                updateBadge();
                itemSearchInput.dispatchEvent(new Event('keyup', { bubbles: true }));
            }
        });

        const updateBadge = () => {
            const count = activeFilters[filterKey].length;
            badge.textContent = count;
            badge.classList.toggle('hidden', count === 0);
            button.classList.toggle('active', count > 0);
        };

        updateBadge();
    };

    const loadAndRenderProductTypeFilter = async () => {
        try {
            const res = await fetch(`${API_URL}/get_sheet_names`);
            if (!res.ok) throw new Error('Failed to load product types');
            const productTypes = await res.json();

            if (productTypes.length > 0) {
                activeFilters.product_type = [...productTypes];
                createFilterDropdown('product_type', 'Product Type', productTypes);
            }
        } catch (error) {
            console.error('Error loading product type filter:', error);
        }
    };

    const loadAndRenderFilters = async () => {
        try {
            const res = await fetch(`${API_URL}/get_filter_options`);
            if (!res.ok) throw new Error('Failed to load filter options');
            filterOptions = await res.json();

            for (const [key, options] of Object.entries(filterOptions)) {
                if (options.length > 0) {
                    createFilterDropdown(key, key.charAt(0).toUpperCase() + key.slice(1), options);
                }
            }
        } catch (error) {
            console.error('Error loading filters:', error);
            excelFiltersContainer.innerHTML += `<p class="text-xs text-red-500">Could not load filters.</p>`;
        }
    };

    const htmlToText = (html) => {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.textContent || temp.innerText || '';
    };

    const cleanupSuggestions = () => {
        const dropdown = document.getElementById('offer-description-suggestions');
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

    // --- HISTORY MANAGEMENT FUNCTIONS ---
    const captureState = () => {
        if (isRestoringState) return;

        clearTimeout(captureTimeout);
        captureTimeout = setTimeout(() => {
            const state = {
                selectedClient: JSON.parse(JSON.stringify(selectedClient)),
                offerItems: JSON.parse(JSON.stringify(offerItems)),
                financials: JSON.parse(JSON.stringify(financials)),
                financialLabels: JSON.parse(JSON.stringify(financialLabels)),
                visibleColumns: JSON.parse(JSON.stringify(visibleColumns)),
                searchSettings: JSON.parse(JSON.stringify(searchSettings)),
                selectedCover: selectedCover,
                isSummaryPageEnabled: isSummaryPageEnabled,
                summaryScopeDescriptions: JSON.parse(JSON.stringify(summaryScopeDescriptions)),
                includeSignature: includeSignature,
                tncState: {
                    international: tncInternationalCheckbox.checked,
                    local_supply: tncLocalSupplyCheckbox.checked,
                    local_installation: tncLocalInstallationCheckbox.checked,
                    value: tncTextarea.value
                },
                projectName: offerProjectName.textContent
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

        }, 250);
    };

    const updateFinancialLabelsInDOM = () => {
        for (const key in financialLabels) {
            const el = document.getElementById(`${key.replace(/([A-Z])/g, "-$1").toLowerCase()}-label`);
            if (el && el.textContent !== financialLabels[key]) {
                el.textContent = financialLabels[key];
            }
        }
    };

    const restoreState = (state) => {
        if (!state) return;
        isRestoringState = true;

        selectedClient = state.selectedClient;
        offerItems = state.offerItems;
        financials = state.financials;
        financialLabels = state.financialLabels || getDefaultFinancialLabels();
        visibleColumns = state.visibleColumns;
        searchSettings = state.searchSettings || { foreign: true, local: false };
        selectedCover = state.selectedCover;
        isSummaryPageEnabled = state.isSummaryPageEnabled;
        summaryScopeDescriptions = state.summaryScopeDescriptions || {};
        includeSignature = state.includeSignature === undefined ? true : state.includeSignature;

        if(includeSignatureCheckbox) {
            includeSignatureCheckbox.checked = includeSignature;
        }

        if(state.tncState) {
            tncInternationalCheckbox.checked = state.tncState.international;
            tncLocalSupplyCheckbox.checked = state.tncState.local_supply;
            tncLocalInstallationCheckbox.checked = state.tncState.local_installation;
            tncTextarea.value = state.tncState.value;
        }
        offerProjectName.textContent = state.projectName;

        if (selectedClient) {
            document.getElementById('client-name').textContent = selectedClient.name;
            document.getElementById('client-address').textContent = selectedClient.address;
            selectedClientInfo.style.display = 'block';
            clientSearchInput.value = selectedClient.name;
        } else {
            selectedClientInfo.style.display = 'none';
            clientSearchInput.value = '';
        }

        for (const key in financials) {
            if (key.startsWith('use_')) continue;
            const input = financialsSection.querySelector(`[data-type="${key}"]`);
            if (input) input.value = financials[key];
        }

        enableSummaryPageCheckbox.checked = isSummaryPageEnabled;
        searchForeignCheckbox.checked = searchSettings.foreign;
        searchLocalCheckbox.checked = searchSettings.local;

        updateFinancialLabelsInDOM();

        renderFinancialSummaryUI();
        setupFinancialsUI();
        renderOfferTable();
        renderSelectedCover();
        updateActionButtons();
        renderOfferCategoryCheckboxes();
        setupColumnsDropdown();
        setupSortDropdown();

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
    const checkAdminToolsVisibility = () => {
        if (!adminToolsDiv) return;
        const isAdmin = currentUser.role === 'admin';
        adminToolsDiv.classList.toggle('hidden', !isAdmin);
    };

    const updateInWordsSummary = async (usd, bdt) => {
        const wordsUsdEl = document.getElementById('summary-words-usd');
        const wordsBdtEl = document.getElementById('summary-words-bdt');

        if (!wordsUsdEl || !wordsBdtEl) return;

        try {
            const response = await fetch(`${API_URL}/convert_to_words`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usd_value: usd, bdt_value: bdt })
            });
            const result = await response.json();

            if (result.success) {
                wordsUsdEl.textContent = result.words_usd;
                wordsBdtEl.textContent = result.words_bdt;
            } else {
                wordsUsdEl.textContent = 'N/A';
                wordsBdtEl.textContent = 'N/A';
            }
        } catch (err) {
            console.error('Failed to convert numbers to words:', err);
            wordsUsdEl.textContent = 'Error';
            wordsBdtEl.textContent = 'Error';
        }
    };

    const renderFinancialSummaryUI = () => {
        if (!isSummaryPageEnabled) {
            financialSummaryContainer.style.display = 'none';
            return;
        }
        financialSummaryContainer.style.display = 'block';

        if (offerItems.length === 0) {
            financialSummaryContainer.innerHTML = '<p class="text-center text-slate-500 dark:text-slate-400 py-8">Add items to the offer to see the financial summary.</p>';
            return;
        }

        const scopes = {};
        offerItems.forEach(item => {
            const type = item.make || 'MISC';
            const foreignValue = parseFloat(item.foreign_total_usd || 0);
            const localSupplyValue = parseFloat(item.local_supply_total_bdt || 0);
            const installationValue = parseFloat(item.installation_total_bdt || 0);

            if (foreignValue > 0 && visibleColumns.foreign_price) {
                const scopeKey = `${type}-foreign`;
                if (!scopes[scopeKey]) {
                    scopes[scopeKey] = { total_usd: 0, total_bdt: 0, description: `Foreign Supply of ${type} Items` };
                }
                scopes[scopeKey].total_usd += foreignValue;
            }
            if (localSupplyValue > 0 && visibleColumns.local_supply_price) {
                const scopeKey = `${type}-localsupply`;
                if (!scopes[scopeKey]) {
                    scopes[scopeKey] = { total_usd: 0, total_bdt: 0, description: `Local Supply of ${type} Items` };
                }
                scopes[scopeKey].total_bdt += localSupplyValue;
            }
            if (installationValue > 0 && visibleColumns.installation_price) {
                const scopeKey = `${type}-installation`;
                if (!scopes[scopeKey]) {
                    scopes[scopeKey] = { total_usd: 0, total_bdt: 0, description: `Installation of ${type} Items` };
                }
                scopes[scopeKey].total_bdt += installationValue;
            }
        });

        Object.keys(scopes).forEach(key => {
            if (summaryScopeDescriptions[key]) {
                scopes[key].description = summaryScopeDescriptions[key];
            }
        });

        let sub_total_usd = 0;
        let sub_total_bdt = 0;

        const scopeOrder = ['foreign', 'localsupply', 'installation'];
        const sortedScopeKeys = Object.keys(scopes).sort((a, b) => {
            const [typeA, subTypeA] = a.split('-');
            const [typeB, subTypeB] = b.split('-');

            const indexA = scopeOrder.indexOf(subTypeA);
            const indexB = scopeOrder.indexOf(subTypeB);

            if (indexA !== indexB) {
                return indexA - indexB;
            }

            if (typeA < typeB) return -1;
            if (typeA > typeB) return 1;

            return 0;
        });

        const scopeRows = sortedScopeKeys.map((key, index) => {
            const scope = scopes[key];
            sub_total_usd += scope.total_usd;
            sub_total_bdt += scope.total_bdt;
            return `
                <tr>
                    <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-center">${String.fromCharCode(65 + index)}</td>
                    <td class="px-2 py-2 border border-slate-300 dark:border-slate-600">
                        <input type="text" value="${scope.description}" data-scopetype="${key}" class="summary-scope-desc w-full p-1 bg-transparent dark:bg-transparent rounded">
                    </td>
                    <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right font-medium">${scope.total_usd > 0 ? scope.total_usd.toLocaleString('en-US', {minimumFractionDigits: 2}) : '-'}</td>
                    <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right font-medium">${scope.total_bdt > 0 ? scope.total_bdt.toLocaleString('en-BD', {minimumFractionDigits: 2}) : '-'}</td>
                </tr>
            `;
        }).join('');

        const freight_usd = financials.use_freight && visibleColumns.foreign_price ? parseFloat(financials.freight_foreign_usd || 0) : 0;
        const discount_foreign_usd = financials.use_discount_foreign && visibleColumns.foreign_price ? parseFloat(financials.discount_foreign_usd || 0) : 0;

        const isLocalSectionVisible = visibleColumns.local_supply_price || visibleColumns.installation_price;
        const delivery_bdt = financials.use_delivery && isLocalSectionVisible ? parseFloat(financials.delivery_local_bdt || 0) : 0;
        const vat_bdt = financials.use_vat && isLocalSectionVisible ? parseFloat(financials.vat_local_bdt || 0) : 0;
        const ait_bdt = financials.use_ait && isLocalSectionVisible ? parseFloat(financials.ait_local_bdt || 0) : 0;

        const discount_local_bdt = financials.use_discount_local && visibleColumns.local_supply_price ? parseFloat(financials.discount_local_bdt || 0) : 0;
        const discount_install_bdt = financials.use_discount_installation && visibleColumns.installation_price ? parseFloat(financials.discount_installation_bdt || 0) : 0;

        const discount_bdt_total = discount_local_bdt + discount_install_bdt;
        const grand_total_usd = sub_total_usd + freight_usd - discount_foreign_usd;
        const grand_total_bdt = sub_total_bdt + delivery_bdt + vat_bdt + ait_bdt - discount_bdt_total;

        let summaryHtml = `
            <table class="w-full text-sm">
                <thead class="bg-slate-100 dark:bg-slate-700">
                    <tr>
                        <th class="px-2 py-2 border border-slate-300 dark:border-slate-600">Sl. No.</th>
                        <th class="px-2 py-2 border border-slate-300 dark:border-slate-600 w-1/2">Scope of Works</th>
                        <th class="px-2 py-2 border border-slate-300 dark:border-slate-600">Imported Items (USD)</th>
                        <th class="px-2 py-2 border border-slate-300 dark:border-slate-600">Supply, Installation (BDT)</th>
                    </tr>
                </thead>
                <tbody>
                    ${scopeRows}
                    <tr>
                        <td colspan="2" class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right font-bold">Sub-Total:</td>
                        <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right font-bold">${sub_total_usd.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                        <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right font-bold">${sub_total_bdt.toLocaleString('en-BD', {minimumFractionDigits: 2})}</td>
                    </tr>`;

        if (freight_usd > 0) {
            summaryHtml += `<tr>
                <td colspan="2" class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right">Sea Freight:</td>
                <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right">${freight_usd.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right"></td>
            </tr>`;
        }
        if (delivery_bdt > 0) {
            summaryHtml += `<tr>
                <td colspan="2" class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right">Delivery Charge:</td>
                <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right"></td>
                <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right">${delivery_bdt.toLocaleString('en-BD', {minimumFractionDigits: 2})}</td>
            </tr>`;
        }
        if (vat_bdt > 0) {
            summaryHtml += `<tr>
                <td colspan="2" class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right">VAT:</td>
                <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right"></td>
                <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right">${vat_bdt.toLocaleString('en-BD', {minimumFractionDigits: 2})}</td>
            </tr>`;
        }
        if (ait_bdt > 0) {
            summaryHtml += `<tr>
                <td colspan="2" class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right">AIT:</td>
                <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right"></td>
                <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right">${ait_bdt.toLocaleString('en-BD', {minimumFractionDigits: 2})}</td>
            </tr>`;
        }
        if (discount_foreign_usd > 0 || discount_bdt_total > 0) {
            summaryHtml += `<tr>
                <td colspan="2" class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right font-bold text-red-600">Special Discount:</td>
                <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right font-bold text-red-600">(${discount_foreign_usd.toLocaleString('en-US', {minimumFractionDigits: 2})})</td>
                <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right font-bold text-red-600">(${discount_bdt_total.toLocaleString('en-BD', {minimumFractionDigits: 2})})</td>
            </tr>`;
        }

        summaryHtml += `
                     <tr class="bg-slate-100 dark:bg-slate-700">
                        <td colspan="2" class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right font-extrabold">Grand Total:</td>
                        <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right font-extrabold">${grand_total_usd.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                        <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right font-extrabold">${grand_total_bdt.toLocaleString('en-BD', {minimumFractionDigits: 2})}</td>
                    </tr>
                    <tr class="bg-white dark:bg-slate-800">
                        <td colspan="2" class="border p-2 text-right font-bold border-slate-300 dark:border-slate-600">In Words (Foreign Part):</td>
                        <td colspan="2" id="summary-words-usd" class="border p-2 font-semibold border-slate-300 dark:border-slate-600">Loading...</td>
                    </tr>
                    <tr class="bg-slate-50 dark:bg-slate-700/50">
                        <td colspan="2" class="border p-2 text-right font-bold border-slate-300 dark:border-slate-600">In Words (Local Part):</td>
                        <td colspan="2" id="summary-words-bdt" class="border p-2 font-semibold border-slate-300 dark:border-slate-600">Loading...</td>
                    </tr>
                </tbody>
            </table>`;

        financialSummaryContainer.innerHTML = summaryHtml;
        updateInWordsSummary(grand_total_usd, grand_total_bdt);
    };

    const renderSelectedCover = () => {
        coverPreviewContainer.innerHTML = '';
        if (selectedCover) {
            coverPreviewContainer.classList.remove('hidden');
            selectedCoverInfo.classList.remove('hidden');
            noCoverSelected.classList.add('hidden');
            selectedCoverName.textContent = selectedCover;
            selectedCoverName.title = selectedCover;
            const img = document.createElement('img');
            img.src = `${API_URL}/get_cover_thumbnail/${encodeURIComponent(selectedCover)}`;
            img.alt = `Preview of ${selectedCover}`;
            img.className = 'w-full h-full object-contain rounded-lg bg-slate-200 dark:bg-slate-700';
            img.onload = () => img.classList.remove('bg-slate-200', 'dark:bg-slate-700');
            img.onerror = () => {
                coverPreviewContainer.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-red-100 dark:bg-red-900/50 rounded-lg"><p class="text-red-600 dark:text-red-300 font-semibold">Preview not available</p></div>`;
            };
            coverPreviewContainer.appendChild(img);
        } else {
            coverPreviewContainer.classList.add('hidden');
            selectedCoverInfo.classList.add('hidden');
            noCoverSelected.classList.remove('hidden');
        }
    };

    const setupColumnsDropdown = () => {
        columnsDropdown.innerHTML = '';
        columnsDropdown.innerHTML += `
            <div class="flex items-center space-x-2 p-1">
                <input type="checkbox" id="toggle-foreign_price" data-col="foreign_price" class="h-4 w-4 rounded" ${visibleColumns.foreign_price ? 'checked' : ''}>
                <label for="toggle-foreign_price" class="text-slate-700 dark:text-slate-300">Foreign Price</label>
            </div>`;
        if (currentUser.role === 'admin') {
            columnsDropdown.innerHTML += `
                <div class="flex items-center space-x-2 p-1">
                    <input type="checkbox" id="toggle-po_price" data-col="po_price" class="h-4 w-4 rounded" ${visibleColumns.po_price ? 'checked' : ''}>
                    <label for="toggle-po_price" class="text-slate-700 dark:text-slate-300">PO Price</label>
                </div>`;
        }
        columnsDropdown.innerHTML += `
            <div class="flex items-center space-x-2 p-1">
                <input type="checkbox" id="toggle-local_supply_price" data-col="local_supply_price" class="h-4 w-4 rounded" ${visibleColumns.local_supply_price ? 'checked' : ''}>
                <label for="toggle-local_supply_price" class="text-slate-700 dark:text-slate-300">Local Supply Price</label>
            </div>
            <div class="flex items-center space-x-2 p-1">
                <input type="checkbox" id="toggle-installation_price" data-col="installation_price" class="h-4 w-4 rounded" ${visibleColumns.installation_price ? 'checked' : ''}>
                <label for="toggle-installation_price" class="text-slate-700 dark:text-slate-300">Installation Price</label>
            </div>
        `;
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
                    <input type="radio" id="sort-${key}" name="sort_option" value="${key}" class="h-4 w-4 text-sky-600 focus:ring-sky-500" ${isChecked ? 'checked' : ''}>
                    <label for="sort-${key}" class="ml-2 text-sm text-slate-700 dark:text-slate-300">${value}</label>
                </div>
            `;
        }
    };

    const sortOfferItems = () => {
        const indexedItems = offerItems.map((item, index) => ({ item, originalIndex: index }));

        switch (currentSortOrder) {
            case 'category_asc':
                indexedItems.sort((a, b) => (a.item.make || '').localeCompare(b.item.make || ''));
                break;
            case 'category_desc':
                indexedItems.sort((a, b) => (b.item.make || '').localeCompare(a.item.make || ''));
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
        offerItems = indexedItems.map(i => i.item);
    };

    const updateSummaryPageCheckboxState = () => {
        const hasForeignItems = visibleColumns.foreign_price && offerItems.some(i => parseFloat(i.foreign_total_usd || 0) > 0);

        if (!hasForeignItems && offerItems.length > 0) {
            enableSummaryPageCheckbox.checked = false;
        } else {
            enableSummaryPageCheckbox.checked = true;
        }
        isSummaryPageEnabled = enableSummaryPageCheckbox.checked;
        renderFinancialSummaryUI();
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
        dropdown.id = 'offer-description-suggestions';
        dropdown.className = 'search-results-dropdown z-30';
        document.body.appendChild(dropdown);

        dropdown.innerHTML = '';
        if (items.length === 0) {
            dropdown.innerHTML = '<div class="p-2 text-center text-xs text-slate-500">No matches found</div>';
        } else {
            items.slice(0, 10).forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'search-result-item cursor-pointer p-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600 border-b border-slate-200 dark:border-slate-700 whitespace-normal';
                itemDiv.innerHTML = item.description;
                itemDiv.onclick = () => {
                    const row = targetCell.closest('tr');
                    const itemIndex = parseInt(row.dataset.itemIndex, 10);

                    const newItem = {
                        ...item,
                        qty: offerItems[itemIndex].qty || 1,
                        unit: item.unit || 'Pcs',
                        foreign_price_usd: item.source_type === 'foreign' ? item.offer_price : 0.00,
                        local_supply_price_bdt: item.source_type === 'local' ? item.offer_price : 0.00,
                        installation_price_bdt: item.installation || 0.00,
                        po_price_usd: item.po_price || 0.00,
                        isCustom: false
                    };
                    const qty = parseFloat(newItem.qty);
                    newItem.foreign_total_usd = (qty * parseFloat(newItem.foreign_price_usd)).toFixed(2);
                    newItem.local_supply_total_bdt = (qty * parseFloat(newItem.local_supply_price_bdt)).toFixed(2);
                    newItem.installation_total_bdt = (qty * parseFloat(newItem.installation_price_bdt)).toFixed(2);
                    newItem.po_total_usd = (qty * parseFloat(newItem.po_price_usd)).toFixed(2);

                    offerItems[itemIndex] = newItem;

                    cleanupSuggestions();
                    renderOfferTable();
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
                const source = searchSettings.foreign && searchSettings.local ? 'all' : searchSettings.foreign ? 'foreign' : 'local';
                const apiUrl = `${API_URL}/search_items?q=${encodeURIComponent(query)}&role=${currentUser.role}&source=${source}`;

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


    const renderOfferTable = () => {
        cleanupSuggestions();
        offerTableHead.innerHTML = '';
        offerTableBody.innerHTML = '';

        sortOfferItems();

        const hasItems = offerItems.length > 0;
        financialsSection.classList.toggle('hidden', !hasItems);
        tablePlaceholder.style.display = hasItems ? 'none' : 'block';
        offerTableActions.style.display = 'block';

        if (!hasItems) {
             renderFinancialSummaryUI();
             suggestCovers();
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
        addHeader(headerRow1, 'DESCRIPTION', { rowSpan: 2, className: 'w-1/3' });
        addHeader(headerRow1, 'QTY', { rowSpan: 2 });
        addHeader(headerRow1, 'UNIT', { rowSpan: 2 });

        const priceHeaders = [
            { title: 'FOREIGN PRICE', currency: 'USD', key: 'foreign_price', price_key: 'foreign_price_usd', total_key: 'foreign_total_usd', is_visible: visibleColumns.foreign_price },
            { title: 'PO PRICE', currency: 'USD', key: 'po_price', price_key: 'po_price_usd', total_key: 'po_total_usd', is_visible: currentUser.role === 'admin' && visibleColumns.po_price},
            { title: 'LOCAL SUPPLY PRICE', currency: 'BDT', key: 'local_supply_price', price_key: 'local_supply_price_bdt', total_key: 'local_supply_total_bdt', is_visible: visibleColumns.local_supply_price},
            { title: 'INSTALLATION PRICE', currency: 'BDT', key: 'installation_price', price_key: 'installation_price_bdt', total_key: 'installation_total_bdt', is_visible: visibleColumns.installation_price }
        ];

        priceHeaders.forEach(h => {
            if(!h.is_visible) return;
            addHeader(headerRow1, h.title, { colSpan: 2, className: `${h.key}-col text-center` });
            addHeader(headerRow2, `PRICE (${h.currency})`, { className: `${h.key}-col` });
            addHeader(headerRow2, `TOTAL (${h.currency})`, { className: `${h.key}-col` });
        });

        addHeader(headerRow1, 'CATEGORY', { rowSpan: 2, className: 'text-center w-[10%]' });
        addHeader(headerRow1, 'Action', { rowSpan: 2 });
        offerTableHead.appendChild(headerRow1);
        offerTableHead.appendChild(headerRow2);

        offerItems.forEach((item, index) => {
            const row = document.createElement('tr');
            row.dataset.itemIndex = index;

            let rowClasses = "border-t border-slate-200 dark:border-slate-700";
            if (item.source_type !== 'foreign' && currentSortOrder !== 'source_foreign') {
                rowClasses += " bg-slate-100 dark:bg-slate-700/50";
            }
            if (item.source_type === 'foreign' && currentSortOrder === 'source_foreign') {
                 rowClasses += " bg-blue-50 dark:bg-blue-900/20";
            }
            row.className = rowClasses;

            let rowHTML = `
                <td class="px-2 py-2 text-center border border-slate-300 dark:border-slate-600 cursor-grab move-handle" draggable="true"><i class="fas fa-grip-vertical text-slate-400 pointer-events-none"></i></td>
                <td class="px-2 py-2 text-center border border-slate-300 dark:border-slate-600">${index + 1}</td>
                <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 preserve-lines" contenteditable="true" data-field="description">${item.description || ''}</td>
                <td class="px-2 py-2 border border-slate-300 dark:border-slate-600"><input type="number" class="w-16 p-1 bg-transparent dark:bg-transparent rounded text-right" min="1" value="${item.qty || 1}" data-field="qty"></td>
                <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-center" contenteditable="true" data-field="unit">${item.unit || 'Pcs'}</td>`;

            priceHeaders.forEach(h => {
                if(h.is_visible) {
                    const unitPrice = parseFloat(item[h.price_key] || 0);
                    const totalValue = parseFloat(item[h.total_key] || 0);
                    const locale = h.currency === 'USD' ? 'en-US' : 'en-BD';
                    const formattedTotal = totalValue.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    const formattedUnitPrice = unitPrice.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                    const isModifiedPrice = typeof item.isCustom === 'object' && item.isCustom !== null && item.isCustom[h.price_key];
                    let priceCellClass = '';
                    let showSaveBtn = false;

                    if (isModifiedPrice) {
                        priceCellClass = 'text-red-500 font-bold';
                    }

                    if (isModifiedPrice && h.key === 'installation_price' && currentUser.role === 'admin' && unitPrice > 0 && item.item_code) {
                        showSaveBtn = true;
                    }

                    const saveBtnHtml = showSaveBtn
                        ? `<button class="save-price-to-master-btn text-xs text-green-500 hover:text-green-700 p-0.5 ml-1" title="Save this price to master list"
                                   data-item-code="${item.item_code}"
                                   data-price-type="${h.key}"
                                   data-price-value="${unitPrice.toFixed(2)}"
                                   data-description="${htmlToText(item.description)}"
                                   data-unit="${item.unit || 'Pcs'}"
                                   data-product-type="${item.make || 'MISC'}"
                                   data-source-type="${item.source_type || 'local'}"
                           ><i class="fas fa-save"></i></button>`
                        : '';

                    rowHTML += `
                        <td class="${h.key}-col px-2 py-2 border border-slate-300 dark:border-slate-600 text-right ${priceCellClass}" contenteditable="true" data-field="${h.price_key}">${formattedUnitPrice}${saveBtnHtml}</td>
                        <td class="${h.key}-col px-2 py-2 font-semibold border border-slate-300 dark:border-slate-600 text-right" data-field="${h.total_key}">${formattedTotal}</td>`;
                }
            });

            rowHTML += `
                <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 align-middle">
                    <select data-field="make" class="w-full p-1 bg-transparent dark:bg-slate-700 rounded border-slate-300 dark:border-slate-600 focus:ring-sky-500 text-center">
                        <option value="FDS" ${item.make === 'FDS' ? 'selected' : ''}>FDS</option>
                        <option value="FPS" ${item.make === 'FPS' ? 'selected' : ''}>FPS</option>
                        <option value="FD" ${item.make === 'FD' ? 'selected' : ''}>FD</option>
                        <option value="FC" ${item.make === 'FC' ? 'selected' : ''}>FC</option>
                        <option value="MISC" ${item.make === 'MISC' ? 'selected' : ''}>MISC</option>
                    </select>
                </td>
                <td class="text-center px-2 py-2 border border-slate-300 dark:border-slate-600 space-x-1">
                    <button class="add-row-after-btn text-slate-400 hover:text-green-500 p-1" title="Add Row After"><i class="fas fa-plus-circle"></i></button>
                    <button class="remove-item-btn text-slate-400 hover:text-red-500 p-1" title="Remove Item"><i class="fas fa-trash"></i></button>
                </td>`;
            row.innerHTML = rowHTML;
            offerTableBody.appendChild(row);
        });
        updateFinancialSummary();
        renderFinancialSummaryUI();
        checkAdminToolsVisibility();
    };

    const renderOfferCategoryCheckboxes = (savedCategories = null) => {
        const allCategories = ['FDS', 'FPS', 'FD', 'FC'];
        const categoriesToRender = savedCategories !== null ? savedCategories : [...new Set(offerItems.map(item => item.make))];
        if (offerCategoryCheckboxes) {
            offerCategoryCheckboxes.innerHTML = allCategories.map(cat => {
                const checked = categoriesToRender.includes(cat) ? 'checked' : '';
                return `<div class="flex items-center"><input id="cat-${cat}" type="checkbox" value="${cat}" name="category" class="h-4 w-4 text-sky-600 border-slate-300 dark:border-slate-600 rounded focus:ring-sky-500 bg-slate-100 dark:bg-slate-900" ${checked}><label for="cat-${cat}" class="ml-3 block text-sm text-slate-700 dark:text-slate-300">${cat}</label></div>`;
            }).join('');
        }
    };

    const updateFinancialSummary = () => {
        foreignSummaryBlock.style.display = visibleColumns.foreign_price ? 'block' : 'none';
        poSummaryBlock.style.display = visibleColumns.po_price ? 'block' : 'none';
        localSummaryBlock.style.display = visibleColumns.local_supply_price ? 'block' : 'none';
        installationSummaryBlock.style.display = visibleColumns.installation_price ? 'block' : 'none';

        const hasFreight = financials.use_freight && parseFloat(financials.freight_foreign_usd || 0) > 0 && visibleColumns.foreign_price;

        if (hasFreight) {
            financialLabels.subtotalForeign = 'Subtotal, Ex-Works:';
            financialLabels.grandtotalForeign = 'Grand Total, CFR, Chattogram (USD):';
        } else {
            financialLabels.subtotalForeign = 'Subtotal:';
            financialLabels.grandtotalForeign = 'Grand Total, Ex-Works (USD):';
        }
        updateFinancialLabelsInDOM();

        const subtotal_foreign = offerItems.reduce((acc, item) => acc + parseFloat(item.foreign_total_usd || 0), 0);
        const subtotal_po = offerItems.reduce((acc, item) => acc + parseFloat(item.po_total_usd || 0), 0);
        const subtotal_local = offerItems.reduce((acc, item) => acc + parseFloat(item.local_supply_total_bdt || 0), 0);
        const subtotal_installation = offerItems.reduce((acc, item) => acc + parseFloat(item.installation_total_bdt || 0), 0);

        const freight = financials.use_freight ? parseFloat(financials.freight_foreign_usd || 0) : 0;
        const freight_po = financials.use_freight_po ? parseFloat(financials.freight_po_usd || 0) : 0;
        const delivery = financials.use_delivery ? parseFloat(financials.delivery_local_bdt || 0) : 0;

        if (financials.use_vat && financials.vat_is_percentage) {
            financials.vat_local_bdt = (subtotal_local * (financials.vat_percentage / 100)).toFixed(2);
            const vatInput = document.querySelector('input[data-type="vat_local_bdt"]');
            if (vatInput) vatInput.value = financials.vat_local_bdt;
        }
        const vat = financials.use_vat ? parseFloat(financials.vat_local_bdt || 0) : 0;

        if (financials.use_ait && financials.ait_is_percentage) {
            financials.ait_local_bdt = (subtotal_local * (financials.ait_percentage / 100)).toFixed(2);
            const aitInput = document.querySelector('input[data-type="ait_local_bdt"]');
            if (aitInput) aitInput.value = financials.ait_local_bdt;
        }
        const ait = financials.use_ait ? parseFloat(financials.ait_local_bdt || 0) : 0;

        const discount_foreign = financials.use_discount_foreign ? parseFloat(financials.discount_foreign_usd || 0) : 0;
        const discount_po = financials.use_discount_po ? parseFloat(financials.discount_po_usd || 0) : 0;
        const discount_local = financials.use_discount_local ? parseFloat(financials.discount_local_bdt || 0) : 0;
        const discount_installation = financials.use_discount_installation ? parseFloat(financials.discount_installation_bdt || 0) : 0;

        const grandtotal_foreign = subtotal_foreign + freight - discount_foreign;
        const grandtotal_po = subtotal_po + freight_po - discount_po;
        const grandtotal_local = subtotal_local + delivery + vat + ait - discount_local;
        const grandtotal_installation = subtotal_installation - discount_installation;

        document.getElementById('subtotal-foreign').textContent = subtotal_foreign.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('subtotal-po').textContent = subtotal_po.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('subtotal-local').textContent = subtotal_local.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('subtotal-installation').textContent = subtotal_installation.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        document.getElementById('grandtotal-foreign').textContent = grandtotal_foreign.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('grandtotal-po').textContent = grandtotal_po.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('grandtotal-local').textContent = grandtotal_local.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('grandtotal-installation').textContent = grandtotal_installation.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        // START OF CORRECTED SECTION
        if (financials.use_total_in_bdt && financials.total_in_bdt_is_auto) {
            financials.total_in_bdt = (grandtotal_foreign * offerConfig.bdt_conversion_rate);
        }
    
        const total_in_bdt_val = financials.use_total_in_bdt ? parseFloat(financials.total_in_bdt || 0) : 0;
    
        if (financials.use_customs_duty && financials.customs_duty_is_auto && total_in_bdt_val > 0) {
            // CHANGED LINE: The percentage value is now correctly divided by 100.
            const raw_duty = total_in_bdt_val * (offerConfig.customs_duty_percentage / 100);
            // The rounding logic (round up to the nearest 100) is now applied correctly.
            financials.customs_duty_bdt = Math.ceil(raw_duty / 100) * 100;
        }
        
        const customs_duty_val = financials.use_customs_duty ? parseFloat(financials.customs_duty_bdt || 0) : 0;
    
        const totalInBdtInput = document.querySelector('input[data-type="total_in_bdt"]');
        if (totalInBdtInput) totalInBdtInput.value = total_in_bdt_val.toFixed(2);
    
        // CORRECTED SELECTOR: Target the input specifically
        const customsDutyInput = document.querySelector('input[data-type="customs_duty_bdt"]');
        if (customsDutyInput) customsDutyInput.value = customs_duty_val.toFixed(2);

        const grandTotalBdtWrapper = document.getElementById('foreign-grand-total-bdt-wrapper');
        if (grandTotalBdtWrapper) {
            if (financials.use_total_in_bdt || financials.use_customs_duty) {
                const final_grand_total_bdt = total_in_bdt_val + customs_duty_val;
                document.getElementById('foreign-grand-total-bdt-value').textContent = final_grand_total_bdt.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                grandTotalBdtWrapper.classList.remove('hidden');
            } else {
                grandTotalBdtWrapper.classList.add('hidden');
            }
        }
        // END OF CORRECTED SECTION

        renderFinancialSummaryUI();
    };

    const resetOfferState = () => {
        selectedClient = null; offerItems = []; currentProjectId = null; currentReferenceNumber = null; selectedCover = null;
        isSummaryPageEnabled = true;
        summaryScopeDescriptions = {};
        includeSignature = true;
        financialLabels = getDefaultFinancialLabels();
        searchSettings = { foreign: true, local: false };

        currentSortOrder = 'custom';

        financials = {
            freight_foreign_usd: 0,
            discount_foreign_usd: 0,
            freight_po_usd: 0,
            discount_po_usd: 0,
            delivery_local_bdt: 0,
            vat_local_bdt: 0,
            ait_local_bdt: 0,
            discount_local_bdt: 0,
            discount_installation_bdt: 0,
            use_freight: false,
            use_discount_foreign: false,
            use_freight_po: false,
            use_discount_po: false,
            use_delivery: false,
            use_vat: false,
            use_ait: false,
            use_discount_local: false,
            use_discount_installation: false,
            vat_is_percentage: true,
            ait_is_percentage: true,
            vat_percentage: 7.5,
            ait_percentage: 5,
            // START OF CORRECTED SECTION
            use_total_in_bdt: false,
            use_customs_duty: false,
            total_in_bdt: 0,
            customs_duty_bdt: 0,
            total_in_bdt_is_auto: true,
            customs_duty_is_auto: true
            // END OF CORRECTED SECTION
        };
        setupFinancialsUI();
        updateFinancialSummary();

        visibleColumns = {
            foreign_price: true,
            po_price: false,
            local_supply_price: false,
            installation_price: false
        };
        clientSearchInput.value = ''; itemSearchInput.value = ''; selectedClientInfo.style.display = 'none';
        if (offerProjectName) offerProjectName.textContent = 'New Financial Offer';
        tncTextarea.value = '';
        tncInternationalCheckbox.checked = false;
        tncLocalSupplyCheckbox.checked = false;
        tncLocalInstallationCheckbox.checked = false;

        if(includeSignatureCheckbox) {
            includeSignatureCheckbox.checked = true;
        }

        enableSummaryPageCheckbox.checked = isSummaryPageEnabled;
        searchForeignCheckbox.checked = searchSettings.foreign;
        searchLocalCheckbox.checked = searchSettings.local;

        updateFinancialLabelsInDOM();
        renderOfferTable(); updateActionButtons();
        renderOfferCategoryCheckboxes();
        renderSelectedCover(); suggestCovers();
        setupColumnsDropdown();
        setupSortDropdown();
        renderFinancialSummaryUI();

        history = [];
        historyIndex = -1;
        setDirty(false);
        setTimeout(() => captureState(), 50);
    };

    const updateActionButtons = () => {
        const disabled = offerItems.length === 0 || !selectedClient;
        exportPdfBtn.disabled = disabled; exportXlsxBtn.disabled = disabled; saveProjectBtn.disabled = disabled; saveAsBtn.disabled = disabled;
    };

    const fetchAndDisplayCovers = async (searchTerm = '') => {
        try {
            const res = await fetch(`${API_URL}/get_covers?q=${encodeURIComponent(searchTerm)}`);
            if (!res.ok) throw new Error('Failed to fetch covers from server.');
            const covers = await res.json();

            coverSearchResults.innerHTML = '';
            if (covers.length > 0) {
                 covers.forEach(cover => {
                    const div = document.createElement('div');
                    div.textContent = cover;
                    div.className = 'search-result-item cursor-pointer p-2 hover:bg-slate-100 dark:hover:bg-slate-600';
                    div.onclick = () => {
                        selectedCover = cover;
                        renderSelectedCover();
                        coverSearchResults.classList.add('hidden');
                        coverSearchInput.value = '';
                        captureState();
                    };
                    coverSearchResults.appendChild(div);
                });
                coverSearchResults.classList.remove('hidden');
            } else {
                coverSearchResults.classList.add('hidden');
            }
        } catch (err) {
            console.error('Failed to fetch covers:', err);
            showToast(err.message, true);
        }
    };

    const suggestCovers = async () => {
        if (!selectedClient) {
            suggestedCoversContainer.innerHTML = '<p class="text-slate-500 col-span-full">Select a client to see suggestions.</p>';
            return;
        }

        const clientNameParts = selectedClient.name.toLowerCase().split(' ').filter(p => p.length > 2);
        const categories = [...new Set(offerItems.map(item => item.make))].map(c => c.toLowerCase());

        try {
            const res = await fetch(`${API_URL}/get_covers`);
            if (!res.ok) throw new Error('Failed to fetch suggestions.');
            const allCovers = await res.json();

            const suggestions = allCovers.filter(cover => {
                const lowerCover = cover.toLowerCase();
                const clientMatch = clientNameParts.some(part => lowerCover.includes(part));
                const categoryMatch = categories.some(cat => lowerCover.includes(cat));
                return clientMatch || categoryMatch;
            }).slice(0, 4);

            suggestedCoversContainer.innerHTML = '';
            if (suggestions.length > 0) {
                suggestions.forEach(cover => {
                    const button = document.createElement('button');
                    button.textContent = cover;
                    button.className = 'p-2 border rounded-md text-left text-sm hover:bg-sky-100 dark:hover:bg-sky-900 truncate';
                    button.title = cover;
                    button.onclick = () => {
                        selectedCover = cover;
                        renderSelectedCover();
                        captureState();
                    };
                    suggestedCoversContainer.appendChild(button);
                });
            } else {
                suggestedCoversContainer.innerHTML = '<p class="text-slate-500 col-span-full">No specific suggestions found.</p>';
            }
        } catch (err) {
            console.error("Failed to suggest covers:", err);
            showToast(err.message, true);
        }
    };

    const handleCoverUpload = async (file) => {
        if (!file || file.type !== 'application/pdf') {
            showToast('Please upload a valid PDF file.', true);
            return;
        }

        let refForUpload = currentReferenceNumber;
        if (!refForUpload) {
            if (!selectedClient) {
                showToast('Please select a client before uploading a cover.', true);
                return;
            }
            try {
                const checkedCategories = Array.from(document.querySelectorAll('#offer-category-checkboxes input:checked')).map(cb => cb.value);
                refForUpload = NameController.generateOfferReference({
                    clientName: selectedClient.name,
                    categories: checkedCategories,
                    items: offerItems,
                    visibleColumns: visibleColumns
                });
                currentReferenceNumber = refForUpload;
                offerProjectName.textContent = refForUpload;
                showToast(`Generated project reference: ${refForUpload}`, false);
            } catch (err) {
                showToast(err.message, true);
                return;
            }
        }

        const formData = new FormData();
        formData.append('cover_pdf', file);
        formData.append('referenceNumber', refForUpload);

        showToast('Uploading custom cover...', false);

        try {
            const res = await fetch(`${API_URL}/upload_cover`, {
                method: 'POST',
                body: formData,
            });
            const result = await res.json();

            if (result.success) {
                showToast('Custom cover uploaded successfully.', false);
                selectedCover = result.savedFilename;
                renderSelectedCover();
                suggestCovers();
                captureState();
            } else {
                showToast(`Upload failed: ${result.message}`, true);
            }
        } catch (err) {
            showToast(`An error occurred during upload: ${err.message}`, true);
        } finally {
            coverFileInput.value = '';
        }
    };

    const handleSaveOffer = async (isSaveAs = false, newName = null) => {
        const button = isSaveAs ? saveAsBtn : saveProjectBtn;
        button.innerHTML = `<div class="loader !w-4 !h-4 !border-2"></div><span class="ml-2">Saving...</span>`;
        button.disabled = true;

        try {
            let refToSave = currentReferenceNumber;
            let idToSave = isSaveAs ? null : currentProjectId;
            const checkedCategories = Array.from(document.querySelectorAll('#offer-category-checkboxes input:checked')).map(cb => cb.value);

            if (isSaveAs && newName) {
                refToSave = newName;
            } else if (!idToSave && !refToSave) {
                refToSave = NameController.generateOfferReference({
                    clientName: selectedClient.name,
                    categories: checkedCategories,
                    items: offerItems,
                    visibleColumns: visibleColumns
                });
            } else if (!idToSave && currentReferenceNumber) {
                refToSave = currentReferenceNumber;
            }

            const payload = {
                projectId: idToSave, referenceNumber: refToSave, client: selectedClient,
                items: offerItems, financials,
                financialLabels,
                user: currentUser, projectType: 'offer',
                selected_cover: selectedCover,
                visibleColumns,
                searchSettings,
                isSummaryPageEnabled,
                summaryScopeDescriptions,
                includeSignature: includeSignature,
                categories: checkedCategories,
                tncState: {
                    international: tncInternationalCheckbox.checked,
                    local_supply: tncLocalSupplyCheckbox.checked,
                    local_installation: tncLocalInstallationCheckbox.checked,
                    value: tncTextarea.value
                }
            };
            const response = await fetch(`${API_URL}/project`, {
                method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.success) {
                currentProjectId = result.projectId;
                currentReferenceNumber = result.referenceNumber;
                updateProjectState({ projectId: currentProjectId, referenceNumber: currentReferenceNumber });
                offerProjectName.textContent = currentReferenceNumber;
                showToast(`Project saved with reference: ${currentReferenceNumber}`);
                setDirty(false);
            } else { showToast(`Error saving project: ${result.message}`, true); }
        } catch (err) { showToast(`An error occurred: ${err.message}`, true); }
        finally { button.innerHTML = isSaveAs ? '<i class="fa-solid fa-copy"></i> Save As' : '<i class="fa-solid fa-save"></i> Save'; updateActionButtons(); }
    };

    const handleExport = async (fileType) => {
        const button = fileType === 'xlsx' ? exportXlsxBtn : exportPdfBtn;
        button.innerHTML = `<div class="loader !w-4 !h-4 !border-2"></div><span class="ml-2">Generating...</span>`;
        button.disabled = true;

        try {
            const checkedCategories = Array.from(document.querySelectorAll('#offer-category-checkboxes input:checked')).map(cb => cb.value);
            const termsAndConditions = tncTextarea.value;
            let refForExport = currentReferenceNumber;

            if (!refForExport) {
                refForExport = NameController.generateOfferReference({
                    clientName: selectedClient.name,
                    categories: checkedCategories,
                    items: offerItems,
                    visibleColumns: visibleColumns
                });
                currentReferenceNumber = refForExport;
                offerProjectName.textContent = refForExport;
            }

            const filename = NameController.generateOfferFilename({
                referenceNumber: refForExport,
                fileType: fileType
            });

            const summaryScopes = {};
            offerItems.forEach(item => {
                const type = item.make || 'MISC';
                const foreignValue = parseFloat(item.foreign_total_usd || 0);
                const localSupplyValue = parseFloat(item.local_supply_total_bdt || 0);
                const installationValue = parseFloat(item.installation_total_bdt || 0);

                if (foreignValue > 0) {
                    const scopeKey = `${type}-foreign`;
                    if (!summaryScopes[scopeKey]) {
                        summaryScopes[scopeKey] = { total_usd: 0, total_bdt: 0, description: summaryScopeDescriptions[scopeKey] || `Foreign Supply of ${type} Items` };
                    }
                    summaryScopes[scopeKey].total_usd += foreignValue;
                }
                if (localSupplyValue > 0) {
                    const scopeKey = `${type}-localsupply`;
                    if (!summaryScopes[scopeKey]) {
                        summaryScopes[scopeKey] = { total_usd: 0, total_bdt: 0, description: summaryScopeDescriptions[scopeKey] || `Local Supply of ${type} Items` };
                    }
                    summaryScopes[scopeKey].total_bdt += localSupplyValue;
                }
                if (installationValue > 0) {
                    const scopeKey = `${type}-installation`;
                    if (!summaryScopes[scopeKey]) {
                        summaryScopes[scopeKey] = { total_usd: 0, total_bdt: 0, description: summaryScopeDescriptions[scopeKey] || `Installation of ${type} Items` };
                    }
                    summaryScopes[scopeKey].total_bdt += installationValue;
                }
            });

            const payload = {
                items: offerItems, client: selectedClient, financials, referenceNumber: refForExport,
                user: currentUser, categories: checkedCategories, terms_and_conditions: termsAndConditions,
                selected_cover: selectedCover,
                visibleColumns,
                isSummaryPageEnabled,
                summaryScopes,
                includeSignature: includeSignature,
                filename: filename,
                financialLabels
            };

            const exportRes = await fetch(`${API_URL}/export_${fileType}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            if (!exportRes.ok) throw new Error(`Server error: ${exportRes.statusText}`);

            const blob = await exportRes.blob();
            const a = document.createElement('a');
            a.href = window.URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(a.href);
        } catch (err) { console.error(`Export failed: ${err.message}`); showToast(`Failed to generate ${fileType} file: ${err.message}`, true); }
        finally { button.innerHTML = fileType === 'pdf' ? '<i class="fa-solid fa-file-pdf"></i> PDF' : '<i class="fa-solid fa-file-excel"></i> Excel'; updateActionButtons(); }
    };

    const updateTncTextarea = async () => {
        let tncParts = [];
        tncTextarea.value = "Loading...";

        try {
            if (tncInternationalCheckbox.checked) {
                const res = await fetch(`${API_URL}/get_tnc/international`);
                tncParts.push((await res.json()).terms);
            }
            if (tncLocalSupplyCheckbox.checked) {
                const resSupply = await fetch(`${API_URL}/get_tnc/local_supply`);
                tncParts.push((await resSupply.json()).terms);
            }
            if (tncLocalInstallationCheckbox.checked) {
                const resInstall = await fetch(`${API_URL}/get_tnc/local_installation`);
                tncParts.push((await resInstall.json()).terms);
            }
            tncTextarea.value = tncParts.join('\n\n');
        } catch (err) {
            tncTextarea.value = `Error loading terms: ${err.message}`;
        } finally {
            captureState();
        }
    };

    // --- EVENT LISTENERS ---

    const applyCustomMarkup = () => {
        if (currentUser.role !== 'admin' || !adminMarkupInput) return;

        const markupPercent = parseFloat(adminMarkupInput.value);

        if (isNaN(markupPercent) || markupPercent < 0) {
            return;
        }

        const markupFactor = 1 + (markupPercent / 100);

        offerItems.forEach(item => {
            const poPrice = parseFloat(item.po_price_usd || 0);

            if (poPrice > 0) {
                item.foreign_price_usd = (poPrice * markupFactor).toFixed(2);

                if (typeof item.isCustom !== 'object' || item.isCustom === null) {
                    item.isCustom = {};
                }
                item.isCustom['foreign_price_usd'] = true;

                const qty = parseFloat(item.qty || 1);
                item.foreign_total_usd = (qty * parseFloat(item.foreign_price_usd)).toFixed(2);
            }
        });

        renderOfferTable();
        captureState();
    };

    if (offerProjectName) {
        offerProjectName.addEventListener('blur', async () => {
            const newName = offerProjectName.textContent.trim();
            if (currentProjectId && newName && newName !== currentReferenceNumber) {
                const confirmed = await showConfirmModal(
                    `Are you sure you want to rename this project to "<strong>${newName}</strong>"?`,
                    "Rename Project",
                    "bg-sky-600 hover:bg-sky-700",
                    "Confirm Rename"
                );

                if (confirmed) {
                    try {
                        const res = await fetch(`${API_URL}/project/reference/${currentProjectId}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ referenceNumber: newName, user: currentUser })
                        });
                        const result = await res.json();
                        if (result.success) {
                            currentReferenceNumber = newName;
                            updateProjectState({ projectId: currentProjectId, referenceNumber: currentReferenceNumber });
                            showToast('Project renamed successfully.');
                            setDirty(false); // Renaming should mark as saved
                        } else {
                            showToast(`Error renaming project: ${result.message}`, true);
                            offerProjectName.textContent = currentReferenceNumber; // Revert on failure
                        }
                    } catch (err) {
                        showToast(`An error occurred: ${err.message}`, true);
                        offerProjectName.textContent = currentReferenceNumber; // Revert on failure
                    }
                } else {
                    offerProjectName.textContent = currentReferenceNumber; // Revert if user cancels
                }
            }
        });

        offerProjectName.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.target.blur(); // Trigger the blur event to save
            }
        });
    }

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

    enableSummaryPageCheckbox.addEventListener('change', (e) => {
        isSummaryPageEnabled = e.target.checked;
        renderFinancialSummaryUI();
        captureState();
    });

    if(includeSignatureCheckbox) {
        includeSignatureCheckbox.addEventListener('change', (e) => {
            includeSignature = e.target.checked;
            captureState();
        });
    }

    financialSummaryContainer.addEventListener('input', (e) => {
        if (e.target.classList.contains('summary-scope-desc')) {
            const scopeType = e.target.dataset.scopetype;
            summaryScopeDescriptions[scopeType] = e.target.value;
            captureState();
        }
    });

    if (newOfferBtn) {
        newOfferBtn.addEventListener('click', async () => {
            if (getDirty()) {
                const confirmed = await showConfirmModal(
                    "You have unsaved changes that will be lost. Are you sure you want to start a new offer?",
                    "Unsaved Changes",
                    "bg-amber-600 hover:bg-amber-700",
                    "Start New Offer"
                );
                if (!confirmed) {
                    return;
                }
            }
            resetOfferState();
        });
    }

    if (selectedClientInfo) {
        selectedClientInfo.addEventListener('input', (e) => {
            if (!selectedClient) {
                selectedClient = { name: '', address: '' };
            }
            if (e.target.id === 'client-name') {
                selectedClient.name = e.target.textContent;
            } else if (e.target.id === 'client-address') {
                selectedClient.address = e.target.textContent;
            }
            captureState();
        });
    }

    createSearchHandler({
        searchInput: coverSearchInput,
        resultsContainer: coverSearchResults,
        apiEndpoint: `${API_URL}/get_covers`,
        buildQuery: (query) => `q=${encodeURIComponent(query)}`,
        renderResults: (covers, onSelect) => {
            const fragment = document.createDocumentFragment();
            covers.forEach(cover => {
                const div = document.createElement('div');
                div.textContent = cover;
                div.className = 'search-result-item cursor-pointer p-2 hover:bg-slate-100 dark:hover:bg-slate-600';
                div.onclick = () => onSelect(cover);
                fragment.appendChild(div);
            });
            return fragment;
        },
        onResultSelected: (cover) => {
            selectedCover = cover;
            renderSelectedCover();
            coverSearchInput.value = '';
            captureState();
        }
    });

    window.addEventListener('click', (e) => {
        if (!columnsDropdown.classList.contains('hidden') && !columnsToggleBtn.contains(e.target) && !columnsDropdown.contains(e.target)) {
            columnsDropdown.classList.add('hidden');
        }
        if (!sortDropdown.classList.contains('hidden') && !sortToggleBtn.contains(e.target) && !sortDropdown.contains(e.target)) {
            sortDropdown.classList.add('hidden');
        }
        if (activeDescriptionCell && !activeDescriptionCell.contains(e.target)) {
            const dropdown = document.getElementById('offer-description-suggestions');
            if(dropdown && !dropdown.contains(e.target)) {
                cleanupSuggestions();
            }
         }
        if (!e.target.closest('.filter-dropdown-container')) {
            document.querySelectorAll('.filter-dropdown-panel').forEach(p => p.classList.add('hidden'));
        }
    });

    if(addCustomItemBtn) {
        addCustomItemBtn.addEventListener('click', () => {
            if (!visibleColumns.local_supply_price) {
                visibleColumns.local_supply_price = true;
                setupColumnsDropdown();
            }
            const newItem = {
                customId: `custom_${Date.now()}`,
                description: '',
                qty: 1,
                unit: 'Pcs',
                foreign_price_usd: '0.00',
                foreign_total_usd: '0.00',
                local_supply_price_bdt: '0.00',
                local_supply_total_bdt: '0.00',
                installation_price_bdt: '0.00',
                installation_total_bdt: '0.00',
                isCustom: {},
                source_type: 'local',
                make: 'FPS'
            };
            offerItems.push(newItem);

            if (!tncLocalSupplyCheckbox.checked) {
                tncLocalSupplyCheckbox.checked = true;
                tncLocalSupplyCheckbox.dispatchEvent(new Event('change'));
            }

            renderOfferTable();
            updateActionButtons();
            captureState();

            const newRow = offerTableBody.querySelector(`tr[data-item-index="${offerItems.length - 1}"]`);
            if (newRow) {
                const descCell = newRow.querySelector('[data-field="description"]');
                if (descCell) {
                    descCell.focus();
                }
            }
        });
    }

    financialsSection.addEventListener('paste', e => {
        if (e.target.matches('input[type="number"], [contenteditable=true]')) {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text');
            const sanitizedText = text.replace(/[^0-9.]/g, '');

            if (e.target.isContentEditable) {
                document.execCommand('insertText', false, sanitizedText);
            } else {
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
        }
    });

    financialsSection.addEventListener('input', (e) => {
        const target = e.target;
        if (target.classList.contains('financial-input')) {
            const type = target.dataset.type;
            financials[type] = target.value;
            // START OF REVISED SECTION
            if (type === 'vat_local_bdt') {
                financials.vat_is_percentage = false;
            }
            if (type === 'ait_local_bdt') {
                financials.ait_is_percentage = false;
            }
            if (type === 'total_in_bdt') {
                financials.total_in_bdt_is_auto = false;
            }
            if (type === 'customs_duty_bdt') {
                financials.customs_duty_is_auto = false;
            }
            // END OF REVISED SECTION
            updateFinancialSummary();
            captureState();
        }
        if (target.isContentEditable && target.dataset.labelKey) {
            const key = target.dataset.labelKey;
            financialLabels[key] = target.textContent;
            captureState();
        }
    });

    const setupFinancialsUI = () => {
        const allToggles = [
            { useKey: 'use_freight', type: 'freight' },
            { useKey: 'use_discount_foreign', type: 'discount_foreign' },
            { useKey: 'use_freight_po', type: 'freight_po' },
            { useKey: 'use_discount_po', type: 'discount_po' },
            { useKey: 'use_delivery', type: 'delivery' },
            { useKey: 'use_vat', type: 'vat' },
            { useKey: 'use_ait', type: 'ait' },
            { useKey: 'use_discount_local', type: 'discount_local' },
            { useKey: 'use_discount_installation', type: 'discount_installation' },
            { useKey: 'use_total_in_bdt', type: 'total_in_bdt' },
            { useKey: 'use_customs_duty', type: 'customs_duty' }
        ];

        allToggles.forEach(({ useKey, type }) => {
            const addBtn = financialsSection.querySelector(`.add-charge-btn[data-type="${type}"]`);
            if (!addBtn) return;
            const removeBtn = financialsSection.querySelector(`.remove-charge-btn[data-type="${type}"]`);
            const valueDisplay = addBtn.closest('.flex').querySelector('.financial-input, .financial-value');

            const isVisible = financials[useKey];

            if (valueDisplay) valueDisplay.classList.toggle('hidden', !isVisible);
            if (removeBtn) removeBtn.classList.toggle('hidden', !isVisible);
            addBtn.classList.toggle('hidden', isVisible);
        });
        updateFinancialSummary();
    };

    financialsSection.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if(!button) return;

        const type = button.dataset.type;
        if (!type) return;

        let stateChanged = false;

        if(button.classList.contains('add-charge-btn')) {
            financials[`use_${type}`] = true;
            if (type === 'vat') financials.vat_is_percentage = true;
            if (type === 'ait') financials.ait_is_percentage = true;
            // START OF CORRECTION
            if (type === 'total_in_bdt') financials.total_in_bdt_is_auto = true;
            if (type === 'customs_duty') financials.customs_duty_is_auto = true;
            // END OF CORRECTION
            stateChanged = true;
        } else if(button.classList.contains('remove-charge-btn')) {
            financials[`use_${type}`] = false;

            const input = button.closest('.flex').querySelector('.financial-input');
            if (input) {
                const valueKey = input.dataset.type;
                financials[valueKey] = 0;
                input.value = 0;
            }
            // START OF CORRECTION
            if (type === 'total_in_bdt') financials.total_in_bdt_is_auto = true;
            if (type === 'customs_duty') financials.customs_duty_is_auto = true;
            // END OF CORRECTION
            stateChanged = true;
        }

        if(stateChanged) {
            setupFinancialsUI();
            captureState();
        }
    });

    if (coverUploadZone) {
        coverUploadZone.addEventListener('dragover', (e) => {
            e.preventDefault(); e.stopPropagation();
            coverUploadZone.classList.add('bg-sky-50', 'dark:bg-sky-900/50', 'border-sky-500');
        });
        coverUploadZone.addEventListener('dragleave', (e) => {
            e.preventDefault(); e.stopPropagation();
            coverUploadZone.classList.remove('bg-sky-50', 'dark:bg-sky-900/50', 'border-sky-500');
        });
        coverUploadZone.addEventListener('drop', (e) => {
            e.preventDefault(); e.stopPropagation();
            coverUploadZone.classList.remove('bg-sky-50', 'dark:bg-sky-900/50', 'border-sky-500');
            const files = e.dataTransfer.files;
            if (files.length > 0) handleCoverUpload(files[0]);
        });
    }

    if (coverFileInput) {
        coverFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleCoverUpload(e.target.files[0]);
        });
    }

    coverSearchInput.addEventListener('keyup', (e) => {
        if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) return;
        fetchAndDisplayCovers(e.target.value);
    });

    removeCoverBtn.addEventListener('click', () => {
        selectedCover = null;
        renderSelectedCover();
        captureState();
    });

    createSearchHandler({
        searchInput: clientSearchInput, resultsContainer: clientSearchResults, apiEndpoint: `${API_URL}/search_clients`,
        buildQuery: (query) => `q=${encodeURIComponent(query)}`,
        renderResults: renderClientResults,
        onResultSelected: (client) => {
            selectedClient = { name: client.client_name, address: client.client_address };
            document.getElementById('client-name').textContent = selectedClient.name;
            document.getElementById('client-address').textContent = selectedClient.address;
            selectedClientInfo.style.display = 'block';
            clientSearchInput.value = selectedClient.name;
            updateActionButtons();
            suggestCovers();
            captureState();
        }
    });

    createSearchHandler({
        searchInput: itemSearchInput, resultsContainer: itemSearchResults, loaderElement: itemSearchLoader, apiEndpoint: `${API_URL}/search_items`, currentUser, minQueryLength: 0,
        buildQuery: (query) => {
            let url = `q=${encodeURIComponent(query)}&role=${currentUser.role}&source=${searchSettings.foreign && searchSettings.local ? 'all' : searchSettings.foreign ? 'foreign' : 'local'}`;
            for (const [key, values] of Object.entries(activeFilters)) {
                if (values.length > 0) {
                    url += `&${key}=${encodeURIComponent(values.join(','))}`;
                }
            }
            return url;
        },
        renderResults: renderItemResults,
        onResultSelected: (item) => {
            const newItem = {
                ...item, qty: 1, unit: item.unit || 'Pcs',
                foreign_price_usd: item.source_type === 'foreign' ? item.offer_price : 0.00,
                local_supply_price_bdt: item.source_type === 'local' ? item.offer_price : 0.00,
                installation_price_bdt: item.installation || 0.00,
                po_price_usd: item.po_price || 0.00,
                isCustom: false,
                make: item.product_type // Set the category from the product_type
            };
            newItem.foreign_total_usd = (newItem.qty * parseFloat(newItem.foreign_price_usd)).toFixed(2);
            newItem.local_supply_total_bdt = (newItem.qty * parseFloat(newItem.local_supply_price_bdt)).toFixed(2);
            newItem.installation_total_bdt = (newItem.qty * parseFloat(newItem.installation_price_bdt)).toFixed(2);
            newItem.po_total_usd = (newItem.qty * parseFloat(newItem.po_price_usd)).toFixed(2);

            if (newItem.source_type === 'local' && !visibleColumns.local_supply_price) {
                visibleColumns.local_supply_price = true;
                setupColumnsDropdown();
            }

            offerItems.push(newItem);

            if (newItem.source_type === 'foreign' && !tncInternationalCheckbox.checked) {
                tncInternationalCheckbox.checked = true;
                tncInternationalCheckbox.dispatchEvent(new Event('change'));
            } else if (newItem.source_type === 'local' && !tncLocalSupplyCheckbox.checked) {
                tncLocalSupplyCheckbox.checked = true;
                tncLocalSupplyCheckbox.dispatchEvent(new Event('change'));
            }

            currentSortOrder = 'custom';
            setupSortDropdown();
            renderOfferTable();
            renderOfferCategoryCheckboxes();
            updateActionButtons();
            itemSearchInput.focus();
            captureState();
        }
    });

    searchForeignCheckbox.addEventListener('change', (e) => {
        searchSettings.foreign = e.target.checked;
        itemSearchInput.dispatchEvent(new Event('keyup', { bubbles:true }));
        captureState();
    });
    searchLocalCheckbox.addEventListener('change', (e) => {
        searchSettings.local = e.target.checked;
        itemSearchInput.dispatchEvent(new Event('keyup', { bubbles:true }));
        captureState();
    });

    offerTableBody.addEventListener('paste', e => {
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

    offerTableBody.addEventListener('input', (e) => {
        const target = e.target;
        const row = target.closest('tr'); if (!row) return;
        const itemIndex = parseInt(row.dataset.itemIndex, 10);
        const item = offerItems[itemIndex]; if (!item) return;

        const field = target.dataset.field;
        if (field) {
            if (field === 'description') {
                handleDescriptionInput(e);
                item[field] = target.innerHTML;
            } else {
                const rawValue = target.matches('[contenteditable]') ? target.textContent : target.value;
                if (field.includes('price')) {
                    item[field] = rawValue.replace(/,/g, '');
                } else {
                    item[field] = rawValue;
                }

                if (field.includes('price')) {
                    if (typeof item.isCustom !== 'object' || item.isCustom === null) {
                        item.isCustom = {};
                    }
                    item.isCustom[field] = true;
                }
            }

            const qty = parseFloat(item.qty || 1);
            item.foreign_total_usd = (qty * parseFloat(item.foreign_price_usd || 0)).toFixed(2);
            item.local_supply_total_bdt = (qty * parseFloat(item.local_supply_price_bdt || 0)).toFixed(2);
            item.installation_total_bdt = (qty * parseFloat(item.installation_price_bdt || 0)).toFixed(2);
            item.po_total_usd = (qty * parseFloat(item.po_price_usd || 0)).toFixed(2);

            const updateTotalCell = (totalField, value, currency) => {
                const cell = row.querySelector(`[data-field="${totalField}"]`);
                if (cell) cell.textContent = parseFloat(value).toLocaleString(currency === 'USD' ? 'en-US' : 'en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            };
            updateTotalCell('foreign_total_usd', item.foreign_total_usd, 'USD');
            updateTotalCell('local_supply_total_bdt', item.local_supply_total_bdt, 'BDT');
            updateTotalCell('installation_total_bdt', item.installation_total_bdt, 'BDT');
            updateTotalCell('po_total_usd', item.po_total_usd, 'USD');

            if(field.includes('price')) {
                const mainScroller = document.querySelector('main');
                const scrollPos = mainScroller.scrollTop;

                let selection = window.getSelection();
                let cursorPosition = 0;
                if (selection.rangeCount > 0) {
                    let range = selection.getRangeAt(0);
                    cursorPosition = range.startOffset;
                }

                renderOfferTable();

                mainScroller.scrollTo({ top: scrollPos, behavior: 'instant' });
                const newRow = offerTableBody.querySelector(`tr[data-item-index="${itemIndex}"]`);
                if (newRow) {
                    const newTarget = newRow.querySelector(`[data-field="${field}"]`);
                    if (newTarget) {
                        newTarget.focus();
                        try {
                            let newRange = document.createRange();
                            let newSelection = window.getSelection();
                            if (newTarget.childNodes.length > 0) {
                                let newCursorPosition = Math.min(cursorPosition, newTarget.childNodes[0].length);
                                newRange.setStart(newTarget.childNodes[0], newCursorPosition);
                                newRange.collapse(true);
                                newSelection.removeAllRanges();
                                newSelection.addRange(newRange);
                            }
                        } catch (err) {
                            console.warn("Could not restore cursor position.", err);
                        }
                    }
                }
            }

            updateFinancialSummary();
            if(field === 'make') {
                renderFinancialSummaryUI();
            }
            captureState();
        }
    });

    offerTableBody.addEventListener('click', async (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        const row = button.closest('tr');
        if (!row) return;

        const itemIndex = parseInt(row.dataset.itemIndex, 10);

        if (button.classList.contains('save-price-to-master-btn')) {
            if (currentUser.role !== 'admin') return;
            const itemData = { ...button.dataset };
            const confirmed = await showConfirmModal(
                `Are you sure you want to update the master price for <strong>${itemData.itemCode || 'this custom item'}</strong>?<br>New Price: <strong>${itemData.priceValue}</strong>`,
                'Update Master Price List',
                'bg-green-600 hover:bg-green-700',
                'Confirm Update'
            );
            if (!confirmed) return;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            try {
                const response = await fetch(`${API_URL}/update_master_price`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...itemData, adminEmail: currentUser.email })
                });
                const result = await response.json();
                showToast(result.message, !result.success);
                if (result.success) {
                    if (typeof offerItems[itemIndex].isCustom === 'object') {
                        delete offerItems[itemIndex].isCustom[itemData.priceType + '_bdt'];
                    }
                    renderOfferTable();
                    captureState();
                } else {
                     button.innerHTML = '<i class="fas fa-save"></i>';
                }
            } catch (err) {
                showToast(`An error occurred: ${err.message}`, true);
                button.innerHTML = '<i class="fas fa-save"></i>';
            }
        } else if (button.classList.contains('remove-item-btn')) {
            offerItems.splice(itemIndex, 1);
        } else if (button.classList.contains('add-row-after-btn')) {
            const newItem = {
                customId: `custom_${Date.now()}`, description: '', qty: 1, unit: 'Pcs',
                foreign_price_usd: '0.00', foreign_total_usd: '0.00',
                local_supply_price_bdt: '0.00', local_supply_total_bdt: '0.00',
                installation_price_bdt: '0.00', installation_total_bdt: '0.00',
                isCustom: {}, source_type: 'local', make: 'MISC'
            };
            offerItems.splice(itemIndex + 1, 0, newItem);
        }

        if (!button.classList.contains('save-price-to-master-btn')) {
            renderOfferTable();
            renderOfferCategoryCheckboxes();
            updateActionButtons();
            captureState();
        }
    });

    // Drag and Drop Listeners
    offerTableBody.addEventListener('dragstart', (e) => {
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

    offerTableBody.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    offerTableBody.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetRow = e.target.closest('tr');
        if (targetRow && draggedItemIndex !== null) {
            const targetIndex = parseInt(targetRow.dataset.itemIndex, 10);
            const draggedItem = offerItems.splice(draggedItemIndex, 1)[0];
            offerItems.splice(targetIndex, 0, draggedItem);
            currentSortOrder = 'custom';
            setupSortDropdown();
            renderOfferTable();
            captureState();
        }
    });

    offerTableBody.addEventListener('dragend', (e) => {
        const draggedRow = offerTableBody.querySelector('.bg-yellow-200');
        if (draggedRow) {
            draggedRow.classList.remove('bg-yellow-200', 'dark:bg-yellow-800/50');
        }
        draggedItemIndex = null;
    });


    if (autoFillBtn) {
        autoFillBtn.addEventListener('click', async () => {
            const confirmed = await showConfirmModal(
                'This will scan the master price lists and attempt to fill in any missing price values. This can take a moment and will trigger a data re-initialization. Continue?',
                'Auto-fill Master Prices',
                'bg-red-600 hover:bg-red-700',
                'Proceed'
            );
            if (!confirmed) return;

            autoFillBtn.disabled = true;
            autoFillBtn.innerHTML = `<div class="loader !w-4 !h-4 !border-2"></div><span class="ml-2">Processing...</span>`;

            try {
                const response = await fetch(`${API_URL}/autofill_master_prices`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ adminEmail: currentUser.email })
                });
                const result = await response.json();
                showToast(result.message, !result.success);
            } catch (err) {
                showToast(`An error occurred: ${err.message}`, true);
            } finally {
                autoFillBtn.disabled = false;
                autoFillBtn.innerHTML = '<i class="fas fa-magic"></i> Auto-fill Missing Prices';
            }
        });
    }

    if (adminMarkupInput) {
        adminMarkupInput.addEventListener('input', () => {
            // Debounce to avoid re-calculating on every keystroke
            clearTimeout(itemSearchTimeout); // Re-using an existing timeout variable for debouncing
            itemSearchTimeout = setTimeout(applyCustomMarkup, 300);
        });
    }

    saveAsBtn.addEventListener('click', () => {
        if (saveAsBtn.disabled) return;

        let suggestedName = '';
        if (currentReferenceNumber) {
            const versionMatch = currentReferenceNumber.match(/(V)(\d+)$/);
            if (versionMatch) {
                const newVersion = parseInt(versionMatch[2], 10) + 1;
                suggestedName = currentReferenceNumber.replace(/(V)(\d+)$/, `V${newVersion}`);
            } else {
                suggestedName = `${currentReferenceNumber}V2`;
            }
        } else {
            const checkedCategories = Array.from(document.querySelectorAll('#offer-category-checkboxes input:checked')).map(cb => cb.value);
            suggestedName = NameController.generateOfferReference({
                clientName: selectedClient.name,
                categories: checkedCategories,
                items: offerItems,
                visibleColumns: visibleColumns
            });
        }

        document.getElementById('save-as-type').value = 'offer';
        document.getElementById('save-as-name').value = suggestedName;
        saveAsModal.classList.remove('hidden');
    });

    saveProjectBtn.addEventListener('click', () => {
        if (saveProjectBtn.disabled) return;
        if (!currentProjectId) {
            saveAsBtn.click();
        } else {
            handleSaveOffer(false);
        }
    });

    exportPdfBtn.addEventListener('click', () => handleExport('pdf'));
    exportXlsxBtn.addEventListener('click', () => handleExport('xlsx'));

    tncInternationalCheckbox.addEventListener('change', updateTncTextarea);
    tncLocalSupplyCheckbox.addEventListener('change', updateTncTextarea);
    tncLocalInstallationCheckbox.addEventListener('change', updateTncTextarea);

    columnsToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        columnsDropdown.classList.toggle('hidden');
    });
    columnsDropdown.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            const col = e.target.dataset.col;
            const isChecked = e.target.checked;
            visibleColumns[col] = isChecked;

            const syncTncCheckbox = (tncCheckbox, shouldBeChecked) => {
                if (shouldBeChecked && !tncCheckbox.checked) {
                    tncCheckbox.checked = true;
                    tncCheckbox.dispatchEvent(new Event('change'));
                } else if (!shouldBeChecked && tncCheckbox.checked) {
                    tncCheckbox.checked = false;
                    tncCheckbox.dispatchEvent(new Event('change'));
                }
            };

            if (col === 'foreign_price') syncTncCheckbox(tncInternationalCheckbox, isChecked);
            else if (col === 'local_supply_price') syncTncCheckbox(tncLocalSupplyCheckbox, isChecked);
            else if (col === 'installation_price') syncTncCheckbox(tncLocalInstallationCheckbox, isChecked);
            renderOfferTable();
            captureState();
        }
    });

    sortToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sortDropdown.classList.toggle('hidden');
    });

    sortDropdown.addEventListener('change', (e) => {
        if (e.target.name === 'sort_option') {
            currentSortOrder = e.target.value;
            renderOfferTable();
            sortDropdown.classList.add('hidden');
        }
    });

    window.addItemsToOffer = (itemsToAdd) => {
        if (!itemsToAdd || itemsToAdd.length === 0) return;
        itemsToAdd.forEach(item => {
            const newItem = { ...item };
            const qty = parseFloat(newItem.qty || 1);
            newItem.foreign_total_usd = (qty * parseFloat(newItem.foreign_price_usd || 0)).toFixed(2);
            newItem.local_supply_total_bdt = (qty * parseFloat(newItem.local_supply_price_bdt || 0)).toFixed(2);
            newItem.installation_total_bdt = (qty * parseFloat(newItem.installation_price_bdt || 0)).toFixed(2);
            newItem.po_total_usd = (qty * parseFloat(newItem.po_price_usd || 0)).toFixed(2);
            newItem.isCustom = false;

            if (newItem.source_type === 'foreign' && parseFloat(newItem.foreign_price_usd) > 0 && !tncInternationalCheckbox.checked) {
                tncInternationalCheckbox.checked = true;
                tncInternationalCheckbox.dispatchEvent(new Event('change'));
            } else if (newItem.source_type === 'local' && parseFloat(newItem.local_supply_price_bdt) > 0 && !tncLocalSupplyCheckbox.checked) {
                tncLocalSupplyCheckbox.checked = true;
                tncLocalSupplyCheckbox.dispatchEvent(new Event('change'));
            }
            if (newItem.source_type === 'local' && !visibleColumns.local_supply_price) visibleColumns.local_supply_price = true;
            if (parseFloat(newItem.installation_price_bdt) > 0 && !visibleColumns.installation_price) visibleColumns.installation_price = true;
            offerItems.push(newItem);
        });
        setupColumnsDropdown();
        renderOfferTable(); renderOfferCategoryCheckboxes(); updateActionButtons(); captureState();
    };

    window.handleOfferSaveAs = async (newName) => {
        await handleSaveOffer(true, newName);
    };

    window.loadOfferData = (projectData) => {
        currentProjectId = projectData.projectId;
        currentReferenceNumber = projectData.referenceNumber;
        updateProjectState(projectData);
        selectedClient = projectData.client;
        offerItems = projectData.items;

        const defaultFinancials = {
            freight_foreign_usd: 0,
            discount_foreign_usd: 0,
            freight_po_usd: 0,
            discount_po_usd: 0,
            delivery_local_bdt: 0,
            vat_local_bdt: 0,
            ait_local_bdt: 0,
            discount_local_bdt: 0,
            discount_installation_bdt: 0,
            use_freight: false,
            use_discount_foreign: false,
            use_freight_po: false,
            use_discount_po: false,
            use_delivery: false,
            use_vat: false,
            use_ait: false,
            use_discount_local: false,
            use_discount_installation: false,
            vat_is_percentage: true,
            ait_is_percentage: true,
            vat_percentage: 7.5,
            ait_percentage: 5,
            use_total_in_bdt: false,
            use_customs_duty: false
        };
        financials = { ...defaultFinancials, ...(projectData.financials || {}) };

        for (const key in financials) {
            if (key.startsWith('use_')) continue;
            const input = financialsSection.querySelector(`.financial-input[data-type="${key}"]`);
            if (input) {
                input.value = financials[key] || 0;
            }
        }

        financialLabels = projectData.financialLabels || getDefaultFinancialLabels();
        searchSettings = projectData.searchSettings || { foreign: true, local: false };
        selectedCover = projectData.selected_cover || null;
        isSummaryPageEnabled = projectData.isSummaryPageEnabled === undefined ? true : projectData.isSummaryPageEnabled;
        summaryScopeDescriptions = projectData.summaryScopeDescriptions || {};
        includeSignature = projectData.includeSignature === undefined ? true : projectData.includeSignature;

        if (includeSignatureCheckbox) {
            includeSignatureCheckbox.checked = includeSignature;
        }

        const loadedCols = projectData.visibleColumns || {};
        visibleColumns.foreign_price = loadedCols.foreign_price === undefined ? true : loadedCols.foreign_price;
        visibleColumns.po_price = !!loadedCols.po_price;
        visibleColumns.local_supply_price = !!loadedCols.local_supply_price;
        visibleColumns.installation_price = !!loadedCols.installation_price;

        if(projectData.tncState) {
            tncInternationalCheckbox.checked = projectData.tncState.international;
            tncLocalSupplyCheckbox.checked = projectData.tncState.local_supply;
            tncLocalInstallationCheckbox.checked = projectData.tncState.local_installation;
            tncTextarea.value = projectData.tncState.value;
        }

        offerProjectName.textContent = projectData.referenceNumber;
        document.getElementById('client-name').textContent = selectedClient.name;
        document.getElementById('client-address').textContent = selectedClient.address;
        selectedClientInfo.style.display = 'block';
        clientSearchInput.value = selectedClient.name;
        searchForeignCheckbox.checked = searchSettings.foreign;
        searchLocalCheckbox.checked = searchSettings.local;

        updateFinancialLabelsInDOM();
        setupFinancialsUI();
        enableSummaryPageCheckbox.checked = isSummaryPageEnabled;
        renderFinancialSummaryUI();
        setupColumnsDropdown();
        setupSortDropdown();
        renderOfferTable();
        updateActionButtons();
        renderOfferCategoryCheckboxes(projectData.categories);
        renderSelectedCover();
        suggestCovers();

        history = [];
        historyIndex = -1;
        setDirty(false);
        setTimeout(() => captureState(), 50);
    };

    window.performReplaceInOffer = (findText, replaceText, isCaseSensitive, isBold) => {
        if (!offerItems || offerItems.length === 0) {
            showToast('No items to perform replacement on.', true);
            return;
        }

        let replacement = isBold ? `<b>${replaceText}</b>` : replaceText;
        const escapedFindText = findText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regexFlags = isCaseSensitive ? 'g' : 'gi';
        const regex = new RegExp(escapedFindText, regexFlags);

        let replacementsMade = 0;
        offerItems.forEach(item => {
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
            renderOfferTable();
            captureState();
            showToast(`Made replacements in ${replacementsMade} item(s).`);
        } else {
            showToast('No matches found to replace.', false);
        }
    };

    const fetchOfferConfig = async () => {
        try {
            const res = await fetch(`${API_URL}/get_offer_config`);
            const result = await res.json();
            if (result.success) {
                offerConfig = {
                    bdt_conversion_rate: result.bdt_conversion_rate,
                    customs_duty_percentage: result.customs_duty_percentage
                };
            }
        } catch (error) {
            console.error('Failed to fetch offer config:', error);
            showToast('Could not load server configuration, using defaults.', true);
        }
    };

    if (adminToolsDiv) {
        adminToolsDiv.classList.add('hidden');
    }

    setupColumnsDropdown();
    setupSortDropdown();
    resetOfferState();
    loadAndRenderFilters();
    loadAndRenderProductTypeFilter();
    fetchOfferConfig();
}