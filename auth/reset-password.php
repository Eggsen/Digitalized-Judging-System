<?php

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$resetToken = htmlspecialchars($_GET['reset_token'] ?? $_GET['token'] ?? '');

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://kit.fontawesome.com/12ec0fec7b.js" crossorigin="anonymous"></script>
    <link rel="stylesheet" href="/frontend/css/output.css">
    <link rel="icon" href="/assets/logo/DJS Logo.png">
    <script type="module" src="/scripts/ui/authUI.js"></script>
    <title>Reset Password | BukSU Digitalized Judging System</title>
</head>
<body class="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col justify-between antialiased selection:bg-buksu-navy selection:text-buksu-gold relative overflow-x-hidden">

    <div class="dashboard-bg"></div>

    <div class="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-linear-to-b from-buksu-navy/5 to-transparent pointer-events-none -z-10 blur-3xl"></div>
    <div class="fixed -bottom-20 -right-20 w-80 h-80 rounded-full bg-buksu-gold/10 pointer-events-none -z-10 blur-3xl"></div>

    <!-- Header Navigation -->
    <header class="w-full bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-buksu-navy flex items-center justify-center text-buksu-gold shadow-md shadow-buksu-navy/20 border border-buksu-gold/30">
                    <i class="fa-solid fa-scale-balanced text-lg"></i>
                </div>
                <div>
                    <span class="font-extrabold text-buksu-navy text-lg tracking-tight">JudgeTab</span>
                    <span class="font-medium text-slate-500 text-sm hidden sm:inline-block ms-1.5 border-l border-slate-300 ps-2">Digitalized Judging System</span>
                </div>
            </div>
            <a href="/auth/login.php" class="text-xs font-semibold text-buksu-navy hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                <i class="fa-solid fa-arrow-left"></i> Back to Login
            </a>
        </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        
        <!-- RESET PASSWORD CARD -->
        <div id="reset-token-card" class="w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-slate-900/10 border border-slate-100 p-6 sm:p-8 transition-all duration-300">
            <div class="flex items-center justify-between mb-6">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-semibold tracking-wide border border-rose-200">
                    <i class="fa-solid fa-key text-rose-500"></i> Password Recovery
                </span>
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-700">
                    <i class="fa-solid fa-shield-halved"></i> Security Check
                </span>
            </div>

            <div>
                <h2 class="text-2xl font-extrabold text-buksu-navy tracking-tight">Set New Password</h2>
                <p class="text-xs text-slate-500 mt-1 font-normal leading-relaxed">Enter a strong new password for your BukSU DJS account.</p>
            </div>

            <div class="my-4 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1">
                <div id="reset-token-username-display" class="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <i class="fa-solid fa-spinner fa-spin text-indigo-600"></i> Verifying reset token...
                </div>
            </div>

            <div id="reset-token-notice-wrap" class="hidden my-4 px-3 py-2 rounded-xl text-xs font-semibold">
                <span id="reset-token-notice"></span>
            </div>

            <form id="completeResetForm" onsubmit="return false;" class="space-y-4">
                <input type="hidden" id="reset-token-input" value="<?= $resetToken ?>">

                <div>
                    <label class="block text-xs font-semibold text-buksu-navy mb-1.5">New Password</label>
                    <div class="relative rounded-xl">
                        <div class="absolute inset-y-0 left-0 ps-3.5 flex items-center pointer-events-none text-slate-400 text-xs">
                            <i class="fa-solid fa-lock"></i>
                        </div>
                        <input type="password" id="reset-token-password-input" placeholder="Enter new password (min. 6 chars)" class="w-full ps-9 pe-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-buksu-navy focus:ring-2 focus:ring-buksu-navy/10 transition-all">
                        <button type="button" id="toggle-reset-token-pw-btn" class="absolute inset-y-0 right-0 pe-3.5 flex items-center text-slate-400 hover:text-buksu-navy transition-colors cursor-pointer">
                            <i id="toggle-reset-token-pw-icon" class="fa-solid fa-eye"></i>
                        </button>
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-buksu-navy mb-1.5">Confirm New Password</label>
                    <div class="relative rounded-xl">
                        <div class="absolute inset-y-0 left-0 ps-3.5 flex items-center pointer-events-none text-slate-400 text-xs">
                            <i class="fa-solid fa-shield-halved"></i>
                        </div>
                        <input type="password" id="reset-token-confirm-pw-input" placeholder="Re-enter new password" class="w-full ps-9 pe-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-buksu-navy focus:ring-2 focus:ring-buksu-navy/10 transition-all">
                        <button type="button" id="toggle-reset-token-confirm-pw-btn" class="absolute inset-y-0 right-0 pe-3.5 flex items-center text-slate-400 hover:text-buksu-navy transition-colors cursor-pointer">
                            <i id="toggle-reset-token-confirm-pw-icon" class="fa-solid fa-eye"></i>
                        </button>
                    </div>
                </div>

                <button type="submit" id="completeResetBtn" disabled class="w-full py-3 px-4 bg-buksu-navy hover:bg-indigo-900 disabled:opacity-50 text-buksu-gold font-bold text-xs rounded-xl shadow-lg shadow-buksu-navy/20 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer mt-2">
                    <i class="fa-solid fa-check-circle"></i>
                    <span id="complete-reset-btn-text">Save New Password</span>
                </button>
            </form>

            <div class="mt-6 pt-4 border-t border-slate-100 text-center">
                <a href="/auth/login.php" class="text-xs font-semibold text-slate-500 hover:text-buksu-navy transition-colors inline-flex items-center gap-1.5">
                    <i class="fa-solid fa-arrow-left"></i> Return to Sign In
                </a>
            </div>
        </div>
    </main>

    <!-- Footer -->
    <footer class="w-full border-t border-slate-200/60 bg-white/50 backdrop-blur-xs py-4 text-center">
        <p class="text-xs text-slate-500">&copy; 2026 Bukidnon State University Digitalized Judging System. All rights reserved.</p>
    </footer>

</body>
</html>
