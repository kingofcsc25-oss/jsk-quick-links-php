const fs = require('fs');
const html = fs.readFileSync('doulfin_dump.html', 'utf8');
const regex = /<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g;
let match;
const links = [];
while ((match = regex.exec(html)) !== null) {
  let text = match[2].replace(/<[^>]+>/g, '').trim();
  if (text) links.push({ text: text, url: match[1] });
}
fs.writeFileSync('links.json', JSON.stringify(links, null, 2));
console.log('Saved ' + links.length + ' links to links.json');
