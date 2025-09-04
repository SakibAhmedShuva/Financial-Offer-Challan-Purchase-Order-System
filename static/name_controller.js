// /static/name_controller.js

/**
 * Provides centralized methods for generating reference numbers and filenames
 * for various documents like Offers, Challans, and Purchase Orders.
 * This ensures consistent naming across the application.
 */

// --- PRIVATE HELPERS ---

/**
 * Helper to get a consistent date format for reference numbers (e.g., 251007 for Jul 10, 2025)
 * @returns {string} A date string in YYDDMM format.
 */
const getReferenceDatePart = () => {
    const d = new Date();
    // YYDDMM format
    const year = String(d.getFullYear()).slice(-2);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}${day}${month}`;
};

/**
 * Helper to get a consistent date format for filenames (e.g., 10-Jul-2025)
 * @returns {string} A date string in DD-Mon-YYYY format.
 */
const getFilenameDatePart = () => {
    const d = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = String(d.getDate()).padStart(2, '0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
};


// --- PUBLIC CONTROLLER OBJECT ---

const NameController = {
    /**
     * Generates a 2-4 letter uppercase abbreviation from a client's name.
     * Example: "Your High-tech Solutions Inc." -> "YHSI"
     * @param {string} clientName The full name of the client.
     * @returns {string} A 2-4 character uppercase abbreviation. Returns 'CLIENT' if name is not provided.
     */
    getClientAbbreviation(clientName) {
        if (!clientName || typeof clientName !== 'string') return 'CLIENT';
        // Remove special characters, split into words, take the first letter of each, uppercase, and limit to 4 chars.
        const words = clientName.replace(/[^\w\s-]/gi, '').split(/\s+/).filter(Boolean);
        if (words.length === 0) return 'CLIENT';
        let abbr = (words.length > 1) ? words.map(w => w[0]).join('') : (words[0] || '');
        return abbr.toUpperCase().slice(0, 4);
    },

    /**
     * Generates a project reference number for a Financial Offer.
     * Ideal Format: FO_FPS_YHSI_251007GE30
     * @param {object} data - Contains clientName, categories, items, and visibleColumns.
     * @returns {string} The generated reference number.
     */
    generateOfferReference(data) {
        const { clientName, categories = [], items = [], visibleColumns = {} } = data;

        const has_foreign = visibleColumns.foreign_price && items.some(item => parseFloat(item.foreign_total_usd || 0) > 0);
        const has_local = visibleColumns.local_supply_price && items.some(item => parseFloat(item.local_supply_total_bdt || 0) > 0);
        const has_installation = visibleColumns.installation_price && items.some(item => parseFloat(item.installation_total_bdt || 0) > 0);

        let prefix = "FO";
        if (!has_foreign) {
            if (has_local) prefix = "FO_LO";
            else if (has_installation) prefix = "FO_INS";
        }
        
        const client_part = this.getClientAbbreviation(clientName);
        const cats_part = categories && categories.length > 0 ? categories.sort().join('_') : "MISC";
        const date_part = getReferenceDatePart();
        const rand_num = Math.floor(Math.random() * (99 - 10 + 1)) + 10;

        return `${prefix}_${cats_part}_${client_part}_${date_part}GE${rand_num}`;
    },

    /**
     * Generates a project reference number for an AI Helper project.
     * Ideal Format: AI_FPS_251007GE30
     * @param {object} data - Contains categories.
     * @returns {string} The generated reference number.
     */
    generateAiHelperReference(data) {
        const { categories = [] } = data;
        const prefix = "AI";
        const cats_part = categories && categories.length > 0 ? categories.sort().join('_') : "MISC";
        const date_part = getReferenceDatePart();
        const rand_num = Math.floor(Math.random() * (99 - 10 + 1)) + 10;

        return `${prefix}_${cats_part}_${date_part}GE${rand_num}`;
    },

    /**
     * Generates a complete filename for a Challan export.
     * Ideal Format: DC_1556_NTBC_FPS_10-Jul-2025.pdf
     * @param {object} data - Contains challanRef, clientName, categories, and fileType ('pdf' or 'xlsx').
     * @returns {string} The generated filename with extension.
     */
    generateChallanFilename(data) {
        const { challanRef, clientName, categories = [], fileType } = data;
        const refStr = String(challanRef || '0').trim();

        // **FIX**: Check if the ref is already a full name. If so, use it directly.
        if (refStr.startsWith('DC_') && refStr.split('_').length > 2) {
            return `${refStr}.${fileType}`;
        }

        // Otherwise, build the name from scratch as before.
        const abbr = this.getClientAbbreviation(clientName);
        const cats_part = categories && categories.length > 0 ? categories.sort().join('_') : 'MISC';
        const datePart = getFilenameDatePart();
        
        const baseName = `DC_${refStr}_${abbr}_${cats_part}_${datePart}`;
        return `${baseName}.${fileType}`;
    },

    /**
     * Generates a complete filename for a Purchase Order export.
     * Derives from the offer reference number by replacing 'FO_' with 'PO_'.
     * @param {object} data - Contains offerReferenceNumber and fileType ('pdf' or 'xlsx').
     * @returns {string} The generated filename with extension.
     */
    generatePOFilename(data) {
         const { offerReferenceNumber, fileType } = data;
         if (!offerReferenceNumber) return `PO_Unknown_Ref.${fileType}`;
         
         const po_reference_number = offerReferenceNumber.includes('FO_') 
            ? offerReferenceNumber.replace('FO_', 'PO_') 
            : `PO_${offerReferenceNumber}`;
            
         return `${po_reference_number}.${fileType}`;
    },

    /**
     * Generates a complete filename for a Financial Offer or AI Helper export.
     * @param {object} data - Contains referenceNumber and fileType.
     * @returns {string} The sanitized filename with extension.
     */
    generateOfferFilename(data) {
        const { referenceNumber, fileType } = data;
        const safe_filename = referenceNumber.replace(/[\\/*?:"<>|]/g, "_");
        return `${safe_filename}.${fileType}`;
    }
};