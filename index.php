<?php

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$isAuthenticated = isset($_SESSION['user_id']) && !empty($_SESSION['username']);

if (!$isAuthenticated) {
    include __DIR__ . '/frontend/landing-page.html';
    exit;
}

$username = htmlspecialchars($_SESSION['username'] ?? 'User');
$email = htmlspecialchars($_SESSION['email'] ?? '');
$role = strtolower($_SESSION['role'] ?? 'user');

$roleBadges = [
    'admin'     => ['title' => 'Administrator Dashboard', 'icon' => 'fa-user-shield', 'color' => 'bg-indigo-600'],
    'judge'     => ['title' => 'Official Judge Portal',   'icon' => 'fa-gavel',       'color' => 'bg-amber-600'],
    'tabulator' => ['title' => 'Tabulator Control Panel', 'icon' => 'fa-calculator',  'color' => 'bg-emerald-600']
];

$badgeInfo = $roleBadges[$role] ?? ['title' => 'User Dashboard', 'icon' => 'fa-user', 'color' => 'bg-slate-700'];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://kit.fontawesome.com/12ec0fec7b.js" crossorigin="anonymous"></script>
    <link rel="stylesheet" href="/frontend/css/output.css">
    <title><?= $badgeInfo['title'] ?> | BukSU DJS</title>
