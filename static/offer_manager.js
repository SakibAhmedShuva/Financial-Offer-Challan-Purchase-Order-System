// /static/offer_manager.js

/**
 * Creates and manages the state and business logic for a financial offer.
 * This manager is responsible for all data manipulations, calculations, and history management (undo/redo).
 * It communicates with the backend for saving, loading, and exporting data.
 *
 * @param {object} deps - Dependencies required by the manager.
 * @returns {object} A public API to interact with and manage the offer state.
 */
function createOfferManager(deps) {
    const { API_URL, currentUser, showToast, updateProjectState, setDirty } = deps;

    // --- STATE MANAGEMENT ---
    let state = {};

    const getDefaultFinancialLabels = () => ({
        foreignPrice: 'Foreign Price',
        subtotalForeign: 'Subtotal:',
        freight: 'Freight:',
        discountForeign: 'Discount:',
        grandtotalForeign: 'Grand Total, Ex-Works (USD):',
        totalInBdt: 'Total in BDT:',
        customsDuty: 'Customs Duty:',
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

    const getInitialFinancials = () => ({
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
        use_customs_duty: false,
        total_in_bdt: 0,
        customs_duty_bdt: 0,
        total_in_bdt_is_auto: true,
        customs_duty_is_auto: true
    });

    const getDefaultState = () => ({
        selectedClient: null,
        offerItems: [],
        currentProjectId: null,
        currentReferenceNumber: null,
        projectName: 'New Financial Offer',
        selectedCover: null,
        isSummaryPageEnabled: true,
        summaryScopeDescriptions: {},
        includeSignature: true,
        currentSortOrder: 'custom',
        searchSettings: { foreign: true, local: false },
        offerConfig: { bdt_conversion_rate: 125, customs_duty_percentage: 0.16 },
        financialLabels: getDefaultFinancialLabels(),
        financials: getInitialFinancials(),
        visibleColumns: {
            foreign_price: true,
            po_price: false,
            local_supply_price: false,
            installation_price: false
        },
        tncState: {
            international: false,
            local_supply: false,
            local_installation: false,
            value: ''
        }
    });

    // --- UNDO/REDO ---
    let history = [];
    let historyIndex = -1;
    let isRestoringState = false;
    let captureTimeout;

    const captureState = () => {
        if (isRestoringState) return;
        clearTimeout(captureTimeout);
        captureTimeout = setTimeout(() => {
            const currentState = {
                selectedClient: JSON.parse(JSON.stringify(state.selectedClient)),
                offerItems: JSON.parse(JSON.stringify(state.offerItems)),
                financials: JSON.parse(JSON.stringify(state.financials)),
                financialLabels: JSON.parse(JSON.stringify(state.financialLabels)),
                visibleColumns: JSON.parse(JSON.stringify(state.visibleColumns)),
                searchSettings: JSON.parse(JSON.stringify(state.searchSettings)),
                selectedCover: state.selectedCover,
                isSummaryPageEnabled: state.isSummaryPageEnabled,
                summaryScopeDescriptions: JSON.parse(JSON.stringify(state.summaryScopeDescriptions)),
                includeSignature: state.includeSignature,
                tncState: JSON.parse(JSON.stringify(state.tncState)),
                projectName: state.projectName
            };

            if (history.length > 0 && JSON.stringify(history[historyIndex]) === JSON.stringify(currentState)) {
                return;
            }

            if (historyIndex < history.length - 1) {
                history = history.slice(0, historyIndex + 1);
            }

            history.push(currentState);
            historyIndex++;
            if (historyIndex > 0) setDirty(true);
        }, 250);
    };

    const restoreState = (newState) => {
        if (!newState) return;
        isRestoringState = true;
        state = JSON.parse(JSON.stringify(newState));
        isRestoringState = false;
    };

    // --- LOGIC & CALCULATIONS ---
    const sortItems = () => {
        const indexedItems = state.offerItems.map((item, index) => ({ item, originalIndex: index }));

        switch (state.currentSortOrder) {
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
        state.offerItems = indexedItems.map(i => i.item);
    };

    const updateItemTotals = (item) => {
        const qty = parseFloat(item.qty || 1);
        item.foreign_total_usd = (qty * parseFloat(item.foreign_price_usd || 0)).toFixed(2);
        item.local_supply_total_bdt = (qty * parseFloat(item.local_supply_price_bdt || 0)).toFixed(2);
        item.installation_total_bdt = (qty * parseFloat(item.installation_price_bdt || 0)).toFixed(2);
        item.po_total_usd = (qty * parseFloat(item.po_price_usd || 0)).toFixed(2);
        return item;
    };

    // --- PUBLIC API ---
    const publicApi = {
        getState: () => JSON.parse(JSON.stringify(state)),

        reset: () => {
            state = getDefaultState();
            history = [];
            historyIndex = -1;
            setDirty(false);
            setTimeout(() => captureState(), 50);
            return publicApi.getState();
        },

        loadProject: (projectData) => {
            publicApi.reset();
            state.currentProjectId = projectData.projectId;
            state.currentReferenceNumber = projectData.referenceNumber;
            updateProjectState(projectData);
            state.projectName = projectData.referenceNumber;
            state.selectedClient = projectData.client;
            state.offerItems = projectData.items || [];
            state.financials = { ...getInitialFinancials(), ...(projectData.financials || {}) };
            state.financialLabels = projectData.financialLabels || getDefaultFinancialLabels();
            state.searchSettings = projectData.searchSettings || { foreign: true, local: false };
            state.selectedCover = projectData.selected_cover || null;
            state.isSummaryPageEnabled = projectData.isSummaryPageEnabled === undefined ? true : projectData.isSummaryPageEnabled;
            state.summaryScopeDescriptions = projectData.summaryScopeDescriptions || {};
            state.includeSignature = projectData.includeSignature === undefined ? true : projectData.includeSignature;
            state.visibleColumns = { ...state.visibleColumns, ...(projectData.visibleColumns || {}) };
            if (projectData.tncState) state.tncState = projectData.tncState;

            setDirty(false);
            setTimeout(() => captureState(), 50);
            return publicApi.getState();
        },

        undo: () => {
            if (historyIndex > 0) {
                historyIndex--;
                restoreState(history[historyIndex]);
                return state;
            }
            return null;
        },

        redo: () => {
            if (historyIndex < history.length - 1) {
                historyIndex++;
                restoreState(history[historyIndex]);
                return state;
            }
            return null;
        },

        setStateProperty: (key, value) => {
            state[key] = value;
            captureState();
            return publicApi.getState();
        },

        updateItem: (index, field, value) => {
            let item = state.offerItems[index];
            if (!item) return;

            if (field === 'description') {
                item[field] = value;
            } else {
                const rawValue = typeof value === 'string' ? value.replace(/,/g, '') : value;
                item[field] = rawValue;
                if (field.includes('price')) {
                    if (typeof item.isCustom !== 'object' || item.isCustom === null) item.isCustom = {};
                    item.isCustom[field] = true;
                }
            }
            state.offerItems[index] = updateItemTotals(item);
            captureState();
            return publicApi.getState();
        },

        addItems: (itemsToAdd) => {
            itemsToAdd.forEach(item => {
                const newItem = updateItemTotals({ ...item, isCustom: false });
                state.offerItems.push(newItem);
            });
            state.currentSortOrder = 'custom';
            captureState();
            return publicApi.getState();
        },

        addCustomItem: (isLocalSupplyVisible) => {
            if (!isLocalSupplyVisible) state.visibleColumns.local_supply_price = true;
            state.offerItems.push({
                customId: `custom_${Date.now()}`, description: '', qty: 1, unit: 'Pcs',
                foreign_price_usd: '0.00', foreign_total_usd: '0.00',
                local_supply_price_bdt: '0.00', local_supply_total_bdt: '0.00',
                installation_price_bdt: '0.00', installation_total_bdt: '0.00',
                isCustom: {}, source_type: 'local', make: 'FPS'
            });
            captureState();
            return publicApi.getState();
        },

        insertCustomItem: (index) => {
            const newItem = {
                customId: `custom_${Date.now()}`, description: '', qty: 1, unit: 'Pcs',
                foreign_price_usd: '0.00', foreign_total_usd: '0.00',
                local_supply_price_bdt: '0.00', local_supply_total_bdt: '0.00',
                installation_price_bdt: '0.00', installation_total_bdt: '0.00',
                isCustom: {}, source_type: 'local', make: 'MISC'
            };
            state.offerItems.splice(index + 1, 0, newItem);
            captureState();
            return publicApi.getState();
        },

        removeItem: (index) => {
            state.offerItems.splice(index, 1);
            captureState();
            return publicApi.getState();
        },

        moveItem: (fromIndex, toIndex) => {
            const [movedItem] = state.offerItems.splice(fromIndex, 1);
            state.offerItems.splice(toIndex, 0, movedItem);
            state.currentSortOrder = 'custom';
            captureState();
            return publicApi.getState();
        },

        sort: () => {
            sortItems();
            return publicApi.getState();
        },

        save: async (isSaveAs, newName, checkedCategories) => {
            let refToSave = isSaveAs ? newName : state.currentReferenceNumber;
            let idToSave = isSaveAs ? null : state.currentProjectId;

            const payload = {
                ...state,
                projectId: idToSave,
                referenceNumber: refToSave,
                items: state.offerItems,
                categories: checkedCategories,
                user: currentUser
            };
            const response = await fetch(`${API_URL}/project`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.success) {
                state.currentProjectId = result.projectId;
                state.currentReferenceNumber = result.referenceNumber;
                state.projectName = result.referenceNumber;
                updateProjectState({ projectId: state.currentProjectId, referenceNumber: state.currentReferenceNumber });
                setDirty(false);
            }
            return result;
        },

        exportFile: async (fileType, checkedCategories, filename, terms) => {
            const payload = {
                ...state,
                items: state.offerItems,
                referenceNumber: state.currentReferenceNumber,
                categories: checkedCategories,
                terms_and_conditions: terms,
                user: currentUser,
                filename: filename
            };
            return fetch(`${API_URL}/export_${fileType}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        },

        performReplaceInOffer: (findText, replaceText, isCaseSensitive, isBold) => {
            let replacement = isBold ? `<b>${replaceText}</b>` : replaceText;
            const regex = new RegExp(findText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), isCaseSensitive ? 'g' : 'gi');
            let replacementsMade = 0;
            state.offerItems.forEach(item => {
                if (item.description && item.description.match(regex)) {
                    item.description = item.description.replace(regex, replacement);
                    replacementsMade++;
                }
            });
            if (replacementsMade > 0) captureState();
            return { count: replacementsMade, newState: publicApi.getState() };
        },

        applyCustomMarkup: (markupPercent) => {
            const markupFactor = 1 + (markupPercent / 100);
            state.offerItems.forEach(item => {
                const poPrice = parseFloat(item.po_price_usd || 0);
                if (poPrice > 0) {
                    item.foreign_price_usd = (poPrice * markupFactor).toFixed(2);
                    if (typeof item.isCustom !== 'object' || item.isCustom === null) item.isCustom = {};
                    item.isCustom['foreign_price_usd'] = true;
                    updateItemTotals(item);
                }
            });
            captureState();
            return publicApi.getState();
        },

        fetchConfig: async () => {
            try {
                const res = await fetch(`${API_URL}/get_offer_config`);
                const result = await res.json();
                if (result.success) {
                    state.offerConfig = {
                        bdt_conversion_rate: result.bdt_conversion_rate,
                        customs_duty_percentage: result.customs_duty_percentage
                    };
                }
            } catch (error) {
                console.error('Failed to fetch offer config:', error);
                showToast('Could not load server configuration, using defaults.', true);
            }
        }
    };

    // Initial setup
    publicApi.reset();
    publicApi.fetchConfig();

    return publicApi;
}