// /static/offer_ui_controller.js

function initializeOfferModule(deps) {
    const { API_URL, currentUser, showToast, saveAsModal, getDirty, showConfirmModal, updateProjectState, setDirty } = deps;

    // --- MANAGER INITIALIZATION ---
    const offerManager = createOfferManager(deps);

    // --- DOM ELEMENTS ---
    const newOfferBtn = document.getElementById('new-offer-btn'),
        clientSearchInput = document.getElementById('client-search-input'), clientSearchResults = document.getElementById('client-search-results'),
        selectedClientInfo = document.getElementById('selected-client-info'),
        itemSearchInput = document.getElementById('item-search-input'), itemSearchResults = document.getElementById('item-search-results'),
        itemSearchLoader = document.getElementById('item-search-loader'),
        offerTableHead = document.getElementById('offer-table-head'), offerTableBody = document.getElementById('offer-table-body'),
        tablePlaceholder = document.getElementById('table-placeholder'),
        offerCategoryCheckboxes = document.getElementById('offer-category-checkboxes'),
        saveProjectBtn = document.getElementById('save-project-btn'), saveAsBtn = document.getElementById('save-as-btn'),
        exportPdfBtn = document.getElementById('export-pdf-btn'), exportXlsxBtn = document.getElementById('export-xlsx-btn'),
        financialsSection = document.getElementById('financials-section'), offerTableActions = document.getElementById('offer-table-actions'),
        columnsToggleBtn = document.getElementById('columns-toggle-btn'), columnsDropdown = document.getElementById('columns-dropdown'),
        sortToggleBtn = document.getElementById('sort-toggle-btn'), sortDropdown = document.getElementById('sort-dropdown'),
        addCustomItemBtn = document.getElementById('add-custom-item-btn'),
        tncTextarea = document.getElementById('tnc-textarea'), tncInternationalCheckbox = document.getElementById('tnc-international'),
        tncLocalSupplyCheckbox = document.getElementById('tnc-local-supply'), tncLocalInstallationCheckbox = document.getElementById('tnc-local-installation'),
        offerProjectName = document.getElementById('offer-project-name'),
        coverSearchInput = document.getElementById('cover-search-input'), coverSearchResults = document.getElementById('cover-search-results'),
        suggestedCoversContainer = document.getElementById('suggested-covers-container'),
        coverPreviewContainer = document.getElementById('cover-preview-container'), selectedCoverInfo = document.getElementById('selected-cover-info'),
        selectedCoverName = document.getElementById('selected-cover-name'), noCoverSelected = document.getElementById('no-cover-selected'),
        removeCoverBtn = document.getElementById('remove-cover-btn'), coverUploadZone = document.getElementById('cover-upload-zone'),
        coverFileInput = document.getElementById('cover-file-input'), enableSummaryPageCheckbox = document.getElementById('enable-summary-page-checkbox'),
        financialSummaryContainer = document.getElementById('financial-summary-container'),
        includeSignatureCheckbox = document.getElementById('offer-add-signature'),
        excelFiltersContainer = document.getElementById('offer-excel-filters'),
        searchForeignCheckbox = document.getElementById('search-foreign'), searchLocalCheckbox = document.getElementById('search-local'),
        foreignSummaryBlock = document.getElementById('foreign-summary'), poSummaryBlock = document.getElementById('po-summary'),
        localSummaryBlock = document.getElementById('local-summary'), installationSummaryBlock = document.getElementById('installation-summary'),
        adminToolsDiv = document.getElementById('admin-offer-tools'), autoFillBtn = document.getElementById('admin-autofill-prices-btn'),
        adminMarkupInput = document.getElementById('admin-markup-input');

    // --- UI STATE & UTILS ---
    let descriptionSearchTimeout = null, activeDescriptionCell = null, activeScrollListener = null, activeKeydownHandler = null, draggedItemIndex = null;
    let filterOptions = {}, activeFilters = { make: [], approvals: [], model: [], product_type: [] };

    const htmlToText = (html) => {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.textContent || temp.innerText || '';
    };

    const cleanupSuggestions = () => {
        const dropdown = document.getElementById('offer-description-suggestions');
        if (dropdown) dropdown.remove();
        const mainScroller = document.querySelector('main');
        if (mainScroller && activeScrollListener) mainScroller.removeEventListener('scroll', activeScrollListener);
        if (activeDescriptionCell && activeKeydownHandler) activeDescriptionCell.removeEventListener('keydown', activeKeydownHandler);
        activeDescriptionCell = null;
        activeScrollListener = null;
        activeKeydownHandler = null;
    };

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
    
    // --- RENDER FUNCTIONS (ALL READ FROM STATE) ---
    const renderAllUI = (state) => {
        if (!state) return; // Prevent rendering if state is null (e.g., from failed undo)
        renderClientInfo(state.selectedClient);
        renderOfferTable(state);
        renderGlobalUIState(state);
        renderSelectedCover(state.selectedCover);
        renderTnc(state.tncState);
        suggestCovers(state.selectedClient, state.offerItems);
    };

    const renderClientInfo = (client) => {
        if (client) {
            document.getElementById('client-name').textContent = client.name;
            document.getElementById('client-address').textContent = client.address;
            selectedClientInfo.style.display = 'block';
            clientSearchInput.value = client.name;
        } else {
            selectedClientInfo.style.display = 'none';
            clientSearchInput.value = '';
        }
    };
    
    const renderOfferTable = (state) => {
        const { offerItems, visibleColumns, currentSortOrder } = state;
        cleanupSuggestions();
        offerTableHead.innerHTML = '';
        offerTableBody.innerHTML = '';

        const hasItems = offerItems.length > 0;
        financialsSection.classList.toggle('hidden', !hasItems);
        tablePlaceholder.style.display = hasItems ? 'none' : 'block';
        offerTableActions.style.display = 'block';

        if (!hasItems) {
            updateFinancialsUI(state);
            suggestCovers(state.selectedClient, state.offerItems);
            return;
        }

        const headerRow1 = document.createElement('tr');
        const headerRow2 = document.createElement('tr');
        const addHeader = (row, text, opts = {}) => {
            const th = document.createElement('th');
            th.innerHTML = text;
            th.className = `px-2 py-2 border border-slate-300 dark:border-slate-600 text-center align-middle ${opts.className || ''}`;
            if (opts.rowSpan) th.rowSpan = opts.rowSpan;
            if (opts.colSpan) th.colSpan = opts.colSpan;
            row.appendChild(th);
        };

        addHeader(headerRow1, '<i class="fas fa-grip-vertical text-slate-400"></i>', { rowSpan: 2 });
        addHeader(headerRow1, 'SL NO', { rowSpan: 2 });
        addHeader(headerRow1, 'DESCRIPTION', { rowSpan: 2, className: 'w-1/3' });
        addHeader(headerRow1, 'QTY', { rowSpan: 2 });
        addHeader(headerRow1, 'UNIT', { rowSpan: 2 });

        const priceHeaders = [
            { title: 'FOREIGN PRICE', currency: 'USD', key: 'foreign_price', price_key: 'foreign_price_usd', total_key: 'foreign_total_usd', is_visible: visibleColumns.foreign_price },
            { title: 'PO PRICE', currency: 'USD', key: 'po_price', price_key: 'po_price_usd', total_key: 'po_total_usd', is_visible: currentUser.role === 'admin' && visibleColumns.po_price },
            { title: 'LOCAL SUPPLY PRICE', currency: 'BDT', key: 'local_supply_price', price_key: 'local_supply_price_bdt', total_key: 'local_supply_total_bdt', is_visible: visibleColumns.local_supply_price },
            { title: 'INSTALLATION PRICE', currency: 'BDT', key: 'installation_price', price_key: 'installation_price_bdt', total_key: 'installation_total_bdt', is_visible: visibleColumns.installation_price }
        ];

        priceHeaders.forEach(h => {
            if (!h.is_visible) return;
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
                if (h.is_visible) {
                    const unitPrice = parseFloat(item[h.price_key] || 0);
                    const totalValue = parseFloat(item[h.total_key] || 0);
                    const locale = h.currency === 'USD' ? 'en-US' : 'en-BD';
                    const formattedTotal = totalValue.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    const formattedUnitPrice = unitPrice.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                    const isModifiedPrice = typeof item.isCustom === 'object' && item.isCustom !== null && item.isCustom[h.price_key];
                    let priceCellClass = isModifiedPrice ? 'text-red-500 font-bold' : '';

                    const showSaveBtn = isModifiedPrice && h.key === 'installation_price' && currentUser.role === 'admin' && unitPrice > 0 && item.item_code;
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
        updateFinancialsUI(state);
    };

    const updateFinancialsUI = (state) => {
        const { offerItems, visibleColumns, financials, financialLabels, offerConfig } = state;

        foreignSummaryBlock.style.display = visibleColumns.foreign_price ? 'block' : 'none';
        poSummaryBlock.style.display = visibleColumns.po_price ? 'block' : 'none';
        localSummaryBlock.style.display = visibleColumns.local_supply_price ? 'block' : 'none';
        installationSummaryBlock.style.display = visibleColumns.installation_price ? 'block' : 'none';

        let tempFinancials = JSON.parse(JSON.stringify(financials));
        let tempLabels = JSON.parse(JSON.stringify(financialLabels));

        const hasFreight = tempFinancials.use_freight && parseFloat(tempFinancials.freight_foreign_usd || 0) > 0 && visibleColumns.foreign_price;

        if (hasFreight) {
            tempLabels.subtotalForeign = 'Subtotal, Ex-Works:';
            tempLabels.grandtotalForeign = 'Grand Total, CFR, Chattogram (USD):';
        } else {
            tempLabels.subtotalForeign = 'Subtotal:';
            tempLabels.grandtotalForeign = 'Grand Total, Ex-Works (USD):';
        }

        const subtotal_foreign = offerItems.reduce((acc, item) => acc + parseFloat(item.foreign_total_usd || 0), 0);
        const subtotal_po = offerItems.reduce((acc, item) => acc + parseFloat(item.po_total_usd || 0), 0);
        const subtotal_local = offerItems.reduce((acc, item) => acc + parseFloat(item.local_supply_total_bdt || 0), 0);
        const subtotal_installation = offerItems.reduce((acc, item) => acc + parseFloat(item.installation_total_bdt || 0), 0);

        const freight = tempFinancials.use_freight ? parseFloat(tempFinancials.freight_foreign_usd || 0) : 0;
        const freight_po = tempFinancials.use_freight_po ? parseFloat(tempFinancials.freight_po_usd || 0) : 0;
        const delivery = tempFinancials.use_delivery ? parseFloat(tempFinancials.delivery_local_bdt || 0) : 0;

        if (tempFinancials.use_vat && tempFinancials.vat_is_percentage) {
            tempFinancials.vat_local_bdt = (subtotal_local * (tempFinancials.vat_percentage / 100)).toFixed(2);
        }
        const vat = tempFinancials.use_vat ? parseFloat(tempFinancials.vat_local_bdt || 0) : 0;

        if (tempFinancials.use_ait && tempFinancials.ait_is_percentage) {
            tempFinancials.ait_local_bdt = (subtotal_local * (tempFinancials.ait_percentage / 100)).toFixed(2);
        }
        const ait = tempFinancials.use_ait ? parseFloat(tempFinancials.ait_local_bdt || 0) : 0;

        const discount_foreign = tempFinancials.use_discount_foreign ? parseFloat(tempFinancials.discount_foreign_usd || 0) : 0;
        const discount_po = tempFinancials.use_discount_po ? parseFloat(tempFinancials.discount_po_usd || 0) : 0;
        const discount_local = tempFinancials.use_discount_local ? parseFloat(tempFinancials.discount_local_bdt || 0) : 0;
        const discount_installation = tempFinancials.use_discount_installation ? parseFloat(tempFinancials.discount_installation_bdt || 0) : 0;

        const grandtotal_foreign = subtotal_foreign + freight - discount_foreign;
        const grandtotal_po = subtotal_po + freight_po - discount_po;
        const grandtotal_local = subtotal_local + delivery + vat + ait - discount_local;
        const grandtotal_installation = subtotal_installation - discount_installation;

        if (tempFinancials.use_total_in_bdt && tempFinancials.total_in_bdt_is_auto) {
            tempFinancials.total_in_bdt = (grandtotal_foreign * offerConfig.bdt_conversion_rate);
        }
        const total_in_bdt_val = tempFinancials.use_total_in_bdt ? parseFloat(tempFinancials.total_in_bdt || 0) : 0;

        if (tempFinancials.use_customs_duty && tempFinancials.customs_duty_is_auto && total_in_bdt_val > 0) {
            const raw_duty = total_in_bdt_val * (offerConfig.customs_duty_percentage / 100);
            tempFinancials.customs_duty_bdt = Math.ceil(raw_duty / 100) * 100;
        }
        const customs_duty_val = tempFinancials.use_customs_duty ? parseFloat(tempFinancials.customs_duty_bdt || 0) : 0;
        
        // Update DOM elements
        for (const key in tempLabels) {
            const el = document.getElementById(`${key.replace(/([A-Z])/g, "-$1").toLowerCase()}-label`);
            if (el && el.textContent !== tempLabels[key]) {
                el.textContent = tempLabels[key];
            }
        }

        document.getElementById('subtotal-foreign').textContent = subtotal_foreign.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('grandtotal-foreign').textContent = grandtotal_foreign.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('subtotal-po').textContent = subtotal_po.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('grandtotal-po').textContent = grandtotal_po.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('subtotal-local').textContent = subtotal_local.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('grandtotal-local').textContent = grandtotal_local.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('subtotal-installation').textContent = subtotal_installation.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('grandtotal-installation').textContent = grandtotal_installation.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        const totalInBdtInput = document.querySelector('input[data-type="total_in_bdt"]');
        if (totalInBdtInput) totalInBdtInput.value = total_in_bdt_val.toFixed(2);
        const customsDutyInput = document.querySelector('input[data-type="customs_duty_bdt"]');
        if (customsDutyInput) customsDutyInput.value = customs_duty_val.toFixed(2);
        const grandTotalBdtWrapper = document.getElementById('foreign-grand-total-bdt-wrapper');
        if (grandTotalBdtWrapper) {
            if (tempFinancials.use_total_in_bdt || tempFinancials.use_customs_duty) {
                const final_grand_total_bdt = total_in_bdt_val + customs_duty_val;
                document.getElementById('foreign-grand-total-bdt-value').textContent = final_grand_total_bdt.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                grandTotalBdtWrapper.classList.remove('hidden');
            } else {
                grandTotalBdtWrapper.classList.add('hidden');
            }
        }

        renderFinancialSummaryUI(state);
    };

    const renderFinancialSummaryUI = (state) => {
        const { isSummaryPageEnabled, offerItems, visibleColumns, financials, summaryScopeDescriptions } = state;
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
            if (indexA !== indexB) return indexA - indexB;
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
                    <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right font-medium">${scope.total_usd > 0 ? scope.total_usd.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}</td>
                    <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right font-medium">${scope.total_bdt > 0 ? scope.total_bdt.toLocaleString('en-BD', { minimumFractionDigits: 2 }) : '-'}</td>
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
                        <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right font-bold">${sub_total_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right font-bold">${sub_total_bdt.toLocaleString('en-BD', { minimumFractionDigits: 2 })}</td>
                    </tr>`;

        if (freight_usd > 0) {
            summaryHtml += `<tr><td colspan="2" class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right">Sea Freight:</td><td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right">${freight_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td><td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right"></td></tr>`;
        }
        if (delivery_bdt > 0) {
            summaryHtml += `<tr><td colspan="2" class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right">Delivery Charge:</td><td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right"></td><td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right">${delivery_bdt.toLocaleString('en-BD', { minimumFractionDigits: 2 })}</td></tr>`;
        }
        if (vat_bdt > 0) {
            summaryHtml += `<tr><td colspan="2" class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right">VAT:</td><td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right"></td><td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right">${vat_bdt.toLocaleString('en-BD', { minimumFractionDigits: 2 })}</td></tr>`;
        }
        if (ait_bdt > 0) {
            summaryHtml += `<tr><td colspan="2" class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right">AIT:</td><td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right"></td><td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right">${ait_bdt.toLocaleString('en-BD', { minimumFractionDigits: 2 })}</td></tr>`;
        }
        if (discount_foreign_usd > 0 || discount_bdt_total > 0) {
            summaryHtml += `<tr><td colspan="2" class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right font-bold text-red-600">Special Discount:</td><td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right font-bold text-red-600">(${discount_foreign_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })})</td><td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right font-bold text-red-600">(${discount_bdt_total.toLocaleString('en-BD', { minimumFractionDigits: 2 })})</td></tr>`;
        }

        summaryHtml += `
                     <tr class="bg-slate-100 dark:bg-slate-700">
                        <td colspan="2" class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right font-extrabold">Grand Total:</td>
                        <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right font-extrabold">${grand_total_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td class="px-2 py-2 border border-slate-300 dark:border-slate-600 text-right font-extrabold">${grand_total_bdt.toLocaleString('en-BD', { minimumFractionDigits: 2 })}</td>
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
            }
        } catch (err) {
            console.error('Failed to convert numbers to words:', err);
            wordsUsdEl.textContent = 'Error';
            wordsBdtEl.textContent = 'Error';
        }
    };
    
    const renderSelectedCover = (selectedCover) => {
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
    
    const renderTnc = (tncState) => {
        tncInternationalCheckbox.checked = tncState.international;
        tncLocalSupplyCheckbox.checked = tncState.local_supply;
        tncLocalInstallationCheckbox.checked = tncState.local_installation;
        tncTextarea.value = tncState.value;
    };

    const renderGlobalUIState = (state) => {
        offerProjectName.textContent = state.projectName;
        includeSignatureCheckbox.checked = state.includeSignature;
        enableSummaryPageCheckbox.checked = state.isSummaryPageEnabled;
        searchForeignCheckbox.checked = state.searchSettings.foreign;
        searchLocalCheckbox.checked = state.searchSettings.local;
        
        setupColumnsDropdown(state.visibleColumns);
        setupSortDropdown(state.currentSortOrder);
        renderOfferCategoryCheckboxes(state);
        updateActionButtons(state);
        checkAdminToolsVisibility();
    };
    
    const checkAdminToolsVisibility = () => {
        if (!adminToolsDiv) return;
        adminToolsDiv.classList.toggle('hidden', currentUser.role !== 'admin');
    };

    const updateActionButtons = (state) => {
        const disabled = state.offerItems.length === 0 || !state.selectedClient;
        exportPdfBtn.disabled = disabled;
        exportXlsxBtn.disabled = disabled;
        saveProjectBtn.disabled = disabled;
        saveAsBtn.disabled = disabled;
    };

    const setupColumnsDropdown = (visibleColumns) => {
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

    const setupSortDropdown = (currentSortOrder) => {
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
    
    const renderOfferCategoryCheckboxes = (state) => {
        const { offerItems } = state;
        const allCategories = ['FDS', 'FPS', 'FD', 'FC'];
        const categoriesInOffer = [...new Set(offerItems.map(item => item.make))];
        if (offerCategoryCheckboxes) {
            offerCategoryCheckboxes.innerHTML = allCategories.map(cat => {
                const checked = categoriesInOffer.includes(cat) ? 'checked' : '';
                return `<div class="flex items-center"><input id="cat-${cat}" type="checkbox" value="${cat}" name="category" class="h-4 w-4 text-sky-600 border-slate-300 dark:border-slate-600 rounded focus:ring-sky-500 bg-slate-100 dark:bg-slate-900" ${checked}><label for="cat-${cat}" class="ml-3 block text-sm text-slate-700 dark:text-slate-300">${cat}</label></div>`;
            }).join('');
        }
    };
    
    const suggestCovers = async (selectedClient, offerItems) => {
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
                        renderAllUI(offerManager.setStateProperty('selectedCover', cover));
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

    const updateTncTextarea = async () => {
        let tncParts = [];
        tncTextarea.value = "Loading...";
        const internationalChecked = tncInternationalCheckbox.checked;
        const localSupplyChecked = tncLocalSupplyCheckbox.checked;
        const localInstallationChecked = tncLocalInstallationCheckbox.checked;

        try {
            if (internationalChecked) {
                const res = await fetch(`${API_URL}/get_tnc/international`);
                tncParts.push((await res.json()).terms);
            }
            if (localSupplyChecked) {
                const resSupply = await fetch(`${API_URL}/get_tnc/local_supply`);
                tncParts.push((await resSupply.json()).terms);
            }
            if (localInstallationChecked) {
                const resInstall = await fetch(`${API_URL}/get_tnc/local_installation`);
                tncParts.push((await resInstall.json()).terms);
            }
            const newValue = tncParts.join('\n\n');
            tncTextarea.value = newValue;
            offerManager.setStateProperty('tncState', {
                international: internationalChecked,
                local_supply: localSupplyChecked,
                local_installation: localInstallationChecked,
                value: newValue
            });
        } catch (err) {
            tncTextarea.value = `Error loading terms: ${err.message}`;
        }
    };

    const handleCoverUpload = async (file) => {
        if (!file || file.type !== 'application/pdf') {
            showToast('Please upload a valid PDF file.', true);
            return;
        }

        const state = offerManager.getState();
        let refForUpload = state.currentReferenceNumber;
        if (!refForUpload) {
            if (!state.selectedClient) {
                showToast('Please select a client before uploading a cover.', true);
                return;
            }
            try {
                const checkedCategories = Array.from(document.querySelectorAll('#offer-category-checkboxes input:checked')).map(cb => cb.value);
                refForUpload = NameController.generateOfferReference({
                    clientName: state.selectedClient.name,
                    categories: checkedCategories,
                    items: state.offerItems,
                    visibleColumns: state.visibleColumns
                });
                renderAllUI(offerManager.setStateProperty('currentReferenceNumber', refForUpload));
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
                renderAllUI(offerManager.setStateProperty('selectedCover', result.savedFilename));
            } else {
                showToast(`Upload failed: ${result.message}`, true);
            }
        } catch (err) {
            showToast(`An error occurred during upload: ${err.message}`, true);
        } finally {
            coverFileInput.value = '';
        }
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
                    const currentState = offerManager.getState();
                    
                    const newItem = {
                        ...item,
                        qty: currentState.offerItems[itemIndex].qty || 1,
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
                    
                    currentState.offerItems[itemIndex] = newItem;
                    
                    cleanupSuggestions();
                    renderAllUI(offerManager.setStateProperty('offerItems', currentState.offerItems));
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
                const { searchSettings } = offerManager.getState();
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

    // --- EVENT LISTENERS ---

    newOfferBtn.addEventListener('click', async () => {
        if (getDirty()) {
            const confirmed = await showConfirmModal(
                "You have unsaved changes that will be lost. Are you sure you want to start a new offer?",
                "Unsaved Changes",
                "bg-amber-600 hover:bg-amber-700",
                "Start New Offer"
            );
            if (!confirmed) return;
        }
        renderAllUI(offerManager.reset());
    });

    if (selectedClientInfo) {
        selectedClientInfo.addEventListener('input', (e) => {
            const { selectedClient } = offerManager.getState();
            let newClient = selectedClient ? { ...selectedClient } : { name: '', address: '' };
            if (e.target.id === 'client-name') newClient.name = e.target.textContent;
            else if (e.target.id === 'client-address') newClient.address = e.target.textContent;
            offerManager.setStateProperty('selectedClient', newClient);
        });
    }

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
        const field = target.dataset.field;
        if (field) {
            const value = target.matches('[contenteditable]') ? target.innerHTML : target.value;
            
            if (field === 'description') {
                handleDescriptionInput(e);
            }
            
            const newState = offerManager.updateItem(itemIndex, field, value);

            if (field.includes('price') || field === 'qty' || field === 'make') {
                updateFinancialsUI(newState);
                 if(field.includes('price')) {
                    const mainScroller = document.querySelector('main');
                    const scrollPos = mainScroller.scrollTop;
                    let selection = window.getSelection();
                    let cursorPosition = 0;
                    if (selection.rangeCount > 0) {
                        let range = selection.getRangeAt(0);
                        cursorPosition = range.startOffset;
                    }
                    renderOfferTable(newState);
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
                            } catch (err) { console.warn("Could not restore cursor position.", err); }
                        }
                    }
                } else {
                     renderGlobalUIState(newState);
                }
            }
        }
    });

    offerTableBody.addEventListener('click', async (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        const row = button.closest('tr');
        if (!row) return;
        const itemIndex = parseInt(row.dataset.itemIndex, 10);

        if (button.classList.contains('remove-item-btn')) {
            renderAllUI(offerManager.removeItem(itemIndex));
        } else if (button.classList.contains('add-row-after-btn')) {
            renderAllUI(offerManager.insertCustomItem(itemIndex));
        } else if (button.classList.contains('save-price-to-master-btn')) {
            if (currentUser.role !== 'admin') return;
            const itemData = { ...button.dataset };
            const confirmed = await showConfirmModal(
                `Are you sure you want to update the master price for <strong>${itemData.itemCode || 'this custom item'}</strong>?<br>New Price: <strong>${itemData.priceValue}</strong>`,
                'Update Master Price List', 'bg-green-600 hover:bg-green-700', 'Confirm Update'
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
                    const { offerItems } = offerManager.getState();
                    if (typeof offerItems[itemIndex].isCustom === 'object') {
                        delete offerItems[itemIndex].isCustom[itemData.priceType];
                    }
                    renderAllUI(offerManager.setStateProperty('offerItems', offerItems));
                } else {
                    button.innerHTML = '<i class="fas fa-save"></i>';
                }
            } catch (err) {
                showToast(`An error occurred: ${err.message}`, true);
                button.innerHTML = '<i class="fas fa-save"></i>';
            }
        }
    });

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

    offerTableBody.addEventListener('dragover', (e) => e.preventDefault());

    offerTableBody.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetRow = e.target.closest('tr');
        if (targetRow && draggedItemIndex !== null) {
            const targetIndex = parseInt(targetRow.dataset.itemIndex, 10);
            renderAllUI(offerManager.moveItem(draggedItemIndex, targetIndex));
        }
    });

    offerTableBody.addEventListener('dragend', () => {
        const draggedRow = offerTableBody.querySelector('.bg-yellow-200');
        if (draggedRow) {
            draggedRow.classList.remove('bg-yellow-200', 'dark:bg-yellow-800/50');
        }
        draggedItemIndex = null;
    });

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') { e.preventDefault(); renderAllUI(offerManager.undo()); }
            if (e.key === 'y') { e.preventDefault(); renderAllUI(offerManager.redo()); }
        }
    });

    addCustomItemBtn.addEventListener('click', () => {
        const { visibleColumns } = offerManager.getState();
        const newState = offerManager.addCustomItem(visibleColumns.local_supply_price);
        renderAllUI(newState);
        const newRow = offerTableBody.querySelector(`tr[data-item-index="${newState.offerItems.length - 1}"]`);
        if (newRow) {
            const descCell = newRow.querySelector('[data-field="description"]');
            if (descCell) descCell.focus();
        }
    });

    sortToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sortDropdown.classList.toggle('hidden');
    });

    sortDropdown.addEventListener('change', (e) => {
        if (e.target.name === 'sort_option') {
            offerManager.setStateProperty('currentSortOrder', e.target.value);
            renderOfferTable(offerManager.sort());
            sortDropdown.classList.add('hidden');
        }
    });

    columnsToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        columnsDropdown.classList.toggle('hidden');
    });

    columnsDropdown.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            const col = e.target.dataset.col;
            const isChecked = e.target.checked;
            const { visibleColumns } = offerManager.getState();
            visibleColumns[col] = isChecked;
            renderAllUI(offerManager.setStateProperty('visibleColumns', visibleColumns));
        }
    });

    searchForeignCheckbox.addEventListener('change', (e) => {
        const { searchSettings } = offerManager.getState();
        searchSettings.foreign = e.target.checked;
        itemSearchInput.dispatchEvent(new Event('keyup', { bubbles:true }));
        offerManager.setStateProperty('searchSettings', searchSettings);
    });

    searchLocalCheckbox.addEventListener('change', (e) => {
        const { searchSettings } = offerManager.getState();
        searchSettings.local = e.target.checked;
        itemSearchInput.dispatchEvent(new Event('keyup', { bubbles:true }));
        offerManager.setStateProperty('searchSettings', searchSettings);
    });

    tncInternationalCheckbox.addEventListener('change', updateTncTextarea);
    tncLocalSupplyCheckbox.addEventListener('change', updateTncTextarea);
    tncLocalInstallationCheckbox.addEventListener('change', updateTncTextarea);

    if (autoFillBtn) {
        autoFillBtn.addEventListener('click', async () => {
            const confirmed = await showConfirmModal(
                'This will scan the master price lists and attempt to fill in any missing price values. This can take a moment and will trigger a data re-initialization. Continue?',
                'Auto-fill Master Prices', 'bg-red-600 hover:bg-red-700', 'Proceed'
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
            clearTimeout(descriptionSearchTimeout);
            descriptionSearchTimeout = setTimeout(() => {
                const markup = parseFloat(adminMarkupInput.value);
                if (!isNaN(markup)) {
                    renderAllUI(offerManager.applyCustomMarkup(markup));
                }
            }, 300);
        });
    }

    // --- GLOBAL INTERFACE ---
    window.loadOfferData = (projectData) => {
        renderAllUI(offerManager.loadProject(projectData));
    };

    window.addItemsToOffer = (itemsToAdd) => {
        if (!itemsToAdd || itemsToAdd.length === 0) return;
        const state = offerManager.addItems(itemsToAdd);
        const { offerItems, visibleColumns } = state;
        const newItem = offerItems[offerItems.length - 1]; // Assume last added
        if (newItem.source_type === 'foreign' && !tncInternationalCheckbox.checked) {
            tncInternationalCheckbox.checked = true;
            updateTncTextarea();
        } else if (newItem.source_type === 'local' && !tncLocalSupplyCheckbox.checked) {
            tncLocalSupplyCheckbox.checked = true;
            updateTncTextarea();
        }
        if (newItem.source_type === 'local' && !visibleColumns.local_supply_price) visibleColumns.local_supply_price = true;
        if (parseFloat(newItem.installation_price_bdt) > 0 && !visibleColumns.installation_price) visibleColumns.installation_price = true;
        renderAllUI(state);
    };

    window.handleOfferSaveAs = async (newName) => {
        const checkedCategories = Array.from(document.querySelectorAll('#offer-category-checkboxes input:checked')).map(cb => cb.value);
        const result = await offerManager.save(true, newName, checkedCategories);
        if(result.success) {
            showToast(`Project saved as: ${result.referenceNumber}`);
            renderGlobalUIState(offerManager.getState());
        } else {
            showToast(`Error saving: ${result.message}`, true);
        }
    };
    
    window.performReplaceInOffer = (findText, replaceText, isCaseSensitive, isBold) => {
        const { count, newState } = offerManager.performReplaceInOffer(findText, replaceText, isCaseSensitive, isBold);
        if (count > 0) {
            renderOfferTable(newState);
            showToast(`Made replacements in ${count} item(s).`);
        } else {
            showToast('No matches found to replace.', false);
        }
    };
    
    // --- INITIALIZATION ---
    createSearchHandler({
        searchInput: clientSearchInput, resultsContainer: clientSearchResults, apiEndpoint: `${API_URL}/search_clients`,
        buildQuery: (query) => `q=${encodeURIComponent(query)}`,
        renderResults: renderClientResults,
        onResultSelected: (client) => {
            const newClient = { name: client.client_name, address: client.client_address };
            renderAllUI(offerManager.setStateProperty('selectedClient', newClient));
        }
    });
    
    createSearchHandler({
        searchInput: itemSearchInput, resultsContainer: itemSearchResults, loaderElement: itemSearchLoader, apiEndpoint: `${API_URL}/search_items`, currentUser, minQueryLength: 0,
        buildQuery: (query) => {
            const { searchSettings } = offerManager.getState();
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
                make: item.product_type
            };
            window.addItemsToOffer([newItem]);
            itemSearchInput.focus();
        }
    });

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
            renderAllUI(offerManager.setStateProperty('selectedCover', cover));
            coverSearchInput.value = '';
        }
    });
    
    renderAllUI(offerManager.getState());
    loadAndRenderFilters();
    loadAndRenderProductTypeFilter();
}