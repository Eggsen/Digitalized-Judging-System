<!-- Appearance & UI Preferences Section -->
<div class="space-y-6">
    <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 flex-wrap gap-4">
        <div>
            <h3 class="text-lg font-black text-buksu-navy flex items-center gap-2">
                <i class="fa-solid fa-sliders text-amber-500"></i> Appearance &amp; UI Preferences
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Personalize your workspace theme, institutional color scheme, and dashboard layout.</p>
        </div>
        <button type="button" class="reset-preferences-btn px-3.5 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer flex items-center gap-1.5">
            <i class="fa-solid fa-arrow-rotate-left"></i> Reset Defaults
        </button>
    </div>

    <!-- PREFERENCE 1: THEME SELECTION -->
    <div class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-4 shadow-xs">
        <div class="flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-xl bg-buksu-navy text-buksu-gold flex items-center justify-center text-xs font-bold shadow-2xs">
                    <i class="fa-solid fa-circle-half-stroke"></i>
                </div>
                <div>
                    <h4 class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Workspace Theme</h4>
                    <p class="text-[11px] text-slate-500">Choose between crisp light mode or dark mode for low-light scoring environments.</p>
                </div>
            </div>
            <span class="text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                <i class="fa-solid fa-bolt"></i> Instant Preview
            </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Light Mode Option Card -->
            <div data-pref-theme="light" class="pref-card group p-4 sm:p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-buksu-navy/60 dark:hover:border-buksu-gold transition-all cursor-pointer relative shadow-xs flex flex-col justify-between">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex items-center gap-2.5">
                        <div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg shadow-2xs border border-amber-200/60">
                            <i class="fa-solid fa-sun"></i>
                        </div>
                        <div>
                            <span class="font-black text-sm text-slate-800 dark:text-slate-100 block">Light Mode</span>
                            <span class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Default</span>
                        </div>
                    </div>
                    <div class="pref-check-indicator w-6 h-6 rounded-full bg-buksu-navy text-white text-[11px] hidden items-center justify-center shadow-xs">
                        <i class="fa-solid fa-check"></i>
                    </div>
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                    Crisp white dashboard with high-contrast slate typography and BukSU navy blue headers. Ideal for standard room lighting.
                </p>
                <div class="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                    <span class="w-3.5 h-3.5 rounded-full bg-white border border-slate-300"></span>
                    <span class="w-3.5 h-3.5 rounded-full bg-[#031527]"></span>
                    <span class="w-3.5 h-3.5 rounded-full bg-[#f5b800]"></span>
                    <span class="text-[10px] text-slate-400 ms-auto font-medium">Standard Canvas</span>
                </div>
            </div>

            <!-- Dark Mode Option Card -->
            <div data-pref-theme="dark" class="pref-card group p-4 sm:p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-buksu-navy/60 dark:hover:border-buksu-gold transition-all cursor-pointer relative shadow-xs flex flex-col justify-between">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex items-center gap-2.5">
                        <div class="w-10 h-10 rounded-xl bg-slate-900 text-buksu-gold flex items-center justify-center text-lg shadow-2xs border border-slate-800">
                            <i class="fa-solid fa-moon"></i>
                        </div>
                        <div>
                            <span class="font-black text-sm text-slate-800 dark:text-slate-100 block">Dark Mode</span>
                            <span class="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider">High Contrast</span>
                        </div>
                    </div>
                    <div class="pref-check-indicator w-6 h-6 rounded-full bg-buksu-gold text-buksu-navy text-[11px] hidden items-center justify-center shadow-xs">
                        <i class="fa-solid fa-check"></i>
                    </div>
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                    Sleek midnight slate palette (#0b1320) designed for evening auditoriums and judging tables to minimize screen glare.
                </p>
                <div class="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                    <span class="w-3.5 h-3.5 rounded-full bg-[#0b1320] border border-slate-700"></span>
                    <span class="w-3.5 h-3.5 rounded-full bg-[#111c2e] border border-slate-700"></span>
                    <span class="w-3.5 h-3.5 rounded-full bg-[#f5b800]"></span>
                    <span class="text-[10px] text-slate-400 ms-auto font-medium">Midnight Slate</span>
                </div>
            </div>
        </div>
    </div>

    <!-- PREFERENCE 2: COLOR PALETTE RULE -->
    <div class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-4 shadow-xs">
        <div class="flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-xl bg-buksu-navy text-buksu-gold flex items-center justify-center text-xs font-bold shadow-2xs">
                    <i class="fa-solid fa-palette"></i>
                </div>
                <div>
                    <h4 class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Color Palette Rule</h4>
                    <p class="text-[11px] text-slate-500">Choose between multi-color dynamic badges or the strict BukSU 3-color rule mode.</p>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Normal Mode Card -->
            <div data-pref-color-rule="normal" class="pref-card group p-4 sm:p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-buksu-navy/60 dark:hover:border-buksu-gold transition-all cursor-pointer relative shadow-xs flex flex-col justify-between">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex items-center gap-2.5">
                        <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg shadow-2xs border border-emerald-200/60">
                            <i class="fa-solid fa-paint-roller"></i>
                        </div>
                        <div>
                            <span class="font-black text-sm text-slate-800 dark:text-slate-100 block">Normal Mode</span>
                            <span class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Default</span>
                        </div>
                    </div>
                    <div class="pref-check-indicator w-6 h-6 rounded-full bg-buksu-navy text-white text-[11px] hidden items-center justify-center shadow-xs">
                        <i class="fa-solid fa-check"></i>
                    </div>
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                    Diverse vibrant spectrum: Criteria icons, status badges, and action buttons render with multi-colored accents (emerald, amber, indigo, rose, purple).
                </p>
                <div class="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-700">
                    <span class="w-3.5 h-3.5 rounded-full bg-emerald-500"></span>
                    <span class="w-3.5 h-3.5 rounded-full bg-amber-500"></span>
                    <span class="w-3.5 h-3.5 rounded-full bg-indigo-500"></span>
                    <span class="w-3.5 h-3.5 rounded-full bg-rose-500"></span>
                    <span class="w-3.5 h-3.5 rounded-full bg-purple-500"></span>
                    <span class="text-[10px] text-slate-400 ms-auto font-medium">Multi-Color</span>
                </div>
            </div>

            <!-- 3-Color Rule Mode Card -->
            <div data-pref-color-rule="three-color" class="pref-card group p-4 sm:p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-buksu-navy/60 dark:hover:border-buksu-gold transition-all cursor-pointer relative shadow-xs flex flex-col justify-between">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex items-center gap-2.5">
                        <div class="w-10 h-10 rounded-xl bg-buksu-navy text-buksu-gold flex items-center justify-center text-lg shadow-2xs border border-buksu-gold/30">
                            <i class="fa-solid fa-wand-magic-sparkles"></i>
                        </div>
                        <div>
                            <span class="font-black text-sm text-slate-800 dark:text-slate-100 block">3-Color Rule Mode</span>
                            <span class="text-[10px] text-amber-600 font-semibold uppercase tracking-wider">Institutional</span>
                        </div>
                    </div>
                    <div class="pref-check-indicator w-6 h-6 rounded-full bg-buksu-gold text-buksu-navy text-[11px] hidden items-center justify-center shadow-xs">
                        <i class="fa-solid fa-check"></i>
                    </div>
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                    Strict institutional harmony: all icons become BukSU Navy (or Gold in dark mode) and all accent texts and badges adapt to the BukSU Navy/Gold palette.
                </p>
                <div class="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-700">
                    <span class="w-3.5 h-3.5 rounded-full bg-[#031527] border border-slate-400"></span>
                    <span class="w-3.5 h-3.5 rounded-full bg-[#f5b800]"></span>
                    <span class="w-3.5 h-3.5 rounded-full bg-white border border-slate-300"></span>
                    <span class="text-[10px] text-amber-600 font-bold ms-auto">Navy &amp; Gold</span>
                </div>
            </div>
        </div>
    </div>

    <!-- PREFERENCE 3: NAVIGATION PLACEMENT -->
    <div class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-4 shadow-xs">
        <div class="flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-xl bg-buksu-navy text-buksu-gold flex items-center justify-center text-xs font-bold shadow-2xs">
                    <i class="fa-solid fa-table-columns"></i>
                </div>
                <div>
                    <h4 class="font-extrabold text-sm text-slate-800 dark:text-slate-100">Navigation Placement</h4>
                    <p class="text-[11px] text-slate-500">Move sections (Events &amp; Competitions, Judge Assignments, etc.) into a left sidebar or keep the usual top tabs.</p>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Usual Placement (Top Tabs) Card -->
            <div data-pref-nav="top" class="pref-card group p-4 sm:p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-buksu-navy/60 dark:hover:border-buksu-gold transition-all cursor-pointer relative shadow-xs flex flex-col justify-between">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex items-center gap-2.5">
                        <div class="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center text-lg shadow-2xs border border-slate-200">
                            <i class="fa-solid fa-window-maximize"></i>
                        </div>
                        <div>
                            <span class="font-black text-sm text-slate-800 dark:text-slate-100 block">Usual Placement</span>
                            <span class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Top Bar Tabs</span>
                        </div>
                    </div>
                    <div class="pref-check-indicator w-6 h-6 rounded-full bg-buksu-navy text-white text-[11px] hidden items-center justify-center shadow-xs">
                        <i class="fa-solid fa-check"></i>
                    </div>
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                    Sections are placed horizontally below the welcome banner at the top of the dashboard. Standard horizontal layout.
                </p>
                <!-- Mini Layout Diagram: Top Bar -->
                <div class="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-1.5">
                    <div class="w-full h-2 bg-buksu-navy rounded-xs"></div>
                    <div class="flex gap-1">
                        <div class="w-10 h-1.5 bg-buksu-gold rounded-xs"></div>
                        <div class="w-8 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-xs"></div>
                        <div class="w-8 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-xs"></div>
                    </div>
                    <div class="w-full h-6 bg-white dark:bg-slate-900 rounded-xs border border-slate-200 dark:border-slate-700"></div>
                </div>
            </div>

            <!-- Sidebar Mode Card -->
            <div data-pref-nav="sidebar" class="pref-card group p-4 sm:p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-buksu-navy/60 dark:hover:border-buksu-gold transition-all cursor-pointer relative shadow-xs flex flex-col justify-between">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex items-center gap-2.5">
                        <div class="w-10 h-10 rounded-xl bg-buksu-navy text-buksu-gold flex items-center justify-center text-lg shadow-2xs border border-buksu-gold/30">
                            <i class="fa-solid fa-table-columns"></i>
                        </div>
                        <div>
                            <span class="font-black text-sm text-slate-800 dark:text-slate-100 block">Sidebar Mode</span>
                            <span class="text-[10px] text-amber-600 font-semibold uppercase tracking-wider">Vertical Left Sidebar</span>
                        </div>
                    </div>
                    <div class="pref-check-indicator w-6 h-6 rounded-full bg-buksu-gold text-buksu-navy text-[11px] hidden items-center justify-center shadow-xs">
                        <i class="fa-solid fa-check"></i>
                    </div>
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                    Sections become a sleek left sidebar instead of the usual placement. Fast category switching with maximum vertical content space.
                </p>
                <!-- Mini Layout Diagram: Sidebar -->
                <div class="pt-2 border-t border-slate-100 dark:border-slate-700 flex gap-2">
                    <div class="w-8 h-10 bg-buksu-navy rounded-xs flex flex-col gap-1 p-1">
                        <div class="w-full h-1 bg-buksu-gold rounded-xs"></div>
                        <div class="w-full h-1 bg-white/40 rounded-xs"></div>
                        <div class="w-full h-1 bg-white/40 rounded-xs"></div>
                    </div>
                    <div class="flex-1 h-10 bg-white dark:bg-slate-900 rounded-xs border border-slate-200 dark:border-slate-700"></div>
                </div>
            </div>
        </div>
    </div>
</div>
