import re
from num2words import num2words
import math

def html_to_plain_text(html):
    """A simple regex-based converter to strip HTML for plain text representations."""
    if not html:
        return ''
    # Remove <br> and <p> tags with newlines
    text = re.sub(r'<br\s*/?>|<p\s*.*?>', '\n', str(html))
    # Remove any other tags
    text = re.sub(r'<.*?>', '', text)
    # Decode HTML entities
    text = text.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    return text.strip()

def to_words_usd(number):
    """Converts a number to a specific USD word format."""
    try:
        if not isinstance(number, (int, float)):
            number = float(number)
        
        dollars = int(number)
        cents = int(round((number - dollars) * 100))
        
        dollar_words = num2words(dollars).title()
        # Remove commas and internal "And"
        dollar_words = dollar_words.replace(",", "").replace(" And ", " ")
        
        if cents == 0:
            return f"USD {dollar_words} Only"
        else:
            # The final "And" before cents is correct
            return f"USD {dollar_words} And {cents}/100 Only"
            
    except Exception:
        return "N/A"

def to_words_bdt(number):
    """Converts a number to a specific BDT word format with Taka and Poisha."""
    try:
        if not isinstance(number, (int, float)):
            number = float(number)
        
        taka = int(number)
        poisha = int(round((number - taka) * 100))
        
        # Using 'en_IN' locale to get the Lakh/Crore system
        taka_words = num2words(taka, lang='en_IN').title()
        # Remove commas and internal "And"
        taka_words = taka_words.replace(",", "").replace(" And ", " ")
        
        if poisha == 0:
            return f"BDT {taka_words} Only"
        else:
            # The final "And" before poisha is correct
            return f"BDT {taka_words} And {poisha}/100 Only"
            
    except Exception:
        return "N/A"