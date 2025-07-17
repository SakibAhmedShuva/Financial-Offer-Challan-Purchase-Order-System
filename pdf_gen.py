import os
import re
from datetime import datetime
from fpdf import FPDF
from app_helpers import html_to_plain_text, to_words_bdt, to_words_usd

# --- Helper to prevent conversion errors ---
def safe_float(value, default=0.0):
    try:
        if value is None or value == '':
            return default
        return float(value)
    except (ValueError, TypeError):
        return default

# --- PDF Custom Class ---
class PDF(FPDF):
    _title = 'Financial Offer'
    is_tnc_page = False
    _header_color = (238, 229, 118) # EEE576
    is_summary_page = False
    project_details = {}

    def set_doc_title(self, title):
        self._title = title

    def set_header_color(self, hex_color):
        self._header_color = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

    def header(self):
        logo_path = os.path.join('assets', 'amoge_logo.png')
        if os.path.exists(logo_path):
            self.image(logo_path, x=10, y=8, w=60)
        else:
            self.set_font('Arial', 'B', 16)
            self.cell(80, 10, 'AMO Greenenergy Ltd.', 0, 0, 'L')

        y = self.get_y()
        self.set_y(y) 
        self.set_font('Arial', '', 9)
        self.cell(0, 5, f"Date: {datetime.now().strftime('%d-%B-%Y')}", 0, 1, 'R')
        self.cell(0, 5, "Phone: +88029850836", 0, 1, 'R')
        self.cell(0, 5, "Website: www.ge-bd.com", 0, 1, 'R')

        self.set_y(self.get_y() + 5)
        self.set_line_width(0.5)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(5)

        if self.is_summary_page and self.page_no() == 1:
            self.set_font('Arial', 'BU', 14)
            self.set_fill_color(*self._header_color)
            title_text = "SUMMARY OF SUPPLY & INSTALLATION OF FIRE PROTECTION SYSTEM AND FIRE DETECTION & ALARM SYSTEM"
            self.multi_cell(0, 8, title_text, 0, 'C', fill=True)
            self.ln(5)

            # Draw project details from stored data
            self.set_font('Arial', 'B', 11)
            self.cell(40, 7, "Project Name:", 0, 0, 'L')
            self.set_font('Arial', '', 11)
            self.cell(0, 7, sanitize_text(self.project_details.get('projectName', 'N/A')), 0, 1, 'L')

            self.set_font('Arial', 'B', 11)
            self.cell(40, 7, "Submitted By:", 0, 0, 'L')
            self.set_font('Arial', '', 11)
            self.cell(0, 7, sanitize_text(self.project_details.get('submittedBy', 'AMO Green Energy Limited')), 0, 1, 'L')

            self.set_font('Arial', 'B', 11)
            self.cell(40, 7, "Submission Date:", 0, 0, 'L')
            self.set_font('Arial', '', 11)
            self.cell(0, 7, sanitize_text(self.project_details.get('submissionDate', 'N/A')), 0, 1, 'L')

            self.set_font('Arial', 'B', 11)
            self.cell(40, 7, "Reference:", 0, 0, 'L')
            self.set_font('Arial', '', 11)
            self.cell(0, 7, sanitize_text(self.project_details.get('reference', 'N/A')), 0, 1, 'L')
            self.ln(5)

        elif not self.is_tnc_page:
            self.set_font('Arial', 'B', 18)
            self.set_fill_color(*self._header_color)
            self.cell(0, 10, self._title, 0, 1, 'C', fill=True)
            self.ln(5)
        else:
            self.ln(5)

    def footer(self):
        self.set_y(-15)
        
        self.set_line_width(0.5)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(2)

        y_pos = self.get_y()

        self.set_font('Arial', '', 8)
        footer_text1 = "Corporate Office: Nurul Islam House, 110 Gulshan Avenue, Road 113, Dhaka-1212"
        footer_text2 = "Web: www.ge-bd.com, sales@ge-bd.com, Phone: +880 1715-895144"
        
        self.cell(0, 3, footer_text1, 0, 1, 'L')
        self.cell(0, 3, footer_text2, 0, 1, 'L')

        self.set_y(y_pos)
        self.set_font('Arial', 'I', 8)
        self.cell(0, 6, f'Page {self.page_no()}/{{nb}}', 0, 0, 'R')
    
    def write_html(self, html, cell_height):
        html = str(html).replace('&nbsp;', ' ')
        html = re.sub(r'<br\s*/?>', '\n', html)
        parts = re.split(r'(<.*?>)', html)
        
        for part in parts:
            if not part: continue
            
            if part.startswith('<b'): self.set_font('', 'B')
            elif part.startswith('</b>'): self.set_font('', '')
            elif part.startswith('<i'): self.set_font('', 'I')
            elif part.startswith('</i>'): self.set_font('', '')
            elif part.startswith('<font'):
                color = re.search(r'color="#?([0-9a-fA-F]{6})"', part)
                if color:
                    hex_color = color.group(1)
                    r, g, b = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
                    self.set_text_color(r, g, b)
            elif part.startswith('</font>'): self.set_text_color(0, 0, 0)
            else:
                text = part.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&').encode('latin-1', 'replace').decode('latin-1')
                self.write(cell_height, text)
    
    def add_signature_block(self, signature_image_path, include_signature=True):
        self.set_y(self.get_y() + 15)
        if self.get_y() > 220:
             self.add_page()
             self.ln(10)

        self.set_font('Arial', '', 10)
        self.cell(0, 5, "Sincerely,", 0, 1, 'L')
        self.ln(10)
        
        if include_signature and os.path.exists(signature_image_path):
            signature_y = self.get_y() - 10
            self.image(signature_image_path, x=self.get_x(), y=signature_y, w=32 * 0.8)
            self.set_y(self.get_y() + 15)
        else:
            self.ln(15)

        signature_text_lines = ["Md. Rezwanul Islam", "Manager, Business Development", "AMO Green Energy Limited"]
        for i, line in enumerate(signature_text_lines):
            if i == 0:
                self.set_font('Arial', 'B', 10)
            else:
                self.set_font('Arial', '', 10)
            self.cell(0, 5, line, 0, 1, 'L')

