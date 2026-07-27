import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# find the <div style="display: flex; gap: 10px; justify-content: center;">
# and replace everything up to </div>
import re
pattern = re.compile(r'<div style="display: flex; gap: 10px; justify-content: center;">.*?</div>', re.DOTALL)

replacement = """<div style="display: flex; gap: 10px; justify-content: center;">
                        <a href="SSPCM_NEW_FIXED_JULY27.zip"
                            download="SSPCM_NEW_FIXED_JULY27.zip"
                            class="tab-btn active" style="background:#8b5cf6; border-color:#8b5cf6;">📥 Download SSP Extension (.zip)</a>
                        <button class="tab-btn"
                            onclick="document.getElementById('ssp-warning-message').style.display='none'; document.getElementById('ext-services-list').style.display='grid';">Go Back</button>
                    </div>"""

# Replace ONLY the first match which is the SSP extension (there might be others for DL and PAN)
# Wait, the first match of that div is inside the SSP warning!
content = pattern.sub(replacement, content, count=1)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
