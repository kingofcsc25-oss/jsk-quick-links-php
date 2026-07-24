// Grab the target URL from query parameters
const urlParams = new URLSearchParams(window.location.search);
const targetUrl = urlParams.get('url');

if (targetUrl) {
    document.getElementById('frame-container').src = targetUrl;
} else {
    document.getElementById('frame-container').src = "https://rtc.karnataka.gov.in/service78/Dashboard.aspx";
}
