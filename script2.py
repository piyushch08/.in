import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

def inject_class(tag, new_classes):
    # if it already has the core class, skip
    if new_classes.split()[0] in tag:
        return tag
        
    if 'class="' in tag:
        # inject into existing class attribute
        return tag.replace('class="', f'class="{new_classes} ', 1)
    else:
        # add class attribute
        # insert right after the tag name (e.g. <a href=... -> <a class="..." href=...)
        parts = tag.split(' ', 1)
        if len(parts) > 1:
            return f'{parts[0]} class="{new_classes}" {parts[1]}'
        else:
            # e.g. <a> -> <a class="...">
            return f'{parts[0][:-1]} class="{new_classes}">'
            
def a_replacer(match):
    tag = match.group(0)
    # Don't add to card-h as they have their own hover
    if 'card-h' in tag:
        return tag
    
    # Check if flex or inline-flex is present, if so no need for inline-block
    if 'flex' in tag or 'inline-flex' in tag or 'block' in tag:
        return inject_class(tag, 'hover:scale-105 transition-transform duration-300')
    else:
        return inject_class(tag, 'hover:scale-105 transition-transform duration-300 inline-block')

def button_replacer(match):
    tag = match.group(0)
    return inject_class(tag, 'hover:-translate-y-1 hover:shadow-lg hover:shadow-accent/20 transition-all duration-300')

# Apply to <a ...> tags. We use a regex that matches `<a ` up to `>` but handles newlines.
content = re.sub(r'<a\s+[^>]*>', a_replacer, content)

# Apply to <button ...> tags
content = re.sub(r'<button\s+[^>]*>', button_replacer, content)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