</head>
<body class="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col justify-between antialiased" data-role="<?= $role ?>">

    <!-- Header Navigation -->
    <header class="w-full bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-buksu-navy flex items-center justify-center text-buksu-gold shadow-md border border-buksu-gold/30">
                    <i class="fa-solid fa-scale-balanced text-lg"></i>
                </div>
                <div>
                    <span class="font-extrabold text-buksu-navy text-lg tracking-tight">JudgeTab</span>
                    <span class="font-medium text-slate-500 text-sm hidden sm:inline-block ms-1.5 border-l border-slate-300 ps-2">Digitalized Judging System</span>
                </div>
            </div>

            <div class="flex items-center gap-4">
                <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200">
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span class="text-xs font-bold text-slate-700 uppercase tracking-wider"><?= ucfirst($role) ?></span>
                    <span class="text-xs text-slate-500 hidden md:inline-block">| <?= $username ?></span>
                </div>

                <button id="logoutBtn" class="px-3.5 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 border border-rose-200">
                    <i class="fa-solid fa-right-from-bracket"></i> Sign Out
                </button>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <!-- Welcome Card -->
        <div class="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 sm:p-10">
            <div class="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 pb-6 mb-8">
                <div>
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white <?= $badgeInfo['color'] ?> mb-2">
                        <i class="fa-solid <?= $badgeInfo['icon'] ?>"></i> <?= strtoupper($role) ?>
                    </span>
                    <h1 class="text-3xl font-extrabold text-buksu-navy">Welcome back, <?= $username ?>!</h1>
                    <p class="text-xs sm:text-sm text-slate-500 mt-1"><?= $email ? $email : 'Authenticated user session active.' ?></p>
                </div>

                <div class="px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 text-right">
                    <span class="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">System Status</span>
                    <span class="text-xs font-bold text-emerald-600 flex items-center justify-end gap-1.5 mt-0.5">
                        <i class="fa-solid fa-circle text-[8px]"></i> Ready for Judging Event
                    </span>
                </div>
            </div>

            <!-- Role Dashboard Quick Access -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="p-5 rounded-2xl bg-slate-50 border border-slate-200/70 hover:shadow-md transition-all">
                    <div class="w-10 h-10 rounded-xl bg-buksu-navy text-buksu-gold flex items-center justify-center text-lg mb-3">
                        <i class="fa-solid fa-calendar-check"></i>
                    </div>
                    <h3 class="font-bold text-slate-800 text-sm">Active Events</h3>
                    <p class="text-xs text-slate-500 mt-1">View and manage scheduled judging events and criteria.</p>
                </div>

                <div class="p-5 rounded-2xl bg-slate-50 border border-slate-200/70 hover:shadow-md transition-all">
                    <div class="w-10 h-10 rounded-xl bg-buksu-navy text-buksu-gold flex items-center justify-center text-lg mb-3">
                        <i class="fa-solid fa-users text-lg"></i>
                    </div>
                    <h3 class="font-bold text-slate-800 text-sm">Contestants &amp; Judges</h3>
                    <p class="text-xs text-slate-500 mt-1">Monitor connected judges, score submissions, and participants.</p>
                </div>

                <div class="p-5 rounded-2xl bg-slate-50 border border-slate-200/70 hover:shadow-md transition-all">
                    <div class="w-10 h-10 rounded-xl bg-buksu-navy text-buksu-gold flex items-center justify-center text-lg mb-3">
                        <i class="fa-solid fa-chart-pie text-lg"></i>
                    </div>
                    <h3 class="font-bold text-slate-800 text-sm">Real-time Tallies</h3>
                    <p class="text-xs text-slate-500 mt-1">Audit score entries and generate printable result summaries.</p>
                </div>
            </div>
        </div>

        <?php if ($role === 'admin'): ?>
        <!-- Admin: User Account Management -->
        <div class="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 sm:p-10 mt-5">
            <div class="flex items-center gap-3 mb-8 border-b border-slate-100 pb-6">
                <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-lg">
                    <i class="fa-solid fa-users-gear"></i>
                </div>
                <div>
                    <h2 class="text-xl font-extrabold text-buksu-navy">User Account Management</h2>
                    <p class="text-xs text-slate-500 mt-0.5">Create and manage Judge &amp; Tabulator accounts, and control their access permissions.</p>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-5 gap-8">

                <!-- Create Account Form -->
                <div class="lg:col-span-2">
                    <h3 class="text-sm font-bold text-buksu-navy mb-4 flex items-center gap-2">
                        <i class="fa-solid fa-user-plus text-indigo-500"></i> Create New Account
                    </h3>

                    <!-- Form notice -->
                    <div id="admin-create-notice-wrap" class="hidden mb-3">
                        <span id="admin-create-notice"></span>
                    </div>

                    <form id="createAccountForm" onsubmit="return false;" class="space-y-5">
                        <div>
                            <label class="block text-xs font-semibold text-slate-700 mb-1.5">Role <span class="text-rose-500">*</span></label>
                            <select id="create-role" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-buksu-navy focus:ring-2 focus:ring-buksu-navy/10 transition-all">
                                <option value="judge">Judge</option>
                                <option value="tabulator">Tabulator</option>
                            </select>
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-slate-700 mb-1.5">Username <span class="text-rose-500">*</span></label>
                            <div class="relative">
                                <div class="absolute inset-y-0 left-0 ps-3.5 flex items-center pointer-events-none text-slate-400 text-xs">
                                    <i class="fa-solid fa-at"></i>
                                </div>
                                <input type="text" id="create-username" placeholder="e.g. judge01 or tab_smith" class="w-full ps-9 pe-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-buksu-navy focus:ring-2 focus:ring-buksu-navy/10 transition-all">
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-slate-700 mb-1.5">Email <span class="text-slate-400 font-normal">(optional)</span></label>
                            <div class="relative">
                                <div class="absolute inset-y-0 left-0 ps-3.5 flex items-center pointer-events-none text-slate-400 text-xs">
                                    <i class="fa-solid fa-envelope"></i>
                                </div>
                                <input type="email" id="create-email" placeholder="email@buksu.edu.ph" class="w-full ps-9 pe-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-buksu-navy focus:ring-2 focus:ring-buksu-navy/10 transition-all">
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-slate-700 mb-1.5">Password <span class="text-rose-500">*</span></label>
                            <div class="relative">
                                <div class="absolute inset-y-0 left-0 ps-3.5 flex items-center pointer-events-none text-slate-400 text-xs">
                                    <i class="fa-solid fa-lock"></i>
                                </div>
                                <input type="password" id="create-password" placeholder="Min. 6 characters" class="w-full ps-9 pe-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-buksu-navy focus:ring-2 focus:ring-buksu-navy/10 transition-all">
                                <button type="button" id="toggle-create-password-btn" class="absolute inset-y-0 right-0 pe-3.5 flex items-center text-slate-400 hover:text-buksu-navy transition-colors cursor-pointer">
                                    <i id="toggle-create-password-icon" class="fa-solid fa-eye text-xs"></i>
                                </button>
                            </div>
                        </div>

                        <button type="submit" id="createAccountBtn" class="w-full mt-5 py-2.5 px-4 bg-buksu-navy hover:bg-buksu-navy-light text-white font-bold text-xs rounded-xl shadow-lg shadow-buksu-navy/20 hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-buksu-gold/30">
                            <i class="fa-solid fa-user-plus text-buksu-gold"></i>
                            <span id="create-btn-text">Create Account</span>
                        </button>
                    </form>
                </div>

                <!-- Accounts Table -->
                <div class="lg:col-span-3 mt-5">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-sm font-bold text-buksu-navy flex items-center gap-2">
                            <i class="fa-solid fa-list-ul text-indigo-500"></i> Existing Accounts
                        </h3>
                        <button id="refreshAccountsBtn" class="text-xs text-slate-500 hover:text-buksu-navy transition-colors flex items-center gap-1.5 cursor-pointer">
                            <i class="fa-solid fa-rotate-right"></i> Refresh
                        </button>
                    </div>

                    <!-- Permissions notice -->
                    <div id="admin-perm-notice-wrap" class="hidden mb-3">
                        <span id="admin-perm-notice"></span>
                    </div>

                    <div id="accounts-table-wrap" class="overflow-x-auto rounded-2xl border border-slate-200">
                        <table class="w-full text-xs">
                            <thead>
                                <tr class="bg-slate-50 border-b border-slate-200">
                                    <th class="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider">Username</th>
                                    <th class="px-4 py-3 text-center font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                                    <th class="px-4 py-3 text-center font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                    <th class="px-4 py-3 text-center font-semibold text-slate-500 uppercase tracking-wider">Access</th>
                                </tr>
                            </thead>
                            <tbody id="accounts-tbody">
                                <tr>
                                    <td colspan="4" class="px-4 py-6 text-center text-slate-400">
                                        <i class="fa-solid fa-spinner fa-spin me-1.5"></i> Loading accounts...
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
        <?php endif; ?>

    </main>

    <!-- Footer -->
    <footer class="w-full py-4 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        <p>&copy; 2026 intFour. All rights reserved. | <span class="font-medium text-slate-500">Digitalized Judging System</span></p>
    </footer>

    <script type="module" src="/scripts/ui/dashboardUI.js"></script>
    <script type="module" src="/scripts/admin/adminUI.js"></script>

</body>
</html>

