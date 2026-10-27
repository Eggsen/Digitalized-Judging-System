<?php

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id']) || empty($_SESSION['username'])) {
    header("Location: /auth/login.php");
    exit;
}

$username = htmlspecialchars($_SESSION['username'] ?? 'User');
$email = htmlspecialchars($_SESSION['email'] ?? '');
$role = strtolower($_SESSION['role'] ?? 'user');

$roleBadges = [
    'admin' => ['title' => 'Administrator Dashboard', 'icon' => 'fa-user-shield', 'color' => 'bg-buksu-navy'],
    'judge' => ['title' => 'Official Judge Portal', 'icon' => 'fa-gavel', 'color' => 'bg-amber-600'],
    'tabulator' => ['title' => 'Tabulator Control Panel', 'icon' => 'fa-calculator', 'color' => 'bg-emerald-600']
];

$badgeInfo = $roleBadges[$role] ?? ['title' => 'User Dashboard', 'icon' => 'fa-user', 'color' => 'bg-slate-700'];

$userPrefs = $_SESSION['preferences'] ?? [];
$serverTheme = htmlspecialchars($userPrefs['theme'] ?? 'light');
$serverColorRule = htmlspecialchars($userPrefs['colorRule'] ?? 'normal');
$serverNavPlacement = htmlspecialchars($userPrefs['navPlacement'] ?? 'top');
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://kit.fontawesome.com/12ec0fec7b.js" crossorigin="anonymous"></script>
    <link rel="stylesheet" href="/frontend/css/output.css">
    <title><?= $badgeInfo['title'] ?> | BukSU DJS</title>
    <script>
        (function() {
            try {
                // Expose current authenticated user identifiers
                window.__CURRENT_USER_ID__ = "<?= htmlspecialchars($_SESSION['user_id'] ?? '') ?>";
                window.__CURRENT_USERNAME__ = "<?= htmlspecialchars($username ?? '') ?>";
                window.__CURRENT_ROLE__ = "<?= htmlspecialchars($role ?? '') ?>";

                const userId = "<?= htmlspecialchars($_SESSION['user_id'] ?? '') ?>";
                const userPrefix = userId ? ('djs_user_' + userId + '_') : 'djs_';

                const serverTheme = "<?= $serverTheme ?>";
                const serverColorRule = "<?= $serverColorRule ?>";
                const serverNavPlacement = "<?= $serverNavPlacement ?>";

                // Clean up legacy global settings so they never bleed into other user sessions
                try {
                    localStorage.removeItem('djs_theme');
                    localStorage.removeItem('djs_color_rule');
                    localStorage.removeItem('djs_nav_placement');
                } catch (_) {}

                // Load user-specific theme (defaults to crisp light mode)
                const theme = localStorage.getItem(userPrefix + 'theme') || (serverTheme || 'light');
                if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }

                // Load user-specific color rule (defaults to standard normal mode)
                const colorRule = localStorage.getItem(userPrefix + 'color_rule') || (serverColorRule || 'normal');
                if (colorRule === 'three-color') {
                    document.documentElement.classList.add('three-color-mode');
                } else {
                    document.documentElement.classList.remove('three-color-mode');
                }

                // Load user-specific navigation placement (defaults to top tabs)
                const navPlacement = localStorage.getItem(userPrefix + 'nav_placement') || (serverNavPlacement || 'top');
                if (navPlacement === 'sidebar') {
                    document.documentElement.classList.add('layout-sidebar');
                } else {
                    document.documentElement.classList.remove('layout-sidebar');
                }
            } catch (e) {
                console.error('Error applying early preferences:', e);
            }
        })();
    </script>
</head>