def sanitize_text(text):
    text = str(text)
    replacements = {
        '\u201c': '"',
        '\u201d': '"',
        '\u2018': "'",
        '\u2019': "'",
        '\u2026': '...',
        '\u2013': '-',
        '\u2014': '--',
        '\u2023': '-',
        '\u2043': '-',
        '\u2022': '-',
    }
    for unicode_char, replacement in replacements.items():
        text = text.replace(unicode_char, replacement)
    
    return text.encode('latin-1', 'replace').decode('latin-1')

def add_tnc_to_pdf(pdf, tnc_text):
    if not tnc_text: return
    
    pdf.is_tnc_page = True
    pdf.is_summary_page = False
    pdf.add_page()
    pdf.set_font('Arial', 'B', 14)
    pdf.set_fill_color(*pdf._header_color)
    pdf.cell(0, 10, 'Terms & Conditions', 0, 1, 'C', fill=True)
    pdf.ln(3)

    in_table, table_data = False, []
    tnc_headers = ["Foreign Part:", "Local Part (Supply):", "Local Part (Installation):"]
    headers_needing_space = [
        "Local Part (Supply):", 
        "Payment Schedule (Local Supply):", 
        "Local Part (Installation):", 
        "Payment Schedule (Installation):"
    ]
    
    for line in tnc_text.split('\n'):
        line = line.strip()
        if not line:
            continue

        if any(h in line for h in headers_needing_space):
            pdf.ln(3)

        if line == 'TABLE_START': in_table, table_data = True, []; continue
        elif line == 'TABLE_END':
            in_table = False
            if table_data:
                pdf.ln(3)
                pdf.set_font('Arial', 'B', 9)
                pdf.set_fill_color(*pdf._header_color)
                col_widths, headers = [20, 120, 50], table_data[0]
                for i, header in enumerate(headers): pdf.cell(col_widths[i], 7, header, 1, 0, 'C', 1)
                pdf.ln()
                pdf.set_font('Arial', '', 9)
                pdf.set_fill_color(255, 255, 255)
                for row in table_data[1:]:
                    for i, cell_text in enumerate(row):
                        align = 'C' if i == 0 or i == 2 else 'L'
                        pdf.cell(col_widths[i], 6, sanitize_text(cell_text), 1, 0, align)
                    pdf.ln()
                pdf.ln(3)
            continue
        if in_table: table_data.append([cell.strip() for cell in line.split('|')]); continue
        
        sanitized_line = sanitize_text(line)

        if any(header in sanitized_line for header in tnc_headers):
            pdf.set_font('Arial', 'B', 10)
            pdf.set_fill_color(*pdf._header_color)
            pdf.cell(0, 7, sanitized_line, 0, 1, 'L', fill=True)
            pdf.ln(1)
        elif re.match(r'^[A-Za-z]+\s*Part.*:$', sanitized_line) or "Payment Schedule" in sanitized_line:
            pdf.set_font('Arial', 'B', 10)
            pdf.set_fill_color(*pdf._header_color)
            pdf.cell(0, 7, sanitized_line, 0, 1, 'L', fill=True)
        elif sanitized_line.startswith('-'):
            pdf.set_font('Arial', '', 9)
            pdf.cell(5)
            pdf.multi_cell(0, 4, sanitized_line, 0, 'L')
        else:
            pdf.set_font('Arial', '', 9)
            pdf.multi_cell(0, 4, sanitized_line, 0, 'L')

