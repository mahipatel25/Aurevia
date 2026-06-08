// --- Safe LocalStorage Wrappers ---
const safeGetItem = (key, fallback = null) => {
    try {
        return localStorage.getItem(key) || fallback;
    } catch (e) {
        console.warn(`localStorage.getItem failed for key "${key}":`, e);
        return fallback;
    }
};

const safeSetItem = (key, value) => {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        console.warn(`localStorage.setItem failed for key "${key}":`, e);
    }
};

// --- Safe Icons Hydrator ---
const safeHydrateIcons = () => {
    try {
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    } catch (e) {
        console.warn("Lucide icons hydration failed:", e);
    }
};

// --- Auth Session Guard ---
if (safeGetItem('loggedIn') === 'true') {
    window.location.replace('../todo/index.html');
}

document.addEventListener('DOMContentLoaded', () => {
    // --- State Variables ---
    let audioCtx = null;
    const initTheme = () => {
        const savedTheme = safeGetItem('aetherlist_theme', 'light');
        document.documentElement.setAttribute('data-theme', savedTheme);
    };
    initTheme();

    // Reapply theme on browser history traversal / back-forward cache restores
    window.addEventListener('pageshow', (event) => {
        initTheme();
    });

    // Reapply theme on page visibility state changes (switching browser tabs, app switching)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            initTheme();
        }
    });

    // Reapply theme on storage changes across tabs in real-time
    window.addEventListener('storage', (event) => {
        if (event.key === 'aetherlist_theme') {
            initTheme();
        }
    });

    // --- DOM Elements ---
    const signupForm = document.getElementById('signup-form');
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    const termsCheckbox = document.getElementById('terms-checkbox');
    const emailBox = document.getElementById('email-box');
    const passwordBox = document.getElementById('password-box');
    const termsError = document.getElementById('terms-error');

    // Remove terms error when checked
    if (termsCheckbox) {
        termsCheckbox.addEventListener('change', () => {
            if (termsCheckbox.checked) {
                termsError.classList.remove('active');
                const extraRow = document.querySelector('.form-extra-row');
                if (extraRow) {
                    extraRow.classList.remove('has-error');
                }
            }
        });
    }

    // Hydrate Lucide Icons
    safeHydrateIcons();

    // --- Password Toggle Logic ---
    const passwordToggleBtns = document.querySelectorAll('.password-toggle-btn');
    passwordToggleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const inputWrapper = btn.closest('.input-wrapper-clean');
            if (inputWrapper) {
                const input = inputWrapper.querySelector('input');
                if (input.type === 'password') {
                    input.type = 'text';
                    btn.innerHTML = `<i data-lucide="eye"></i>`;
                } else {
                    input.type = 'password';
                    btn.innerHTML = `<i data-lucide="eye-off"></i>`;
                }
                safeHydrateIcons();
            }
        });
    });

    // --- Password Real-Time Validation Logic ---
    const passwordRequirementsContainer = document.getElementById('password-requirements');
    const passwordReqMessage = document.getElementById('password-req-message');

    let isPasswordValid = false;

    const validatePassword = () => {
        if (!passwordInput) return;
        const val = passwordInput.value;
        if (val.length > 0) {
            passwordRequirementsContainer.classList.add('active');
        } else {
            passwordRequirementsContainer.classList.remove('active');
        }

        const rules = [
            { isValid: val.length >= 8, text: "Password must be at least 8 characters" },
            { isValid: /[A-Z]/.test(val), text: "Add at least one uppercase letter" },
            { isValid: /[a-z]/.test(val), text: "Add at least one lowercase letter" },
            { isValid: /[0-9]/.test(val), text: "Add at least one number" },
            { isValid: /[~!@#$%^&*()_+=\-\[\]{}|;':",./<>?\\`]/.test(val), text: "Add at least one special character" }
        ];

        const firstUnmet = rules.find(rule => !rule.isValid);

        if (passwordReqMessage) {
            if (firstUnmet) {
                passwordReqMessage.className = 'req-item invalid';
                passwordReqMessage.innerHTML = `<i data-lucide="x-circle"></i> <span>${firstUnmet.text}</span>`;
                isPasswordValid = false;
            } else {
                passwordReqMessage.className = 'req-item valid';
                passwordReqMessage.innerHTML = `<i data-lucide="check-circle-2"></i> <span>Password meets all requirements ✓</span>`;
                isPasswordValid = true;
            }
        }

        safeHydrateIcons();
    };

    if (passwordInput) {
        ['input', 'change', 'keyup', 'paste', 'cut'].forEach(evt => {
            passwordInput.addEventListener(evt, validatePassword);
        });
    }

    // --- Terms & Conditions Modal Logic ---
    const termsModal = document.getElementById('terms-modal');
    const openTermsLinks = document.querySelectorAll('.terms-link');
    const closeModalBtn = document.querySelector('.close-modal-btn');
    const understandTermsBtn = document.getElementById('understand-terms-btn');

    const openTermsModal = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation(); // Prevent the click from bubbling up to the checkbox label
        }
        if (termsModal) {
            termsModal.classList.add('active');
            playSound('click');
        }
    };

    const closeTermsModal = () => {
        if (termsModal) {
            termsModal.classList.remove('active');
            playSound('click');
        }
    };

    openTermsLinks.forEach(link => {
        link.addEventListener('click', openTermsModal);
    });

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeTermsModal);
    if (understandTermsBtn) understandTermsBtn.addEventListener('click', closeTermsModal);
    
    // Close when clicking outside modal content (on the overlay)
    if (termsModal) {
        termsModal.addEventListener('click', (e) => {
            if (e.target === termsModal) {
                closeTermsModal();
            }
        });
    }

    // --- Procedural Web Audio Sound Engine ---
    const playSound = (type) => {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            const now = audioCtx.currentTime;

            // Load volume setting and scale chimes
            const rawVol = safeGetItem('aetherlist_volume', '50');
            const volRatio = (safeGetItem('aetherlist_muted') === 'true') ? 0 : parseInt(rawVol) / 100;

            if (type === 'click') {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(900, now);
                osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
                gain.gain.setValueAtTime(volRatio * 0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                osc.start(now);
                osc.stop(now + 0.05);
            } else if (type === 'success') {
                // Ascending bright chime chord progression
                const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
                notes.forEach((freq, idx) => {
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();
                    osc.connect(gain);
                    gain.connect(audioCtx.destination);
                    
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + idx * 0.07);
                    gain.gain.setValueAtTime(volRatio * 0.08, now + idx * 0.07);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.25);
                    osc.start(now + idx * 0.07);
                    osc.stop(now + idx * 0.07 + 0.25);
                });
            }
        } catch (e) {
            console.error("Web Audio API signup failure:", e);
        }
    };

    // --- Elegant Toast Notification System ---
    const showToast = (message, type = 'info', duration = 3000) => {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`.trim();
        
        let iconName = 'info';
        if (type === 'success') iconName = 'check-circle-2';
        if (type === 'danger') iconName = 'alert-circle';
        
        toast.innerHTML = `
            <div class="toast-icon">
                <i data-lucide="${iconName}"></i>
            </div>
            <div class="toast-message">${escapeHTML(message)}</div>
        `;
        
        toastContainer.appendChild(toast);
        safeHydrateIcons();
        
        const destroyTimeout = setTimeout(() => {
            removeToast(toast);
        }, duration);
        
        toast.addEventListener('click', () => {
            clearTimeout(destroyTimeout);
            removeToast(toast);
        });
    };

    const removeToast = (toast) => {
        if (!toast || !toast.parentNode) return;
        toast.classList.add('removing');
        const forceRemove = () => {
            if (toast.parentNode) toast.remove();
        };
        const safetyTimeout = setTimeout(forceRemove, 250);
        toast.addEventListener('transitionend', () => {
            clearTimeout(safetyTimeout);
            forceRemove();
        }, { once: true });
    };

    const escapeHTML = (text) => {
        const div = document.createElement('div');
        div.innerText = text;
        return div.innerHTML;
    };

    // --- Interactive Form Clicks ---
    document.addEventListener('click', (e) => {
        if (e.target.closest('input') || e.target.closest('button')) {
            playSound('click');
        }
    });

    // --- Form Submit Dynamic Controller ---
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        validatePassword();
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const termsChecked = termsCheckbox.checked;

        // Basic Regex format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!emailRegex.test(email)) {
            emailBox.classList.add('shake');
            emailBox.addEventListener('animationend', () => {
                emailBox.classList.remove('shake');
            }, { once: true });
            
            showToast("Please enter a valid email address", "danger");
            playSound('click');
            return;
        }

        if (!isPasswordValid) {
            passwordBox.classList.add('shake');
            passwordBox.addEventListener('animationend', () => {
                passwordBox.classList.remove('shake');
            }, { once: true });
            
            showToast("Password must meet all requirements", "danger");
            playSound('click');
            return;
        }

        if (!termsChecked) {
            termsError.classList.add('active');
            const extraRow = document.querySelector('.form-extra-row');
            if (extraRow) {
                extraRow.classList.add('has-error');
            }
            playSound('click');
            return;
        }

        // Retrieve existing users from localStorage
        let existingUsers = [];
        try {
            existingUsers = JSON.parse(safeGetItem('aetherlist_users', '[]'));
        } catch (err) {
            console.error("Error parsing users storage:", err);
            existingUsers = [];
        }

        // Check for duplicate account
        const userExists = existingUsers.some(user => user.email.toLowerCase() === email.toLowerCase());
        if (userExists) {
            emailBox.classList.add('shake');
            emailBox.addEventListener('animationend', () => {
                emailBox.classList.remove('shake');
            }, { once: true });
            
            showToast("Account already exists", "danger");
            playSound('click');
            return;
        }

        // Add user and save to localStorage
        existingUsers.push({ email, password });
        safeSetItem('aetherlist_users', JSON.stringify(existingUsers));

        // Auto-authenticate user and redirect to dashboard
        safeSetItem("loggedIn", "true");

        // Sign Up Success state execution
        playSound('success');
        showToast("Account created successfully! ✨", "success", 2000);

        setTimeout(() => {
            window.location.replace('../todo/index.html');
        }, 1500);
    });

    // Integrated Theme Toggle Logic
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            safeSetItem('aetherlist_theme', newTheme);
        });
    }

    // Allow theme transitions after page load
    setTimeout(() => {
        document.documentElement.classList.remove('no-transition');
    }, 100);
});
