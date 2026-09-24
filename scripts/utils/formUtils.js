/**
 * Helper utility functions for form handling and input manipulation.
 */

/**
 * Clears input values for a given form element or array of element IDs.
 * @param {HTMLFormElement|string|string[]} target - Form element or input ID(s)
 */
export function clearFormInputs(target) {
    if (typeof target === 'string') {
        const el = document.getElementById(target);
        if (el) clearSingleInput(el);
    } else if (Array.isArray(target)) {
        target.forEach(id => {
            const el = typeof id === 'string' ? document.getElementById(id) : id;
            if (el) clearSingleInput(el);
        });
    } else if (target instanceof HTMLFormElement) {
        const inputs = target.querySelectorAll('input, select, textarea');
        inputs.forEach(clearSingleInput);
    }
}

function clearSingleInput(input) {
    if (!input) return;
    const type = input.type ? input.type.toLowerCase() : '';

    if (type === 'checkbox' || type === 'radio') {
        input.checked = false;
    } else if (type !== 'button' && type !== 'submit' && type !== 'reset') {
        input.value = '';
    }
}

/**
 * Specifically resets the login form fields, password toggle state, and notice banner.
 */
export function clearLoginForm() {
    clearFormInputs(['username-input', 'password-input']);

    const passwordInput = document.getElementById('password-input');
    const icon = document.getElementById('toggle-password-icon');
    const noticeText = document.getElementById('notice-text');

    if (passwordInput) {
        passwordInput.type = 'password';
    }
    if (icon) {
        icon.setAttribute('class', 'fa-solid fa-eye');
    }
    if (noticeText && noticeText.parentElement) {
        noticeText.parentElement.classList.add('hidden');
        noticeText.parentElement.classList.remove('block');
    }
}

/**
 * Toggles password input visibility between text and password mode.
 * @param {string} [passwordInputId='password-input']
 * @param {string} [iconId='toggle-password-icon']
 */
export function togglePasswordVisibility(passwordInputId = 'password-input', iconId = 'toggle-password-icon') {
    const passwordInput = document.getElementById(passwordInputId);
    const icon = document.getElementById(iconId);

    if (!passwordInput || !icon) return;

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.setAttribute('class', 'fa-solid fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        icon.setAttribute('class', 'fa-solid fa-eye');
    }
}
