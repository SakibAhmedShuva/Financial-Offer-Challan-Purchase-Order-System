# tnc.py

INTERNATIONAL_TNC = """Foreign Part:
‣ Offer Validity: 07 Days
‣ Port of Shipment: Jabel Ali, Dubai
‣ Port of Delivery: Chattogram Sea Port, Bangladesh
‣ Ex Works: 12-14 weeks
‣ Payment Terms: LC at Sight
‣ Prices: C & F, Chattogram Seaport, Bangladesh
‣ If there is any price hike in the raw materials, the price quoted will change accordingly.
‣ Freight Charges will be calculated on at actual basis. In case of a rise in the freight charges, additional cost has to be borne by the concerned client.
‣ The manufacturer may change the brand/origin of the product keeping specifications the same as per the product availability."""

LOCAL_SUPPLY_TNC = """Local Part (Supply):
‣ Offer Validity: 07 Days
‣ Delivery: 7 days from the work order and fulfilling payment terms
‣ Any addition of items/fittings after approval of this quotation, due to site conditions, will increase prices according to our submitted price offer.
‣ If there is any hike in the price of the raw materials, the price quoted will change accordingly
‣ VAT, TAX, AIT, and other Government charges are excluded
‣ We reserve the right to correct any typographic/arithmetic errors

Payment Schedule (Local Supply):
TABLE_START
Sl.|Description of Stages of Payment|Percentage per Stage (%)
i.|Payment before supply (Advance)|80%
ii.|After completion of delivery|20%
TABLE_END
Payments shall be done by account payee cheque or bank transfer type to AMO Green Energy Limited"""

LOCAL_INSTALLATION_TNC = """Local Part (Installation):
‣ Installation charges will be applied accordingly. Installation rate is provided item-wise.
‣ For any interruption in work progress due to unavoidable issues, project installation work duration will be extended accordingly.
‣ Any civil & excavation works to be performed by the client.

Payment Schedule (Installation):
TABLE_START
Sl.|Description of Stages of Payment|Percentage per Stage (%)
i.|Before Starting the Installation Works|40%
ii.|After Completing 40% of the installation works|30%
iii.|Before Testing & Commissioning|20%
iv.|After Commissioning and Handover (Within one week)|10%
TABLE_END
Payments shall be done by account payee cheque or bank transfer type to AMO Green Energy Limited"""

def get_tnc(template_name):
    """
    Returns the terms and conditions text for a given template name.
    """
    if template_name == 'international':
        return INTERNATIONAL_TNC
    elif template_name == 'local_supply':
        return LOCAL_SUPPLY_TNC
    elif template_name == 'local_installation':
        return LOCAL_INSTALLATION_TNC
    elif template_name == 'detailed':
        # This combines all for any part of the app that might still use 'detailed'.
        return f"Terms & Conditions\n\n{INTERNATIONAL_TNC}\n\n{LOCAL_SUPPLY_TNC}\n\n{LOCAL_INSTALLATION_TNC}"
    else:
        return ""