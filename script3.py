import os
import re

files_to_update = ['projects.html', 'blog.html', 'blog-article.html', 'case-study.html']
cwd = r'd:\professional_portfolio\piyush_portfolio'

reveal_regex = re.compile(r'\.reveal\{opacity:0;transform:translateY\([^\)]+\);transition:opacity [^,]+,transform [^\}]+\}')
reveal_replacement = r'.reveal{opacity:0;transform:translateY(30px) scale(0.98);transition:opacity 0.8s cubic-bezier(0.25, 1, 0.5, 1), transform 0.8s cubic-bezier(0.25, 1, 0.5, 1);}'

lenis_regex = re.compile(r'const lenis = new Lenis\(\{\s*duration: 1\.2,\s*easing: \(t\) => Math\.min\(1, 1\.001 - Math\.pow\(2, -10 \* t\)\)\s*\}\);')
lenis_replacement = """const lenis = new Lenis({
        lerp: 0.08,
        smoothWheel: true,
        wheelMultiplier: 1.2
      });"""

for file_name in files_to_update:
    file_path = os.path.join(cwd, file_name)
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        content = reveal_regex.sub(reveal_replacement, content)
        content = lenis_regex.sub(lenis_replacement, content)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {file_name}")
    else:
        print(f"File {file_name} not found.")