def draw_boq_content(pdf, data, sections, visible_price_groups):
    items = data.get('items', [])
    
    all_prices_visible = len(visible_price_groups) >= 3 
    header_font_size, boq_font_size = 8, 9
    if all_prices_visible:
        header_font_size *= 0.8
        boq_font_size *= 0.8
    
    def draw_headers():
        pdf.set_font('Arial', 'B', header_font_size)
        pdf.set_text_color(0, 0, 0)
        pdf.set_fill_color(*pdf._header_color)
        
        row_height = 7
        start_x = pdf.l_margin
        start_y = pdf.get_y()
        
        current_x = start_x
        for col in sections['base']:
            pdf.set_xy(current_x, start_y)
            pdf.cell(col['width'], row_height * 2, col['header'], 1, 0, 'C', fill=True)
            current_x += col['width']
        
        for group in visible_price_groups:
            pdf.set_xy(current_x, start_y)
            pdf.cell(group['width'], row_height, group['header'], 1, 0, 'C', fill=True)
            current_x += group['width']
        
        current_x = start_x + sum(col['width'] for col in sections['base'])
        for group in visible_price_groups:
            for sub_col in group['sub']:
                pdf.set_xy(current_x, start_y + row_height)
                pdf.multi_cell(sub_col['width'], row_height / 2, sub_col['header'], 1, 'C', fill=True)
                current_x += sub_col['width']
        
        pdf.set_y(start_y + row_height * 2)

    draw_headers()    
    pdf.set_font('Arial', '', boq_font_size)
    line_height = 5
    for i, item in enumerate(items):
        plain_desc_html = item.get('description', '')
        
        # Height calculation based on plain text
        plain_desc_text = html_to_plain_text(str(plain_desc_html).replace('&nbsp;', ' '))
        sanitized_desc_for_height_calc = sanitize_text(plain_desc_text)
        desc_lines = pdf.multi_cell(sections['base'][1]['width'], line_height, sanitized_desc_for_height_calc, 0, 'L', split_only=True)
        num_lines = len(desc_lines)
        row_height = (num_lines * line_height) + 4
        
        if pdf.get_y() + row_height > pdf.page_break_trigger:
            pdf.add_page()
            draw_headers()
            pdf.set_font('Arial', '', boq_font_size)

        start_y = pdf.get_y()
        current_x = pdf.l_margin
        
        # SL cell
        pdf.cell(sections['base'][0]['width'], row_height, str(i + 1), 1, 0, 'C')
        current_x += sections['base'][0]['width']
        
        # Description cell box
        pdf.rect(current_x, start_y, sections['base'][1]['width'], row_height)
        desc_text_x = current_x + 1
        desc_text_y = start_y + 2 # Padding from top
        current_x += sections['base'][1]['width']

        # Reset Y for other cells in the row
        pdf.set_y(start_y)

        # Qty, Unit, and Price cells
        pdf.set_x(current_x)
        pdf.cell(sections['base'][2]['width'], row_height, str(item.get('qty', 1)), 1, 0, 'C')
        current_x += sections['base'][2]['width']
        pdf.set_x(current_x)
        pdf.cell(sections['base'][3]['width'], row_height, sanitize_text(item.get('unit', 'Pcs')), 1, 0, 'C')
        current_x += sections['base'][3]['width']
        
        for group in visible_price_groups:
            for sub in group['sub']:
                pdf.set_x(current_x)
                val = safe_float(item.get(sub['key'], 0))
                currency_symbol = '$' if 'usd' in sub['key'].lower() else ''
                text = f"-{currency_symbol}{abs(val):,.2f}" if val < 0 else f"{currency_symbol}{val:,.2f}"
                pdf.cell(sub['width'], row_height, text, 1, 0, sub['align'])
                current_x += sub['width']
        
        # Write the formatted description text inside the box
        pdf.set_xy(desc_text_x, desc_text_y)
        
        # Set margins to confine the write() call
        initial_r_margin = pdf.r_margin
        initial_l_margin = pdf.l_margin
        desc_cell_width = sections['base'][1]['width'] - 2 # width with padding
        pdf.set_left_margin(desc_text_x)
        pdf.set_right_margin(pdf.w - desc_text_x - desc_cell_width)

        pdf.write_html(plain_desc_html, line_height)
        
        # Restore margins
        pdf.set_left_margin(initial_l_margin)
        pdf.set_right_margin(initial_r_margin)

        # Move cursor to next row
        pdf.set_y(start_y + row_height)


def draw_financial_summary_rows_for_boq(pdf, data, sections, visible_price_groups, financial_labels, is_local_only=False):
    financials, items = data.get('financials', {}), data.get('items', [])
    has_additional_charges = data.get('has_additional_charges', False)
    
    label_span_width = sum(c['width'] for c in sections['base'])

    def add_summary_row(label, values, is_bold=False, is_red=False, is_grand_total=False):
        row_height = 6.4 if is_grand_total else 4.8
        pdf.set_font('Arial', 'B' if is_bold else '', 9)
        if is_red: pdf.set_text_color(255, 0, 0)
        if is_grand_total: pdf.set_fill_color(*pdf._header_color)

        pdf.cell(label_span_width, row_height, label, 1, 0, 'R', fill=is_grand_total)
        current_x_pos = pdf.get_x()
        
        for group in visible_price_groups:
            merged_value_width = group['sub'][0]['width'] + group['sub'][1]['width']
            
            pdf.set_xy(current_x_pos, pdf.get_y())
            value = values.get(group['id'])
            
            text = ''
            if value is not None:
                currency_symbol = '$' if 'usd' in group['sub'][1]['key'].lower() else 'BDT '
                if value < 0:
                    text = f"-{currency_symbol}{abs(value):,.2f}"
                else:
                    text = f"{currency_symbol}{value:,.2f}"

            pdf.cell(merged_value_width, row_height, text, 1, 0, 'R', fill=is_grand_total)
            current_x_pos += merged_value_width
            
        pdf.ln(row_height)
        pdf.set_text_color(0, 0, 0)
    
    subtotal_values = {group['id']: sum(safe_float(it.get(group['sub'][1]['key'], 0)) for it in items) for group in visible_price_groups}

    freight = safe_float(financials.get('freight_foreign_usd')) if financials.get('use_freight') else 0
    delivery = safe_float(financials.get('delivery_local_bdt')) if financials.get('use_delivery') else 0
    vat = safe_float(financials.get('vat_local_bdt')) if financials.get('use_vat') else 0
    ait = safe_float(financials.get('ait_local_bdt')) if financials.get('use_ait') else 0
    discount_foreign = safe_float(financials.get('discount_foreign_usd')) if financials.get('use_discount_foreign') else 0
    discount_local = safe_float(financials.get('discount_local_bdt')) if financials.get('use_discount_local') else 0
    discount_install = safe_float(financials.get('discount_installation_bdt')) if financials.get('use_discount_installation') else 0

    grand_total_foreign = subtotal_values.get('foreign', 0) + freight - discount_foreign
    grand_total_local_supply = subtotal_values.get('local', 0) - discount_local
    grand_total_install = subtotal_values.get('install', 0) - discount_install
    
    visible_group_ids = [g['id'] for g in visible_price_groups]
    grand_total_bdt_combined = grand_total_local_supply + grand_total_install
    
    if 'local' in visible_group_ids or 'install' in visible_group_ids:
        grand_total_bdt_combined += delivery + vat + ait

    grand_total_values = {
        'foreign': grand_total_foreign,
        'local': grand_total_local_supply,
        'install': grand_total_install + delivery + vat + ait if 'local' not in visible_group_ids else grand_total_install
    }

    grand_total_label = financial_labels.get('grandtotalLocal', 'Grand Total (BDT):') if is_local_only else financial_labels.get('grandtotalForeign', 'Grand Total:')

    if not has_additional_charges:
        add_summary_row(grand_total_label, grand_total_values, is_bold=True, is_grand_total=True)
    else:
        add_summary_row(financial_labels.get('subtotalForeign', 'Sub Total:'), subtotal_values, is_bold=True)
        is_foreign_visible_boq = 'foreign' in visible_group_ids
        is_local_supply_visible_boq = 'local' in visible_group_ids
        is_install_visible_boq = 'install' in visible_group_ids

        if freight > 0 and is_foreign_visible_boq:
            add_summary_row(financial_labels.get('freight', 'Freight:'), {'foreign': freight})
        
        if delivery > 0 and (is_local_supply_visible_boq or is_install_visible_boq):
            add_summary_row(financial_labels.get('delivery', 'Delivery:'), {'local' if is_local_supply_visible_boq else 'install': delivery})
        if vat > 0 and (is_local_supply_visible_boq or is_install_visible_boq):
            add_summary_row(financial_labels.get('vat', 'VAT:'), {'local' if is_local_supply_visible_boq else 'install': vat})
        if ait > 0 and (is_local_supply_visible_boq or is_install_visible_boq):
            add_summary_row(financial_labels.get('ait', 'AIT:'), {'local' if is_local_supply_visible_boq else 'install': ait})
            
        if any(d > 0 for d in [discount_foreign, discount_local, discount_install]):
            discount_values = {k: v for k, v in {
                'foreign': -discount_foreign if discount_foreign > 0 else None,
                'local': -discount_local if discount_local > 0 else None,
                'install': -discount_install if discount_install > 0 else None,
            }.items() if v is not None}
            add_summary_row('Discount:', discount_values, is_bold=True, is_red=True)

        add_summary_row(grand_total_label, grand_total_values, is_bold=True, is_grand_total=True)


