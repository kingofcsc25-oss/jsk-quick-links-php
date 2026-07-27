$content = Get-Content 'F:\Google\jskquicklinks\temp_ext_extract\content.js' -Raw

$proxy = "
// FETCH PROXY TO BYPASS CORS
const originalFetch = window.fetch;
window.fetch = async function(url, options) {
    if (typeof url === 'string' && url.includes('script.google.com')) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'proxyFetch',
                url: url,
                options: options
            }, response => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText
                    }));
                }
            });
        });
    }
    return originalFetch.apply(this, arguments);
};
"

$newContent = $proxy + "`n" + $content
Set-Content 'F:\Google\jskquicklinks\2. Jana Seva Kendra\JSK Extension Services for Printing\SSPCM\SSPCM Extension COde\content.js' -Value $newContent -Encoding UTF8