<body class="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col justify-between antialiased relative overflow-x-hidden"
    data-role="<?= $role ?>"
    data-username="<?= $username ?>"
    data-user-id="<?= htmlspecialchars($_SESSION['user_id'] ?? '') ?>">

    <div class="dashboard-bg"></div>

    <!-- Header Navigation -->
    <header class="w-full bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div
                    class="w-10 h-10 rounded-xl bg-buksu-navy flex items-center justify-center text-buksu-gold shadow-md border border-buksu-gold/30">
                    <i class="fa-solid fa-scale-balanced text-lg"></i>
                </div>
                <div>
                    <span class="font-extrabold text-buksu-navy text-lg tracking-tight">JudgeTab</span>
                    <span
                        class="font-medium text-slate-500 text-sm hidden sm:inline-block ms-1.5 border-l border-slate-300 ps-2">Digitalized
                        Judging System</span>
                </div>
            </div>

            <div class="flex items-center gap-3 sm:gap-4">
                <!-- Quick Preferences Button -->
                <button id="openPreferencesBtn" title="Appearance & UI Preferences" class="p-2 text-slate-600 hover:text-buksu-navy hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-slate-200">
                    <i class="fa-solid fa-sliders text-lg"></i>
                </button>

                <!-- Topbar Notifications -->
                <div class="relative" id="notification-wrapper">
                    <button id="notifBtn" class="relative p-2 text-slate-600 hover:text-buksu-navy hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-slate-200">
                        <i class="fa-solid fa-bell text-lg"></i>
                        <span id="notifBadge" class="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white font-extrabold text-[10px] rounded-full flex items-center justify-center border-2 border-white hidden">0</span>
                    </button>

                    <!-- Notifications Dropdown Drawer -->
                    <div id="notifDropdown" class="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-slate-200/90 z-50 hidden overflow-hidden animate-fade-in">
                        <div class="p-4 bg-gradient-to-r from-buksu-navy via-buksu-navy-light to-buksu-navy text-white flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <i class="fa-solid fa-bell text-buksu-gold"></i>
                                <h3 class="font-extrabold text-sm tracking-tight">Notifications</h3>
                            </div>
                            <button id="markAllReadBtn" class="text-[11px] font-semibold text-slate-300 hover:text-buksu-gold transition-colors cursor-pointer">Mark all read</button>
                        </div>

                        <div id="notifList" class="max-h-80 overflow-y-auto divide-y divide-slate-100 text-xs">
                            <div class="p-6 text-center text-slate-400">
                                <i class="fa-solid fa-spinner fa-spin me-1.5"></i> Loading notifications...
                            </div>
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200">
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span class="text-xs font-bold text-slate-700 uppercase tracking-wider"><?= ucfirst($role) ?></span>
                </div>

                <button id="logoutBtn"
                    class="px-3.5 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 border border-rose-200">
                    <i class="fa-solid fa-right-from-bracket"></i> Sign Out
                </button>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div id="dashboard-layout-container" class="flex flex-col lg:flex-row gap-6 items-start w-full">

            <!-- Sidebar Navigation (Active in Sidebar Mode) -->
            <aside id="dashboard-sidebar-nav" class="dashboard-sidebar w-full lg:w-72 shrink-0 bg-white rounded-3xl shadow-xl border border-slate-200/80 p-5 space-y-4 lg:sticky lg:top-20">
                <div class="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <div class="w-9 h-9 rounded-xl bg-buksu-navy text-buksu-gold flex items-center justify-center font-bold shadow-xs border border-buksu-gold/30">
                        <i class="fa-solid fa-compass"></i>
                    </div>
                    <div>
                        <h3 class="font-extrabold text-sm text-buksu-navy">Navigation Hub</h3>
                        <p class="text-[10px] text-slate-400 font-medium"><?= $badgeInfo['title'] ?></p>
                    </div>
                </div>

                <?php if ($role === 'admin'): ?>
                <!-- Navigation Links for Admin -->
                <nav class="space-y-1.5" id="sidebar-admin-links">
                    <button type="button" data-tab="events-tab" class="sidebar-nav-btn w-full px-4 py-3 text-xs font-bold rounded-2xl bg-buksu-navy text-white shadow-md transition-all cursor-pointer flex items-center gap-3 border border-buksu-gold/30">
                        <i class="fa-solid fa-trophy text-buksu-gold w-4 text-center"></i>
                        <span>Events &amp; Competitions</span>
                    </button>
                    <button type="button" data-tab="assignments-tab" class="sidebar-nav-btn w-full px-4 py-3 text-xs font-bold rounded-2xl text-slate-600 hover:text-buksu-navy hover:bg-slate-100 transition-all cursor-pointer flex items-center gap-3 border border-transparent">
                        <i class="fa-solid fa-user-check text-slate-400 w-4 text-center"></i>
                        <span>Judge Assignments</span>
                    </button>
                    <button type="button" data-tab="users-tab" class="sidebar-nav-btn w-full px-4 py-3 text-xs font-bold rounded-2xl text-slate-600 hover:text-buksu-navy hover:bg-slate-100 transition-all cursor-pointer flex items-center gap-3 border border-transparent">
                        <i class="fa-solid fa-users-gear text-slate-400 w-4 text-center"></i>
                        <span>User Invitations</span>
                    </button>
                    <button type="button" data-tab="logs-tab" class="sidebar-nav-btn w-full px-4 py-3 text-xs font-bold rounded-2xl text-slate-600 hover:text-buksu-navy hover:bg-slate-100 transition-all cursor-pointer flex items-center gap-3 border border-transparent">
                        <i class="fa-solid fa-clock-rotate-left text-slate-400 w-4 text-center"></i>
                        <span>Audit Logs</span>
                    </button>
                    <button type="button" data-tab="settings-tab" class="sidebar-nav-btn w-full px-4 py-3 text-xs font-bold rounded-2xl text-slate-600 hover:text-buksu-navy hover:bg-slate-100 transition-all cursor-pointer flex items-center gap-3 border border-transparent">
                        <i class="fa-solid fa-sliders text-slate-400 w-4 text-center"></i>
                        <span>System Settings</span>
                    </button>
                </nav>
                <?php else: ?>
                <!-- Navigation Links for Judge / Tabulator -->
                <nav class="space-y-1.5" id="sidebar-user-links">
                    <button type="button" data-tab="user-events-tab" class="sidebar-nav-btn w-full px-4 py-3 text-xs font-bold rounded-2xl bg-buksu-navy text-white shadow-md transition-all cursor-pointer flex items-center gap-3 border border-buksu-gold/30">
                        <i class="fa-solid fa-clipboard-list text-buksu-gold w-4 text-center"></i>
                        <span>Assigned Competitions</span>
                    </button>
                    <button type="button" data-tab="user-preferences-tab" class="sidebar-nav-btn w-full px-4 py-3 text-xs font-bold rounded-2xl text-slate-600 hover:text-buksu-navy hover:bg-slate-100 transition-all cursor-pointer flex items-center gap-3 border border-transparent">
                        <i class="fa-solid fa-sliders text-slate-400 w-4 text-center"></i>
                        <span>Preferences</span>
                    </button>
                </nav>
                <?php endif; ?>

                <!-- Sidebar Footer Status Card -->
                <div class="pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1.5">
                    <div class="flex items-center justify-between">
                        <span class="font-bold text-slate-600">Active Role</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-700"><?= $role ?></span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-slate-400">Layout</span>
                        <span class="text-[10px] font-bold text-buksu-navy">Sidebar Mode</span>
                    </div>
                </div>
            </aside>

            <!-- Main Content Area -->
            <div id="dashboard-content-area" class="flex-1 w-full min-w-0 space-y-6">

                <!-- Welcome Card -->
                <div class="rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden bg-white">
                    <!-- Top Section: BukSU Dark Blue Header -->
                    <div class="bg-gradient-to-r from-buksu-navy via-buksu-navy-light to-buksu-navy p-6 sm:p-8 text-white relative">
                        <!-- Decorative ambient background glow & watermark -->
                        <div class="absolute top-0 right-0 w-80 h-80 bg-buksu-gold/10 rounded-full blur-3xl pointer-events-none"></div>
                        <div class="absolute -bottom-4 right-10 opacity-10 text-white pointer-events-none hidden sm:block">
                            <i class="fa-solid fa-scale-balanced text-9xl"></i>
                        </div>

                        <div class="relative z-10 flex items-center justify-between flex-wrap gap-4">
                            <div>
                                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-buksu-gold/20 text-buksu-gold border border-buksu-gold/30 mb-3 backdrop-blur-xs">
                                    <i class="fa-solid <?= $badgeInfo['icon'] ?>"></i> <?= strtoupper($role) ?> PORTAL
                                </span>
                                <h1 class="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Welcome back, <?= $username ?>!</h1>
                                <p class="text-xs sm:text-sm text-slate-300 mt-1.5 font-normal flex items-center gap-2">
                                    <i class="fa-solid fa-circle-check text-emerald-400 text-[10px]"></i>
                                    <span><?= $email ? $email : 'Authenticated user session active.' ?></span>
                                </p>
                            </div>

                            <?php if ($role === 'admin'): ?>
                                <button id="open-create-event-modal-btn"
                                    class="px-5 py-3 bg-buksu-gold hover:bg-amber-400 text-buksu-navy font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg shadow-buksu-gold/20 hover:shadow-xl transition-all flex items-center gap-2 cursor-pointer border border-yellow-300">
                                    <i class="fa-solid fa-plus text-buksu-navy"></i> Create Competition
                                </button>
                            <?php endif; ?>
                        </div>
                    </div>

                    <?php if ($role === 'admin'): ?>
                        <!-- Bottom Section: Admin Navigation Tabs -->
                        <div class="top-nav-bar bg-slate-50/90 px-6 sm:px-8 py-3.5 border-t border-slate-200/80">
                            <div class="flex items-center gap-2 overflow-x-auto" id="admin-tabs">
                                <button data-tab="events-tab" class="admin-tab-btn px-4 py-2 text-xs font-bold rounded-xl bg-buksu-navy text-white shadow-xs transition-all cursor-pointer">
                                    <i class="fa-solid fa-trophy me-1.5 text-buksu-gold"></i> Events &amp; Competitions
                                </button>
                                <button data-tab="assignments-tab" class="admin-tab-btn px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:bg-white hover:text-buksu-navy transition-all cursor-pointer">
                                    <i class="fa-solid fa-user-check me-1.5 text-slate-400"></i> Judge Assignments
                                </button>
                                <button data-tab="users-tab" class="admin-tab-btn px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:bg-white hover:text-buksu-navy transition-all cursor-pointer">
                                    <i class="fa-solid fa-users-gear me-1.5 text-slate-400"></i> User Invitations
                                </button>
                                <button data-tab="logs-tab" class="admin-tab-btn px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:bg-white hover:text-buksu-navy transition-all cursor-pointer">
                                    <i class="fa-solid fa-clock-rotate-left me-1.5 text-slate-400"></i> Audit Logs
                                </button>
                                <button data-tab="settings-tab" class="admin-tab-btn px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:bg-white hover:text-buksu-navy transition-all cursor-pointer">
                                    <i class="fa-solid fa-sliders me-1.5 text-slate-400"></i> System Settings
                                </button>
                            </div>
                        </div>
                    <?php else: ?>
                        <!-- Bottom Section: Judge / Tabulator Navigation Tabs -->
                        <div class="top-nav-bar bg-slate-50/90 px-6 sm:px-8 py-3.5 border-t border-slate-200/80">
                            <div class="flex items-center gap-2 overflow-x-auto" id="user-tabs">
                                <button data-tab="user-events-tab" class="user-tab-btn px-4 py-2 text-xs font-bold rounded-xl bg-buksu-navy text-white shadow-xs transition-all cursor-pointer">
                                    <i class="fa-solid fa-clipboard-list me-1.5 text-buksu-gold"></i> Assigned Competitions
                                </button>
                                <button data-tab="user-preferences-tab" class="user-tab-btn px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:bg-white hover:text-buksu-navy transition-all cursor-pointer">
                                    <i class="fa-solid fa-sliders me-1.5 text-slate-400"></i> Preferences
                                </button>
                            </div>
                        </div>
                    <?php endif; ?>
                </div>


        <?php if ($role === 'admin'): ?>
            <!-- TAB 1: EVENTS & COMPETITIONS -->
            <div id="events-tab" class="admin-tab-content bg-white rounded-3xl shadow-xl border border-slate-100 p-6 sm:p-8">
                <div class="flex items-center justify-between flex-wrap gap-4 mb-6">
                    <div>
                        <h2 class="text-xl font-extrabold text-buksu-navy flex items-center gap-2">
                            <i class="fa-solid fa-trophy text-buksu-navy"></i> Competitions &amp; Events
                        </h2>
                        <p class="text-xs text-slate-500 mt-0.5">Manage scheduled competitions, update status, and archive completed events.</p>
                    </div>

                    <div class="flex items-center gap-3">
                        <select id="event-status-filter" class="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer">
                            <option value="ALL">All Statuses (Ongoing Priority)</option>
                            <option value="Ongoing">Ongoing</option>
                            <option value="Upcoming">Upcoming</option>
                            <option value="Completed">Completed</option>
                            <option value="Archived">Archived</option>
                        </select>
                        <button id="refreshEventsBtn" class="text-xs text-slate-500 hover:text-buksu-navy font-semibold flex items-center gap-1 cursor-pointer">
                            <i class="fa-solid fa-rotate-right"></i> Refresh
                        </button>
                    </div>
                </div>

                <div id="admin-events-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    <div class="col-span-full py-12 text-center text-slate-400">
                        <i class="fa-solid fa-spinner fa-spin text-xl mb-2"></i>
                        <p class="text-xs">Loading competitions...</p>
                    </div>
                </div>
            </div>

            <!-- TAB 2: JUDGE ASSIGNMENTS -->
            <div id="assignments-tab" class="admin-tab-content bg-white rounded-3xl shadow-xl border border-slate-100 p-6 sm:p-8 hidden">
                <div class="flex items-center justify-between flex-wrap gap-4 mb-6 border-b border-slate-100 pb-4">
                    <div>
                        <h2 class="text-xl font-extrabold text-buksu-navy flex items-center gap-2">
                            <i class="fa-solid fa-user-check text-buksu-navy"></i> Judge &amp; Tabulator Assignments
                        </h2>
                        <p class="text-xs text-slate-500 mt-0.5">Assign active Judges and Tabulators to specific competitions.</p>
                    </div>
                </div>

                <div id="assignments-container" class="space-y-4">
                    <!-- Loaded dynamically -->
                </div>
            </div>

            <!-- TAB 3: USER INVITATIONS & ACCOUNTS -->
            <div id="users-tab" class="admin-tab-content bg-white rounded-3xl shadow-xl border border-slate-100 p-6 sm:p-8 hidden">
                <div class="flex items-center gap-3 mb-8 border-b border-slate-100 pb-6">
                    <div class="w-10 h-10 rounded-xl bg-buksu-navy text-white flex items-center justify-center text-lg">
                        <i class="fa-solid fa-users-gear"></i>
                    </div>
                    <div>
                        <h2 class="text-xl font-extrabold text-buksu-navy">User Account Management</h2>
                        <p class="text-xs text-slate-500 mt-0.5">Send invitations to Judges &amp; Tabulators, and manage active permissions.</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    <!-- Send Invitation Form -->
                    <div class="lg:col-span-2">
                        <h3 class="text-sm font-bold text-buksu-navy mb-4 flex items-center gap-2">
                            <i class="fa-solid fa-paper-plane text-buksu-navy"></i> Send Account Invitation
                        </h3>

                        <div id="admin-create-notice-wrap" class="hidden mb-3">
                            <span id="admin-create-notice"></span>
                        </div>

                        <form id="createAccountForm" onsubmit="return false;" class="space-y-4">
                            <div>
                                <label class="block text-xs font-semibold text-slate-700 mb-1.5">Role <span class="text-rose-500">*</span></label>
                                <select id="create-role" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none">
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
                                    <input type="text" id="create-username" placeholder="e.g. judge01 or tab_smith" class="w-full ps-9 pe-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none">
                                </div>
                            </div>

                            <div>
                                <label class="block text-xs font-semibold text-slate-700 mb-1.5">Email <span class="text-rose-500">*</span></label>
                                <div class="relative">
                                    <div class="absolute inset-y-0 left-0 ps-3.5 flex items-center pointer-events-none text-slate-400 text-xs">
                                        <i class="fa-solid fa-envelope"></i>
                                    </div>
                                    <input type="email" id="create-email" placeholder="email@buksu.edu.ph" class="w-full ps-9 pe-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none">
                                </div>
                            </div>

                            <button type="submit" id="createAccountBtn" class="w-full mt-4 py-2.5 px-4 bg-buksu-navy hover:bg-buksu-navy-light text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer border border-buksu-gold/30">
                                <i class="fa-solid fa-paper-plane text-buksu-gold"></i>
                                <span id="create-btn-text">Send Invitation</span>
                            </button>
                        </form>
                    </div>

                    <!-- Accounts Table -->
                    <div class="lg:col-span-3">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-sm font-bold text-buksu-navy flex items-center gap-2">
                                <i class="fa-solid fa-list-ul text-buksu-navy"></i> Existing Accounts
                            </h3>
                            <button id="refreshAccountsBtn" class="text-xs text-slate-500 hover:text-buksu-navy transition-colors flex items-center gap-1.5 cursor-pointer">
                                <i class="fa-solid fa-rotate-right"></i> Refresh
                            </button>
                        </div>

                        <div id="admin-perm-notice-wrap" class="hidden mb-3">
                            <span id="admin-perm-notice"></span>
                        </div>

                        <div id="accounts-table-wrap" class="overflow-x-auto rounded-2xl border border-slate-200">
                            <table class="w-full text-xs">
                                <thead>
                                    <tr class="bg-slate-50 border-b border-slate-200">
                                        <th class="px-4 py-3 text-left font-semibold text-slate-500 uppercase">Username / Email</th>
                                        <th class="px-4 py-3 text-center font-semibold text-slate-500 uppercase">Role</th>
                                        <th class="px-4 py-3 text-center font-semibold text-slate-500 uppercase">Status</th>
                                        <th class="px-4 py-3 text-center font-semibold text-slate-500 uppercase">Access</th>
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

            <!-- TAB 4: SYSTEM AUDIT LOGS -->
            <div id="logs-tab" class="admin-tab-content bg-white rounded-3xl shadow-xl border border-slate-100 p-6 sm:p-8 hidden">
                <div class="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                    <div>
                        <h2 class="text-xl font-extrabold text-buksu-navy flex items-center gap-2">
                            <i class="fa-solid fa-clock-rotate-left text-buksu-navy"></i> System Audit Logs
                        </h2>
                        <p class="text-xs text-slate-500 mt-0.5">Chronological record of system actions, event creations, edits, archiving, and access updates.</p>
                    </div>
                    <button id="refreshLogsBtn" class="text-xs text-slate-500 hover:text-buksu-navy font-semibold flex items-center gap-1 cursor-pointer">
                        <i class="fa-solid fa-rotate-right"></i> Refresh
                    </button>
                </div>

                <div class="overflow-x-auto rounded-2xl border border-slate-200">
                    <table class="w-full text-xs">
                        <thead>
                            <tr class="bg-slate-50 border-b border-slate-200">
                                <th class="px-4 py-3 text-left font-semibold text-slate-500 uppercase">Timestamp</th>
                                <th class="px-4 py-3 text-left font-semibold text-slate-500 uppercase">User</th>
                                <th class="px-4 py-3 text-center font-semibold text-slate-500 uppercase">Action</th>
                                <th class="px-4 py-3 text-left font-semibold text-slate-500 uppercase">Details</th>
                            </tr>
                        </thead>
                        <tbody id="logs-tbody">
                            <tr>
                                <td colspan="4" class="px-4 py-6 text-center text-slate-400">
                                    <i class="fa-solid fa-spinner fa-spin me-1.5"></i> Loading audit logs...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- TAB 5: SYSTEM SETTINGS HUB -->
            <div id="settings-tab" class="admin-tab-content bg-white rounded-3xl shadow-xl border border-slate-100 p-6 sm:p-8 hidden">
                <!-- Header Banner -->
                <div class="flex items-start justify-between flex-wrap gap-4 mb-6 border-b border-slate-100 pb-5">
                    <div class="space-y-1">
                        <div class="flex items-center gap-2">
                            <span class="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-buksu-navy text-buksu-gold shadow-2xs">
                                Global Configuration
                            </span>
                            <span id="setting-last-backup-badge" class="px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200">
                                Checking status...
                            </span>
                        </div>
                        <h2 class="text-xl sm:text-2xl font-black text-buksu-navy flex items-center gap-2">
                            <i class="fa-solid fa-sliders text-buksu-navy"></i> System Settings Hub
                        </h2>
                        <p class="text-xs text-slate-500 max-w-2xl">
                            Configure institutional identity &amp; branding, enforce judging &amp; tabulation rules, manage report signatories, and generate system data backups.
                        </p>
                    </div>

                    <div class="flex items-center gap-2 flex-wrap">
                        <button type="button" id="refreshSettingsBtn" class="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer flex items-center gap-1.5">
                            <i class="fa-solid fa-rotate-right"></i> Refresh
                        </button>
                        <button type="button" id="resetSettingsBtn" class="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer flex items-center gap-1.5">
                            <i class="fa-solid fa-arrow-rotate-left"></i> Reset Defaults
                        </button>
                    </div>
                </div>

                <!-- Sub-tabs Navigation -->
                <div class="flex items-center gap-2 border-b border-slate-200 pb-3 mb-6 overflow-x-auto" id="settings-subtabs">
                    <button type="button" data-subtab="settings-content-branding" class="settings-subtab-btn px-4 py-2 text-xs font-bold rounded-xl bg-buksu-navy text-white shadow-xs transition-all cursor-pointer border border-buksu-gold/30">
                        <i class="fa-solid fa-building-columns me-1.5 text-buksu-gold"></i> Institution &amp; Branding
                    </button>
                    <button type="button" data-subtab="settings-content-judging" class="settings-subtab-btn px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:text-buksu-navy hover:bg-slate-100 transition-all cursor-pointer border border-transparent">
                        <i class="fa-solid fa-scale-balanced me-1.5 text-slate-400"></i> Judging &amp; Tabulation Rules
                    </button>
                    <button type="button" data-subtab="settings-content-backup" class="settings-subtab-btn px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:text-buksu-navy hover:bg-slate-100 transition-all cursor-pointer border border-transparent">
                        <i class="fa-solid fa-database me-1.5 text-slate-400"></i> Data Backup &amp; Diagnostics
                    </button>
                    <button type="button" data-subtab="settings-content-security" class="settings-subtab-btn px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:text-buksu-navy hover:bg-slate-100 transition-all cursor-pointer border border-transparent">
                        <i class="fa-solid fa-shield-halved me-1.5 text-slate-400"></i> Authentication &amp; Security
                    </button>
                    <button type="button" data-subtab="settings-content-preferences" class="settings-subtab-btn px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:text-buksu-navy hover:bg-slate-100 transition-all cursor-pointer border border-transparent">
                        <i class="fa-solid fa-sliders me-1.5 text-slate-400"></i> Preferences &amp; UI
                    </button>
                </div>

                <!-- Loading State -->
                <div id="settings-loading-state" class="hidden py-12 text-center text-slate-400 text-xs">
                    <i class="fa-solid fa-spinner fa-spin text-2xl text-buksu-navy mb-2"></i>
                    <p class="font-bold text-slate-600">Loading system settings &amp; diagnostics...</p>
                </div>

                <!-- Settings Content Wrapper -->
                <div id="settings-content-wrapper">
                    <form id="systemSettingsForm" onsubmit="return false;" class="space-y-6">

                        <!-- SECTION 1: INSTITUTION & BRANDING -->
                        <div id="settings-content-branding" class="settings-subtab-content space-y-6 animate-fade-in">
                            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                <!-- Left: Branding Identity Form -->
                                <div class="lg:col-span-7 space-y-5">
                                    <div class="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/90 space-y-4">
                                        <div class="flex items-center gap-2 border-b border-slate-200/70 pb-3">
                                            <div class="w-8 h-8 rounded-xl bg-buksu-navy text-buksu-gold flex items-center justify-center text-xs font-bold shadow-2xs">
                                                <i class="fa-solid fa-school"></i>
                                            </div>
                                            <div>
                                                <h3 class="font-extrabold text-sm text-slate-800">Institutional Identity</h3>
                                                <p class="text-[11px] text-slate-500">Official university and campus details shown on public portals &amp; tally sheets.</p>
                                            </div>
                                        </div>

                                        <div class="space-y-3.5 text-xs">
                                            <div>
                                                <label class="block font-bold text-slate-700 mb-1">Institution / University Name <span class="text-rose-500">*</span></label>
                                                <input type="text" id="setting-institution-name" required class="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs" placeholder="e.g. Bukidnon State University">
                                            </div>

                                            <div>
                                                <label class="block font-bold text-slate-700 mb-1">Campus / Department / Organizing Unit</label>
                                                <input type="text" id="setting-campus-unit" class="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs" placeholder="e.g. Main Campus, Malaybalay City - Office of Student Affairs &amp; Services">
                                            </div>

                                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <label class="block font-bold text-slate-700 mb-1">System Title / App Name</label>
                                                    <input type="text" id="setting-system-title" class="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs" placeholder="JudgeTab - Digitalized Judging System">
                                                </div>
                                                <div>
                                                    <label class="block font-bold text-slate-700 mb-1">Official Report Subtitle</label>
                                                    <input type="text" id="setting-header-subtitle" class="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs" placeholder="Official Tabulation &amp; Certification of Results">
                                                </div>
                                            </div>

                                            <div class="pt-2 flex items-center justify-between border-t border-slate-200">
                                                <div class="space-y-0.5">
                                                    <span class="font-bold text-slate-800 block text-xs">University Watermark on Prints</span>
                                                    <span class="text-[11px] text-slate-500 block">Render official seal watermark on exported certificates &amp; printable tally sheets.</span>
                                                </div>
                                                <label class="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" id="setting-show-watermark" checked class="sr-only peer">
                                                    <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-buksu-navy"></div>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Right: Live Branding Preview Card -->
                                <div class="lg:col-span-5 space-y-4">
                                    <div class="p-5 rounded-2xl bg-gradient-to-br from-buksu-navy to-buksu-navy-light text-white shadow-md relative overflow-hidden border border-buksu-gold/30">
                                        <div class="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-buksu-gold/10 blur-xl pointer-events-none"></div>
                                        <div class="flex items-center justify-between pb-3 border-b border-white/15">
                                            <span class="text-[10px] uppercase font-black tracking-widest text-buksu-gold">Live Header Preview</span>
                                            <span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/10 border border-white/20">System Brand</span>
                                        </div>
                                        <div class="py-4 space-y-1">
                                            <h4 id="setting-preview-inst" class="text-base font-black tracking-tight text-white">Bukidnon State University</h4>
                                            <p id="setting-preview-unit" class="text-xs text-slate-300">Malaybalay City, Bukidnon</p>
                                            <div class="pt-3 flex items-center gap-2">
                                                <div class="w-8 h-8 rounded-lg bg-buksu-gold text-buksu-navy flex items-center justify-center font-black text-xs shadow-xs">
                                                    <i class="fa-solid fa-gavel"></i>
                                                </div>
                                                <div>
                                                    <span id="setting-preview-title" class="text-xs font-black text-buksu-gold block">JudgeTab</span>
                                                    <span class="text-[10px] text-slate-300 block">Tabulation &amp; Evaluation Platform</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="p-4 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-900 text-xs space-y-1">
                                        <div class="flex items-center gap-1.5 font-bold">
                                            <i class="fa-solid fa-circle-info text-amber-600"></i>
                                            <span>Branding Usage Note</span>
                                        </div>
                                        <p class="text-[11px] text-amber-800 leading-relaxed">
                                            Changes to the institution name and campus header are applied immediately to judge scorecards, tabulation boards, and printable reports.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <!-- Official Signatories Card -->
                            <div class="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/90 space-y-4">
                                <div class="flex items-center justify-between border-b border-slate-200/70 pb-3 flex-wrap gap-2">
                                    <div class="flex items-center gap-2">
                                        <div class="w-8 h-8 rounded-xl bg-buksu-navy text-buksu-gold flex items-center justify-center text-xs font-bold shadow-2xs">
                                            <i class="fa-solid fa-signature"></i>
                                        </div>
                                        <div>
                                            <h3 class="font-extrabold text-sm text-slate-800">Official Report Signatories</h3>
                                            <p class="text-[11px] text-slate-500">Authorized officials whose names and designations appear on official certified tally sheets.</p>
                                        </div>
                                    </div>
                                    <span class="text-[10px] font-bold text-slate-400">3 Designated Signatories</span>
                                </div>

                                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                                    <!-- Signatory 1 -->
                                    <div class="p-4 rounded-xl bg-white border border-slate-200 space-y-2.5 shadow-2xs">
                                        <span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-700 block w-fit">Signatory 1 (Tabulation)</span>
                                        <div>
                                            <label class="block font-bold text-slate-600 mb-1">Official Name</label>
                                            <input type="text" id="setting-sig-name-0" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500" placeholder="e.g. Dr. Juan Dela Cruz">
                                        </div>
                                        <div>
                                            <label class="block font-bold text-slate-600 mb-1">Designation / Role Title</label>
                                            <input type="text" id="setting-sig-title-0" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500" placeholder="e.g. Head Tabulator">
                                        </div>
                                    </div>

                                    <!-- Signatory 2 -->
                                    <div class="p-4 rounded-xl bg-white border border-slate-200 space-y-2.5 shadow-2xs">
                                        <span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-700 block w-fit">Signatory 2 (Judging)</span>
                                        <div>
                                            <label class="block font-bold text-slate-600 mb-1">Official Name</label>
                                            <input type="text" id="setting-sig-name-1" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500" placeholder="e.g. Prof. Maria Santos">
                                        </div>
                                        <div>
                                            <label class="block font-bold text-slate-600 mb-1">Designation / Role Title</label>
                                            <input type="text" id="setting-sig-title-1" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500" placeholder="e.g. Chairman, Board of Judges">
                                        </div>
                                    </div>

                                    <!-- Signatory 3 -->
                                    <div class="p-4 rounded-xl bg-white border border-slate-200 space-y-2.5 shadow-2xs">
                                        <span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-700 block w-fit">Signatory 3 (Management)</span>
                                        <div>
                                            <label class="block font-bold text-slate-600 mb-1">Official Name</label>
                                            <input type="text" id="setting-sig-name-2" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500" placeholder="e.g. Engr. Roberto Reyes">
                                        </div>
                                        <div>
                                            <label class="block font-bold text-slate-600 mb-1">Designation / Role Title</label>
                                            <input type="text" id="setting-sig-title-2" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500" placeholder="e.g. Overall Event Coordinator">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- SECTION 2: JUDGING & TABULATION RULES -->
                        <div id="settings-content-judging" class="settings-subtab-content space-y-6 hidden animate-fade-in">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                                <!-- Rule 1: Decimal Precision -->
                                <div class="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/90 space-y-3">
                                    <div class="flex items-center gap-2">
                                        <div class="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black text-xs">
                                            <i class="fa-solid fa-calculator"></i>
                                        </div>
                                        <div>
                                            <h4 class="font-extrabold text-sm text-slate-800">Scoring Decimal Precision</h4>
                                            <p class="text-[11px] text-slate-500">Number of decimal places shown in total scores &amp; ranks.</p>
                                        </div>
                                    </div>
                                    <select id="setting-decimal-precision" class="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs">
                                        <option value="1">1 Decimal Place (e.g. 94.2%)</option>
                                        <option value="2" selected>2 Decimal Places (e.g. 94.25%) - Recommended Standard</option>
                                        <option value="3">3 Decimal Places (e.g. 94.250%) - High Precision</option>
                                        <option value="4">4 Decimal Places (e.g. 94.2500%) - Ultra Precision</option>
                                    </select>
                                    <p class="text-[11px] text-slate-400 italic">Affects the Tabulation Board display and printed tally certificates.</p>
                                </div>

                                <!-- Rule 2: Tabulation Algorithm -->
                                <div class="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/90 space-y-3">
                                    <div class="flex items-center gap-2">
                                        <div class="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs">
                                            <i class="fa-solid fa-chart-simple"></i>
                                        </div>
                                        <div>
                                            <h4 class="font-extrabold text-sm text-slate-800">Tabulation Algorithm</h4>
                                            <p class="text-[11px] text-slate-500">Mathematical formula used to calculate final rankings.</p>
                                        </div>
                                    </div>
                                    <select id="setting-tabulation-method" class="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs">
                                        <option value="standard_average" selected>Standard Average (Mean of all assigned judges) - Recommended</option>
                                        <option value="olympic_trimming">Olympic Trimming (Drop highest &amp; lowest judge rating before averaging)</option>
                                        <option value="ordinal_ranking">Ordinal Ranking (Rank sum system across judges)</option>
                                    </select>
                                    <p class="text-[11px] text-slate-400 italic">Olympic trimming requires at least 3 assigned judges per event.</p>
                                </div>

                                <!-- Rule 3: Tie-Breaker Rule -->
                                <div class="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/90 space-y-3">
                                    <div class="flex items-center gap-2">
                                        <div class="w-8 h-8 rounded-xl bg-buksu-navy text-buksu-gold flex items-center justify-center font-black text-xs shadow-2xs">
                                            <i class="fa-solid fa-equals"></i>
                                        </div>
                                        <div>
                                            <h4 class="font-extrabold text-sm text-slate-800">Tie-Breaking Resolution</h4>
                                            <p class="text-[11px] text-slate-500">Automated protocol when two contestants produce identical final scores.</p>
                                        </div>
                                    </div>
                                    <select id="setting-tie-breaker" class="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs">
                                        <option value="highest_weight_criterion" selected>Highest Weight Criterion Priority (Break ties via Criterion #1) - Default</option>
                                        <option value="judge_majority_vote">Judge Majority Preference (Break ties by head-to-head vote)</option>
                                        <option value="split_award">Allow Tied Placements (Co-winners with shared prize)</option>
                                    </select>
                                    <p class="text-[11px] text-slate-400 italic">Eliminates ambiguity during final medal and trophy distribution.</p>
                                </div>

                                <!-- Rule 4: Submission Unlock Policy -->
                                <div class="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/90 space-y-3">
                                    <div class="flex items-center gap-2">
                                        <div class="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-black text-xs">
                                            <i class="fa-solid fa-lock"></i>
                                        </div>
                                        <div>
                                            <h4 class="font-extrabold text-sm text-slate-800">Judge Score Unlock Policy</h4>
                                            <p class="text-[11px] text-slate-500">Security rule when a judge attempts to edit a submitted score.</p>
                                        </div>
                                    </div>
                                    <select id="setting-unlock-policy" class="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs">
                                        <option value="admin_approval" selected>Admin / Tabulator Approval Required (Strict Audit Mode) - Default</option>
                                        <option value="judge_self_unlock">Judge Self-Unlock Allowed (Logged with audit timestamp)</option>
                                    </select>
                                    <p class="text-[11px] text-slate-400 italic">Protects tabulated scores against accidental mid-event overwrites.</p>
                                </div>
                            </div>

                            <!-- Privacy & Blind Judging -->
                            <div class="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/90 flex items-center justify-between gap-4 flex-wrap">
                                <div class="flex items-start gap-3">
                                    <div class="w-8 h-8 rounded-xl bg-buksu-navy text-buksu-gold flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                                        <i class="fa-solid fa-eye-slash"></i>
                                    </div>
                                    <div>
                                        <h4 class="font-extrabold text-sm text-slate-800">Blind Judging Mode</h4>
                                        <p class="text-xs text-slate-500 mt-0.5">Prevent judges from viewing ratings submitted by other judges during live sessions.</p>
                                    </div>
                                </div>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" id="setting-blind-judging" checked class="sr-only peer">
                                    <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-buksu-navy"></div>
                                </label>
                            </div>
                        </div>

                        <!-- SECTION 3: DATA BACKUP & DIAGNOSTICS -->
                        <div id="settings-content-backup" class="settings-subtab-content space-y-6 hidden animate-fade-in">
                            <!-- Backup Action Card -->
                            <div class="backup-action-card p-6 rounded-2xl bg-gradient-to-r from-amber-50 via-amber-100/40 to-amber-50/60 dark:from-slate-850 dark:via-slate-800 dark:to-slate-850 border border-amber-200 dark:border-amber-500/40 shadow-sm flex items-center justify-between gap-4 flex-wrap">
                                <div class="space-y-1 max-w-xl">
                                    <span class="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-amber-400 text-buksu-navy dark:bg-amber-500 dark:text-slate-950">
                                        Data Protection
                                    </span>
                                    <h3 class="text-base font-black text-slate-800 dark:text-slate-100">Instant One-Click Database Snapshot</h3>
                                    <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                        Generate and download an encrypted, portable JSON backup of all registered competitions, criteria rubrics, contestant rosters, judge scores, and user credentials.
                                    </p>
                                </div>
                                <button type="button" id="downloadBackupBtn" class="px-5 py-3 rounded-xl bg-buksu-navy hover:bg-buksu-navy-light dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-slate-950 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2 border border-buksu-gold/30 dark:border-amber-400/50">
                                    <i class="fa-solid fa-download text-buksu-gold dark:text-slate-950"></i> Download Full Database Backup (.json)
                                </button>
                            </div>

                            <!-- Live Diagnostics Grid -->
                            <div class="space-y-3">
                                <div class="flex items-center justify-between">
                                    <h4 class="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-400 flex items-center gap-1.5">
                                        <i class="fa-solid fa-heart-pulse text-emerald-500"></i> Live System Diagnostics
                                    </h4>
                                    <span class="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Operational
                                    </span>
                                </div>

                                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                                    <div class="diag-card p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center space-y-1">
                                        <span class="text-[10px] text-slate-400 uppercase font-extrabold block">Database</span>
                                        <span id="diag-db-name" class="font-black text-slate-800 dark:text-slate-100 block text-sm">djs_db</span>
                                        <span class="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold block">Atlas Connected</span>
                                    </div>
                                    <div class="diag-card p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center space-y-1">
                                        <span class="text-[10px] text-slate-400 uppercase font-extrabold block">Events</span>
                                        <span id="diag-events-count" class="font-black text-buksu-navy dark:text-amber-400 block text-lg">0</span>
                                        <span class="text-[9px] text-slate-500 dark:text-slate-400 block">Competitions</span>
                                    </div>
                                    <div class="diag-card p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center space-y-1">
                                        <span class="text-[10px] text-slate-400 uppercase font-extrabold block">Contestants</span>
                                        <span id="diag-contestants-count" class="font-black text-buksu-navy dark:text-amber-400 block text-lg">0</span>
                                        <span class="text-[9px] text-slate-500 dark:text-slate-400 block">Registered</span>
                                    </div>
                                    <div class="diag-card p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center space-y-1">
                                        <span class="text-[10px] text-slate-400 uppercase font-extrabold block">Criteria</span>
                                        <span id="diag-criteria-count" class="font-black text-buksu-navy dark:text-amber-400 block text-lg">0</span>
                                        <span class="text-[9px] text-slate-500 dark:text-slate-400 block">Configured</span>
                                    </div>
                                    <div class="diag-card p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center space-y-1">
                                        <span class="text-[10px] text-slate-400 uppercase font-extrabold block">Scores</span>
                                        <span id="diag-scores-count" class="font-black text-buksu-navy dark:text-amber-400 block text-lg">0</span>
                                        <span class="text-[9px] text-slate-500 dark:text-slate-400 block">Evaluations</span>
                                    </div>
                                    <div class="diag-card p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center space-y-1">
                                        <span class="text-[10px] text-slate-400 uppercase font-extrabold block">Accounts</span>
                                        <span id="diag-users-count" class="font-black text-buksu-navy dark:text-amber-400 block text-lg">0</span>
                                        <span class="text-[9px] text-slate-500 dark:text-slate-400 block">Total Users</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Maintenance Controls Card -->
                            <div class="maintenance-control-card p-5 rounded-2xl bg-rose-50/50 dark:bg-slate-850 border border-rose-200 dark:border-rose-900/40 space-y-3 text-xs">
                                <div class="flex items-center gap-2">
                                    <div class="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/50 flex items-center justify-center font-bold text-xs">
                                        <i class="fa-solid fa-triangle-exclamation"></i>
                                    </div>
                                    <div>
                                        <h4 class="font-black text-sm text-slate-800 dark:text-slate-100">System Log Maintenance</h4>
                                        <p class="text-[11px] text-slate-500 dark:text-slate-400">Purge historical audit records to reclaim database storage space.</p>
                                    </div>
                                </div>
                                <div class="flex items-center justify-between gap-3 pt-2 border-t border-rose-200/60 dark:border-rose-900/40 flex-wrap">
                                    <p class="text-[11px] text-slate-600 dark:text-slate-300">Current audit records: <strong id="diag-logs-count" class="text-rose-700 dark:text-rose-400">0</strong> entries</p>
                                    <button type="button" id="clearLogsBtn" class="px-4 py-2 bg-white hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold rounded-xl border border-rose-300 dark:border-rose-800 transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5">
                                        <i class="fa-solid fa-trash-can"></i> Purge Activity Logs
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- SECTION: AUTHENTICATION & SECURITY CONTROLS -->
                        <div id="settings-content-security" class="settings-subtab-content space-y-6 hidden animate-fade-in">
                            <div class="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/90 space-y-4">
                                <div class="flex items-center justify-between border-b border-slate-200/70 pb-3 flex-wrap gap-2">
                                    <div class="flex items-center gap-2">
                                        <div class="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shadow-2xs">
                                            <i class="fa-solid fa-shield-halved"></i>
                                        </div>
                                        <div>
                                            <h3 class="font-extrabold text-sm text-slate-800">Authentication &amp; Bot Protection Controls</h3>
                                            <p class="text-[11px] text-slate-500">Configure third-party Single Sign-On and automated brute-force protection mechanisms.</p>
                                        </div>
                                    </div>
                                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
                                        <i class="fa-solid fa-envelope-circle-check text-amber-600"></i> Email Confirmation Protected
                                    </span>
                                </div>

                                <div class="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                                    <i class="fa-solid fa-triangle-exclamation text-amber-600 mt-0.5 shrink-0 text-sm"></i>
                                    <div class="text-[11px] leading-relaxed">
                                        <strong>Two-Step Security Requirement:</strong> To prevent unauthorized tampering with authentication controls, toggling Google OAuth or reCAPTCHA sends a verification code and link to your administrator email address before changes are committed.
                                    </div>
                                </div>

                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                    <!-- Google OAuth 2.0 Card -->
                                    <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3">
                                        <div class="space-y-2">
                                            <div class="flex items-center justify-between">
                                                <div class="flex items-center gap-2.5">
                                                    <div class="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                                                        <svg class="w-4 h-4" viewBox="0 0 24 24">
                                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <h4 class="font-bold text-xs text-slate-800">Google OAuth 2.0 Login</h4>
                                                        <span id="google-auth-status-badge" class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Active</span>
                                                    </div>
                                                </div>
                                                <label class="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" id="setting-toggle-google-auth" checked class="sr-only peer">
                                                    <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-buksu-navy"></div>
                                                </label>
                                            </div>
                                            <p class="text-[11px] text-slate-500 leading-relaxed">
                                                Enables the "Sign in with Google" button on login. Allows administrators, judges, and tabulators to sign in directly with their registered Google account.
                                            </p>
                                        </div>
                                    </div>

                                    <!-- Google reCAPTCHA v2 Card -->
                                    <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3">
                                        <div class="space-y-2">
                                            <div class="flex items-center justify-between">
                                                <div class="flex items-center gap-2.5">
                                                    <div class="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                                                        <i class="fa-solid fa-robot"></i>
                                                    </div>
                                                    <div>
                                                        <h4 class="font-bold text-xs text-slate-800">Google reCAPTCHA v2</h4>
                                                        <span id="recaptcha-status-badge" class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Active</span>
                                                    </div>
                                                </div>
                                                <label class="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" id="setting-toggle-recaptcha" checked class="sr-only peer">
                                                    <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-buksu-navy"></div>
                                                </label>
                                            </div>
                                            <p class="text-[11px] text-slate-500 leading-relaxed">
                                                Enforces the "I'm not a robot" checkbox challenge across the Sign In, Admin Registration, and Password Reset forms to prevent automated brute-force attacks.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div class="pt-3 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2">
                                    <span class="text-[11px] text-slate-400">
                                        Requires email OTP confirmation before changes are applied.
                                    </span>
                                    <button type="button" id="applySecurityTogglesBtn" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5">
                                        <i class="fa-solid fa-paper-plane text-emerald-200"></i> Update Security Controls
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- SECTION 4: PREFERENCES & UI CUSTOMIZATION -->
                        <div id="settings-content-preferences" class="settings-subtab-content space-y-6 hidden animate-fade-in">
                            <?php include __DIR__ . '/frontend/components/preferences_section.php'; ?>
                        </div>

                        <!-- Sticky Bottom Action Footer -->
                        <div class="pt-5 border-t border-slate-200 flex items-center justify-between flex-wrap gap-3">
                            <span class="text-xs text-slate-400 flex items-center gap-1.5">
                                <i class="fa-solid fa-shield-halved text-emerald-500"></i> Settings stored securely in MongoDB Atlas
                            </span>
                            <button type="submit" id="saveSettingsBtn" class="px-6 py-2.5 rounded-xl bg-buksu-navy hover:bg-buksu-navy-light text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2 border border-buksu-gold/30">
                                <i class="fa-solid fa-floppy-disk text-buksu-gold"></i> Save All Settings
                            </button>
                        </div>
                    </form>
                </div>
            </div>

        <?php else: ?>
            <!-- JUDGE / TABULATOR VIEW: ASSIGNED COMPETITIONS -->
            <div id="user-events-tab" class="user-tab-content bg-white rounded-3xl shadow-xl border border-slate-100 p-6 sm:p-8">
                <div class="flex items-center justify-between flex-wrap gap-4 mb-6 border-b border-slate-100 pb-4">
                    <div>
                        <h2 class="text-xl font-extrabold text-buksu-navy flex items-center gap-2">
                            <i class="fa-solid fa-clipboard-list text-buksu-navy"></i> Your Assigned Competitions
                        </h2>
                        <p class="text-xs text-slate-500 mt-0.5">Competitions and events where you are designated as an official <?= ucfirst($role) ?>.</p>
                    </div>
                    <button id="refreshUserEventsBtn" class="text-xs text-slate-500 hover:text-buksu-navy font-semibold flex items-center gap-1 cursor-pointer">
                        <i class="fa-solid fa-rotate-right"></i> Refresh List
                    </button>
                </div>

                <div id="user-assigned-events-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    <div class="col-span-full py-12 text-center text-slate-400">
                        <i class="fa-solid fa-spinner fa-spin text-xl mb-2"></i>
                        <p class="text-xs">Loading assigned competitions...</p>
                    </div>
                </div>
            </div>

            <!-- JUDGE / TABULATOR VIEW: PREFERENCES ONLY -->
            <div id="user-preferences-tab" class="user-tab-content bg-white rounded-3xl shadow-xl border border-slate-100 p-6 sm:p-8 hidden">
                <?php include __DIR__ . '/frontend/components/preferences_section.php'; ?>
            </div>
        <?php endif; ?>

            </div> <!-- End #dashboard-content-area -->
        </div> <!-- End #dashboard-layout-container -->
    </main>

    <?php if ($role === 'admin'): ?>
    <!-- MODAL: CREATE EVENT -->
    <div id="create-event-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 hidden">
        <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-4 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 class="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                    <i class="fa-solid fa-calendar-plus text-buksu-navy"></i> Create Competition
                </h3>
                <button class="close-modal-btn text-slate-400 hover:text-slate-600 text-lg cursor-pointer">&times;</button>
            </div>

            <form id="createEventForm" onsubmit="return false;" class="space-y-4">
                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1">Event Name <span class="text-rose-500">*</span></label>
                    <input type="text" id="ev-name" placeholder="e.g. PE Culmination Dance Contest" class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none">
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Type <span class="text-rose-500">*</span></label>
                        <input type="text" id="ev-type" placeholder="e.g. Dance_Competition" class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Venue <span class="text-rose-500">*</span></label>
                        <input type="text" id="ev-venue" placeholder="e.g. BukSU GYM" class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none">
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1">Event Date &amp; Time <span class="text-rose-500">*</span></label>
                    <input type="datetime-local" id="ev-date" class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none">
                </div>

                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                    <textarea id="ev-desc" rows="2" placeholder="Brief event description..." class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"></textarea>
                </div>

                <div class="pt-2 flex items-center justify-end gap-2">
                    <button type="button" class="close-modal-btn px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs rounded-xl cursor-pointer">Cancel</button>
                    <button type="submit" id="saveCreateEventBtn" class="px-4 py-2 bg-buksu-navy hover:bg-buksu-navy-light text-white font-bold text-xs rounded-xl shadow cursor-pointer">Save Competition</button>
                </div>
            </form>
        </div>
    </div>

    <!-- MODAL: EDIT EVENT -->
    <div id="edit-event-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 hidden">
        <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-4 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 class="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                    <i class="fa-solid fa-pen-to-square text-buksu-navy"></i> Edit Competition Details
                </h3>
                <button class="close-modal-btn text-slate-400 hover:text-slate-600 text-lg cursor-pointer">&times;</button>
            </div>

            <form id="editEventForm" onsubmit="return false;" class="space-y-4">
                <input type="hidden" id="edit-ev-id" value="">

                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1">Event Name</label>
                    <input type="text" id="edit-ev-name" class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none">
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Type</label>
                        <input type="text" id="edit-ev-type" class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Venue</label>
                        <input type="text" id="edit-ev-venue" class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none">
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Event Status</label>
                        <select id="edit-ev-status" class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none">
                            <option value="Upcoming">Upcoming</option>
                            <option value="Ongoing">Ongoing</option>
                            <option value="Completed">Completed</option>
                            <option value="Archived">Archived</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1">Judging Status</label>
                        <select id="edit-ev-judging-status" class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none">
                            <option value="Not Yet Started">Not Yet Started</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Finished">Finished</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1">Event Date &amp; Time</label>
                    <input type="datetime-local" id="edit-ev-date" class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none">
                </div>

                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                    <textarea id="edit-ev-desc" rows="2" class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"></textarea>
                </div>

                <div class="pt-2 flex items-center justify-between gap-2">
                    <button type="button" id="deleteArchivedEventFromEditBtn" class="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 transition-colors hidden">
                        <i class="fa-solid fa-trash-can"></i> Delete Archived Competition
                    </button>
                    <div class="flex items-center gap-2 ms-auto">
                        <button type="button" class="close-modal-btn px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs rounded-xl cursor-pointer">Cancel</button>
                        <button type="submit" id="saveEditEventBtn" class="px-4 py-2 bg-buksu-navy hover:bg-buksu-navy-light text-white font-bold text-xs rounded-xl shadow cursor-pointer">Update Event</button>
                    </div>
                </div>
            </form>
        </div>
    </div>

    <!-- MODAL: MANAGE ASSIGNMENTS -->
    <div id="assign-event-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 hidden">
        <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-4 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 class="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                    <i class="fa-solid fa-users-check text-buksu-navy"></i> Assign Judges &amp; Tabulators
                </h3>
                <button class="close-modal-btn text-slate-400 hover:text-slate-600 text-lg cursor-pointer">&times;</button>
            </div>

            <form id="assignEventForm" onsubmit="return false;" class="space-y-4">
                <input type="hidden" id="assign-ev-id" value="">
                <p id="assign-ev-title" class="font-bold text-slate-800 text-xs"></p>

                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1.5">Assign Judges</label>
                    <div id="assign-judges-checkboxes" class="space-y-2 max-h-40 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                        <span class="text-slate-400">Loading judges...</span>
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1.5">Assign Tabulators</label>
                    <div id="assign-tabulators-checkboxes" class="space-y-2 max-h-40 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                        <span class="text-slate-400">Loading tabulators...</span>
                    </div>
                </div>

                <div class="pt-2 flex items-center justify-end gap-2">
                    <button type="button" class="close-modal-btn px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs rounded-xl cursor-pointer">Cancel</button>
                    <button type="submit" id="saveAssignBtn" class="px-4 py-2 bg-buksu-navy hover:bg-buksu-navy-light text-white font-bold text-xs rounded-xl shadow cursor-pointer">Save Assignments</button>
                </div>
            </form>
        </div>
    </div>

    <!-- MODAL: MANAGE EVENT SETUP (CONTESTANTS & CRITERIA) -->
    <div id="manage-event-setup-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 hidden">
        <div class="bg-white rounded-3xl shadow-2xl max-w-6xl w-full p-6 sm:p-8 space-y-5 max-h-[92vh] overflow-y-auto border border-slate-100 animate-fade-in flex flex-col">
            <!-- Modal Header -->
            <div class="flex items-center justify-between border-b border-slate-100 pb-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-2xl bg-buksu-navy text-buksu-gold flex items-center justify-center font-bold shadow-md border border-buksu-gold/30">
                        <i class="fa-solid fa-sliders text-base"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <span id="setup-modal-event-id-badge" class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-600 uppercase">Event #1</span>
                            <span class="text-xs font-semibold text-slate-400">Competition Management</span>
                        </div>
                        <h3 id="setup-modal-event-title" class="font-extrabold text-slate-800 text-lg leading-tight">Manage Contestants &amp; Judging Criteria</h3>
                    </div>
                </div>
                <button type="button" class="close-modal-btn text-slate-400 hover:text-slate-600 text-2xl cursor-pointer p-1 transition-colors leading-none">&times;</button>
            </div>

            <!-- Tab Switcher -->
            <div class="flex items-center gap-2 border-b border-slate-100 pb-3">
                <button type="button" class="setup-tab-btn px-4 py-2 text-xs font-bold rounded-xl bg-buksu-navy text-white shadow-xs transition-all cursor-pointer" data-tab="setup-contestants-tab">
                    <i class="fa-solid fa-users me-1.5 text-buksu-gold"></i> Contestant Records
                </button>
                <button type="button" class="setup-tab-btn px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:bg-slate-100 hover:text-buksu-navy transition-all cursor-pointer" data-tab="setup-criteria-tab">
                    <i class="fa-solid fa-list-check me-1.5 text-slate-400"></i> Judging Criteria &amp; Weights
                </button>
            </div>

            <!-- TAB 1: CONTESTANTS -->
            <div id="setup-contestants-tab" class="setup-tab-content space-y-6 flex-1">
                <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <!-- Contestants List (3 cols) -->
                    <div class="lg:col-span-3 space-y-3">
                        <div class="flex items-center justify-between">
                            <h4 class="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <i class="fa-solid fa-address-book text-buksu-navy"></i> Registered Contestants
                            </h4>
                            <span class="text-[11px] text-slate-400 font-medium">Auto-ordered by number</span>
                        </div>
                        <div id="setup-contestants-list" class="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                            <div class="py-6 text-center text-slate-400 text-xs">
                                <i class="fa-solid fa-spinner fa-spin me-1.5"></i> Loading contestants...
                            </div>
                        </div>
                    </div>

                    <!-- Create Contestant Form (2 cols) -->
                    <div class="lg:col-span-2 bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-user-plus text-buksu-navy text-sm"></i>
                            <h4 class="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Register Contestant</h4>
                        </div>
                        <form id="createContestantForm" onsubmit="return false;" class="space-y-3 text-xs">
                            <div>
                                <label class="block font-semibold text-slate-700 mb-1">Contestant Number</label>
                                <input type="number" id="new-contestant-num" min="1" required class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-buksu-navy">
                            </div>
                            <div>
                                <label class="block font-semibold text-slate-700 mb-1.5">Entry Type</label>
                                <div class="grid grid-cols-2 gap-2">
                                    <label class="flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-slate-300">
                                        <input type="radio" name="contestant_entry_type" value="individual" checked class="text-buksu-navy focus:ring-buksu-navy">
                                        <span class="font-bold text-xs text-slate-700"><i class="fa-solid fa-user me-1 text-slate-400"></i> Individual</span>
                                    </label>
                                    <label class="flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-slate-300">
                                        <input type="radio" name="contestant_entry_type" value="team" class="text-buksu-navy focus:ring-buksu-navy">
                                        <span class="font-bold text-xs text-slate-700"><i class="fa-solid fa-users-line me-1 text-slate-400"></i> Team-based</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label id="new-contestant-name-label" class="block font-semibold text-slate-700 mb-1">Full Name / Entry Title</label>
                                <input type="text" id="new-contestant-name" required placeholder="e.g. John Doe" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-buksu-navy">
                            </div>
                            <div id="new-contestant-team-members-group" class="hidden">
                                <div class="flex items-center justify-between mb-1">
                                    <label class="font-semibold text-slate-700">Team Members <span class="text-slate-400 font-normal">(Optional)</span></label>
                                    <span class="text-[10px] text-slate-400">Comma or line-separated</span>
                                </div>
                                <textarea id="new-contestant-members" rows="2" placeholder="e.g. Alice (Vocals), Bob (Keyboardist)&#10;or leave blank to register team name only" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-buksu-navy"></textarea>
                            </div>
                            <div>
                                <label class="block font-semibold text-slate-700 mb-1">Department / Organization</label>
                                <input type="text" id="new-contestant-dept" placeholder="e.g. College of Education" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-buksu-navy">
                            </div>
                            <div>
                                <label class="block font-semibold text-slate-700 mb-1">Special Citation / Note <span class="text-slate-400 font-normal">(Optional)</span></label>
                                <input type="text" id="new-contestant-comment" placeholder="e.g. Best Keyboardist, Special Award note..." class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-buksu-navy">
                            </div>
                            <div>
                                <label class="block font-semibold text-slate-700 mb-1">Description / Entry Info</label>
                                <textarea id="new-contestant-desc" rows="2" placeholder="Brief notes or piece title..." class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-buksu-navy"></textarea>
                            </div>
                            <button type="submit" id="addContestantBtn" class="w-full py-2.5 bg-buksu-navy hover:bg-buksu-navy-light text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5">
                                <i class="fa-solid fa-plus text-buksu-gold"></i> Add Contestant
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            <!-- TAB 2: CRITERIA & WEIGHTS -->
            <div id="setup-criteria-tab" class="setup-tab-content space-y-6 flex-1 hidden">
                <!-- Weight Allocation Bar & Action -->
                <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between flex-wrap gap-4">
                    <div class="space-y-1.5 flex-1 min-w-[240px]">
                        <div class="flex items-center justify-between text-xs">
                            <span class="font-bold text-slate-700 flex items-center gap-1.5">
                                <i class="fa-solid fa-chart-pie text-buksu-navy"></i> Overall Criteria Weight
                            </span>
                            <span id="setup-criteria-weight-badge" class="px-3 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-300">0% / 100% Total</span>
                        </div>
                        <div class="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                            <div id="setup-criteria-weight-bar" class="h-full bg-amber-500 rounded-full transition-all duration-300" style="width: 0%;"></div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" id="openConfigureWeightsBtn" class="px-3.5 py-2 bg-buksu-navy hover:bg-buksu-navy-light text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors">
                            <i class="fa-solid fa-sliders"></i> Adjust All Weights
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <!-- Criteria List (3 cols) -->
                    <div class="lg:col-span-3 space-y-3">
                        <h4 class="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <i class="fa-solid fa-list-ol text-buksu-navy"></i> Active Judging Criteria
                        </h4>
                        <div id="setup-criteria-list" class="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                            <div class="py-6 text-center text-slate-400 text-xs">
                                <i class="fa-solid fa-spinner fa-spin me-1.5"></i> Loading criteria...
                            </div>
                        </div>
                    </div>

                    <!-- Create Criterion Form (2 cols) -->
                    <div class="lg:col-span-2 bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-folder-plus text-buksu-navy text-sm"></i>
                            <h4 class="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Add Judging Criterion</h4>
                        </div>
                        <form id="createCriterionForm" onsubmit="return false;" class="space-y-3 text-xs">
                            <div>
                                <label class="block font-semibold text-slate-700 mb-1">Criterion Title</label>
                                <input type="text" id="new-criterion-title" required placeholder="e.g. Choreography & Execution" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-buksu-navy font-bold text-slate-800">
                            </div>

                            <!-- 2 Choices of Scoring Selector in Quick Add -->
                            <div>
                                <label class="block font-bold text-slate-700 mb-1">Scoring Choice</label>
                                <div class="grid grid-cols-1 gap-2">
                                    <label class="flex items-start gap-2.5 p-2.5 rounded-xl border border-amber-500 bg-amber-50/40 cursor-pointer transition-all quick-scoring-type-label" id="quick-scoring-rubric-card">
                                        <input type="radio" name="quick_scoring_type" value="rubric" class="mt-0.5 accent-amber-600" checked>
                                        <div class="leading-tight">
                                            <span class="font-bold text-slate-800 text-xs block">Criteria-Based Scoring</span>
                                            <span class="text-[10px] text-slate-500">The judge selects a predefined rating with a fixed score and description.</span>
                                        </div>
                                    </label>
                                    <label class="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-slate-400 transition-all quick-scoring-type-label" id="quick-scoring-category-card">
                                        <input type="radio" name="quick_scoring_type" value="category" class="mt-0.5 accent-buksu-navy">
                                        <div class="leading-tight">
                                            <span class="font-bold text-slate-800 text-xs block">Category-Based Scoring</span>
                                            <span class="text-[10px] text-slate-500">The judge scores individual sub-categories which sum up to the total score.</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <div class="flex items-center justify-between mb-1">
                                        <label class="block font-semibold text-slate-700">Weight (%)</label>
                                        <span id="new-criterion-weight-hint" class="text-[10px] font-bold text-slate-500"></span>
                                    </div>
                                    <input type="number" id="new-criterion-pct" min="0" max="100" placeholder="e.g. 40" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-buksu-navy">
                                </div>
                                <div>
                                    <label class="block font-semibold text-slate-700 mb-1" id="new-criterion-max-label">Max Score (pts)</label>
                                    <input type="number" id="new-criterion-max" min="1" value="100" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-buksu-navy">
                                </div>
                            </div>

                            <!-- Criteria-Based Quick Info (visible by default) -->
                            <div id="quick-rubric-info-box" class="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 space-y-1">
                                <span class="font-extrabold flex items-center gap-1"><i class="fa-solid fa-list-check text-amber-600"></i> Criteria-Based Scoring</span>
                                <p class="text-[10px] text-amber-700">Predefined ratings (e.g. Excellent, Very Good, Good, Fair) will be automatically generated from Max Points, or click "Customize Criteria &amp; Scoring" below to edit each rating.</p>
                            </div>

                            <!-- Category Quick Info (visible if category) -->
                            <div id="quick-category-info-box" class="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-800 space-y-1 hidden">
                                <span class="font-extrabold flex items-center gap-1 text-buksu-navy"><i class="fa-solid fa-layer-group text-buksu-navy"></i> Category-Based Scoring</span>
                                <p class="text-[10px] text-slate-600">Will be created with 3 categories totaling your Max Score (e.g. 10 + 10 + 10 = 30 pts). You can click "Edit" on the criterion to customize each category's name, max points, and description.</p>
                            </div>

                            <div>
                                <label class="block font-semibold text-slate-700 mb-1">Description / Guidelines</label>
                                <textarea id="new-criterion-desc" rows="2" placeholder="Judging guidelines and instructions for judges..." class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-buksu-navy"></textarea>
                            </div>

                            <button type="submit" id="addCriterionBtn" class="w-full py-2.5 bg-buksu-navy hover:bg-buksu-navy-light text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5">
                                <i class="fa-solid fa-plus text-buksu-gold"></i> Add Judging Criterion
                            </button>
                            <button type="button" id="openCustomRubricBuilderBtn" class="w-full py-2 bg-slate-100 hover:bg-slate-200 text-buksu-navy border border-slate-200 font-extrabold text-xs rounded-xl shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5">
                                <i class="fa-solid fa-sliders text-buksu-navy"></i> Open Advanced Scoring Setup
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            <!-- Modal Footer -->
            <div class="pt-3 border-t border-slate-100 flex items-center justify-end">
                <button type="button" class="close-modal-btn px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer">
                    Done &amp; Close
                </button>
            </div>
        </div>
    </div>

    <!-- MODAL: ADJUST CRITERIA WEIGHTS -->
    <div id="adjust-weights-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60] hidden">
        <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-7 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-100 animate-fade-in">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 class="font-extrabold text-slate-800 text-base flex items-center gap-2">
                    <i class="fa-solid fa-scale-balanced text-buksu-navy"></i> Configure Criteria Weights
                </h3>
                <button type="button" class="close-modal-btn text-slate-400 hover:text-slate-600 text-xl cursor-pointer leading-none">&times;</button>
            </div>
            <p class="text-xs text-slate-500">Assign percentage weights for each criterion. The total weight can only be set up to 100% and cannot exceed 100%.</p>

            <!-- Total Weight Live Indicator -->
            <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div class="flex items-center justify-between text-xs">
                    <span class="font-extrabold text-slate-700 flex items-center gap-1.5">
                        <i class="fa-solid fa-chart-pie text-buksu-navy"></i> Total Weight:
                    </span>
                    <span id="weights-modal-total-badge" class="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                        100% / 100%
                    </span>
                </div>
                <div class="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div id="weights-modal-total-bar" class="h-full bg-emerald-500 rounded-full transition-all duration-300" style="width: 100%;"></div>
                </div>
            </div>

            <!-- Exceeds 100% Warning Alert Banner -->
            <div id="weights-modal-warning-alert" class="hidden p-3 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-bold flex items-start gap-2.5">
                <i class="fa-solid fa-triangle-exclamation text-rose-600 mt-0.5 shrink-0 text-sm"></i>
                <span id="weights-modal-warning-text">Total weight exceeds 100%! Please decrease one or more criterion weights.</span>
            </div>

            <div id="weights-adjust-container" class="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                <div class="py-4 text-center text-slate-400 text-xs">Loading criteria...</div>
            </div>
            <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button type="button" class="close-modal-btn px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer">Cancel</button>
                <button type="button" id="saveWeightsBtn" class="px-4 py-2 bg-buksu-navy hover:bg-buksu-navy-light text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5">
                    <i class="fa-solid fa-check"></i> Save Weights
                </button>
            </div>
        </div>
    </div>

    <!-- MODAL: EDIT CRITERION & SCORING METHOD BUILDER -->
    <div id="criterion-rubric-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60] hidden">
        <div class="bg-white rounded-3xl shadow-2xl max-w-5xl w-full p-6 sm:p-8 space-y-4 max-h-[92vh] overflow-y-auto border border-slate-100 animate-fade-in flex flex-col">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                <div class="flex items-center gap-2.5">
                    <div class="w-9 h-9 rounded-xl bg-buksu-navy text-buksu-gold flex items-center justify-center font-bold text-sm shadow-xs border border-buksu-gold/30">
                        <i class="fa-solid fa-sliders"></i>
                    </div>
                    <div>
                        <h3 id="rubric-modal-title" class="font-extrabold text-slate-800 text-base leading-tight">Configure Criterion &amp; Scoring Method</h3>
                        <p class="text-[11px] text-slate-500">Choose between Criteria-Based (Predefined Ratings) or Category-Based Scoring</p>
                    </div>
                </div>
                <button type="button" class="close-modal-btn text-slate-400 hover:text-slate-600 text-2xl cursor-pointer p-1 leading-none">&times;</button>
            </div>

            <form id="criterionRubricForm" onsubmit="return false;" class="space-y-4 text-xs">
                <input type="hidden" id="rubric-modal-crit-id" value="">

                <!-- Criterion Basic Info -->
                <div class="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div class="sm:col-span-6">
                        <label class="block font-semibold text-slate-700 mb-1">Criterion Title</label>
                        <input type="text" id="rubric-modal-title-input" required placeholder="e.g. Form &amp; Technique" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-buksu-navy font-bold text-slate-800">
                    </div>
                    <div class="sm:col-span-3">
                        <div class="flex items-center justify-between mb-1">
                            <label class="block font-semibold text-slate-700">Weight (%)</label>
                            <span id="rubric-modal-weight-hint" class="text-[10px] font-bold text-slate-500"></span>
                        </div>
                        <input type="number" id="rubric-modal-pct-input" min="0" max="100" placeholder="e.g. 25" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-buksu-navy">
                    </div>
                    <div class="sm:col-span-3">
                        <label class="block font-semibold text-slate-700 mb-1">Max Score (pts)</label>
                        <input type="number" id="rubric-modal-max-input" min="1" value="100" step="0.5" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-buksu-navy">
                    </div>
                </div>

                <!-- 2 CHOICES OF SCORING: Segmented Option Cards -->
                <div class="space-y-1.5 pt-1">
                    <label class="block font-extrabold text-slate-700 text-xs uppercase tracking-wider">Select Scoring Method</label>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <!-- Choice 1: Criteria-Based Scoring -->
                        <label class="modal-scoring-choice-card cursor-pointer relative p-3.5 rounded-2xl border-2 transition-all flex items-start gap-3 bg-amber-50/50 border-amber-500 shadow-2xs" id="modal-scoring-card-rubric">
                            <input type="radio" name="modal_scoring_type" value="rubric" id="modal-scoring-type-rubric" class="mt-1 accent-amber-600" checked>
                            <div class="space-y-1 flex-1">
                                <div class="flex items-center gap-1.5">
                                    <span class="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-xs">
                                        <i class="fa-solid fa-list-check"></i>
                                    </span>
                                    <span class="font-extrabold text-slate-800 text-xs">Criteria-Based</span>
                                    <span class="px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-100 text-amber-800 uppercase">Choice 1</span>
                                </div>
                                <p class="text-[11px] text-slate-600 leading-snug">The judge selects a predefined rating with a fixed score and description.</p>
                            </div>
                        </label>

                        <!-- Choice 2: Category-Based Scoring -->
                        <label class="modal-scoring-choice-card cursor-pointer relative p-3.5 rounded-2xl border-2 transition-all flex items-start gap-3 bg-white border-slate-200 hover:border-slate-300" id="modal-scoring-card-category">
                            <input type="radio" name="modal_scoring_type" value="category" id="modal-scoring-type-category" class="mt-1 accent-buksu-navy">
                            <div class="space-y-1 flex-1">
                                <div class="flex items-center gap-1.5">
                                    <span class="w-6 h-6 rounded-lg bg-slate-100 text-buksu-navy flex items-center justify-center text-xs">
                                        <i class="fa-solid fa-layer-group"></i>
                                    </span>
                                    <span class="font-extrabold text-slate-800 text-xs">Category-Based</span>
                                    <span class="px-2 py-0.5 rounded-md text-[9px] font-black bg-slate-100 text-slate-700 uppercase">Choice 2</span>
                                </div>
                                <p class="text-[11px] text-slate-600 leading-snug">The judge scores individual sub-categories which sum up to the total score.</p>
                            </div>
                        </label>
                    </div>
                </div>

                <!-- SECTION: CRITERIA-BASED SCORING CONFIGURATION (Predefined Ratings) -->
                <div id="modal-rubric-config-section" class="space-y-3 pt-1">
                    <div class="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-2">
                        <div>
                            <h4 class="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <i class="fa-solid fa-list-check text-amber-600"></i> Predefined Ratings &amp; Fixed Scores
                            </h4>
                            <p class="text-[10px] text-slate-500">Judges select one of these predefined ratings during scoring. The fixed score is awarded automatically.</p>
                        </div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <button type="button" id="rubricLoad4TierPresetBtn" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[11px] cursor-pointer transition-colors flex items-center gap-1" title="Load standard 4-tier rubric (Excellent, Good, Fair, Poor)">
                                <i class="fa-solid fa-wand-magic-sparkles text-xs text-amber-500"></i> 4-Level Preset
                            </button>
                            <button type="button" id="rubricLoad5TierPresetBtn" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[11px] cursor-pointer transition-colors flex items-center gap-1" title="Load 5-tier rubric (Superior, Excellent, Good, Fair, Poor)">
                                <i class="fa-solid fa-wand-magic-sparkles text-xs text-amber-500"></i> 5-Level Preset
                            </button>
                            <button type="button" id="rubricAddRatingBtn" class="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl text-[11px] cursor-pointer transition-colors flex items-center gap-1 border border-amber-200">
                                <i class="fa-solid fa-plus text-xs"></i> Add Predefined Rating
                            </button>
                        </div>
                    </div>

                    <!-- Dynamic Container for Predefined Ratings -->
                    <div id="rubric-ratings-container" class="space-y-3 max-h-[38vh] overflow-y-auto pr-1">
                        <!-- Populated dynamically with predefined rating cards -->
                    </div>
                </div>

                <!-- SECTION 3: CATEGORY-BASED SCORING CONFIGURATION (Sub-Categories Sum) -->
                <div id="modal-category-config-section" class="space-y-3 pt-1 hidden">
                    <div class="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-2">
                        <div>
                            <h4 class="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                                <i class="fa-solid fa-layer-group text-buksu-navy"></i> Score Categories &amp; Max Points
                            </h4>
                            <p class="text-[10px] text-slate-500">The judge inputs scores for each category (up to its max). The sum of all category max scores determines the total criterion score.</p>
                        </div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <span id="category-sum-total-badge" class="px-3 py-1 rounded-xl text-xs font-black bg-slate-100 text-slate-800 border border-slate-300">
                                Total: 30 pts (3 Categories)
                            </span>
                            <button type="button" id="categoryLoadStylePresetBtn" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[11px] cursor-pointer transition-colors flex items-center gap-1" title="Load Style Example (Stance uniqueness 10pts, Pose preference 10pts, Crowd impact 10pts)">
                                <i class="fa-solid fa-wand-magic-sparkles text-xs text-buksu-navy"></i> Style Example (30 pts)
                            </button>
                            <button type="button" id="categoryLoad4TierPresetBtn" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[11px] cursor-pointer transition-colors flex items-center gap-1">
                                <i class="fa-solid fa-wand-magic-sparkles text-xs text-buksu-navy"></i> 4 Standard Categories
                            </button>
                            <button type="button" id="categoryAddRowBtn" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-[11px] cursor-pointer transition-colors flex items-center gap-1 border border-slate-200">
                                <i class="fa-solid fa-plus text-xs"></i> Add Category
                            </button>
                        </div>
                    </div>

                    <!-- Dynamic Container for Score Categories -->
                    <div id="category-rows-container" class="space-y-3 max-h-[38vh] overflow-y-auto pr-1">
                        <!-- Populated dynamically with category rows -->
                    </div>
                </div>

                <!-- Shared Description / Guidelines -->
                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Description / Core Objective &amp; Judging Guidelines</label>
                    <textarea id="rubric-modal-desc-input" rows="2" placeholder="Describe the evaluation guidelines and instructions for judges..." class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-buksu-navy"></textarea>
                </div>

                <!-- Modal Actions -->
                <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button type="button" class="close-modal-btn px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer">Cancel</button>
                    <button type="submit" id="saveRubricCriterionBtn" class="px-4 py-2 bg-buksu-navy hover:bg-buksu-navy-light text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors">
                        <i class="fa-solid fa-check text-buksu-gold"></i> Save Criterion &amp; Scoring Setup
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- MODAL: CONTESTANT CITATIONS & TEAM COMMENTS -->
    <div id="contestant-comments-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[60] hidden">
        <div class="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-6 sm:p-7 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-100 animate-fade-in flex flex-col">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                <div class="flex items-center gap-2.5">
                    <div class="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                        <i class="fa-solid fa-award"></i>
                    </div>
                    <div>
                        <h3 id="contestant-comments-modal-title" class="font-extrabold text-slate-800 text-sm leading-tight">Contestant Citations &amp; Comments</h3>
                        <p id="contestant-comments-modal-sub" class="text-[11px] text-slate-500">Special awards, member citations (e.g. Best Keyboardist), and notes</p>
                    </div>
                </div>
                <button type="button" class="close-modal-btn text-slate-400 hover:text-slate-600 text-2xl cursor-pointer p-1 leading-none">&times;</button>
            </div>

            <input type="hidden" id="contestant-comments-modal-id" value="">

            <!-- Team Members Quick View / Edit Section (visible if team) -->
            <div id="contestant-modal-team-section" class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 hidden">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <i class="fa-solid fa-users text-buksu-navy"></i> Team Members
                    </span>
                    <button type="button" id="saveContestantMembersBtn" class="text-[11px] font-bold text-buksu-navy hover:text-buksu-navy-light cursor-pointer">
                        <i class="fa-solid fa-check me-1"></i> Update Members
                    </button>
                </div>
                <textarea id="contestant-modal-members-input" rows="2" placeholder="List member names (e.g. John Doe - Vocals, Jane Smith - Keyboardist)..." class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-buksu-navy"></textarea>
            </div>

            <!-- Add Citation / Comment Form -->
            <form id="addContestantCommentForm" onsubmit="return false;" class="space-y-2">
                <label class="block font-bold text-xs text-slate-700">Add Special Citation or Member Comment</label>
                <div class="flex items-center gap-2">
                    <input type="text" id="new-citation-text" required placeholder="e.g. Best Keyboardist - Jane Doe" class="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500">
                    <button type="submit" id="addCitationBtn" class="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0">
                        <i class="fa-solid fa-plus"></i> Add Citation
                    </button>
                </div>
            </form>

            <!-- List of existing comments/citations -->
            <div class="space-y-2 pt-2 border-t border-slate-100 flex-1">
                <h5 class="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Current Citations &amp; Comments</h5>
                <div id="contestant-comments-list" class="space-y-2 max-h-[36vh] overflow-y-auto pr-1">
                    <!-- Populated dynamically -->
                </div>
            </div>

            <div class="pt-3 border-t border-slate-100 flex items-center justify-end">
                <button type="button" class="close-modal-btn px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer">
                    Done
                </button>
            </div>
        </div>
    </div>

    <!-- MODAL: SECURITY SETTINGS CONFIRMATION OTP -->
    <div id="security-confirm-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[70] hidden">
        <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-7 space-y-4 border border-slate-100 animate-fade-in flex flex-col text-center">
            
            <div class="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto text-2xl shadow-xs border border-amber-500/20">
                <i class="fa-solid fa-shield-halved"></i>
            </div>

            <div>
                <h3 class="text-lg font-black text-buksu-navy tracking-tight">Security Verification Required</h3>
                <p class="text-xs text-slate-500 mt-1">
                    We sent a 6-digit confirmation code to <strong id="security-modal-masked-email" class="text-slate-700">your email</strong>.
                </p>
            </div>

            <div id="security-confirm-notice" class="hidden p-2.5 rounded-xl text-xs font-semibold"></div>

            <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-left text-xs space-y-2">
                <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Proposed Modifications:</span>
                <div id="security-modal-diff-list" class="space-y-1 text-[11px] text-slate-600 font-medium">
                    <!-- Populated dynamically -->
                </div>
            </div>

            <form id="securityConfirmForm" onsubmit="return false;" class="space-y-3 pt-1">
                <div>
                    <label class="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Enter 6-Digit Code</label>
                    <input type="text" id="security-otp-input" maxlength="6" pattern="[0-9]{6}" autocomplete="one-time-code" placeholder="••••••" class="w-48 mx-auto text-center tracking-[8px] text-2xl font-black text-buksu-navy py-2 px-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-buksu-navy focus:bg-white transition-all font-mono">
                </div>

                <button type="submit" id="confirmSecurityOtpBtn" class="w-full py-2.5 px-4 bg-buksu-navy hover:bg-buksu-navy-light text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 border border-buksu-gold/30 cursor-pointer">
                    <i class="fa-solid fa-check text-buksu-gold"></i>
                    <span id="confirm-otp-btn-text">Verify &amp; Apply Changes</span>
                </button>
            </form>

            <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <button type="button" id="resendSecurityOtpBtn" class="font-bold text-buksu-navy hover:text-buksu-navy-light transition-colors cursor-pointer flex items-center gap-1">
                    <i class="fa-solid fa-rotate-right text-[11px]"></i> Resend Code
                </button>
                <button type="button" id="closeSecurityModalBtn" class="font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                    Cancel
                </button>
            </div>
        </div>
    </div>
    <?php endif; ?>

    <!-- MODAL: JUDGE SCORING SHEET (ACCESSIBLE TO JUDGE & ADMIN) -->
    <div id="judge-scoring-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 hidden">
        <div class="bg-white rounded-3xl shadow-2xl max-w-7xl w-full p-6 sm:p-8 space-y-5 max-h-[94vh] overflow-y-auto border border-slate-100 animate-fade-in flex flex-col">
            <!-- Header -->
            <div class="flex items-center justify-between border-b border-slate-100 pb-4">
                <div class="flex items-center gap-3">
                    <div class="w-11 h-11 rounded-2xl bg-buksu-navy text-buksu-gold flex items-center justify-center font-black shadow-md border border-buksu-gold/30">
                        <i class="fa-solid fa-gavel text-lg"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] uppercase font-bold tracking-wider text-slate-400">Official Judge Scoring</span>
                            <span id="judge-event-status-badge" class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">Not Yet Started</span>
                        </div>
                        <h3 id="judge-modal-title" class="font-extrabold text-slate-800 text-lg sm:text-xl leading-tight">Competition Scoring Portal</h3>
                    </div>
                </div>
                <button type="button" class="close-modal-btn text-slate-400 hover:text-slate-600 text-2xl cursor-pointer p-1 transition-colors leading-none">&times;</button>
            </div>

            <!-- Body Grid: Left Contestants list (3 cols), Right Scoring Form (9 cols) -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[420px]">
                <!-- Contestants List -->
                <div class="lg:col-span-3 space-y-2.5 border-b lg:border-b-0 lg:border-r border-slate-100 pb-4 lg:pb-0 lg:pr-5">
                    <div class="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                        <span>Contestants</span>
                        <span>Status</span>
                    </div>
                    <div id="judge-contestants-list" class="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                        <div class="py-8 text-center text-slate-400 text-xs">
                            <i class="fa-solid fa-spinner fa-spin me-1.5"></i> Loading contestants...
                        </div>
                    </div>
                </div>

                <!-- Scoring Sheet Form -->
                <div class="lg:col-span-9 flex flex-col justify-between space-y-4">
                    <div id="judge-scoring-form-body" class="space-y-4 flex-1">
                        <div class="py-16 text-center text-slate-400 text-xs">
                            <i class="fa-solid fa-user-check text-3xl text-slate-300 mb-2"></i>
                            <p class="font-bold text-slate-600">Select a contestant to begin scoring</p>
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                        <button type="button" class="close-modal-btn px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer">
                            Close
                        </button>
                        <div class="flex items-center gap-2">
                            <button type="button" id="saveDraftScoreBtn" class="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs rounded-xl cursor-pointer transition-colors flex items-center gap-1.5" disabled>
                                <i class="fa-solid fa-pen-ruler"></i> Save as Draft
                            </button>
                            <button type="button" id="submitFinalScoreBtn" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer transition-colors flex items-center gap-1.5" disabled>
                                <i class="fa-solid fa-paper-plane"></i> Submit Final Score
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- MODAL: LIVE TABULATION BOARD (ACCESSIBLE TO TABULATOR & ADMIN) -->
    <div id="tabulation-board-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 hidden">
        <!-- Print Watermark (controlled via Settings -> Branding) -->
        <div id="tab-print-watermark" class="hidden pointer-events-none fixed inset-0 z-0 flex items-center justify-center opacity-[0.06] select-none">
            <span id="tab-print-watermark-text" class="text-7xl font-black uppercase text-slate-800 -rotate-45 tracking-widest text-center">OFFICIAL TABULATION SHEET</span>
        </div>

        <div class="bg-white rounded-3xl shadow-2xl max-w-6xl w-full p-6 sm:p-8 space-y-5 max-h-[94vh] overflow-y-auto border border-slate-100 animate-fade-in flex flex-col relative z-10">
            <!-- Print Header (Official Institution Banner for window.print) -->
            <div id="tab-print-header" class="hidden print-only mb-6 border-b-2 border-slate-900 pb-4">
                <div class="flex items-center justify-between gap-4">
                    <img src="/assets/logo/DJS Logo.png" alt="Logo" class="w-16 h-16 object-contain shrink-0" onerror="this.style.display='none'">
                    <div class="text-center flex-1">
                        <h2 id="tab-print-institution" class="text-lg font-black uppercase tracking-wider text-slate-900">Bukidnon State University</h2>
                        <p class="text-[11px] font-bold text-slate-600 uppercase tracking-widest">Office of Student Affairs & Services &bull; Tabulation Committee</p>
                        <h1 id="tab-print-event-title" class="text-base font-extrabold text-slate-900 mt-1">Official Event Scoring Sheet</h1>
                        <p class="text-[10px] text-slate-500 font-medium">Certified Tabulation Report &bull; Printed: <span id="tab-print-date"></span></p>
                    </div>
                    <div class="w-16 h-16 shrink-0 flex items-center justify-center">
                        <span class="text-xs font-black px-2.5 py-1 rounded bg-slate-100 text-slate-800 border border-slate-300 uppercase">Official</span>
                    </div>
                </div>
            </div>

            <!-- Header (Screen view) -->
            <div class="flex items-center justify-between border-b border-slate-100 pb-4 flex-wrap gap-3 no-print">
                <div class="flex items-center gap-3">
                    <div class="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md">
                        <i class="fa-solid fa-calculator text-lg"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] uppercase font-bold tracking-wider text-slate-400">Live Tabulation Board</span>
                            <span id="tab-event-judging-badge" class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">Not Yet Started</span>
                        </div>
                        <h3 id="tabulation-event-title" class="font-extrabold text-slate-800 text-lg sm:text-xl leading-tight">Official Scoring Matrix</h3>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" id="refreshTabulationBtn" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5">
                        <i class="fa-solid fa-rotate-right"></i> Refresh
                    </button>
                    <button type="button" id="printTabulationBtn" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5">
                        <i class="fa-solid fa-print"></i> Print Matrix
                    </button>
                    <button type="button" class="close-modal-btn text-slate-400 hover:text-slate-600 text-2xl cursor-pointer p-1 transition-colors leading-none">&times;</button>
                </div>
            </div>

            <!-- Stats Bar -->
            <div id="tab-stats-container" class="w-full"></div>

            <!-- Real-time Scoring Matrix Table -->
            <div class="overflow-x-auto rounded-2xl border border-slate-200/90 shadow-xs flex-1">
                <table class="w-full text-left border-collapse">
                    <thead id="tab-table-head"></thead>
                    <tbody id="tab-table-body" class="divide-y divide-slate-100 text-xs">
                        <tr>
                            <td class="py-12 text-center text-slate-400 text-xs">
                                <i class="fa-solid fa-spinner fa-spin me-1.5"></i> Loading live matrix...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Print Signatories Section (Certified Signatures for window.print) -->
            <div id="tab-print-signatories" class="hidden print-only mt-8 pt-4">
                <p class="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-8 text-center">Certified Correct and Approved by the Board of Judges & Tabulation Committee:</p>
                <div class="grid grid-cols-3 gap-8 text-center" id="tab-signatories-grid">
                    <!-- Dynamic Signatories populated from settings.branding.signatories -->
                </div>
            </div>

            <!-- Footer -->
            <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span class="flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Live auto-syncing every 3 seconds
                </span>
                <button type="button" class="close-modal-btn px-5 py-2 bg-buksu-navy hover:bg-buksu-navy-light text-white font-bold text-xs rounded-xl transition-all cursor-pointer">
                    Close Board
                </button>
            </div>
        </div>
    </div>

    <!-- MODAL: VIEW EVENT DETAILS (ACCESSIBLE TO ALL ROLES) -->
    <div id="view-event-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 hidden">
        <div class="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-6 sm:p-8 space-y-5 max-h-[90vh] overflow-y-auto border border-slate-100 animate-fade-in">
            <!-- Header Banner with BukSU Dark Blue gradient -->
            <div class="bg-gradient-to-r from-buksu-navy via-buksu-navy-light to-buksu-navy p-6 rounded-2xl text-white relative overflow-hidden -mx-2 -mt-2">
                <div class="absolute top-0 right-0 w-40 h-40 bg-buksu-gold/10 rounded-full blur-2xl pointer-events-none"></div>
                <div class="flex items-start justify-between gap-3 relative z-10">
                    <div class="space-y-2">
                        <div class="flex items-center gap-2 flex-wrap" id="view-modal-badges">
                            <span id="view-ev-status-badge" class="px-2.5 py-1 text-[10px] font-extrabold rounded-lg uppercase tracking-wide bg-amber-400 text-buksu-navy">Upcoming</span>
                            <span id="view-ev-type-badge" class="px-2.5 py-1 text-[10px] font-bold bg-white/20 text-white rounded-lg">Dance_Competition</span>
                        </div>
                        <h2 id="view-ev-title" class="text-xl sm:text-2xl font-extrabold text-white tracking-tight">Event Name</h2>
                    </div>
                    <button type="button" class="close-modal-btn text-white/70 hover:text-white text-2xl cursor-pointer p-1 transition-colors leading-none">&times;</button>
                </div>
            </div>

            <!-- Details Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                    <div class="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-buksu-navy text-sm shrink-0">
                        <i class="fa-regular fa-clock"></i>
                    </div>
                    <div>
                        <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date &amp; Time</span>
                        <span id="view-ev-date" class="font-bold text-slate-800 text-xs">TBA</span>
                    </div>
                </div>

                <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                    <div class="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-buksu-navy text-sm shrink-0">
                        <i class="fa-solid fa-location-dot"></i>
                    </div>
                    <div>
                        <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Venue / Location</span>
                        <span id="view-ev-venue" class="font-bold text-slate-800 text-xs">TBA</span>
                    </div>
                </div>

                <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3 sm:col-span-2">
                    <div class="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-buksu-navy text-sm shrink-0">
                        <i class="fa-solid fa-tasks"></i>
                    </div>
                    <div>
                        <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Judging State</span>
                        <span id="view-ev-judging-status" class="font-bold text-slate-800 text-xs">Not Yet Started</span>
                    </div>
                </div>
            </div>

            <!-- Description Section -->
            <div class="space-y-1.5 border-t border-slate-100 pt-4">
                <h4 class="text-xs font-bold text-buksu-navy uppercase tracking-wider flex items-center gap-1.5">
                    <i class="fa-solid fa-align-left text-buksu-navy"></i> Event Description
                </h4>
                <p id="view-ev-desc" class="text-xs text-slate-600 font-normal leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 min-h-14">
                    No description provided.
                </p>
            </div>

            <!-- Assigned Personnel Section -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                <div class="space-y-2">
                    <h4 class="text-xs font-bold text-buksu-navy uppercase tracking-wider flex items-center gap-1.5">
                        <i class="fa-solid fa-gavel text-buksu-navy"></i> Assigned Judges
                    </h4>
                    <div id="view-ev-judges-list" class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        <span class="text-slate-400 text-xs italic">None assigned</span>
                    </div>
                </div>

                <div class="space-y-2">
                    <h4 class="text-xs font-bold text-buksu-navy uppercase tracking-wider flex items-center gap-1.5">
                        <i class="fa-solid fa-calculator text-buksu-navy"></i> Assigned Tabulators
                    </h4>
                    <div id="view-ev-tabulators-list" class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        <span class="text-slate-400 text-xs italic">None assigned</span>
                    </div>
                </div>
            </div>

            <!-- Modal Footer -->
            <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                <div id="view-modal-action-buttons" class="flex items-center gap-2"></div>
                <button type="button" class="close-modal-btn px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer">
                    Close
                </button>
            </div>
        </div>
    </div>

    <!-- Footer -->
    <footer class="w-full py-4 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        <p>&copy; 2026 Bukidnon State University. All rights reserved. | <span class="font-medium text-slate-500">Digitalized Judging System</span></p>
    </footer>

    <script type="module" src="/scripts/ui/dashboardUI.js"></script>
    <script type="module" src="/scripts/admin/adminUI.js"></script>
    <script type="module" src="/scripts/admin/eventsUI.js"></script>
    <script type="module" src="/scripts/admin/contestantsCriteriaUI.js"></script>
    <script type="module" src="/scripts/judge/judgeUI.js"></script>
    <script type="module" src="/scripts/tabulator/tabulatorUI.js"></script>
    <script type="module" src="/scripts/ui/notificationUI.js"></script>
    <script type="module" src="/scripts/admin/settingsUI.js"></script>
    <script type="module" src="/scripts/preferences.js"></script>

</body>

</html>