def generate_financial_offer_pdf(data, auth_dir, header_color_hex):
    pdf = PDF()
    pdf.set_header_color(header_color_hex)
    pdf.alias_nb_pages()
    
    items = data.get('items', [])
    financials = data.get('financials', {})

    subtotal_foreign = sum(safe_float(it.get('foreign_total_usd', 0)) for it in items)
    subtotal_local_supply = sum(safe_float(it.get('local_supply_total_bdt', 0)) for it in items)
    subtotal_installation = sum(safe_float(it.get('installation_total_bdt', 0)) for it in items)

    freight = safe_float(financials.get('freight_foreign_usd')) if financials.get('use_freight') else 0
    delivery = safe_float(financials.get('delivery_local_bdt')) if financials.get('use_delivery') else 0
    vat = safe_float(financials.get('vat_local_bdt')) if financials.get('use_vat') else 0
    ait = safe_float(financials.get('ait_local_bdt')) if financials.get('use_ait') else 0
    discount_foreign = safe_float(financials.get('discount_foreign_usd')) if financials.get('use_discount_foreign') else 0
    discount_local = safe_float(financials.get('discount_local_bdt')) if financials.get('use_discount_local') else 0
    discount_install = safe_float(financials.get('discount_installation_bdt')) if financials.get('use_discount_installation') else 0

    grand_total_usd = subtotal_foreign + freight - discount_foreign
    grand_total_bdt = subtotal_local_supply + subtotal_installation + delivery + vat + ait - discount_local - discount_install
    
    data['words_usd'] = to_words_usd(grand_total_usd)
    data['words_bdt'] = to_words_bdt(grand_total_bdt)
    
    financial_labels = data.get('financialLabels', {})
    user_info = data.get('user', {})
    visible_columns, user_role = data.get('visibleColumns', {}), user_info.get('role', 'user')
    is_po_visible, is_foreign_visible = user_role == 'admin' and visible_columns.get('po_price'), visible_columns.get('foreign_price', True)
    is_local_visible, is_install_visible = visible_columns.get('local_supply_price'), visible_columns.get('installation_price')
    
    is_local_only = not is_foreign_visible and (is_local_visible or is_install_visible)
    is_local_part_visible = is_local_visible or is_install_visible

    has_freight_and_is_visible = freight > 0 and is_foreign_visible
    if has_freight_and_is_visible:
        financial_labels['subtotalForeign'] = 'Subtotal, Ex-Works:'
        financial_labels['grandtotalForeign'] = 'Grand Total, CFR, Chattogram (USD):'
    else:
        financial_labels['subtotalForeign'] = 'Subtotal:'
        financial_labels['grandtotalForeign'] = 'Grand Total, Ex-Works (USD):'

    sections = {
        'base': [
            {'id': 'sl', 'header': 'SL', 'width': 10 * 0.8, 'align': 'C'},
            {'id': 'desc', 'header': 'DESCRIPTION', 'width': 65, 'align': 'L'},
            {'id': 'qty', 'header': 'QTY', 'width': 10, 'align': 'C'},
            {'id': 'unit', 'header': 'UNIT', 'width': 15 * 0.8, 'align': 'C'},
        ],
        'price_groups': [
            {'id': 'foreign', 'visible': is_foreign_visible, 'header': financial_labels.get('foreignPrice', 'FOREIGN PRICE'), 'width': 40 * 0.8 * 1.05, 'sub': [
                {'key': 'foreign_price_usd', 'header': 'PRICE\n(USD)', 'width': 20 * 0.8 * 1.05, 'align': 'R'},
                {'key': 'foreign_total_usd', 'header': 'TOTAL\n(USD)', 'width': 20 * 0.8 * 1.05, 'align': 'R'}
            ]},
            {'id': 'po', 'visible': is_po_visible, 'header': 'PO PRICE', 'width': 40 * 0.8 * 1.05, 'sub': [
                {'key': 'po_price_usd', 'header': 'PRICE\n(USD)', 'width': 20 * 0.8 * 1.05, 'align': 'R'},
                {'key': 'po_total_usd', 'header': 'TOTAL\n(USD)', 'width': 20 * 0.8 * 1.05, 'align': 'R'}
            ]},
            {'id': 'local', 'visible': is_local_visible, 'header': financial_labels.get('localPrice', 'LOCAL SUPPLY PRICE'), 'width': 40 * 0.8 * 1.05, 'sub': [
                {'key': 'local_supply_price_bdt', 'header': 'PRICE\n(BDT)', 'width': 20 * 0.8 * 1.05, 'align': 'R'},
                {'key': 'local_supply_total_bdt', 'header': 'TOTAL\n(BDT)', 'width': 20 * 0.8 * 1.05, 'align': 'R'}
            ]},
            {'id': 'install', 'visible': is_install_visible, 'header': financial_labels.get('installationPrice', 'INSTALLATION PRICE'), 'width': 40 * 0.8 * 1.05, 'sub': [
                {'key': 'installation_price_bdt', 'header': 'PRICE\n(BDT)', 'width': 20 * 0.8 * 1.05, 'align': 'R'},
                {'key': 'installation_total_bdt', 'header': 'TOTAL\n(BDT)', 'width': 20 * 0.8 * 1.05, 'align': 'R'}
            ]}
        ]
    }
    visible_price_groups = [g for g in sections['price_groups'] if g['visible']]
    non_desc_width = sum(c['width'] for c in sections['base'] if c['id'] != 'desc') + sum(g['width'] for g in visible_price_groups)
    available_width = pdf.w - pdf.l_margin - pdf.r_margin
    sections['base'][1]['width'] = available_width - non_desc_width
    
    is_summary_enabled = data.get('isSummaryPageEnabled', False)
    
    if is_summary_enabled:
        client_info = data.get('client', {})
        summary_scopes = data.get('summaryScopes', {})
        full_reference_number = data.get('referenceNumber', "NoRef")

        pdf.is_summary_page = True
        pdf.project_details = {
            'projectName': client_info.get('name', 'N/A'),
            'submissionDate': datetime.now().strftime('%d-%B-%Y'),
            'reference': full_reference_number.split('_')[-1]
        }
        pdf.add_page()
        
        pdf.set_font('Arial', 'B', 12)
        pdf.set_fill_color(*pdf._header_color)
        pdf.cell(0, 8, "PRICE SUMMARY", 0, 1, 'C', fill=True)
        pdf.ln(3)

        pdf.set_fill_color(*pdf._header_color)
        pdf.set_font('Arial', 'B', 10)
        
        col_widths = { 'sl': 15, 'scope': 65, 'imported': 55, 'supply': 55 }
        row_height = 6
        header_start_y = pdf.get_y()
        header_start_x = pdf.l_margin

        right_header_start_x = header_start_x + col_widths['sl'] + col_widths['scope']
        pdf.set_xy(right_header_start_x, header_start_y)
        pdf.cell(col_widths['imported'] + col_widths['supply'], row_height, "Description of Head of Cost", 1, 0, 'C', fill=True)
        
        sub_header_y = header_start_y + row_height
        line_height = 4.5
        
        imported_text = "Imported Items\nwith Sea Freight (USD)"
        supply_text = "Supply, Installation,\nTesting & Commissioning (BDT)"
        
        num_lines_imported = len(pdf.multi_cell(col_widths['imported'], line_height, imported_text, 0, 'C', split_only=True))
        num_lines_supply = len(pdf.multi_cell(col_widths['supply'], line_height, supply_text, 0, 'C', split_only=True))
        
        sub_header_total_height = max(num_lines_imported, num_lines_supply) * line_height
        sub_header_total_height = max(sub_header_total_height, row_height)

        pdf.set_xy(right_header_start_x, sub_header_y)
        pdf.cell(col_widths['imported'], sub_header_total_height, '', 1, 0, 'C', fill=True)
        pdf.cell(col_widths['supply'], sub_header_total_height, '', 1, 0, 'C', fill=True)

        imported_text_height = num_lines_imported * line_height
        imported_y_padding = (sub_header_total_height - imported_text_height) / 2
        pdf.set_xy(right_header_start_x, sub_header_y + imported_y_padding)
        pdf.multi_cell(col_widths['imported'], line_height, imported_text, 0, 'C')

        supply_text_height = num_lines_supply * line_height
        supply_y_padding = (sub_header_total_height - supply_text_height) / 2
        pdf.set_xy(right_header_start_x + col_widths['imported'], sub_header_y + supply_y_padding)
        pdf.multi_cell(col_widths['supply'], line_height, supply_text, 0, 'C')
        
        final_y = sub_header_y + sub_header_total_height
        total_header_height = final_y - header_start_y
        
        pdf.set_xy(header_start_x, header_start_y)
        pdf.cell(col_widths['sl'], total_header_height, "SL", 1, 0, 'C', fill=True)
        
        pdf.set_xy(header_start_x + col_widths['sl'], header_start_y)
        pdf.cell(col_widths['scope'], total_header_height, "Scope of Works", 1, 0, 'C', fill=True)
        
        pdf.set_y(final_y)
        pdf.set_font('Arial', '', 10)

        sub_total_usd = sum(scope['total_usd'] for scope in summary_scopes.values())
        sub_total_bdt = sum(scope['total_bdt'] for scope in summary_scopes.values())
        
        sorted_scopes = sorted(summary_scopes.items())

        summary_row_height = 8 * 0.8
        for i, (key, scope) in enumerate(sorted_scopes):
            pdf.cell(15, summary_row_height, chr(65 + i), 1, 0, 'C')
            pdf.cell(65, summary_row_height, sanitize_text(scope['description']), 1, 0, 'L')
            pdf.cell(55, summary_row_height, f"${scope['total_usd']:,.2f}", 1, 0, 'R')
            pdf.cell(55, summary_row_height, f"BDT {scope['total_bdt']:,.2f}", 1, 1, 'R')
        
        def add_summary_row(label, val_usd, val_bdt, is_bold=False, is_red=False, is_grand=False):
            row_h = 8 * 0.8
            if is_grand: pdf.set_fill_color(*pdf._header_color)
            if is_bold: pdf.set_font('Arial', 'B', 10)
            if is_red: pdf.set_text_color(255, 0, 0)
            
            pdf.cell(80, row_h, label, 1, 0, 'R', fill=is_grand)
            
            if val_usd is not None:
                text = f"${val_usd:,.2f}"
                if val_usd < 0:
                    text = f"-${abs(val_usd):,.2f}"
                pdf.cell(55, row_h, text if val_usd != 0 else "$ -", 1, 0, 'R', fill=is_grand)
            else:
                 pdf.cell(55, row_h, "", 1, 0, 'R', fill=is_grand)
                 
            if val_bdt is not None:
                text = f"BDT {val_bdt:,.2f}"
                if val_bdt < 0:
                    text = f"-BDT {abs(val_bdt):,.2f}"
                pdf.cell(55, row_h, text if val_bdt != 0 else "BDT -", 1, 1, 'R', fill=is_grand)
            else:
                pdf.cell(55, row_h, "", 1, 1, 'R', fill=is_grand)

            pdf.set_font('Arial', '', 10)
            pdf.set_text_color(0, 0, 0)

        has_additional_charges = data.get('has_additional_charges', False)

        if has_additional_charges:
            add_summary_row(financial_labels.get('subtotalForeign', 'Sub-Total:'), sub_total_usd, sub_total_bdt, is_bold=True)
            # REVISED: Conditionally add rows
            if freight > 0 and is_foreign_visible:
                add_summary_row(financial_labels.get('freight', 'Sea Freight:'), freight, None)
            if is_local_part_visible:
                if delivery > 0:
                    add_summary_row(financial_labels.get('delivery', 'Delivery Charge:'), None, delivery)
                if vat > 0:
                    add_summary_row(financial_labels.get('vat', 'VAT:'), None, vat)
                if ait > 0:
                    add_summary_row(financial_labels.get('ait', 'AIT:'), None, ait)
            if discount_foreign > 0 or (discount_local + discount_install) > 0:
                add_summary_row("Special Discount:", -discount_foreign, -(discount_local + discount_install), is_bold=True, is_red=True)
        
        add_summary_row(financial_labels.get('grandtotalForeign', 'Grand Total:'), grand_total_usd, grand_total_bdt, is_bold=True, is_grand=True)
        
        if data.get('has_foreign_part') or data.get('has_local_part'):
            pdf.ln(5)
            if data.get('has_foreign_part'):
                pdf.set_font('Arial', 'B', 10)
                pdf.set_fill_color(238, 229, 118)
                pdf.cell(50, 8, "In Words (Foreign Part):", 1, 0, 'L', fill=True)
                pdf.set_font('Arial', '', 10)
                pdf.cell(140, 8, sanitize_text(data.get('words_usd', 'N/A')), 1, 1, 'L')
            
            if data.get('has_local_part'):
                pdf.set_font('Arial', 'B', 10)
                pdf.set_fill_color(238, 229, 118)
                pdf.cell(50, 8, "In Words (Local Part):", 1, 0, 'L', fill=True)
                pdf.set_font('Arial', '', 10)
                pdf.cell(140, 8, sanitize_text(data.get('words_bdt', 'N/A')), 1, 1, 'L')
        
        if data.get('has_foreign_part') and freight > 0:
            pdf.ln(5)
            pdf.set_font('Arial', 'B', 10)
            pdf.set_fill_color(238, 229, 118)
            pdf.cell(0, 8, "Important Note:", 0, 1, 'C', fill=True)
            pdf.set_font('Arial', '', 10)
            note_text = (f"Freight Charge (USD {freight:,.2f}) has been considered in light of the current market trending price, "
                         "applicable for the Sea Freight. Any increase in the freight charge will have to be borne by the client, "
                         "at the time of shipment.")
            pdf.multi_cell(0, 5, note_text, 0, 'L')
        
        pdf.is_summary_page = False
        pdf.set_doc_title("Bill of Quantities")
        pdf.add_page()
        draw_boq_content(pdf, data, sections, visible_price_groups)
        draw_financial_summary_rows_for_boq(pdf, data, sections, visible_price_groups, financial_labels, is_local_only)
    
    else:
        # --- CLASSIC BOQ LAYOUT ---
        pdf.set_doc_title("Financial Offer")
        pdf.add_page()
        client_info = data.get('client', {})
        full_reference_number = data.get('referenceNumber', "FinancialOffer_NoRef")
        display_reference = full_reference_number.split('_')[-1] if '_' in full_reference_number else full_reference_number
        sanitized_reference = sanitize_text(display_reference)
        sanitized_client_name = sanitize_text(client_info.get('name', 'N/A'))
        sanitized_client_address = sanitize_text(client_info.get('address', 'N/A'))

        pdf.set_font('Arial', 'B', 11)
        pdf.cell(pdf.get_string_width("Ref: ") + 1, 7, "Ref: ", 0, 0, 'L')
        pdf.set_font('Arial', '', 11)
        pdf.cell(0, 7, sanitized_reference, 0, 1, 'L')
        
        pdf.set_font('Arial', 'B', 11)
        pdf.cell(pdf.get_string_width("Client: ") + 1, 7, "Client: ", 0, 0, 'L')
        pdf.set_font('Arial', '', 11)
        pdf.multi_cell(0, 7, sanitized_client_name, 0, 'L')

        pdf.set_font('Arial', 'B', 11)
        pdf.cell(pdf.get_string_width("Address: ") + 1, 7, "Address: ", 0, 0, 'L')
        pdf.set_font('Arial', '', 11)
        pdf.multi_cell(0, 7, sanitized_client_address, 0, 'L')
        pdf.ln(10)
        
        draw_boq_content(pdf, data, sections, visible_price_groups)
        draw_financial_summary_rows_for_boq(pdf, data, sections, visible_price_groups, financial_labels, is_local_only)
        
        if data.get('has_foreign_part') or data.get('has_local_part'):
            pdf.ln(5)

        if data.get('has_foreign_part'):
            pdf.set_font('Arial', 'B', 10)
            pdf.set_fill_color(238, 229, 118)
            pdf.cell(50, 8, "In Words (Foreign Part):", 1, 0, 'L', fill=True)
            pdf.set_font('Arial', '', 10)
            pdf.cell(140, 8, sanitize_text(data.get('words_usd', 'N/A')), 1, 1, 'L')
        
        if data.get('has_local_part'):
            pdf.set_font('Arial', 'B', 10)
            pdf.set_fill_color(238, 229, 118)
            pdf.cell(50, 8, "In Words (Local Part):", 1, 0, 'L', fill=True)
            pdf.set_font('Arial', '', 10)
            pdf.cell(140, 8, sanitize_text(data.get('words_bdt', 'N/A')), 1, 1, 'L')
        
        if data.get('has_foreign_part'):
            if freight > 0:
                pdf.ln(5)
                pdf.set_font('Arial', 'B', 10)
                pdf.set_fill_color(238, 229, 118)
                pdf.cell(0, 8, "Important Note:", 0, 1, 'C', fill=True)
                pdf.set_font('Arial', '', 10)
                note_text = (f"Freight Charge (USD {freight:,.2f}) has been considered in light of the current market trending price, "
                            "applicable for the Sea Freight. Any increase in the freight charge will have to be borne by the client, "
                            "at the time of shipment.")
                pdf.multi_cell(0, 5, sanitize_text(note_text), 0, 'L')


    add_tnc_to_pdf(pdf, data.get('terms_and_conditions', ''))
    
    pdf.set_auto_page_break(False)
    signature_image_path = os.path.join(auth_dir, 'Signature_RIF.png')
    pdf.add_signature_block(signature_image_path, data.get('includeSignature', True))
    
    pdf.is_tnc_page = False
    pdf.is_summary_page = False

    return pdf.output(dest='S').encode('latin-1')


