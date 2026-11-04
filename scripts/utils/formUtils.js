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
    let icon = document.getElementById('toggle-password-icon');
    const noticeText = document.getElementById('notice-text');

    if (passwordInput) {
        passwordInput.type = 'password';
    }
    if (!icon && passwordInput && passwordInput.parentElement) {
        icon = passwordInput.parentElement.querySelector('button i, button svg, [id="toggle-password-icon"]');
    }
    if (icon) {
        const parent = icon.parentElement;
        if (parent) {
            const freshIcon = document.createElement('i');
            freshIcon.id = 'toggle-password-icon';
            freshIcon.className = 'fa-solid fa-eye';
            parent.replaceChild(freshIcon, icon);
        } else {
            icon.className = 'fa-solid fa-eye';
        }
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
    if (!passwordInput) return;

    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';

    const newIconClass = isPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';

    let icon = document.getElementById(iconId);
    if (!icon && passwordInput.parentElement) {
        icon = passwordInput.parentElement.querySelector(`button i, button svg, [id="${iconId}"]`);
    }

    if (icon) {
        // If FontAwesome converted <i> into an <svg>, replacing with a fresh <i> tag ensures FontAwesome re-renders the new icon correctly
        const parent = icon.parentElement;
        if (parent) {
            const freshIcon = document.createElement('i');
            freshIcon.id = iconId;
            freshIcon.className = newIconClass;
            parent.replaceChild(freshIcon, icon);
        } else {
            icon.className = newIconClass;
        }
    }
}
