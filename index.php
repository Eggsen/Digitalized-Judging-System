<?php

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$hasActionToken = !empty($_GET['invite_token']) || !empty($_GET['token']) || !empty($_GET['reset_token']);
$isAuthenticated = isset($_SESSION['user_id']) && !empty($_SESSION['username']);

if (!$isAuthenticated || $hasActionToken) {
    include __DIR__ . '/frontend/landing-page.html';
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
    data-role="<?= $role ?>">

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

            <div class="flex items-center gap-4">
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
            <!-- Top 60% Section: BukSU Dark Blue Header -->
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
                <!-- Bottom 40% Section: Admin Navigation Tabs -->
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
                        <select id="event-status-filter" class="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none">
                            <option value="ALL">All Statuses</option>
                            <option value="Upcoming">Upcoming</option>
                            <option value="Ongoing">Ongoing</option>
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

                <div class="pt-2 flex items-center justify-end gap-2">
                    <button type="button" class="close-modal-btn px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs rounded-xl cursor-pointer">Cancel</button>
                    <button type="submit" id="saveEditEventBtn" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow cursor-pointer">Update Event</button>
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
    <?php endif; ?>

    <!-- Footer -->
    <footer class="w-full py-4 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        <p>&copy; 2026 intFour. All rights reserved. | <span class="font-medium text-slate-500">Digitalized Judging System</span></p>
    </footer>

    <script type="module" src="/scripts/ui/dashboardUI.js"></script>
    <script type="module" src="/scripts/admin/adminUI.js"></script>
    <script type="module" src="/scripts/admin/eventsUI.js"></script>

</body>

</html>