def generate_purchase_order_pdf(po_data, auth_dir, header_color_hex):
    items, project_info, financials = po_data.get('items', []), po_data.get('project_info', {}), po_data.get('financials', {})
    original_fo_ref = project_info.get('referenceNumber', 'UnknownRef')
    po_reference_number = original_fo_ref.replace('FO_', 'PO_', 1) if 'FO_' in original_fo_ref else f"PO_{original_fo_ref}"
    
    pdf = PDF()
    pdf.set_doc_title('Purchase Order')
    pdf.set_header_color(header_color_hex)
    pdf.alias_nb_pages()
    pdf.add_page()

    sanitized_po_ref = sanitize_text(po_reference_number)
    sanitized_client_name = sanitize_text(project_info.get('client', {}).get('name', 'N/A'))

    pdf.set_font('Arial', 'B', 11)
    pdf.cell(pdf.get_string_width("PO Ref: ") + 1, 7, "PO Ref: ", 0, 0, 'L')
    pdf.set_font('Arial', '', 11)
    pdf.cell(0, 7, sanitized_po_ref, 0, 1, 'L')

    pdf.set_font('Arial', 'B', 11)
    pdf.cell(pdf.get_string_width("Client: ") + 1, 7, "Client: ", 0, 0, 'L')
    pdf.set_font('Arial', '', 11)
    pdf.multi_cell(0, 7, sanitized_client_name, 0, 'L')
    
    pdf.ln(10)

    pdf.set_font('Arial', 'B', 9); pdf.set_fill_color(*pdf._header_color); pdf.set_text_color(0, 0, 0)
    headers, col_widths = ['SL', 'Description', 'PO Price', 'Unit', 'Total'], {'sl': 12, 'desc': 118, 'po_price': 20, 'unit': 20, 'total': 20}
    for h, key in zip(headers, col_widths.keys()): pdf.cell(col_widths[key], 10, h, 1, 0, 'C', fill=True)
    pdf.ln()

    pdf.set_font('Arial', '', 9); line_height = 5
    for i, item in enumerate(items):
        plain_text_desc = sanitize_text(html_to_plain_text(item.get('description', '')))
        
        num_lines = len(pdf.multi_cell(col_widths['desc'], line_height, plain_text_desc, 0, 'L', split_only=True))
        row_height = max(8, num_lines * line_height)
        
        start_y = pdf.get_y()
        pdf.cell(col_widths['sl'], row_height, str(i + 1), 1, 0, 'C')
        
        x_after_sl = pdf.get_x()
        x_after_desc = x_after_sl + col_widths['desc']
        pdf.set_x(x_after_desc)
        
        pdf.cell(col_widths['po_price'], row_height, f"{safe_float(item.get('po_price_usd', 0)):,}", 1, 0, 'R')
        pdf.cell(col_widths['unit'], row_height, sanitize_text(str(item.get('unit', 'Pcs'))), 1, 0, 'R')
        pdf.cell(col_widths['total'], row_height, f"{safe_float(item.get('po_total_usd', 0)):,}", 1, 1, 'R')
        
        pdf.set_xy(x_after_sl, start_y)
        pdf.rect(x_after_sl, start_y, col_widths['desc'], row_height)
        pdf.multi_cell(col_widths['desc'], line_height, plain_text_desc, 0, 'L')
        
        pdf.set_y(start_y + row_height)

    pdf.ln(5); pdf.set_font('Arial', 'B', 10)
    total_width = sum(col_widths.values())
    pdf.cell(total_width - 40, 8, "Grand Total:", 0, 0, 'R')
    pdf.cell(40, 8, str(financials.get('grand_total', '0.00')), 'B', 1, 'R')

    pdf.set_auto_page_break(False)
    signature_image_path = os.path.join(auth_dir, 'Signature_SHF.jpg')
    pdf.add_signature_block(signature_image_path)

    return pdf.output(dest='S').encode('latin-1')


