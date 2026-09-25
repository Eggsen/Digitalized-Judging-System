import { clearLoginForm, togglePasswordVisibility } from "../utils/index.js";

let currentSelectedRole = 'admin';

// Module scripts are deferred — DOM is ready by the time this runs
initLandingPage();

const ROLE_DATA = {
    admin: {
        badgeText: 'Admin Portal',
        badgeIcon: 'fa-solid fa-user-shield',
        title: 'Administrator Sign In',
        subtitle: 'Enter your administrator credentials to access event controls and system management.',
        btnText: 'Sign In as Admin',
        userPlaceholder: 'admin.username or email@buksu.edu.ph'
    },
    judge: {
        badgeText: 'Judge Portal',
        badgeIcon: 'fa-solid fa-gavel',
        title: 'Official Judge Sign In',
        subtitle: 'Enter your assigned judge credentials or access code to begin scoring candidates.',
        btnText: 'Sign In as Judge',
        userPlaceholder: 'judge.id or access code'
    },
    tabulator: {
        badgeText: 'Tabulator Portal',
        badgeIcon: 'fa-solid fa-calculator',
        title: 'Tabulator Sign In',
        subtitle: 'Enter your tabulator account credentials to audit scores and calculate final tallies.',
        btnText: 'Sign In as Tabulator',
        userPlaceholder: 'tabulator.id or email@buksu.edu.ph'
    }
};

export function getSelectedRole() {
    return currentSelectedRole;
}

window.getSelectedRole = getSelectedRole;

function initLandingPage() {
    const roleSelectionCard = document.getElementById('role-selection-card');
    const loginCard = document.getElementById('login-card');
    
    if (!roleSelectionCard || !loginCard) return;

    const roleCards = document.querySelectorAll('[data-role]');
    roleCards.forEach(card => {
        card.addEventListener('click', () => {
            const role = card.getAttribute('data-role');
            selectRole(role);
        });
    });

    const backBtn = document.getElementById('back-to-roles-btn');
    if (backBtn) {
        backBtn.addEventListener('click', showRoleSelection);
    }

    const togglePasswordBtn = document.getElementById('toggle-password-btn');
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', () => togglePasswordVisibility());
    }

    const openRegisterBtn = document.getElementById('open-register-admin-btn');
    if (openRegisterBtn) {
        openRegisterBtn.addEventListener('click', showRegisterAdminCard);
    }

    const backFromRegisterBtn = document.getElementById('back-from-register-btn');
    if (backFromRegisterBtn) {
        backFromRegisterBtn.addEventListener('click', hideRegisterAdminCard);
    }
}

function showRegisterAdminCard() {
    const loginCard = document.getElementById('login-card');
    const registerCard = document.getElementById('register-admin-card');
    if (loginCard && registerCard) {
        loginCard.classList.add('hidden');
        registerCard.classList.remove('hidden');
        registerCard.classList.add('animate-fade-in');
    }
}

function hideRegisterAdminCard() {
    const loginCard = document.getElementById('login-card');
    const registerCard = document.getElementById('register-admin-card');
    if (loginCard && registerCard) {
        registerCard.classList.add('hidden');
        loginCard.classList.remove('hidden');
        loginCard.classList.add('animate-fade-in');
    }
}

function selectRole(role) {
    const data = ROLE_DATA[role];
    if (!data) return;

    currentSelectedRole = role;

    clearLoginForm();

    const badgeText = document.getElementById('login-role-badge-text');
    const badgeIcon = document.getElementById('login-role-badge-icon');
    const title = document.getElementById('login-title');
    const subtitle = document.getElementById('login-subtitle');
    const btnText = document.getElementById('login-btn-text');
    const usernameInput = document.getElementById('username-input');

    if (badgeText) badgeText.innerText = data.badgeText;
    if (badgeIcon) badgeIcon.setAttribute('class', data.badgeIcon);
    if (title) title.innerText = data.title;
    if (subtitle) subtitle.innerText = data.subtitle;
    if (btnText) btnText.innerText = data.btnText;
    if (usernameInput) usernameInput.placeholder = data.userPlaceholder;

    // Show forgot password link only for judge and tabulator (not admin)
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    if (forgotPasswordLink) {
        if (role === 'judge' || role === 'tabulator') {
            forgotPasswordLink.classList.remove('hidden');
        } else {
            forgotPasswordLink.classList.add('hidden');
        }
    }

    // Show register admin prompt only for admin portal
    const registerAdminWrap = document.getElementById('register-admin-wrap');
    if (registerAdminWrap) {
        if (role === 'admin') {
            registerAdminWrap.classList.remove('hidden');
        } else {
            registerAdminWrap.classList.add('hidden');
        }
    }

    const roleCard = document.getElementById('role-selection-card');
    const loginCard = document.getElementById('login-card');
    const registerCard = document.getElementById('register-admin-card');

    if (registerCard) registerCard.classList.add('hidden');

    if (roleCard && loginCard) {
        roleCard.classList.add('hidden');
        loginCard.classList.remove('hidden');
        loginCard.classList.add('animate-fade-in');
    }
}

function showRoleSelection() {
    clearLoginForm();

    const roleCard = document.getElementById('role-selection-card');
    const loginCard = document.getElementById('login-card');
    const registerCard = document.getElementById('register-admin-card');

    if (registerCard) registerCard.classList.add('hidden');
    if (loginCard) loginCard.classList.add('hidden');
    if (roleCard) {
        roleCard.classList.remove('hidden');
        roleCard.classList.add('animate-fade-in');
    }
}
