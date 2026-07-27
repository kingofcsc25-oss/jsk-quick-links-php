import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# The mangled part from our bad replace
bad_pattern = r'<div style="display: flex; gap: 10px; justify-content: center;">\s*download="SSPCM_Extension\.zip".*?</div>'
new_html = '''<div style="display: flex; gap: 10px; justify-content: center;">
                        <a href="SSPCM_NEW_FIXED_JULY27.zip"
                            download="SSPCM_NEW_FIXED_JULY27.zip"
                            class="tab-btn active" style="background:#8b5cf6; border-color:#8b5cf6;">📥 Download SSP Extension (.zip)</a>
                        <button class="tab-btn"
                            onclick="document.getElementById('ssp-warning-message').style.display='none'; document.getElementById('ext-services-list').style.display='grid';">Go Back</button>
                    </div>'''

content = re.sub(bad_pattern, new_html, content, flags=re.DOTALL)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
