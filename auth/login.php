<?php

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// If user is already authenticated, redirect directly to dashboard
if (isset($_SESSION['user_id']) && !empty($_SESSION['username'])) {
    header("Location: /dashboard.php");
    exit;
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
    <script type="module" src="/scripts/ui/authUI.js"></script>
    <script type="module" src="/scripts/ui/resetUI.js"></script>
    <script type="module" src="/scripts/app.js"></script>
    <title>Sign In | BukSU Digitalized Judging System</title>
</head>
<body class="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col justify-between antialiased selection:bg-buksu-navy selection:text-buksu-gold relative overflow-x-hidden">

    <!-- Dashboard Background with Bottom Fading Effect -->
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
        </div>
    </header>

    <!-- Main Content Center Container -->
    <main class="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        
        <!-- UNIFIED LOGIN CARD -->
        <div id="login-card" class="w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-slate-900/10 border border-slate-100 p-6 sm:p-8 transition-all duration-300">
            
            <div class="flex items-center justify-between mb-6">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-buksu-navy/5 text-buksu-navy text-xs font-semibold tracking-wide uppercase border border-buksu-navy/10">
                    <i class="fa-solid fa-graduation-cap text-buksu-gold"></i> BukSU DJS
                </span>

                <span id="login-role-badge" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-buksu-navy text-buksu-gold shadow-xs">
                    <i id="login-role-badge-icon" class="fa-solid fa-scale-balanced"></i>
                    <span id="login-role-badge-text">Official Portal</span>
                </span>
            </div>

            <div>
                <h2 id="login-title" class="text-2xl font-extrabold text-buksu-navy tracking-tight">System Sign In</h2>
                <p id="login-subtitle" class="text-xs text-slate-500 mt-1 font-normal leading-relaxed">Enter your credentials to access your designated portal (Admin, Judge, or Tabulator).</p>
            </div>

            <form id="loginForm" onsubmit="return false;" class="mt-6 space-y-4">
                <div class="text-center hidden ease-in duration-100 wrap-break-word">
                    <span id="notice-text">This is a notice</span>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-buksu-navy mb-1.5">Username / Email</label>
                    <div class="relative rounded-xl">
                        <div class="absolute inset-y-0 left-0 ps-3.5 flex items-center pointer-events-none text-slate-400 text-xs">
                            <i id="login-user-icon" class="fa-solid fa-user"></i>
                        </div>
                        <input type="text" id="username-input" placeholder="Enter your username or email" class="w-full ps-9 pe-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-buksu-navy focus:ring-2 focus:ring-buksu-navy/10 transition-all">
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-buksu-navy mb-1.5">Password</label>
                    <div class="relative rounded-xl">
                        <div class="absolute inset-y-0 left-0 ps-3.5 flex items-center pointer-events-none text-slate-400 text-xs">
                            <i class="fa-solid fa-lock"></i>
                        </div>
                        <input type="password" id="password-input" placeholder="••••••••••••" class="w-full ps-9 pe-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-buksu-navy focus:ring-2 focus:ring-buksu-navy/10 transition-all">
                        <button type="button" id="toggle-password-btn" class="absolute inset-y-0 right-0 pe-3.5 flex items-center text-slate-400 hover:text-buksu-navy transition-colors cursor-pointer">
                            <i id="toggle-password-icon" class="fa-solid fa-eye"></i>
                        </button>
                    </div>
                </div>

                <div class="flex items-center justify-between text-xs pt-1">
                    <label class="flex items-center gap-2 cursor-pointer text-slate-600">
                        <input type="checkbox" class="w-3.5 h-3.5 rounded border-slate-300 text-buksu-navy focus:ring-buksu-navy accent-buksu-navy">
                        <span>Remember me</span>
                    </label>
                    <a href="#" id="forgot-password-link" class="font-semibold text-buksu-navy hover:text-buksu-gold transition-colors">Forgot password?</a>
                </div>

                <button type="submit" class="w-full mt-2 py-3 px-4 bg-buksu-navy hover:bg-buksu-navy-light text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-buksu-navy/25 hover:shadow-xl hover:shadow-buksu-navy/30 transition-all flex items-center justify-center gap-2 group cursor-pointer border border-buksu-gold/30">
                    <span id="login-btn-text">Sign In</span>
                    <i class="fa-solid fa-right-to-bracket text-buksu-gold group-hover:translate-x-0.5 transition-transform"></i>
                </button>
            </form>

            <div id="register-admin-wrap" class="mt-4 mx-3 pt-3 border-t border-slate-100 text-center text-xs text-slate-500">
                <span>First time setup? </span>
                <button type="button" id="open-register-admin-btn" class="font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer underline inline-block">Register Admin Account</button>
            </div>

            <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                <i class="fa-solid fa-shield-halved text-buksu-gold"></i>
                <span>Protected by BukSU Digitalized Judging System</span>
            </div>
        </div>

        <!-- REGISTER ADMIN CARD -->
        <div id="register-admin-card" class="w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-slate-900/10 border border-slate-100 p-6 sm:p-8 transition-all duration-300 hidden">
            <div class="flex items-center justify-between mb-6">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold tracking-wide border border-indigo-200">
                    <i class="fa-solid fa-user-shield text-indigo-500"></i> Admin Registration
                </span>
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-100 text-amber-800">
                    <i class="fa-solid fa-crown"></i> Initial Setup
                </span>
            </div>

            <div>
                <h2 class="text-2xl font-extrabold text-buksu-navy tracking-tight">Create Admin Account</h2>
                <p class="text-xs text-slate-500 mt-1 font-normal leading-relaxed">Register an administrator account to manage competitions, judges, and tabulators.</p>
            </div>

            <div id="register-notice-wrap" class="hidden my-4">
                <span id="register-notice-text"></span>
            </div>

            <form id="registerAdminForm" onsubmit="return false;" class="mt-4 space-y-4">
                <div>
                    <label class="block text-xs font-semibold text-buksu-navy mb-1.5">Username <span class="text-rose-500">*</span></label>
                    <div class="relative rounded-xl">
                        <div class="absolute inset-y-0 left-0 ps-3.5 flex items-center pointer-events-none text-slate-400 text-xs">
                            <i class="fa-solid fa-user"></i>
                        </div>
                        <input type="text" id="reg-username-input" placeholder="e.g. admin_master" class="w-full ps-9 pe-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-buksu-navy focus:ring-2 focus:ring-buksu-navy/10 transition-all">
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-buksu-navy mb-1.5">Email Address</label>
                    <div class="relative rounded-xl">
                        <div class="absolute inset-y-0 left-0 ps-3.5 flex items-center pointer-events-none text-slate-400 text-xs">
                            <i class="fa-solid fa-envelope"></i>
                        </div>
                        <input type="email" id="reg-email-input" placeholder="admin@buksu.edu.ph" class="w-full ps-9 pe-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-buksu-navy focus:ring-2 focus:ring-buksu-navy/10 transition-all">
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-buksu-navy mb-1.5">Password <span class="text-rose-500">*</span></label>
                    <div class="relative rounded-xl">
                        <div class="absolute inset-y-0 left-0 ps-3.5 flex items-center pointer-events-none text-slate-400 text-xs">
                            <i class="fa-solid fa-lock"></i>
                        </div>
                        <input type="password" id="reg-password-input" placeholder="••••••••••••" class="w-full ps-9 pe-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-buksu-navy focus:ring-2 focus:ring-buksu-navy/10 transition-all">
                        <button type="button" id="toggle-reg-password-btn" class="absolute inset-y-0 right-0 pe-3.5 flex items-center text-slate-400 hover:text-buksu-navy transition-colors cursor-pointer">
                            <i id="toggle-reg-password-icon" class="fa-solid fa-eye"></i>
                        </button>
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-buksu-navy mb-1.5">Confirm Password <span class="text-rose-500">*</span></label>
                    <div class="relative rounded-xl">
                        <div class="absolute inset-y-0 left-0 ps-3.5 flex items-center pointer-events-none text-slate-400 text-xs">
                            <i class="fa-solid fa-shield-halved"></i>
                        </div>
                        <input type="password" id="reg-confirm-password-input" placeholder="••••••••••••" class="w-full ps-9 pe-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-buksu-navy focus:ring-2 focus:ring-buksu-navy/10 transition-all">
                        <button type="button" id="toggle-reg-confirm-pw-btn" class="absolute inset-y-0 right-0 pe-3.5 flex items-center text-slate-400 hover:text-buksu-navy transition-colors cursor-pointer">
                            <i id="toggle-reg-confirm-pw-icon" class="fa-solid fa-eye"></i>
                        </button>
                    </div>
                </div>

                <button type="submit" id="registerAdminBtn" class="w-full mt-2 py-3 px-4 bg-buksu-navy hover:bg-buksu-navy-light text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer border border-buksu-gold/30">
                    <i class="fa-solid fa-user-plus text-buksu-gold"></i>
                    <span id="reg-btn-text">Register Admin Account</span>
                </button>
            </form>

            <div class="mt-4 pt-3 border-t border-slate-100 text-center">
                <button type="button" id="back-from-register-btn" class="text-xs font-bold text-slate-600 hover:text-buksu-navy transition-colors cursor-pointer flex items-center justify-center gap-1.5 mx-auto">
                    <i class="fa-solid fa-arrow-left"></i> Back to Sign In
                </button>
            </div>
        </div>

        <!-- REQUEST PASSWORD RESET CARD -->
        <div id="forgot-password-card" class="w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-slate-900/10 border border-slate-100 p-6 sm:p-8 transition-all duration-300 hidden">
            <div class="flex items-center justify-between mb-6">
                <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white shadow-xs">
                    <i class="fa-solid fa-key"></i>
                    <span>Password Self-Service</span>
                </span>
            </div>

            <div>
                <h2 class="text-2xl font-extrabold text-buksu-navy tracking-tight">Forgot Password?</h2>
                <p class="text-xs text-slate-500 mt-1 font-normal leading-relaxed">Enter your registered email address or username below. We'll send you a link to reset your password.</p>
            </div>

            <div id="reset-notice-wrap" class="hidden my-4">
                <span id="reset-notice"></span>
            </div>

            <form id="resetRequestForm" onsubmit="return false;" class="mt-4 space-y-4">
                <div>
                    <label class="block text-xs font-semibold text-buksu-navy mb-1.5">Email Address / Username <span class="text-rose-500">*</span></label>
                    <div class="relative rounded-xl">
                        <div class="absolute inset-y-0 left-0 ps-3.5 flex items-center pointer-events-none text-slate-400 text-xs">
                            <i class="fa-solid fa-envelope"></i>
                        </div>
                        <input type="text" id="reset-identifier-input" placeholder="Enter registered email or username" class="w-full ps-9 pe-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-buksu-navy focus:ring-2 focus:ring-buksu-navy/10 transition-all">
                    </div>
                </div>

                <button type="submit" id="resetRequestBtn" class="w-full mt-2 py-3 px-4 bg-buksu-navy hover:bg-buksu-navy-light text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer border border-buksu-gold/30">
                    <i class="fa-solid fa-paper-plane text-buksu-gold"></i>
                    <span id="reset-request-btn-text">Send Password Reset Link</span>
                </button>
            </form>

            <div class="mt-4 pt-3 border-t border-slate-100 text-center">
                <button type="button" id="back-to-login-btn" class="text-xs font-bold text-slate-600 hover:text-buksu-navy transition-colors cursor-pointer flex items-center justify-center gap-1.5 mx-auto">
                    <i class="fa-solid fa-arrow-left"></i> Back to Sign In
                </button>
            </div>
        </div>

    </main>

    <!-- Footer -->
    <footer class="w-full py-4 text-center text-xs text-slate-400 border-t border-slate-200/80 bg-white/80 backdrop-blur-md">
        <p>&copy; 2026 Bukidnon State University Digitalized Judging System. All rights reserved.</p>
    </footer>

</body>
</html>
