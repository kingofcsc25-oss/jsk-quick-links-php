<?php
// anganawadi_recruitments.php
// Dynamically fetch Anganawadi Recruitments for the current year

$current_year = date("Y");
$url = "https://karnemakaone.kar.nic.in/abcd/";

function fetch_latest_date($url) {
    $deadlines_file = __DIR__ . '/job_deadlines.json';
    if (file_exists($deadlines_file)) {
        $deadlines = json_decode(file_get_contents($deadlines_file), true);
        if (isset($deadlines[$url])) {
            return $deadlines[$url];
        }
    }
    return "Check Notification";
}

$data_file = __DIR__ . '/anganawadi_data.json';
$jobs = [];
if (file_exists($data_file)) {
    $raw_data = json_decode(file_get_contents($data_file), true);
    if (is_array($raw_data)) {
        foreach($raw_data as $entry) {
            $jobs[] = [
                'title' => htmlspecialchars($entry['notification']) . " - " . htmlspecialchars($entry['project']),
                'district' => htmlspecialchars($entry['district']),
                'link' => 'https://karnemakaone.kar.nic.in/abcd/ApplicationForm_JA_org.aspx',
                'date' => htmlspecialchars($entry['last_date'])
            ];
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Anganawadi Live Recruitments</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Outfit', sans-serif; }
        body { background-color: #f8fafc; color: #0f172a; padding: 2rem; }
        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 16px; padding: 2rem; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); }
        .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 1rem; }
        .header h1 { color: #2563eb; font-size: 1.8rem; }
        .badge { background: #dbeafe; color: #1e40af; padding: 5px 12px; border-radius: 20px; font-weight: 600; font-size: 0.9rem; }
        .job-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; transition: transform 0.2s, box-shadow 0.2s; }
        .job-card:hover { transform: translateY(-3px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.08); border-color: #cbd5e1; }
        .job-title { font-weight: 600; font-size: 1.1rem; color: #0f172a; margin-bottom: 0.5rem; line-height: 1.4; }
        .job-meta { color: #64748b; font-size: 0.85rem; }
        .apply-btn { background: #2563eb; color: white; padding: 0.6rem 1.2rem; border-radius: 8px; text-decoration: none; font-size: 0.9rem; font-weight: 500; transition: background 0.3s; white-space: nowrap; margin-left: 1rem;}
        .apply-btn:hover { background: #1d4ed8; }
        .empty-state { text-align: center; color: #64748b; padding: 3rem 0; }
        .back-link { display: inline-flex; align-items: center; margin-bottom: 1.5rem; color: #64748b; text-decoration: none; font-weight: 500; transition: color 0.2s; }
        .back-link:hover { color: #2563eb; }
        .back-link svg { margin-right: 5px; }
        @media (max-width: 600px) {
            .job-card { flex-direction: column; align-items: flex-start; }
            .apply-btn { margin-left: 0; margin-top: 1rem; width: 100%; text-align: center; }
        }
    </style>
</head>
<body>
    <div class="container">
        <a href="../../index.php" class="back-link">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            Back to JSK Portal
        </a>
        
        <div class="header">
            <h1>Anganawadi Live Recruitments</h1>
            <span class="badge">Year <?php echo $current_year; ?></span>
        </div>
        
        <?php if(empty($jobs)): ?>
            <div class="empty-state">
                <div style="font-size: 4rem; margin-bottom: 1rem;">📭</div>
                <h3 style="color: #0f172a; margin-bottom: 0.5rem;">No New Recruitments Found</h3>
                <p>There are currently no new recruitment updates on Anganawadi for <?php echo $current_year; ?>.</p>
                <a href="<?php echo $url; ?>" target="_blank" class="apply-btn" style="display: inline-block; margin-top: 1.5rem;">Visit Anganawadi Official Site</a>
            </div>
        <?php else: 
            $active_jobs = [];
            $expired_jobs = [];
            $today = new DateTime();
            $today->setTime(0, 0, 0);

            foreach($jobs as $job) {
                if ($job['date'] == 'Check Notification') {
                    $active_jobs[] = array_merge($job, ['status_text' => 'Check Official Notification', 'is_expired' => false]);
                } else {
                    $job_date = DateTime::createFromFormat('d-m-Y', $job['date']);
                    if (!$job_date) {
                        $active_jobs[] = array_merge($job, ['status_text' => 'Date: ' . $job['date'], 'is_expired' => false]);
                        continue;
                    }
                    $job_date->setTime(0, 0, 0);
                    $interval = $today->diff($job_date);
                    
                    if ($job_date >= $today) {
                        $days = $interval->days;
                        $text = ($days == 0) ? "Expires Today!" : "Expires in {$days} days";
                        $active_jobs[] = array_merge($job, ['status_text' => $text, 'is_expired' => false]);
                    } else {
                        $expired_jobs[] = array_merge($job, ['status_text' => "Expired", 'is_expired' => true]);
                    }
                }
            }
        ?>
            <p style="color: #64748b; margin-bottom: 1.5rem; font-size: 0.95rem;">
                Successfully fetched <strong><?php echo count($jobs); ?></strong> live updates from Anganawadi.
            </p>
            
            <!-- Active Jobs -->
            <?php foreach($active_jobs as $job): ?>
                <div class="job-card">
                    <div>
                        <div class="job-title"><?php echo $job['title']; ?></div>
                        <div class="job-meta" style="margin-bottom: 5px;">📍 District: <?php echo isset($job['district']) ? $job['district'] : 'Women and Child Development (WCD)'; ?></div>
                        <div class="job-meta" style="color: #059669; font-weight: 500;">⏳ <?php echo $job['status_text']; ?></div>
                    </div>
                    <a href="<?php echo $job['link']; ?>" target="_blank" class="apply-btn">View Details ➔</a>
                </div>
            <?php endforeach; ?>

            <!-- Expired Jobs -->
            <?php if(!empty($expired_jobs)): ?>
                <div style="margin-top: 3rem; margin-bottom: 1rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">
                    <h2 style="color: #94a3b8; font-size: 1.2rem;">Past / Expired Notifications</h2>
                </div>
                <?php foreach($expired_jobs as $job): ?>
                    <div class="job-card" style="opacity: 0.75; filter: grayscale(100%);">
                        <div>
                            <div class="job-title" style="color: #64748b; text-decoration: line-through;"><?php echo $job['title']; ?></div>
                            <div class="job-meta" style="margin-bottom: 5px;">📍 District: <?php echo isset($job['district']) ? $job['district'] : 'Women and Child Development (WCD)'; ?></div>
                            <div class="job-meta" style="color: #ef4444; font-weight: 500;">🛑 <?php echo $job['status_text']; ?> (<?php echo $job['date']; ?>)</div>
                        </div>
                        <a href="<?php echo $job['link']; ?>" target="_blank" class="apply-btn" style="background: #94a3b8;">View Details ➔</a>
                    </div>
                <?php endforeach; ?>
            <?php endif; ?>
        <?php endif; ?>
    </div>
</body>
</html>
