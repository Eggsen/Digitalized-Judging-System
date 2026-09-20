document.addEventListener('DOMContentLoaded', () => {
    initLandingPage();
});

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
        togglePasswordBtn.addEventListener('click', togglePasswordVisibility);
    }
}

function selectRole(role) {
    const data = ROLE_DATA[role];
    if (!data) return;

    const badgeText = document.getElementById('login-role-badge-text');
    const badgeIcon = document.getElementById('login-role-badge-icon');
    const title = document.getElementById('login-title');
    const subtitle = document.getElementById('login-subtitle');
    const btnText = document.getElementById('login-btn-text');
    const usernameInput = document.getElementById('username-input');

    if (badgeText) badgeText.innerText = data.badgeText;
    if (badgeIcon) badgeIcon.className = data.badgeIcon;
    if (title) title.innerText = data.title;
    if (subtitle) subtitle.innerText = data.subtitle;
    if (btnText) btnText.innerText = data.btnText;
    if (usernameInput) usernameInput.placeholder = data.userPlaceholder;

    const roleCard = document.getElementById('role-selection-card');
    const loginCard = document.getElementById('login-card');

    if (roleCard && loginCard) {
        roleCard.classList.add('hidden');
        loginCard.classList.remove('hidden');
        loginCard.classList.add('animate-fade-in');
    }
}

function showRoleSelection() {
    const roleCard = document.getElementById('role-selection-card');
    const loginCard = document.getElementById('login-card');

    if (roleCard && loginCard) {
        loginCard.classList.add('hidden');
        roleCard.classList.remove('hidden');
        roleCard.classList.add('animate-fade-in');
    }
}

function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password-input');
    const icon = document.getElementById('toggle-password-icon');
    if (!passwordInput || !icon) return;

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.className = 'fa-solid fa-eye-slash';
    } else {
        passwordInput.type = 'password';
        icon.className = 'fa-solid fa-eye';
    }
}
