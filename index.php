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
    <title><?= $badgeInfo['title'] ?> | BukSU DJS</title>
</head>
<body class="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col justify-between antialiased">

    <!-- Header Navigation -->
    <header class="w-full bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-buksu-navy flex items-center justify-center text-buksu-gold shadow-md border border-buksu-gold/30">
                    <i class="fa-solid fa-scale-balanced text-lg"></i>
                </div>
                <div>
                    <span class="font-extrabold text-buksu-navy text-lg tracking-tight">BukSU</span>
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
                    <h3 class="font-bold text-slate-800 text-sm">Contestants & Judges</h3>
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
    </main>

    <!-- Footer -->
    <footer class="w-full py-4 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        <p>&copy; 2026 intFour. All rights reserved. | <span class="font-medium text-slate-500">Digitalized Judging System</span></p>
    </footer>

    <script type="module">
        import { logoutUser } from "/scripts/auth/authAPI.js";

        document.getElementById('logoutBtn')?.addEventListener('click', async () => {
            const res = await logoutUser();
            window.location.reload();
        });
    </script>
</body>
</html>
