import { createAccount, listAccounts, updatePermissions, updateRole } from "/scripts/admin/adminAPI.js";
import { showNotice } from "/scripts/utils/index.js";
import { showToast } from "/scripts/utils/uiUtils.js";
import { getRoleBadge, getStatusBadge } from "/scripts/admin/adminHelpers.js";
import { loadAdminEvents } from "/scripts/admin/eventsUI.js";

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
        tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-6 text-center text-slate-400">No accounts found. Send an invitation to get started.</td></tr>';
        return;
    }

    tbody.innerHTML = res.accounts.map(account => `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
            <td class="px-4 py-3 font-semibold text-slate-800 align-middle">
                <i class="fa-solid fa-user text-slate-400 me-1.5"></i>${account.username}
                ${account.email ? `<div class="text-slate-400 font-normal text-[11px] mt-0.5"><i class="fa-solid fa-envelope text-[10px] me-1"></i>${account.email}</div>` : ''}
                ${account.created_at ? `<div class="text-slate-400 font-normal text-[10px] mt-0.5"><i class="fa-regular fa-clock me-1"></i>Invited: ${account.created_at}</div>` : ''}
                ${account.activated_at ? `<div class="text-emerald-600 font-medium text-[10px] mt-0.5"><i class="fa-solid fa-check me-1"></i>Activated: ${account.activated_at}</div>` : ''}
            </td>
            <td class="px-4 py-3 text-center align-middle">
                ${account.role === 'admin' 
                    ? getRoleBadge('admin')
                    : `<div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 border border-slate-200">
                        <i class="fa-solid ${account.role === 'judge' ? 'fa-gavel' : 'fa-calculator'} text-buksu-navy text-xs"></i>
                        <select class="role-select bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer" data-id="${account.id}" data-current="${account.role}">
                            <option value="judge" ${account.role === 'judge' ? 'selected' : ''}>Judge</option>
                            <option value="tabulator" ${account.role === 'tabulator' ? 'selected' : ''}>Tabulator</option>
                        </select>
                       </div>`
                }
            </td>
            <td class="px-4 py-3 text-center align-middle">${getStatusBadge(account.is_active, account.status)}</td>
            <td class="px-4 py-3 text-center align-middle">
                <div class="flex items-center justify-center gap-1.5">
                    ${account.status === 'pending' && account.invite_link
                        ? `<button class="copy-invite-btn px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-semibold transition-colors cursor-pointer border border-indigo-200 text-[11px]" data-link="${account.invite_link}"><i class="fa-solid fa-copy me-1"></i>Copy Link</button>`
                        : ''
                    }
                    ${account.is_active
                        ? `<button class="perm-btn px-2.5 py-1 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 font-semibold transition-colors cursor-pointer border border-rose-200 text-[11px]" data-id="${account.id}" data-action="disable"><i class="fa-solid fa-ban me-1"></i>Disable</button>`
                        : `<button class="perm-btn px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-semibold transition-colors cursor-pointer border border-emerald-200 text-[11px]" data-id="${account.id}" data-action="enable"><i class="fa-solid fa-circle-check me-1"></i>Enable</button>`
                    }
                </div>
            </td>
        </tr>
    `).join('');

    document.querySelectorAll('.copy-invite-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const link = btn.dataset.link;
            if (navigator.clipboard) {
                navigator.clipboard.writeText(link);
                btn.innerHTML = '<i class="fa-solid fa-check me-1"></i>Copied!';
                setTimeout(() => {
                    btn.innerHTML = '<i class="fa-solid fa-copy me-1"></i>Copy Link';
                }, 2000);
            }
        });
    });

    document.querySelectorAll('.role-select').forEach(select => {
        select.addEventListener('change', async () => {
            const userId = select.dataset.id;
            const newRole = select.value;
            const currentRole = select.dataset.current;

            if (newRole === currentRole) return;

            select.disabled = true;
            const res = await updateRole(userId, newRole);

            if (res.success) {
                showToast("Role Configured!", res.message, "edit");
                await loadAccounts();
                await loadAdminEvents();
            } else {
                showToast("Update Failed", res.message, "error");
                select.value = currentRole;
                select.disabled = false;
            }
        });
    });

    document.querySelectorAll('.perm-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const userId = btn.dataset.id;
            const action = btn.dataset.action;
            const isActive = action === 'enable';

            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

            const res = await updatePermissions(userId, isActive);

            const permNoticeWrap = document.getElementById('admin-perm-notice-wrap');
            if (permNoticeWrap) {
                permNoticeWrap.classList.remove('hidden');
                permNoticeWrap.className = `mb-3 px-3 py-2 rounded-xl text-xs font-semibold ${res.success ? 'text-emerald-600 bg-emerald-50 border border-emerald-200' : 'text-rose-600 bg-rose-50 border border-rose-200'}`;
                showNotice('admin-perm-notice', res.message, res.success ? 'success' : 'error');
            }

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
        const role = document.getElementById('create-role').value;
        const username = document.getElementById('create-username').value.trim();
        const email = document.getElementById('create-email').value.trim();

        const noticeWrap = document.getElementById('admin-create-notice-wrap');
        const notice = document.getElementById('admin-create-notice');

        if (!username || !email) {
            if (noticeWrap && notice) {
                noticeWrap.className = 'mb-3 px-3 py-2 rounded-xl text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200';
                notice.innerHTML = '<i class="fa-solid fa-circle-exclamation me-1.5"></i>Both Username and Email are required.';
                noticeWrap.classList.remove('hidden');
            }
            return;
        }

        const btn = document.getElementById('createAccountBtn');
        const btnText = document.getElementById('create-btn-text');
        btn.disabled = true;
        btnText.textContent = 'Generating Invitation...';

        const res = await createAccount({ role, username, email });

        btn.disabled = false;
        btnText.textContent = 'Send Invitation';

        if (noticeWrap && notice) {
            noticeWrap.className = `mb-3 p-3 rounded-xl text-xs font-semibold ${res.success ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-rose-600 bg-rose-50 border border-rose-200'}`;

            if (res.success && res.invite_link) {
                notice.innerHTML = `
                    <div class="mb-1.5 font-bold"><i class="fa-solid fa-circle-check text-emerald-500 me-1"></i> ${res.message}</div>
                    <div class="text-[11px] font-normal mb-2 text-slate-600">Send this invitation link to the user so they can set their password:</div>
                    <div class="flex items-center gap-1.5">
                        <input type="text" readonly value="${res.invite_link}" id="new-invite-link-input" class="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-[11px] font-mono text-slate-800 focus:outline-none" />
                        <button type="button" id="copy-new-invite-btn" class="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer shrink-0">
                            <i class="fa-solid fa-copy"></i> Copy
                        </button>
                    </div>
                `;
                noticeWrap.classList.remove('hidden');

                document.getElementById('copy-new-invite-btn')?.addEventListener('click', () => {
                    const linkInput = document.getElementById('new-invite-link-input');
                    if (linkInput && navigator.clipboard) {
                        navigator.clipboard.writeText(linkInput.value);
                        const copyBtn = document.getElementById('copy-new-invite-btn');
                        if (copyBtn) copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                    }
                });
            } else {
                notice.innerHTML = `<i class="fa-solid fa-triangle-exclamation me-1.5"></i>${res.message}`;
                noticeWrap.classList.remove('hidden');
            }
        }

        if (res.success) {
            document.getElementById('create-username').value = '';
            document.getElementById('create-email').value = '';
            await loadAccounts();
        }
    });

    document.getElementById('refreshAccountsBtn')?.addEventListener('click', loadAccounts);

    loadAccounts();
}
