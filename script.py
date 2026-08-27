import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace text color classes in headings with text-accent
def heading_replacer(match):
    tag = match.group(0)
    # Remove existing text color classes
    tag = re.sub(r'\b(text-black|dark:text-white|text-white|text-zinc-\d+)\b', '', tag)
    # Add text-accent if it's not there
    if 'text-accent' not in tag:
        tag = tag.replace('class="', 'class="text-accent ', 1)
    # Cleanup multiple spaces
    tag = re.sub(r'\s+', ' ', tag)
    return tag

content = re.sub(r'<h[1-6][^>]*class="[^>]*>', heading_replacer, content)

# Also apply to <strong> keywords
def strong_replacer(match):
    tag = match.group(0)
    tag = re.sub(r'\b(text-black|dark:text-white|text-white|text-zinc-\d+|dark:text-zinc-\d+)\b', '', tag)
    if 'text-accent' not in tag:
        tag = tag.replace('class="', 'class="text-accent ', 1)
    return tag

content = re.sub(r'<strong[^>]*class="[^>]*>', strong_replacer, content)

# Add hover effects to links/buttons (ones that look like buttons: rounded-full, rounded-xl etc with bg or border)
def btn_replacer(match):
    tag = match.group(0)
    if 'hover:-translate-y-1' not in tag:
        tag = tag.replace('class="', 'class="hover:-translate-y-1 hover:shadow-lg hover:shadow-accent/20 transition-all duration-300 ', 1)
    return tag

content = re.sub(r'<(a|button)[^>]*class="[^"]*(rounded-full|rounded-xl|rounded-3xl)[^"]*(bg-|border-|card-h)[^"]*">', btn_replacer, content)

# Add hover effect specifically to .nl navigation links (just changing duration or adding transform isn't great because it breaks layout, 
# but they already have the ::after transition which is a nice underline effect). We can add scale.
def nl_replacer(match):
    tag = match.group(0)
    if 'hover:scale-105' not in tag:
        tag = tag.replace('class="', 'class="hover:scale-105 transition-transform duration-300 ', 1)
    return tag

content = re.sub(r'<a[^>]*class="[^"]*\bnl\b[^"]*">', nl_replacer, content)

# Write back
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
