import re
import json
import os

# Files to process
FILES = [
    r"src/app/[locale]/expenses/page.tsx",
    r"src/app/[locale]/expenses/expenses-client.tsx",
    r"src/app/[locale]/payouts/page.tsx",
    r"src/app/[locale]/payouts/payouts-client.tsx",
    r"src/app/[locale]/publishing/page.tsx",
    r"src/app/[locale]/publishing/publishing-client.tsx",
    r"src/app/[locale]/rates/page.tsx",
    r"src/app/[locale]/rates/rates-client.tsx",
    r"src/app/[locale]/reports/page.tsx",
    r"src/app/[locale]/reports/reports-client.tsx",
    r"src/app/[locale]/units/page.tsx",
    r"src/app/[locale]/units/units-client.tsx",
    r"src/app/[locale]/page.tsx", # Dashboard
]

# Regex patterns for finding text
# 1. Text between tags: >Some Text<
TEXT_CONTENT_REGEX = re.compile(r'>\s*([^<>{}]+?)\s*<')

# 2. Text in specific attributes: placeholder="Some Text", title="...", alt="...", label="..."
ATTRIBUTE_REGEX = re.compile(r'\b(placeholder|title|alt|label|aria-label)\s*=\s*"([^"]+)"')

extracted_strings = {}

def extract_from_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        print(f"Processing {filepath}...")
        
        # Extract text content
        matches_text = TEXT_CONTENT_REGEX.findall(content)
        for text in matches_text:
            text = text.strip()
            if text and not text.isnumeric() and len(text) > 1:
                # Create a key based on the text (simplified)
                # Filter out likely code artifacts
                if not re.match(r'^[\d\s\W]+$', text):
                   key = text.lower().replace(' ', '_').replace('-', '_').replace('(', '').replace(')', '')[:40]
                   # Remove trailing underscore
                   key = key.rstrip('_')
                   if key not in extracted_strings:
                       extracted_strings[key] = text
        
        # Extract attributes
        matches_attr = ATTRIBUTE_REGEX.findall(content)
        for attr, text in matches_attr:
            text = text.strip()
            if text and len(text) > 1:
                if not re.match(r'^[\d\s\W]+$', text):
                    key = text.lower().replace(' ', '_').replace('-', '_')[:40]
                    key = key.rstrip('_')
                    if key not in extracted_strings:
                        extracted_strings[key] = text
                    
    except FileNotFoundError:
        print(f"File not found: {filepath}")

def main():
    base_dir = os.getcwd()
    # Also load existing en.json to preserve keys if needed, but we want fresh extraction
    
    for rel_path in FILES:
        full_path = os.path.join(base_dir, rel_path)
        extract_from_file(full_path)

    # Ensure output directory exists
    os.makedirs('messages', exist_ok=True)
    
    # Write to JSON
    output_path = os.path.join(base_dir, 'messages', 'extracted_v2.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(extracted_strings, f, indent=2, ensure_ascii=False)
    
    print(f"Extraction complete. Found {len(extracted_strings)} strings.")
    print(f"Saved to {output_path}")

if __name__ == "__main__":
    main()
