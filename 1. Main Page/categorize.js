const fs = require('fs');
const path = require('path');

const links = JSON.parse(fs.readFileSync('links.json', 'utf8'));

const categories = {
    "Aadhaar Services": ['aadhar', 'aadhaar', 'uidai', 'adhaar'],
    "PAN Card Services": ['pan ', 'pancard', 'nsdl', 'uti', 'e-pan'],
    "Ration Card Services": ['ration', 'ahara', 'fcs'],
    "Voter ID Services": ['voter', 'eci', 'epic'],
    "Passport & Police": ['passport', 'police'],
    "UDID & Disability": ['udid', 'disability', 'swavlamban'],
    "EPF & Pension": ['epf', 'pension', 'maandhan', 'pf '],
    "Student & Scholarship": ['scholarship', 'student', 'result', 'sslc', 'cbse', 'cet', 'prize money', 'university', 'college'],
    "Utility & Bills": ['bill', 'recharge', 'water', 'keb', 'bescom', 'electricity'],
    "Land, Property & Vehicles": ['bhoomi', 'rtc', 'property', 'vehicle', 'housing', 'ashraya', 'khb'],
    "Jobs, Labor & Business": ['shrama', 'labor', 'business', 'udyam', 'msme', 'fssai', 'trade license', 'industry'],
    "Certificates & Other Govt": ['certificate', 'birth', 'death', 'caste', 'income', 'ejanma'],
    "Jana Seva Kendra": ['seva sindhu', 'nadakacheri', 'csc', 'grama', 'kendra'],
    "Jobs": ['job', 'recruitment', 'kpsc', 'kptcl', 'anganwadi', 'police constable', 'vacancy', 'career']
};

const sanitize = (name) => {
    return name.replace(/[<>:"\/\\|?*\x00-\x1F]/g, '').trim();
};

const categorized = {};

links.forEach(link => {
    let text = link.text.trim();
    let lowerText = text.toLowerCase();
    let assignedCategory = "General Other Services";
    
    for (const [cat, keywords] of Object.entries(categories)) {
        if (keywords.some(kw => lowerText.includes(kw))) {
            assignedCategory = cat;
            break;
        }
    }
    
    if (!categorized[assignedCategory]) {
        categorized[assignedCategory] = [];
    }
    
    const dirName = sanitize(text);
    if (dirName) {
        const fullPath = path.join(__dirname, assignedCategory, dirName);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
        
        // Create an index.php file inside the folder that redirects to the actual URL
        const phpContent = `<?php
// Auto-generated redirect for ${text}
header("Location: ${link.url}");
exit();
?>`;
        fs.writeFileSync(path.join(fullPath, 'index.php'), phpContent);
        
        // Save the local path instead of the external URL for the UI
        categorized[assignedCategory].push({
            text: text,
            url: `${assignedCategory}/${dirName}/index.php`,
            external_url: link.url
        });
    }
});

fs.writeFileSync('categorized_links.json', JSON.stringify(categorized, null, 2));
console.log('Categorization complete! Created folders, added index.php redirects, and saved to categorized_links.json');
