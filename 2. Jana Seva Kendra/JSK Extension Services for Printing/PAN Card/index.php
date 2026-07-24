<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PAN Card Print Service</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #f59e0b;
            --surface: #ffffff;
            --text-main: #0f172a;
            --text-muted: #64748b;
            --bg: #f8fafc;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Outfit', sans-serif; }
        body { background-color: var(--bg); color: var(--text-main); display: flex; flex-direction: column; min-height: 100vh; padding: 2rem; align-items: center; }
        .container { max-width: 800px; width: 100%; background: var(--surface); border-radius: 20px; padding: 3rem 2rem; box-shadow: 0 10px 25px rgba(0,0,0,0.05); text-align: center; }
        .page-title { font-size: 2rem; color: var(--primary); margin-bottom: 1rem; }
        .message { color: var(--text-muted); font-size: 1.1rem; margin-bottom: 2rem; }
        .back-link { display: inline-flex; align-items: center; color: var(--primary); text-decoration: none; font-weight: 600; }
        .back-link:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="page-title">💳 PAN Card Print Service</h1>
        <p class="message">This service is currently under development or maintenance. Please check back later.</p>
        <a href="../index.php" class="back-link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            Back to Services
        </a>
    </div>
</body>
</html>
