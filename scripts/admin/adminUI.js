import { createAccount, listAccounts, updatePermissions } from "/scripts/admin/adminAPI.js";
import { showNotice, togglePasswordVisibility } from "/scripts/utils/index.js";
import { getRoleBadge, getStatusBadge } from "/scripts/admin/adminHelpers.js";

const userRole = document.body.dataset.role;
if (userRole === 'admin') {
    initAdminPanel();
}

async function loadAccounts() {
    const tbody = document.getElementById('accounts-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-6 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin me-1.5"></i> Loading accounts...</td></tr>';

    const res = await listAccounts();

    if (!res.success) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-6 text-center text-rose-500">${res.message}</td></tr>`;
        return;
    }

    if (!res.accounts || res.accounts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-6 text-center text-slate-400">No accounts found. Create one to get started.</td></tr>';
        return;
    }

    tbody.innerHTML = res.accounts.map(account => `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
            <td class="px-4 py-3 font-semibold text-slate-800 align-middle">
                <i class="fa-solid fa-user text-slate-400 me-1.5"></i>${account.username}
                ${account.email ? `<div class="text-slate-400 font-normal mt-0.5">${account.email}</div>` : ''}
            </td>
            <td class="px-4 py-3 text-center align-middle">${getRoleBadge(account.role)}</td>
            <td class="px-4 py-3 text-center align-middle">${getStatusBadge(account.is_active)}</td>
            <td class="px-4 py-3 text-center align-middle">
                ${account.is_active
                    ? `<button class="perm-btn px-3 py-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 font-semibold transition-colors cursor-pointer border border-rose-200 text-[11px]" data-id="${account.id}" data-action="disable"><i class="fa-solid fa-ban me-1"></i>Disable</button>`
                    : `<button class="perm-btn px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-semibold transition-colors cursor-pointer border border-emerald-200 text-[11px]" data-id="${account.id}" data-action="enable"><i class="fa-solid fa-circle-check me-1"></i>Enable</button>`
                }
            </td>
        </tr>
    `).join('');

    document.querySelectorAll('.perm-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = btn.dataset.id;
            const action = btn.dataset.action;
            const isActive = action === 'enable';

            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            const res = await updatePermissions(userId, isActive);

            const permNoticeWrap = document.getElementById('admin-perm-notice-wrap');
            permNoticeWrap.classList.remove('hidden');
            permNoticeWrap.className = `mb-3 px-3 py-2 rounded-xl text-xs font-semibold ${res.success ? 'text-emerald-600 bg-emerald-50 border border-emerald-200' : 'text-rose-600 bg-rose-50 border border-rose-200'}`;
            showNotice('admin-perm-notice', res.message, res.success ? 'success' : 'error');

            if (res.success) {
                await loadAccounts();
            } else {
                btn.disabled = false;
            }
        });
    });
}

function initAdminPanel() {
    const createForm = document.getElementById('createAccountForm');
    createForm?.addEventListener('submit', async () => {
        const role     = document.getElementById('create-role').value;
        const username = document.getElementById('create-username').value.trim();
        const email    = document.getElementById('create-email').value.trim();
        const password = document.getElementById('create-password').value;

        const noticeWrap = document.getElementById('admin-create-notice-wrap');
        const notice     = document.getElementById('admin-create-notice');

        if (!username || !password) {
            noticeWrap.className = 'mb-3 px-3 py-2 rounded-xl text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200';
            notice.innerHTML = '<i class="fa-solid fa-circle-exclamation me-1.5"></i>Username and password are required.';
            noticeWrap.classList.remove('hidden');
            return;
        }

        const btn     = document.getElementById('createAccountBtn');
        const btnText = document.getElementById('create-btn-text');
        btn.disabled = true;
        btnText.textContent = 'Creating...';

        const res = await createAccount({ role, username, email, password });

        btn.disabled = false;
        btnText.textContent = 'Create Account';

        noticeWrap.className = `mb-3 px-3 py-2 rounded-xl text-xs font-semibold ${res.success ? 'text-emerald-600 bg-emerald-50 border border-emerald-200' : 'text-rose-600 bg-rose-50 border border-rose-200'}`;
        notice.innerHTML = `<i class="fa-solid ${res.success ? 'fa-circle-check' : 'fa-triangle-exclamation'} me-1.5"></i>${res.message}`;
        noticeWrap.classList.remove('hidden');

        if (res.success) {
            document.getElementById('create-username').value = '';
            document.getElementById('create-email').value = '';
            document.getElementById('create-password').value = '';
            await loadAccounts();
        }
    });

    document.getElementById('toggle-create-password-btn')?.addEventListener('click', () => {
        togglePasswordVisibility('create-password', 'toggle-create-password-icon');
    });

    document.getElementById('refreshAccountsBtn')?.addEventListener('click', loadAccounts);

    loadAccounts();
}