def generate_challan_pdf(data, auth_dir, header_color_hex):
    client_info = data.get('client', {})
    items = data.get('items', [])
    ref_number = data.get('referenceNumber', 'N/A')
    
    pdf = PDF()
    pdf.set_doc_title('DELIVERY CHALLAN')
    pdf.set_header_color(header_color_hex)
    pdf.alias_nb_pages()
    pdf.add_page()
    
    sanitized_ref = sanitize_text(str(ref_number))
    sanitized_client_name = sanitize_text(client_info.get('name', 'N/A'))
    sanitized_client_address = sanitize_text(client_info.get('address', 'N/A'))

    pdf.set_font('Arial', 'B', 11)
    pdf.cell(0, 7, f"Challan No: {sanitized_ref}", 0, 1, 'L')
    pdf.set_font('Arial', 'B', 11)
    pdf.cell(pdf.get_string_width("Client: ") + 1, 7, "Client: ", 0, 0, 'L')
    pdf.set_font('Arial', '', 11)
    pdf.multi_cell(0, 7, sanitized_client_name, 0, 'L')

    pdf.set_font('Arial', 'B', 11)
    pdf.cell(pdf.get_string_width("Address: ") + 1, 7, "Address: ", 0, 0, 'L')
    pdf.set_font('Arial', '', 11)
    pdf.multi_cell(0, 7, sanitized_client_address, 0, 'L')
    pdf.ln(10)
    
    col_widths = {'sl': 15, 'desc': 125, 'qty': 25, 'unit': 25}
    
    pdf.set_font('Arial', 'B', 9)
    pdf.set_fill_color(*pdf._header_color)
    pdf.cell(col_widths['sl'], 10, 'SL', 1, 0, 'C', fill=True)
    pdf.cell(col_widths['desc'], 10, 'Item Description', 1, 0, 'C', fill=True)
    pdf.cell(col_widths['qty'], 10, 'Quantity', 1, 0, 'C', fill=True)
    pdf.cell(col_widths['unit'], 10, 'Unit', 1, 1, 'C', fill=True)
    
    pdf.set_font('Arial', '', 9)
    pdf.set_text_color(0,0,0)
    line_height = 5
    
    for i, item in enumerate(items):
        if pdf.get_y() > 240:
            pdf.add_page()
            pdf.set_font('Arial', 'B', 9)
            pdf.set_fill_color(*pdf._header_color)
            pdf.cell(col_widths['sl'], 10, 'SL', 1, 0, 'C', fill=True)
            pdf.cell(col_widths['desc'], 10, 'Item Description', 1, 0, 'C', fill=True)
            pdf.cell(col_widths['qty'], 10, 'Quantity', 1, 0, 'C', fill=True)
            pdf.cell(col_widths['unit'], 10, 'Unit', 1, 1, 'C', fill=True)
            pdf.set_font('Arial', '', 9)

        clean_html = str(item.get('description', '')).replace('&nbsp;', ' ')
        plain_text_desc = sanitize_text(html_to_plain_text(clean_html))
        
        quantity_str = sanitize_text(str(item.get('qty', '1')))
        unit_str = sanitize_text(str(item.get('unit', 'Pcs')))
        
        num_lines = len(pdf.multi_cell(col_widths['desc'], line_height, plain_text_desc, 0, 'L', split_only=True))
        row_height = max(8, num_lines * line_height)
        
        start_y = pdf.get_y()
        pdf.cell(col_widths['sl'], row_height, str(i + 1), 1, 0, 'C')
        x_after_sl = pdf.get_x()
        
        pdf.set_x(x_after_sl + col_widths['desc'])
        pdf.cell(col_widths['qty'], row_height, quantity_str, 1, 0, 'C')
        pdf.cell(col_widths['unit'], row_height, unit_str, 1, 1, 'C')
        
        pdf.set_xy(x_after_sl, start_y)
        pdf.rect(x_after_sl, start_y, col_widths['desc'], row_height)
        pdf.multi_cell(col_widths['desc'], line_height, plain_text_desc, 0, 'L')
        
        pdf.set_y(start_y + row_height)


    y_pos = pdf.get_y()
    if y_pos > 220:
        pdf.add_page()
        pdf.ln(10)
    else:
        pdf.ln(15)
        
    signature_image_path = os.path.join(auth_dir, 'Signature_RIF.png')
    signature_y_pos = pdf.get_y()

    pdf.ln(25)
    signature_y_pos = pdf.get_y()

    page_width = pdf.w - pdf.l_margin - pdf.r_margin
    col_width = page_width / 2
    right_col_x_start = pdf.l_margin + col_width

    if data.get('includeSignature', True) and os.path.exists(signature_image_path):
        img_width = 30.4
        img_x = right_col_x_start + (col_width / 2) - (img_width / 2) + 26.6
        img_y = signature_y_pos - 27.6
        pdf.image(signature_image_path, x=img_x, y=img_y, w=img_width)
    
    pdf.set_font('Arial', 'B', 10)

    pdf.cell(col_width, 5, '____________________', 0, 0, 'L')
    pdf.set_x(right_col_x_start)
    pdf.cell(col_width, 5, '____________________', 0, 1, 'R')

    pdf.cell(col_width, 5, 'Received By', 0, 0, 'L')
    pdf.set_x(right_col_x_start)
    pdf.cell(col_width, 5, 'Authorized Signature', 0, 1, 'R')
    
    return pdf.output(dest='S').encode('latin-1')