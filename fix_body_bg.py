import os
import glob

def fix_html_files():
    html_files = glob.glob(r'd:\professional_portfolio\piyush_portfolio\*.html')
    
    for file in html_files:
        with open(file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Replace body classes
        new_content = content.replace('body class="bg-zinc-50 dark:bg-black ', 'body class="bg-transparent ')
        new_content = new_content.replace('body class="bg-white dark:bg-black ', 'body class="bg-transparent ')
        
        # Check if fallback div already exists
        fallback_div = '<div class="fixed inset-0 bg-zinc-50 dark:bg-black -z-50 pointer-events-none"></div>'
        if fallback_div not in new_content:
            # Insert right after body tag
            # Find the closing angle bracket of the body tag
            body_idx = new_content.find('<body ')
            if body_idx != -1:
                close_bracket = new_content.find('>', body_idx)
                if close_bracket != -1:
                    new_content = new_content[:close_bracket+1] + f'\n  {fallback_div}' + new_content[close_bracket+1:]
        
        if new_content != content:
            with open(file, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Fixed {file}")

if __name__ == '__main__':
    fix_html_files()
