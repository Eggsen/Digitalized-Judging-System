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
    'admin' => ['title' => 'Administrator Dashboard', 'icon' => 'fa-user-shield', 'color' => 'bg-indigo-600'],
    'judge' => ['title' => 'Official Judge Portal', 'icon' => 'fa-gavel', 'color' => 'bg-amber-600'],
    'tabulator' => ['title' => 'Tabulator Control Panel', 'icon' => 'fa-calculator', 'color' => 'bg-emerald-600']
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
    <link rel="icon" href="assets/logo/DJS Logo.png">
    <title><?= $badgeInfo['title'] ?> | BukSU DJS</title>
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
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

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
                <div class="bg-slate-50/90 px-6 sm:px-8 py-3.5 border-t border-slate-200/80">
                    <div class="flex items-center gap-2 overflow-x-auto" id="admin-tabs">
                        <button data-tab="events-tab" class="admin-tab-btn px-4 py-2 text-xs font-bold rounded-xl bg-buksu-navy text-white shadow-xs transition-all cursor-pointer">
                            <i class="fa-solid fa-trophy me-1.5 text-buksu-gold"></i> Events &amp; Competitions
                        </button>
                        <button data-tab="assignments-tab" class="admin-tab-btn px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:bg-white hover:text-buksu-navy transition-all cursor-pointer">
                            <i class="fa-solid fa-user-check me-1.5"></i> Judge Assignments
                        </button>
                        <button data-tab="users-tab" class="admin-tab-btn px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:bg-white hover:text-buksu-navy transition-all cursor-pointer">
                            <i class="fa-solid fa-users-gear me-1.5"></i> User Invitations
                        </button>
                        <button data-tab="logs-tab" class="admin-tab-btn px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:bg-white hover:text-buksu-navy transition-all cursor-pointer">
                            <i class="fa-solid fa-clock-rotate-left me-1.5"></i> Audit Logs
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
                            <i class="fa-solid fa-trophy text-amber-500"></i> Competitions &amp; Events
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
                            <i class="fa-solid fa-user-check text-indigo-500"></i> Judge &amp; Tabulator Assignments
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
                    <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-lg">
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
                            <i class="fa-solid fa-paper-plane text-indigo-500"></i> Send Account Invitation
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
                                <i class="fa-solid fa-list-ul text-indigo-500"></i> Existing Accounts
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
                            <i class="fa-solid fa-clock-rotate-left text-slate-600"></i> System Audit Logs
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

        <?php else: ?>
            <!-- JUDGE / TABULATOR VIEW: ASSIGNED COMPETITIONS -->
            <div class="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 sm:p-8">
                <div class="flex items-center justify-between flex-wrap gap-4 mb-6 border-b border-slate-100 pb-4">
                    <div>
                        <h2 class="text-xl font-extrabold text-buksu-navy flex items-center gap-2">
                            <i class="fa-solid fa-clipboard-list text-amber-500"></i> Your Assigned Competitions
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
        <?php endif; ?>

    </main>

    <?php if ($role === 'admin'): ?>
    <!-- MODAL: CREATE EVENT -->
    <div id="create-event-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 hidden">
        <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-4 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 class="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                    <i class="fa-solid fa-calendar-plus text-indigo-600"></i> Create Competition
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
                    <button type="submit" id="saveCreateEventBtn" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow cursor-pointer">Save Competition</button>
                </div>
            </form>
        </div>
    </div>

    <!-- MODAL: EDIT EVENT -->
    <div id="edit-event-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 hidden">
        <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 space-y-4 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 class="font-extrabold text-slate-800 text-lg flex items-center gap-2">
                    <i class="fa-solid fa-pen-to-square text-indigo-600"></i> Edit Competition Details
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
                        <button type="submit" id="saveEditEventBtn" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow cursor-pointer">Update Event</button>
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
                    <i class="fa-solid fa-users-check text-indigo-600"></i> Assign Judges &amp; Tabulators
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
                    <button type="submit" id="saveAssignBtn" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow cursor-pointer">Save Assignments</button>
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
                    <i class="fa-solid fa-users me-1.5"></i> Contestant Records
                </button>
                <button type="button" class="setup-tab-btn px-4 py-2 text-xs font-bold rounded-xl text-slate-600 hover:bg-slate-100 hover:text-buksu-navy transition-all cursor-pointer" data-tab="setup-criteria-tab">
                    <i class="fa-solid fa-list-check me-1.5"></i> Judging Criteria &amp; Weights
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
                                <input type="number" id="new-contestant-num" min="1" required class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            </div>
                            <div>
                                <label class="block font-semibold text-slate-700 mb-1.5">Entry Type</label>
                                <div class="grid grid-cols-2 gap-2">
                                    <label class="flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-slate-300">
                                        <input type="radio" name="contestant_entry_type" value="individual" checked class="text-buksu-navy focus:ring-indigo-500">
                                        <span class="font-bold text-xs text-slate-700"><i class="fa-solid fa-user me-1 text-slate-400"></i> Individual</span>
                                    </label>
                                    <label class="flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-slate-300">
                                        <input type="radio" name="contestant_entry_type" value="team" class="text-buksu-navy focus:ring-indigo-500">
                                        <span class="font-bold text-xs text-slate-700"><i class="fa-solid fa-users-line me-1 text-indigo-500"></i> Team-based</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label id="new-contestant-name-label" class="block font-semibold text-slate-700 mb-1">Full Name / Entry Title</label>
                                <input type="text" id="new-contestant-name" required placeholder="e.g. John Doe" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            </div>
                            <div id="new-contestant-team-members-group" class="hidden">
                                <div class="flex items-center justify-between mb-1">
                                    <label class="font-semibold text-slate-700">Team Members <span class="text-slate-400 font-normal">(Optional)</span></label>
                                    <span class="text-[10px] text-slate-400">Comma or line-separated</span>
                                </div>
                                <textarea id="new-contestant-members" rows="2" placeholder="e.g. Alice (Vocals), Bob (Keyboardist)&#10;or leave blank to register team name only" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
                            </div>
                            <div>
                                <label class="block font-semibold text-slate-700 mb-1">Department / Organization</label>
                                <input type="text" id="new-contestant-dept" placeholder="e.g. College of Education" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            </div>
                            <div>
                                <label class="block font-semibold text-slate-700 mb-1">Special Citation / Note <span class="text-slate-400 font-normal">(Optional)</span></label>
                                <input type="text" id="new-contestant-comment" placeholder="e.g. Best Keyboardist, Special Award note..." class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            </div>
                            <div>
                                <label class="block font-semibold text-slate-700 mb-1">Description / Entry Info</label>
                                <textarea id="new-contestant-desc" rows="2" placeholder="Brief notes or piece title..." class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
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
                        <button type="button" id="openConfigureWeightsBtn" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors">
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
                                <input type="text" id="new-criterion-title" required placeholder="e.g. Choreography & Execution" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block font-semibold text-slate-700 mb-1">Weight (%)</label>
                                    <input type="number" id="new-criterion-pct" min="0" max="100" placeholder="e.g. 40" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                </div>
                                <div>
                                    <label class="block font-semibold text-slate-700 mb-1">Max Points</label>
                                    <input type="number" id="new-criterion-max" min="1" value="100" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                </div>
                            </div>
                            <div>
                                <label class="block font-semibold text-slate-700 mb-1">Description / Guidelines</label>
                                <textarea id="new-criterion-desc" rows="2" placeholder="Judging rubrics and guidelines..." class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
                            </div>
                            <button type="submit" id="addCriterionBtn" class="w-full py-2.5 bg-buksu-navy hover:bg-buksu-navy-light text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5">
                                <i class="fa-solid fa-plus text-buksu-gold"></i> Quick Add Criterion
                            </button>
                            <button type="button" id="openCustomRubricBuilderBtn" class="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-extrabold text-xs rounded-xl shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5">
                                <i class="fa-solid fa-layer-group"></i> Build Custom Sub-Criteria &amp; Rubric
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
    <div id="adjust-weights-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 hidden">
        <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-7 space-y-4 max-h-[90vh] overflow-y-auto border border-slate-100 animate-fade-in">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 class="font-extrabold text-slate-800 text-base flex items-center gap-2">
                    <i class="fa-solid fa-scale-balanced text-indigo-600"></i> Configure Criteria Weights
                </h3>
                <button type="button" class="close-modal-btn text-slate-400 hover:text-slate-600 text-xl cursor-pointer leading-none">&times;</button>
            </div>
            <p class="text-xs text-slate-500">Assign percentage weights for each criterion. The total should ideally equal 100%.</p>
            <div id="weights-adjust-container" class="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                <div class="py-4 text-center text-slate-400 text-xs">Loading criteria...</div>
            </div>
            <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button type="button" class="close-modal-btn px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer">Cancel</button>
                <button type="button" id="saveWeightsBtn" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5">
                    <i class="fa-solid fa-check"></i> Save Weights
                </button>
            </div>
        </div>
    </div>

    <!-- MODAL: EDIT CRITERION & 5-1 RUBRIC BUILDER -->
    <div id="criterion-rubric-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 hidden">
        <div class="bg-white rounded-3xl shadow-2xl max-w-5xl w-full p-6 sm:p-8 space-y-4 max-h-[92vh] overflow-y-auto border border-slate-100 animate-fade-in flex flex-col">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                <div class="flex items-center gap-2.5">
                    <div class="w-9 h-9 rounded-xl bg-buksu-navy text-buksu-gold flex items-center justify-center font-bold text-sm shadow-xs border border-buksu-gold/30">
                        <i class="fa-solid fa-list-check"></i>
                    </div>
                    <div>
                        <h3 id="rubric-modal-title" class="font-extrabold text-slate-800 text-base leading-tight">Configure Criterion &amp; 5-to-1 Rubric</h3>
                        <p class="text-[11px] text-slate-500">Define performance dimensions and descriptive level guides for judges</p>
                    </div>
                </div>
                <button type="button" class="close-modal-btn text-slate-400 hover:text-slate-600 text-2xl cursor-pointer p-1 leading-none">&times;</button>
            </div>

            <form id="criterionRubricForm" onsubmit="return false;" class="space-y-4 text-xs">
                <input type="hidden" id="rubric-modal-crit-id" value="">

                <div class="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div class="sm:col-span-6">
                        <label class="block font-semibold text-slate-700 mb-1">Criterion Title</label>
                        <input type="text" id="rubric-modal-title-input" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800">
                    </div>
                    <div class="sm:col-span-3">
                        <label class="block font-semibold text-slate-700 mb-1">Weight (%)</label>
                        <input type="number" id="rubric-modal-pct-input" min="0" max="100" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    </div>
                    <div class="sm:col-span-3">
                        <label class="block font-semibold text-slate-700 mb-1">Max Points</label>
                        <input type="number" id="rubric-modal-max-input" min="1" value="100" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    </div>
                </div>

                <div>
                    <label class="block font-semibold text-slate-700 mb-1">Description / Core Objective</label>
                    <textarea id="rubric-modal-desc-input" rows="2" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
                </div>

                <!-- Sub-criteria Builder Header -->
                <div class="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                    <div>
                        <h4 class="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                            <i class="fa-solid fa-layer-group text-buksu-navy"></i> Sub-Criteria &amp; Rubric Indicators
                        </h4>
                        <p class="text-[10px] text-slate-400">Judges evaluate each indicator on a 5-to-1 scale. Scores are totaled and normalized to 100.</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <button type="button" id="rubricAddIndicatorBtn" class="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-[11px] cursor-pointer transition-colors flex items-center gap-1">
                            <i class="fa-solid fa-plus text-xs"></i> Add Sub-Criterion
                        </button>
                    </div>
                </div>

                <!-- Dynamic Container for Sub-criteria items -->
                <div id="rubric-subcriteria-container" class="space-y-3 max-h-[44vh] overflow-y-auto pr-1">
                    <!-- Populated dynamically -->
                </div>

                <!-- Modal Actions -->
                <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button type="button" class="close-modal-btn px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer">Cancel</button>
                    <button type="submit" id="saveRubricCriterionBtn" class="px-4 py-2 bg-buksu-navy hover:bg-buksu-navy-light text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors">
                        <i class="fa-solid fa-check text-buksu-gold"></i> Save Criterion &amp; Rubrics
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- MODAL: CONTESTANT CITATIONS & TEAM COMMENTS -->
    <div id="contestant-comments-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 hidden">
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
                        <i class="fa-solid fa-users text-indigo-600"></i> Team Members
                    </span>
                    <button type="button" id="saveContestantMembersBtn" class="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer">
                        <i class="fa-solid fa-check me-1"></i> Update Members
                    </button>
                </div>
                <textarea id="contestant-modal-members-input" rows="2" placeholder="List member names (e.g. John Doe - Vocals, Jane Smith - Keyboardist)..." class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
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
        <div class="bg-white rounded-3xl shadow-2xl max-w-6xl w-full p-6 sm:p-8 space-y-5 max-h-[94vh] overflow-y-auto border border-slate-100 animate-fade-in flex flex-col">
            <!-- Header -->
            <div class="flex items-center justify-between border-b border-slate-100 pb-4 flex-wrap gap-3">
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
                    <div class="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-buksu-navy text-sm shrink-0">
                        <i class="fa-regular fa-clock"></i>
                    </div>
                    <div>
                        <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date &amp; Time</span>
                        <span id="view-ev-date" class="font-bold text-slate-800 text-xs">TBA</span>
                    </div>
                </div>

                <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                    <div class="w-8 h-8 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-buksu-navy text-sm shrink-0">
                        <i class="fa-solid fa-location-dot"></i>
                    </div>
                    <div>
                        <span class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Venue / Location</span>
                        <span id="view-ev-venue" class="font-bold text-slate-800 text-xs">TBA</span>
                    </div>
                </div>

                <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3 sm:col-span-2">
                    <div class="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-buksu-navy text-sm shrink-0">
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

</body>

</html>
