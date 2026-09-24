export function getRoleBadge(role) {
    if (role === 'judge') {
        return '<span class="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 font-semibold text-[11px] uppercase tracking-wide">Judge</span>';
    }
    if (role === 'tabulator') {
        return '<span class="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 font-semibold text-[11px] uppercase tracking-wide">Tabulator</span>';
    }
    return role;
}

export function getStatusBadge(isActive) {
    if (isActive) {
        return '<span class="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[11px] font-semibold border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>Active</span>';
    }
    return '<span class="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-500 text-[11px] font-semibold border border-rose-200"><span class="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block"></span>Disabled</span>';
}
