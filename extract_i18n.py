import re
import json
import os

# Files to process
FILES = [
    r"src/app/bookings/page.tsx",
    r"src/app/bookings/bookings-client.tsx",
    r"src/app/calendar/page.tsx",
    r"src/app/calendar/availability-grid.tsx",
    r"src/app/content/page.tsx",
    r"src/app/content/content-client.tsx"
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
                key = text.lower().replace(' ', '_')[:30]
                # Ensure uniqueness logic implies we might overwrite, but good enough for now
                if key not in extracted_strings:
                    extracted_strings[key] = text
        
        # Extract attributes
        matches_attr = ATTRIBUTE_REGEX.findall(content)
        for attr, text in matches_attr:
            text = text.strip()
            if text and len(text) > 1:
                key = text.lower().replace(' ', '_')[:30]
                if key not in extracted_strings:
                    extracted_strings[key] = text
                    
    except FileNotFoundError:
        print(f"File not found: {filepath}")

def main():
    base_dir = os.getcwd()
    for rel_path in FILES:
        full_path = os.path.join(base_dir, rel_path)
        extract_from_file(full_path)

    # Ensure output directory exists
    os.makedirs('messages', exist_ok=True)
    
    # Write to JSON
    output_path = os.path.join(base_dir, 'messages', 'en.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(extracted_strings, f, indent=2, ensure_ascii=False)
    
    print(f"Extraction complete. Found {len(extracted_strings)} strings.")
    print(f"Saved to {output_path}")

if __name__ == "__main__":
    main()
