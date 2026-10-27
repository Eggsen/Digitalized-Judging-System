<?php

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . "/../database/config.php";
require_once __DIR__ . "/../utils/logger.php";

$token = trim($_GET['token'] ?? '');
$success = false;
$message = '';
$newSecurity = null;

if (empty($token)) {
    $message = "Invalid or missing security confirmation token.";
} else {
    try {
        $settingsDoc = $settingsCollection->findOne(['_id' => 'system_settings']);
        $pending = $settingsDoc['pending_security_change'] ?? null;

        if (!$pending || empty($pending['token'])) {
            $message = "This confirmation link is invalid or the security changes have already been applied.";
        } elseif (!hash_equals($pending['token'], $token)) {
            $message = "Invalid security confirmation token.";
        } else {
            // Check expiration
            $expiresAt = $pending['expires_at'] ?? null;
            $isExpired = false;
            if ($expiresAt instanceof MongoDB\BSON\UTCDateTime) {
                $expirySec = $expiresAt->toDateTime()->getTimestamp();
                if (time() > $expirySec) {
                    $isExpired = true;
                }
            }

            if ($isExpired) {
                $settingsCollection->updateOne(
                    ['_id' => 'system_settings'],
                    ['$unset' => ['pending_security_change' => ""]]
                );
                $message = "This confirmation link has expired (15-minute time limit). Please request the security change again in Admin Settings.";
            } else {
                // Apply changes
                $newSecurity = [
                    'googleAuthEnabled' => !empty($pending['changes']['googleAuthEnabled']),
                    'recaptchaEnabled' => !empty($pending['changes']['recaptchaEnabled'])
                ];

                $updatedBy = $pending['requested_by_username'] ?? 'Administrator';

                $settingsCollection->updateOne(
                    ['_id' => 'system_settings'],
                    [
                        '$set' => [
                            'security' => $newSecurity,
                            'updatedAt' => date('Y-m-d H:i:s'),
                            'updatedBy' => $updatedBy
                        ],
                        '$unset' => [
                            'pending_security_change' => ""
                        ]
                    ]
                );

                logSystemAction(
                    $pending['requested_by_id'] ?? null,
                    $updatedBy,
                    'admin',
                    'VERIFY_SECURITY_SETTINGS',
                    'Admin verified security settings via email link: Google OAuth=' . ($newSecurity['googleAuthEnabled'] ? 'ON' : 'OFF') . ', reCAPTCHA=' . ($newSecurity['recaptchaEnabled'] ? 'ON' : 'OFF')
                );

                $success = true;
                $message = "Your authentication and security settings have been successfully verified and applied to the system.";
            }
        }
    } catch (Throwable $e) {
        $message = "An unexpected error occurred: " . $e->getMessage();
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://kit.fontawesome.com/12ec0fec7b.js" crossorigin="anonymous"></script>
    <link rel="stylesheet" href="/frontend/css/output.css">
    <link rel="icon" href="/assets/logo/DJS Logo.png">
    <title>Security Settings Verification | BukSU DJS</title>
</head>
<body class="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col justify-between antialiased selection:bg-buksu-navy selection:text-buksu-gold relative overflow-x-hidden">

    <div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-buksu-navy/5 to-transparent pointer-events-none -z-10 blur-3xl"></div>

    <!-- Header Navigation -->
    <header class="w-full bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-buksu-navy flex items-center justify-center text-buksu-gold shadow-md border border-buksu-gold/30">
                    <i class="fa-solid fa-scale-balanced text-lg"></i>
                </div>
                <div>
                    <span class="font-extrabold text-buksu-navy text-lg tracking-tight">JudgeTab</span>
                    <span class="font-medium text-slate-500 text-sm hidden sm:inline-block ms-1.5 border-l border-slate-300 ps-2">Security Verification</span>
                </div>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div class="w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-slate-900/10 border border-slate-100 p-6 sm:p-8 text-center animate-fade-in">
            
            <?php if ($success): ?>
                <div class="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-4 text-3xl shadow-xs border border-emerald-500/20">
                    <i class="fa-solid fa-shield-check"></i>
                </div>

                <h2 class="text-xl font-black text-buksu-navy tracking-tight">Security Changes Verified</h2>
                <p class="text-xs text-slate-500 mt-1.5 font-normal leading-relaxed"><?= htmlspecialchars($message) ?></p>

                <?php if ($newSecurity): ?>
                <div class="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-left space-y-3">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Active Security Configuration:</span>
                    
                    <div class="flex items-center justify-between text-xs">
                        <span class="font-bold text-slate-700 flex items-center gap-2">
                            <i class="fa-brands fa-google text-slate-500"></i> Google OAuth Login
                        </span>
                        <?php if ($newSecurity['googleAuthEnabled']): ?>
                            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">Enabled</span>
                        <?php else: ?>
                            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">Disabled</span>
                        <?php endif; ?>
                    </div>

                    <div class="flex items-center justify-between text-xs pt-2 border-t border-slate-200/60">
                        <span class="font-bold text-slate-700 flex items-center gap-2">
                            <i class="fa-solid fa-robot text-slate-500"></i> Google reCAPTCHA v2
                        </span>
                        <?php if ($newSecurity['recaptchaEnabled']): ?>
                            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">Enabled</span>
                        <?php else: ?>
                            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">Disabled</span>
                        <?php endif; ?>
                    </div>
                </div>
                <?php endif; ?>

                <div class="mt-6">
                    <a href="/dashboard.php" class="w-full py-3 px-4 bg-buksu-navy hover:bg-buksu-navy-light text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer border border-buksu-gold/30">
                        <i class="fa-solid fa-arrow-left text-buksu-gold"></i>
                        <span>Return to Admin Dashboard</span>
                    </a>
                </div>

            <?php else: ?>
                <div class="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto mb-4 text-3xl shadow-xs border border-rose-500/20">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>

                <h2 class="text-xl font-black text-rose-600 tracking-tight">Verification Failed</h2>
                <p class="text-xs text-slate-500 mt-1.5 font-normal leading-relaxed"><?= htmlspecialchars($message) ?></p>

                <div class="mt-6">
                    <a href="/dashboard.php" class="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer">
                        <span>Go to Dashboard</span>
                    </a>
                </div>
            <?php endif; ?>

        </div>
    </main>

    <!-- Footer -->
    <footer class="w-full py-4 text-center text-xs text-slate-400 border-t border-slate-200/80 bg-white/80 backdrop-blur-md">
        <p>&copy; 2026 Bukidnon State University Digitalized Judging System. All rights reserved.</p>
    </footer>

</body>
</html>
