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

// --- Auth Check Guard ---
if (safeGetItem('loggedIn') !== 'true') {
    window.location.replace('../login/index.html');
}

/**
 * AetherList - Premium Gamified Focus & Productivity Platform
 * Core JavaScript Engine - SaaS Quality Production Version
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- State Variables ---
    let tasks = [];
    let currentFilter = 'all';
    let lastPercentage = 0; // For percentage counting interpolation
    let activeEditingTaskId = null; // For modal editing tracking
    let lastQuoteIndex = -1; // Prevent repeating motivational slogans
    
    // --- Gamification & Sound State Variables ---
    let xp = parseInt(safeGetItem('aetherlist_xp', '0')) || 0;
    let level = parseInt(safeGetItem('aetherlist_level', '1')) || 1;
    let streakCount = parseInt(safeGetItem('aetherlist_streak_count', '0')) || 0;
    let lastStreakDate = safeGetItem('aetherlist_last_streak_date', null); // YYYY-MM-DD
    let unlockedBadges = [];
    try {
        unlockedBadges = JSON.parse(safeGetItem('aetherlist_unlocked_badges', '[]'));
    } catch (e) {
        console.error("Error parsing unlocked badges:", e);
        unlockedBadges = [];
    }
    
    // --- Sound Synth Engine State ---
    let audioCtx = null;
    let isMuted = safeGetItem('aetherlist_muted') === 'true';
    let pomoVolume = safeGetItem('aetherlist_volume') !== null 
        ? parseInt(safeGetItem('aetherlist_volume')) 
        : 50;
    let selectedAmbience = safeGetItem('aetherlist_ambience', 'none');
    
    let ambienceNode = null;
    let ambienceGainNode = null;
    let rainInterval = null;
    let fireInterval = null;
    let droneOscillators = [];
    let droneLfo = null;
    let ambienceTimeout = null;
    let isSwellActive = false;
    
    // --- Pomodoro Timer State ---
    let pomoTimer = null;
    let userPomoDuration = parseInt(safeGetItem('aetherlist_pomo_duration', '30')) || 30;
    let pomoSecondsRemaining = userPomoDuration * 60;
    let pomoIsRunning = false;
    let pomoMode = 'focus'; // 'focus' or 'break'
    let pomoOriginalDuration = userPomoDuration * 60;
    
    // --- Focus Mode Active ID ---
    let activeFocusTaskId = null;

    // --- DOM Elements ---
    const todoForm = document.getElementById('todo-form');
    const taskInput = document.getElementById('task-input');
    const inputContainerBox = document.getElementById('input-container-box');
    const priorityLabels = document.querySelectorAll('.priority-label');
    const taskList = document.getElementById('task-list');
    const emptyState = document.getElementById('empty-state');
    
    // Stats elements
    const statTotal = document.getElementById('stat-total');
    const statPending = document.getElementById('stat-pending');
    const statCompleted = document.getElementById('stat-completed');
    const progressRingBar = document.getElementById('progress-ring-bar');
    const progressPercentage = document.getElementById('progress-percentage');
    const progressMotivation = document.getElementById('progress-motivation');
    const horizontalProgress = document.getElementById('horizontal-progress');
    
    // Filters & controls
    const filterButtons = document.querySelectorAll('.filter-btn');
    const clearCompletedBtn = document.getElementById('clear-completed-btn');
    const searchInput = document.getElementById('search-input');
    
    // Theme & Widget elements
    const themeToggle = document.getElementById('theme-toggle');
    const currentDateEl = document.getElementById('current-date');
    const currentTimeEl = document.getElementById('current-time');

    // Edit Modal Elements
    const editModal = document.getElementById('edit-modal');
    const editTaskInput = document.getElementById('edit-task-input');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalSaveBtn = document.getElementById('modal-save-btn');

    // Trophies / Achievements Elements
    const achievementsToggleHeader = document.getElementById('achievements-toggle-header');
    const achievementsGridWrapper = document.getElementById('achievements-grid-wrapper');
    const achievementsChevron = document.getElementById('achievements-chevron');
    const logoutBtn = document.getElementById('logout-btn');

    // Pomodoro & Sound Buttons
    const soundToggleBtn = document.getElementById('sound-toggle-btn');
    const soundIcon = document.getElementById('sound-icon');
    const pomoPlayBtn = document.getElementById('pomo-play-btn');
    const pomoResetBtn = document.getElementById('pomo-reset-btn');
    const pomoTimeDisplay = document.getElementById('pomo-time-display');
    const pomoModeLabel = document.getElementById('pomo-mode-label');
    const setTimerBtn = document.getElementById('pomo-set-timer-btn');
    const durationSelector = document.getElementById('pomo-duration-selector');
    const durationDropdown = document.getElementById('pomo-duration-dropdown');
    const customDurationContainer = document.getElementById('pomo-duration-custom-container');
    const customDurationInput = document.getElementById('pomo-custom-input');
    const pomoRingBar = document.getElementById('pomo-ring-bar');

    // Immersive Focus Mode Elements
    const focusOverlay = document.getElementById('focus-overlay');
    const exitFocusBtn = document.getElementById('exit-focus-btn');
    const focusTaskCategory = document.getElementById('focus-task-category');
    const focusTaskTitle = document.getElementById('focus-task-title');
    const focusTimerCountdown = document.getElementById('focus-timer-countdown');
    const focusTimerStatus = document.getElementById('focus-timer-status');
    const focusTimerBar = document.getElementById('focus-timer-bar');
    const focusPlayBtn = document.getElementById('focus-play-btn');
    const focusResetBtn = document.getElementById('focus-reset-btn');
    const focusCompleteBtn = document.getElementById('focus-complete-btn');

    // --- Dynamic Date & Time Widget ---
    const updateDateTime = () => {
        const now = new Date();
        
        // Format Date: e.g., "Friday, 22 May ’26"
        const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
        const day = now.getDate();
        const month = now.toLocaleDateString('en-US', { month: 'short' });
        const yearShort = String(now.getFullYear()).slice(-2);
        currentDateEl.textContent = `${weekday}, ${day} ${month} ’${yearShort}`;
        
        // Format Time: e.g., "13:34" (24-hour format)
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        currentTimeEl.textContent = `${hours}:${minutes}`;
    };
    
    updateDateTime();
    setInterval(updateDateTime, 1000); // 1-second interval refresh

    // --- Premium Sliding Filter Pill Controller ---
    const updateFilterPill = () => {
        const activeBtn = document.querySelector('.filter-btn.active');
        const pill = document.getElementById('active-filter-pill');
        if (activeBtn && pill) {
            pill.style.left = `${activeBtn.offsetLeft}px`;
            pill.style.width = `${activeBtn.offsetWidth}px`;
        }
    };
    
    // Bind to window resize for perfect alignment preservation
    window.addEventListener('resize', updateFilterPill);

    // --- Procedural Sound Synthesizer (Web Audio API) ---
    const unlockAudioContext = () => {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            if (!window.keepAliveOsc) {
                window.keepAliveOsc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                window.keepAliveOsc.connect(gain);
                gain.connect(audioCtx.destination);
                gain.gain.value = 0.0001;
                window.keepAliveOsc.start();
            }
        } catch (e) {
            console.error("AudioContext unlock failed:", e);
        }
    };

    const playSound = (type) => {
        if (isMuted) return;
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            
            const now = audioCtx.currentTime;
            const rawVol = safeGetItem('aetherlist_volume', '50');
            const volRatio = parseInt(rawVol) / 100;
            
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
            } else if (type === 'complete') {
                const notes = [523.25, 659.25, 783.99]; 
                notes.forEach((freq, idx) => {
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();
                    osc.connect(gain);
                    gain.connect(audioCtx.destination);
                    
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + idx * 0.06);
                    gain.gain.setValueAtTime(volRatio * 0.08, now + idx * 0.06);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.22);
                    osc.start(now + idx * 0.06);
                    osc.stop(now + idx * 0.06 + 0.22);
                });
            } else if (type === 'levelup') {
                const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
                notes.forEach((freq, idx) => {
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();
                    osc.connect(gain);
                    gain.connect(audioCtx.destination);
                    
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + idx * 0.05);
                    gain.gain.setValueAtTime(volRatio * 0.06, now + idx * 0.05);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.28);
                    osc.start(now + idx * 0.05);
                    osc.stop(now + idx * 0.05 + 0.28);
                });
            } else if (type === 'alarm') {
                const startTime = audioCtx.currentTime + 0.1; 
                
                const masterGain = audioCtx.createGain();
                masterGain.gain.value = volRatio;
                masterGain.connect(audioCtx.destination);
                
                const notes = [523.25, 659.25, 783.99, 1046.50]; // C Major chord
                
                for (let rep = 0; rep < 3; rep++) {
                    const offset = rep * 0.8; 
                    notes.forEach((freq) => {
                        const osc = audioCtx.createOscillator();
                        const noteGain = audioCtx.createGain();
                        
                        osc.connect(noteGain);
                        noteGain.connect(masterGain);
                        
                        osc.type = 'sine'; 
                        osc.frequency.value = freq;
                        
                        noteGain.gain.setValueAtTime(0, startTime + offset);
                        noteGain.gain.linearRampToValueAtTime(0.3, startTime + offset + 0.05);
                        noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + offset + 0.7);
                        
                        osc.start(startTime + offset);
                        osc.stop(startTime + offset + 0.7);
                    });
                }
            }
        } catch (e) {
            console.error("Web Audio API synthesis failure:", e);
        }
    };

    // --- Sound Mute UI Controller ---
    const updateSoundToggleUI = () => {
        const popoverMuteIcon = document.getElementById('popover-mute-icon');
        const popoverMuteBtn = document.getElementById('popover-mute-btn');
        
        if (isMuted) {
            soundIcon.setAttribute('data-lucide', 'volume-x');
            soundToggleBtn.title = "Unmute Focus Audio";
            if (popoverMuteIcon) popoverMuteIcon.setAttribute('data-lucide', 'volume-x');
            if (popoverMuteBtn) popoverMuteBtn.title = "Unmute Focus Audio";
            if (popoverMuteBtn) popoverMuteBtn.classList.add('muted');
        } else {
            soundIcon.setAttribute('data-lucide', 'volume-2');
            soundToggleBtn.title = "Mute Focus Audio";
            if (popoverMuteIcon) popoverMuteIcon.setAttribute('data-lucide', 'volume-2');
            if (popoverMuteBtn) popoverMuteBtn.title = "Mute Focus Audio";
            if (popoverMuteBtn) popoverMuteBtn.classList.remove('muted');
        }
        safeHydrateIcons();
    };

    // --- Procedural Focus Ambience Synthesizer Nodes ---
    const createBrownNoiseBuffer = () => {
        if (!audioCtx) return null;
        const bufferSize = audioCtx.sampleRate * 2;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            // First-order integration filter (1/f^2 density spectral slope)
            data[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = data[i];
            data[i] *= 3.5; // Scale up to match average peak volume
        }
        return buffer;
    };

    const startRainDroplets = () => {
        rainInterval = setInterval(() => {
            if (isMuted || selectedAmbience !== 'rain') return;
            try {
                const now = audioCtx.currentTime;
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                
                osc.connect(gain);
                gain.connect(ambienceGainNode);
                
                osc.type = 'sine';
                // Generates randomized droplet frequencies to simulate real rain
                const freq = 1000 + Math.random() * 1200;
                osc.frequency.setValueAtTime(freq, now);
                
                const duration = 0.025 + Math.random() * 0.025; // 25ms - 50ms decay
                const volume = 0.02 + Math.random() * 0.04;
                
                gain.gain.setValueAtTime(volume, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
                
                osc.start(now);
                osc.stop(now + duration + 0.05);
            } catch (e) {
                // Safely ignore timer scheduling interruptions on background tabs
            }
        }, 80);
    };

    const startFireCrackles = () => {
        fireInterval = setInterval(() => {
            if (isMuted || selectedAmbience !== 'fire') return;
            try {
                const now = audioCtx.currentTime;
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                
                osc.connect(gain);
                gain.connect(ambienceGainNode);
                
                osc.type = 'square';
                const freq = 100 + Math.random() * 800;
                osc.frequency.setValueAtTime(freq, now);
                
                const duration = 0.01 + Math.random() * 0.03; // 10ms - 40ms very short pop
                const volume = 0.15 + Math.random() * 0.2; // Drastically louder crackles
                
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(volume, now + 0.005);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
                
                osc.start(now);
                osc.stop(now + duration + 0.05);
            } catch (e) {}
        }, 120);
    };

    const startDroneDrone = () => {
        droneOscillators = [];
        const notes = [130.81, 196.00, 261.63]; // C3, G3, C4 warm chord
        const types = ['triangle', 'sine', 'triangle'];
        const relativeGains = [0.4, 0.5, 0.3];
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(350, audioCtx.currentTime);
        filter.Q.setValueAtTime(3, audioCtx.currentTime);
        filter.connect(ambienceGainNode);
        
        // Low Frequency Oscillator for a slow breathing wave modulation
        droneLfo = audioCtx.createOscillator();
        const lfoGain = audioCtx.createGain();
        
        droneLfo.type = 'sine';
        droneLfo.frequency.setValueAtTime(0.08, audioCtx.currentTime); // 12.5s cycles
        lfoGain.gain.setValueAtTime(120, audioCtx.currentTime); // mod frequency +/- 120Hz
        
        droneLfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        
        notes.forEach((freq, idx) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.type = types[idx];
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            osc.detune.setValueAtTime((idx - 1) * 6, audioCtx.currentTime); // Slight analog detune
            gain.gain.setValueAtTime(relativeGains[idx], audioCtx.currentTime);
            
            osc.connect(gain);
            gain.connect(filter);
            
            osc.start();
            droneOscillators.push(osc);
        });
        
        droneLfo.start();
    };

    const stopAmbienceAudio = () => {
        if (ambienceTimeout) {
            clearTimeout(ambienceTimeout);
            ambienceTimeout = null;
        }
        isSwellActive = false;
        if (rainInterval) {
            clearInterval(rainInterval);
            rainInterval = null;
        }
        if (fireInterval) {
            clearInterval(fireInterval);
            fireInterval = null;
        }
        if (droneOscillators.length > 0) {
            droneOscillators.forEach(osc => {
                try { osc.stop(); } catch(e) {}
            });
            droneOscillators = [];
        }
        if (droneLfo) {
            try { droneLfo.stop(); } catch(e) {}
            droneLfo = null;
        }
        if (ambienceNode) {
            try { ambienceNode.stop(); } catch(e) {}
            ambienceNode = null;
        }
    };

    const updateAmbienceVolume = () => {
        if (ambienceGainNode && audioCtx) {
            const masterVolumeMultiplier = 20.0; // Extreme amplification to compensate for lowpass filter energy loss
            const targetGain = isMuted || selectedAmbience === 'none' || (!pomoIsRunning && !isSwellActive)
                ? 0 
                : (pomoVolume / 100) * masterVolumeMultiplier;
                
            // Avoid sudden pops/clicks using smooth transition exponential constants
            ambienceGainNode.gain.setTargetAtTime(targetGain, audioCtx.currentTime, 0.08);
        }
    };

    const startAmbienceSwell = (durationMs, fadeDurationMs) => {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            
            // Clean up any existing instances first
            stopAmbienceAudio();
            
            if (isMuted || selectedAmbience === 'none') {
                return;
            }
            
            isSwellActive = true;
            
            if (!ambienceGainNode) {
                ambienceGainNode = audioCtx.createGain();
                ambienceGainNode.connect(audioCtx.destination);
            }
            
            const masterVolumeMultiplier = 20.0;
            const targetGain = (pomoVolume / 100) * masterVolumeMultiplier;
            
            const now = audioCtx.currentTime;
            const startFadeTime = now + durationMs / 1000;
            const endFadeTime = startFadeTime + fadeDurationMs / 1000;
            
            // Schedule smooth swell envelope
            ambienceGainNode.gain.cancelScheduledValues(now);
            ambienceGainNode.gain.setValueAtTime(0, now);
            ambienceGainNode.gain.linearRampToValueAtTime(targetGain, now + 0.1); // 100ms fade-in
            ambienceGainNode.gain.setValueAtTime(targetGain, startFadeTime);
            ambienceGainNode.gain.linearRampToValueAtTime(0, endFadeTime);
            
            // Start the appropriate source
            if (selectedAmbience === 'rain') {
                const buffer = createBrownNoiseBuffer();
                const source = audioCtx.createBufferSource();
                source.buffer = buffer;
                source.loop = true;
                
                const filter = audioCtx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(650, audioCtx.currentTime);
                
                source.connect(filter);
                filter.connect(ambienceGainNode);
                source.start();
                ambienceNode = source;
                
                startRainDroplets();
                
            } else if (selectedAmbience === 'noise') {
                const buffer = createBrownNoiseBuffer();
                const source = audioCtx.createBufferSource();
                source.buffer = buffer;
                source.loop = true;
                
                const filter = audioCtx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(380, audioCtx.currentTime);
                
                source.connect(filter);
                filter.connect(ambienceGainNode);
                source.start();
                ambienceNode = source;
                
            } else if (selectedAmbience === 'wind') {
                const buffer = createBrownNoiseBuffer();
                const source = audioCtx.createBufferSource();
                source.buffer = buffer;
                source.loop = true;
                
                const filter = audioCtx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(200, audioCtx.currentTime);
                
                const lfo = audioCtx.createOscillator();
                const lfoGain = audioCtx.createGain();
                lfo.type = 'sine';
                lfo.frequency.setValueAtTime(0.15, audioCtx.currentTime); // Gust frequency
                lfoGain.gain.setValueAtTime(400, audioCtx.currentTime); // Filter modulation depth
                lfo.connect(lfoGain);
                lfoGain.connect(filter.frequency);
                lfo.start();
                droneLfo = lfo; 
                
                source.connect(filter);
                filter.connect(ambienceGainNode);
                source.start();
                ambienceNode = source;
                
            } else if (selectedAmbience === 'ocean') {
                const buffer = createBrownNoiseBuffer();
                const source = audioCtx.createBufferSource();
                source.buffer = buffer;
                source.loop = true;
                
                const filter = audioCtx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(400, audioCtx.currentTime);
                
                const ampGain = audioCtx.createGain();
                ampGain.gain.setValueAtTime(1.5, audioCtx.currentTime); // High Base volume
                
                const lfo = audioCtx.createOscillator();
                lfo.type = 'sine';
                lfo.frequency.setValueAtTime(0.08, audioCtx.currentTime); // ~12s wave crash cycle
                
                const lfoScale = audioCtx.createGain();
                lfoScale.gain.setValueAtTime(1.5, audioCtx.currentTime); // Modulate amplitude deeply
                lfo.connect(lfoScale);
                lfoScale.connect(ampGain.gain);
                lfo.start();
                droneLfo = lfo;
                
                source.connect(filter);
                filter.connect(ampGain);
                ampGain.connect(ambienceGainNode);
                source.start();
                ambienceNode = source;
                
            } else if (selectedAmbience === 'fire') {
                const buffer = createBrownNoiseBuffer();
                const source = audioCtx.createBufferSource();
                source.buffer = buffer;
                source.loop = true;
                
                const filter = audioCtx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(250, audioCtx.currentTime);
                
                source.connect(filter);
                filter.connect(ambienceGainNode);
                source.start();
                ambienceNode = source;
                
                startFireCrackles();
                
            } else if (selectedAmbience === 'drone') {
                startDroneDrone();
            }
            
            // Schedule the full stop
            ambienceTimeout = setTimeout(() => {
                stopAmbienceAudio();
            }, durationMs + fadeDurationMs);
            
        } catch (e) {
            console.error("Focus ambience swell engine scheduling failure:", e);
        }
    };

    const updateAmbienceAudio = () => {
        if (pomoIsRunning) {
            startAmbienceSwell(1000, 500); // 1.5 seconds total swell on start
        } else {
            stopAmbienceAudio();
        }
    };

    // --- Sound Settings Deck & Popover Controls UI Handlers ---
    const pomoSoundPopover = document.getElementById('pomo-sound-popover');
    const volumeSlider = document.getElementById('pomo-volume-slider');
    const popoverMuteBtn = document.getElementById('popover-mute-btn');
    const ambienceBtns = document.querySelectorAll('.ambience-btn');

    // Populate initial preferences saved in localStorage
    if (volumeSlider) {
        volumeSlider.value = pomoVolume;
    }
    
    if (ambienceBtns) {
        ambienceBtns.forEach(btn => {
            if (btn.getAttribute('data-ambience') === selectedAmbience) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Toggle Popover settings deck open/close
    soundToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (pomoSoundPopover) {
            pomoSoundPopover.classList.toggle('active');
        }
        playSound('click');
    });

    // Clicking inside the popover shouldn't dismiss it
    if (pomoSoundPopover) {
        pomoSoundPopover.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // Dismiss popover when clicking anywhere else on page
    document.addEventListener('click', () => {
        if (pomoSoundPopover && pomoSoundPopover.classList.contains('active')) {
            pomoSoundPopover.classList.remove('active');
        }
    });

    // Slider inputs - update volume gain in real-time
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            pomoVolume = parseInt(e.target.value);
            updateAmbienceVolume();
        });
        
        volumeSlider.addEventListener('change', (e) => {
            pomoVolume = parseInt(e.target.value);
            safeSetItem('aetherlist_volume', pomoVolume);
        });
    }

    // Popover Mute button toggling
    if (popoverMuteBtn) {
        popoverMuteBtn.addEventListener('click', () => {
            isMuted = !isMuted;
            safeSetItem('aetherlist_muted', isMuted);
            updateSoundToggleUI();
            updateAmbienceAudio();
            playSound('click');
        });
    }

    // Option grid selector buttons for ambience
    if (ambienceBtns) {
        ambienceBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetBtn = e.currentTarget;
                selectedAmbience = targetBtn.getAttribute('data-ambience');
                safeSetItem('aetherlist_ambience', selectedAmbience);
                
                // Synchronize active classes
                ambienceBtns.forEach(b => b.classList.remove('active'));
                targetBtn.classList.add('active');
                
                updateAmbienceAudio();
                playSound('click');
            });
        });
    }

    updateSoundToggleUI();

    // Logout Action Handler
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            try {
                localStorage.removeItem('loggedIn');
            } catch (err) {
                console.warn("localStorage.removeItem loggedIn failed:", err);
            }
            showToast("Logging out... 🔒", "info", 1200);
            playSound('click');
            setTimeout(() => {
                window.location.replace('../login/index.html');
            }, 1000);
        });
    }

    // Global click listener removed to silence general UI interactions per user request

    // --- Elegant Toast Notification System ---
    const showToast = (message, type = 'info', duration = 3000, customClass = '') => {
        const toastContainer = document.getElementById('toast-container');
        
        // Remove duplicate theme notifications if applicable
        if (customClass === 'theme-toast') {
            const existingThemeToasts = document.querySelectorAll('.toast.theme-toast');
            existingThemeToasts.forEach(t => t.remove());
        }
        
        // Create Toast Node
        const toast = document.createElement('div');
        toast.className = `toast ${type} ${customClass}`.trim();
        
        // Match Icons
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
        safeHydrateIcons(); // Hydrate Lucide Icons
        
        // Setup Removal transitions after specified duration
        const destroyTimeout = setTimeout(() => {
            removeToast(toast);
        }, duration);
        
        // Dismiss clicking
        toast.addEventListener('click', () => {
            clearTimeout(destroyTimeout);
            removeToast(toast);
        });
    };

    const removeToast = (toast) => {
        if (!toast || !toast.parentNode) return; // Prevent double-deletion calls
        
        toast.classList.add('removing');
        
        // Solid fallback timeout to guarantee deletion from DOM if transition fails
        const forceRemove = () => {
            if (toast.parentNode) {
                toast.remove();
            }
        };
        
        const safetyTimeout = setTimeout(forceRemove, 250); // matches CSS transition duration
        
        toast.addEventListener('transitionend', () => {
            clearTimeout(safetyTimeout);
            forceRemove();
        }, { once: true });
    };

    // --- Satisfying Minimal Sparkle Emitter Physics ---
    const triggerSparkles = (x, y) => {
        const colors = ['#c084fc', '#818cf8', '#f472b6', '#a78bfa', '#fbbf24'];
        const numParticles = 10;
        
        for (let i = 0; i < numParticles; i++) {
            const particle = document.createElement('div');
            particle.className = 'sparkle-particle';
            particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            
            // Random physics trajectory velocities
            const angle = Math.random() * Math.PI * 2;
            const speed = 2.0 + Math.random() * 4.0;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed - 1.2; // upward drift gravity
            
            particle.style.left = `${x}px`;
            particle.style.top = `${y}px`;
            document.body.appendChild(particle);
            
            let posX = x;
            let posY = y;
            let opacity = 1.0;
            let scale = 1.0;
            
            const animate = () => {
                posX += vx;
                posY += vy;
                opacity -= 0.032;
                scale -= 0.028;
                
                if (opacity > 0) {
                    particle.style.transform = `translate3d(${posX - x}px, ${posY - y}px, 0) scale(${Math.max(scale, 0)})`;
                    particle.style.opacity = opacity;
                    requestAnimationFrame(animate);
                } else {
                    particle.remove();
                }
            };
            requestAnimationFrame(animate);
        }
    };

    // --- Theme Controller (Light/Dark Mode) ---
    const initTheme = () => {
        const savedTheme = safeGetItem('aetherlist_theme');
        
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
        }
    };

    const toggleTheme = () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        safeSetItem('aetherlist_theme', newTheme);
        
        // User Friendly Feedback - 1 second brief premium toast
        const themeMessage = newTheme === 'dark' ? "Cosmic Dark Mode active 🌙" : "Aether Light Mode active ☀️";
        showToast(themeMessage, "info", 1000, "theme-toast");
    };

    themeToggle.addEventListener('click', toggleTheme);
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

    // --- Priority Selector Handling ---
    priorityLabels.forEach(label => {
        label.addEventListener('click', () => {
            priorityLabels.forEach(l => l.classList.remove('active'));
            label.classList.add('active');
            const radio = label.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
        });
    });

    // --- Category Selector Handling ---
    const categorySelect = document.getElementById('task-category');
    const customCatInput = document.getElementById('task-category-custom');
    if (categorySelect) {
        categorySelect.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                if (customCatInput) {
                    customCatInput.style.display = 'inline-block';
                    customCatInput.focus();
                }
            } else {
                if (customCatInput) {
                    customCatInput.style.display = 'none';
                    customCatInput.value = '';
                }
            }
        });
    }

    // --- LocalStorage Integration ---
    const loadTasks = () => {
        const localData = safeGetItem('aetherlist_tasks');
        if (localData) {
            try {
                tasks = JSON.parse(localData);
            } catch (e) {
                console.error("Error parsing tasks storage:", e);
                tasks = [];
            }
        }
    };

    const saveTasks = () => {
        safeSetItem('aetherlist_tasks', JSON.stringify(tasks));
    };

    // --- Gamification System Engines ---
    const updateGamificationUI = () => {
        // XP Ratio & Progress Fills
        const userLevelEl = document.getElementById('user-level');
        const userXpRatioEl = document.getElementById('user-xp-ratio');
        const xpProgressFill = document.getElementById('xp-progress-fill');
        const streakCountEl = document.getElementById('streak-count');
        const streakBadge = document.getElementById('streak-badge');
        
        if (userLevelEl) userLevelEl.textContent = level;
        
        const nextLevelXp = level * 100;
        if (userXpRatioEl) userXpRatioEl.textContent = `${xp} / ${nextLevelXp} XP`;
        if (xpProgressFill) xpProgressFill.style.width = `${(xp / nextLevelXp) * 100}%`;
        
        if (streakCountEl) streakCountEl.textContent = streakCount;
        if (streakBadge) {
            if (streakCount > 0) {
                streakBadge.style.opacity = '1';
                streakBadge.style.transform = 'scale(1)';
            } else {
                streakBadge.style.opacity = '0.35';
                streakBadge.style.transform = 'scale(0.95)';
            }
        }

        // Update Compact Strip Gamification Metrics
        const compactLevel = document.getElementById('compact-level');
        const compactStreak = document.getElementById('compact-streak');
        if (compactLevel) {
            compactLevel.textContent = `Lvl ${level}`;
        }
        if (compactStreak) {
            compactStreak.textContent = `🔥 ${streakCount}`;
        }

        // Hydrate badging classes based on unlocks array
        const badgeList = ['slayer', 'streak3', 'pomo1', 'beast', 'streak7', 'centurion'];
        badgeList.forEach(bId => {
            const el = document.getElementById(`badge-${bId}`);
            if (el) {
                if (unlockedBadges.includes(bId)) {
                    el.classList.remove('locked');
                } else {
                    el.classList.add('locked');
                }
            }
        });
    };

    const gainXP = (amount) => {
        xp += amount;
        const nextLevelXp = level * 100;
        if (xp >= nextLevelXp) {
            xp -= nextLevelXp;
            level += 1;
            showToast(`LEVEL UP! You are now Level ${level}! 🎉`, "success", 4000);
            triggerSparkles(window.innerWidth / 2, window.innerHeight / 2);
        }
        safeSetItem('aetherlist_xp', xp);
        safeSetItem('aetherlist_level', level);
        updateGamificationUI();
        checkAchievements();
    };

    const loseXP = (amount) => {
        xp -= amount;
        while (xp < 0 && level > 1) {
            level -= 1;
            xp += level * 100;
        }
        if (xp < 0) {
            xp = 0;
        }
        safeSetItem('aetherlist_xp', xp);
        safeSetItem('aetherlist_level', level);
        updateGamificationUI();
    };

    const getLocalDateString = (date) => {
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
    };

    const checkAndUpdateStreak = () => {
        const todayStr = getLocalDateString(new Date());
        
        if (lastStreakDate === todayStr) {
            // Already completed an item today. Preserved.
            return;
        }
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = getLocalDateString(yesterday);
        
        if (lastStreakDate === yesterdayStr) {
            streakCount += 1;
            showToast(`Streak continues! 🔥 ${streakCount} Day Streak!`, "success", 3200);
        } else {
            streakCount = 1;
            showToast("New productivity streak started! 🔥", "success", 3200);
        }
        
        lastStreakDate = todayStr;
        safeSetItem('aetherlist_streak_count', streakCount);
        safeSetItem('aetherlist_last_streak_date', lastStreakDate);
        
        updateGamificationUI();
        checkAchievements();
    };

    const initStreakCheck = () => {
        if (!lastStreakDate) {
            streakCount = 0;
            safeSetItem('aetherlist_streak_count', 0);
            updateGamificationUI();
            return;
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        
        const lastDate = new Date(lastStreakDate + 'T00:00:00');
        
        if (lastDate < yesterday) {
            if (streakCount > 0) {
                showToast(`Productivity streak reset. Let's start fresh today! ✨`, "info", 4000);
                streakCount = 0;
                safeSetItem('aetherlist_streak_count', 0);
                updateGamificationUI();
            }
        }
    };

    const checkAchievements = () => {
        const totalCompleted = tasks.filter(t => t.completed).length;
        let newUnlocks = false;
        
        const unlock = (badgeId, badgeName) => {
            if (!unlockedBadges.includes(badgeId)) {
                unlockedBadges.push(badgeId);
                safeSetItem('aetherlist_unlocked_badges', JSON.stringify(unlockedBadges));
                showToast(`Achievement Unlocked: ${badgeName}! 🏆`, "success", 4500);
                triggerSparkles(window.innerWidth / 2, window.innerHeight / 2);
                newUnlocks = true;
            }
        };
        
        // 1. Task Slayer
        if (totalCompleted >= 1) unlock('slayer', 'Task Slayer');
        
        // 2. Consistency King
        if (streakCount >= 3) unlock('streak3', 'Consistency King');
        
        // 3. Focus Master
        const completedPomos = parseInt(safeGetItem('aetherlist_completed_pomos', '0')) || 0;
        if (completedPomos >= 1) unlock('pomo1', 'Focus Master');
        
        // 4. Productivity Beast
        if (totalCompleted >= 10) unlock('beast', 'Productivity Beast');
        
        // 5. Consistency Overlord
        if (streakCount >= 7) unlock('streak7', 'Consistency Overlord');
        
        // 6. Centurion Slayer
        if (totalCompleted >= 100) unlock('centurion', 'Centurion Slayer');
        
        if (newUnlocks) {
            updateGamificationUI();
        }
    };

    // --- Unified Pomodoro State Machine Loop ---
    const updatePomodoroUI = () => {
        const minutes = Math.floor(pomoSecondsRemaining / 60);
        const seconds = pomoSecondsRemaining % 60;
        const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Update document title for background productivity
        document.title = pomoIsRunning ? `[${timeStr}] AetherList` : "AetherList // Gamified Focus & Productivity Platform";
        
        // Update both Widget and Fullscreen displays
        if (pomoTimeDisplay) pomoTimeDisplay.textContent = timeStr;
        if (focusTimerCountdown) focusTimerCountdown.textContent = timeStr;
        
        // Update Compact timer display
        const compactPomoTime = document.getElementById('compact-pomo-time');
        if (compactPomoTime) {
            compactPomoTime.textContent = timeStr;
        }
        
        const ratio = pomoOriginalDuration > 0 ? (pomoSecondsRemaining / pomoOriginalDuration) : 0;
        
        // Update circular ring metrics (Widget radius=30, circ=188.5; Focus radius=95, circ=596.9)
        if (pomoRingBar) {
            const offset = 188.5 * (1 - ratio);
            pomoRingBar.style.strokeDashoffset = offset;
        }
        
        if (focusTimerBar) {
            const offset = 596.9 * (1 - ratio);
            focusTimerBar.style.strokeDashoffset = offset;
        }
        
        const modeText = pomoMode === 'focus' ? 'Focus' : 'Break';
        if (pomoModeLabel) pomoModeLabel.textContent = modeText;
        if (focusTimerStatus) focusTimerStatus.textContent = pomoMode === 'focus' ? 'Focus Mode' : 'Break Mode';
        
        const compactPomoMode = document.getElementById('compact-pomo-mode');
        if (compactPomoMode) {
            compactPomoMode.textContent = modeText;
        }
        
        const playIcon = pomoIsRunning ? 'pause' : 'play';
        pomoPlayBtn.innerHTML = `<i data-lucide="${playIcon}"></i>`;
        focusPlayBtn.innerHTML = `<i data-lucide="${playIcon}"></i>`;
        
        const compactPomoPlay = document.getElementById('compact-pomo-play');
        if (compactPomoPlay) {
            compactPomoPlay.innerHTML = `<i data-lucide="${playIcon}"></i>`;
        }
        
        // Update active session visual glow
        const pomoWidget = document.getElementById('pomodoro-panel-widget');
        if (pomoWidget) {
            if (pomoIsRunning) {
                pomoWidget.classList.add('session-active');
            } else {
                pomoWidget.classList.remove('session-active');
            }
        }
        
        safeHydrateIcons();
    };

    const startPausePomodoro = () => {
        unlockAudioContext();
        playSound('click');
        if (pomoIsRunning) {
            // Pause State
            pomoIsRunning = false;
            clearInterval(pomoTimer);
            pomoTimer = null;
            updatePomodoroUI();
            updateAmbienceAudio();
            showToast("Session paused", "info");
        } else {
            // Active Ticking State
            pomoIsRunning = true;
            pomoTimer = setInterval(() => {
                if (pomoSecondsRemaining > 0) {
                    pomoSecondsRemaining -= 1;
                    updatePomodoroUI();
                } else {
                    // Completed current cycle session
                    clearInterval(pomoTimer);
                    pomoTimer = null;
                    pomoIsRunning = false;
                    
                    updateAmbienceAudio();
                    playSound('alarm');
                    startAmbienceSwell(2000, 500);
                    
                    if (pomoMode === 'focus') {
                        let completedPomos = parseInt(safeGetItem('aetherlist_completed_pomos', '0')) || 0;
                        completedPomos += 1;
                        safeSetItem('aetherlist_completed_pomos', completedPomos);
                        
                        showToast("Focus session complete! Take a break 🌸 (+20 XP)", "success", 5000);
                        gainXP(20);
                        
                        pomoMode = 'break';
                        pomoSecondsRemaining = 5 * 60;
                    } else {
                        showToast("Break over! Ready to focus? ⚡", "info", 5000);
                        pomoMode = 'focus';
                        pomoSecondsRemaining = userPomoDuration * 60;
                    }
                    
                    pomoOriginalDuration = pomoSecondsRemaining;
                    updatePomodoroUI();
                }
            }, 1000);
            updatePomodoroUI();
            updateAmbienceAudio();
            showToast(pomoMode === 'focus' ? "Focus session started 🎯" : "Break session started 🌸", "success");
        }
    };

    const resetPomodoro = () => {
        playSound('click');
        pomoIsRunning = false;
        if (pomoTimer) {
            clearInterval(pomoTimer);
            pomoTimer = null;
        }
        updateAmbienceAudio();
        pomoMode = 'focus';
        pomoSecondsRemaining = userPomoDuration * 60;
        pomoOriginalDuration = pomoSecondsRemaining;
        updatePomodoroUI();
        showToast("Pomodoro timer reset", "info");
    };

    pomoPlayBtn.addEventListener('click', startPausePomodoro);
    pomoResetBtn.addEventListener('click', resetPomodoro);
    focusPlayBtn.addEventListener('click', startPausePomodoro);
    focusResetBtn.addEventListener('click', resetPomodoro);

    if (setTimerBtn && durationSelector) {
        setTimerBtn.addEventListener('click', () => {
            if (durationSelector.style.display === 'none') {
                durationSelector.style.display = 'flex';
                setTimerBtn.classList.add('active');
            } else {
                durationSelector.style.display = 'none';
                setTimerBtn.classList.remove('active');
            }
        });
    }

    // --- Pomodoro Duration Logic ---
    const updateDurationSelection = (duration) => {
        if (duration < 1 || duration > 180 || isNaN(duration)) return;
        userPomoDuration = duration;
        safeSetItem('aetherlist_pomo_duration', duration);
        
        const isPreset = Array.from(durationDropdown.options).some(opt => parseInt(opt.value) === duration);
        if (isPreset) {
            durationDropdown.value = duration;
            customDurationContainer.style.display = 'none';
        } else {
            durationDropdown.value = 'custom';
            customDurationContainer.style.display = 'flex';
            customDurationInput.value = duration;
        }
        
        // Reset timer if running or not
        resetPomodoro();
    };

    if (durationDropdown) {
        durationDropdown.addEventListener('change', (e) => {
            if (e.target.value === '') {
                return;
            } else if (e.target.value === 'custom') {
                customDurationContainer.style.display = 'flex';
                customDurationInput.focus();
            } else {
                customDurationContainer.style.display = 'none';
                const min = parseInt(e.target.value);
                updateDurationSelection(min);
            }
        });
    }

    if (customDurationInput) {
        customDurationInput.addEventListener('change', (e) => {
            let val = parseInt(e.target.value);
            if (isNaN(val) || val < 1) val = 1;
            if (val > 180) val = 180;
            e.target.value = val;
            updateDurationSelection(val);
        });
    }

    // Initialize UI state based on saved duration without triggering extra toasts
    // (Intentionally not auto-selecting in dropdown so it stays on 'Select...')

    // --- Immersive Focus Mode Fullscreen Workspace Overlay Layer ---
    const openFocusMode = (taskId) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        
        activeFocusTaskId = taskId;
        focusTaskTitle.textContent = task.text;
        
        if (task.category) {
            focusTaskCategory.textContent = task.category.toUpperCase();
            focusTaskCategory.className = `cat-tag ${task.category}`;
            focusTaskCategory.style.display = 'inline-block';
        } else {
            focusTaskCategory.style.display = 'none';
        }
        
        focusOverlay.classList.add('active');
        
        // Auto start focus session if not already ticking
        if (!pomoIsRunning && pomoMode === 'focus') {
            startPausePomodoro();
        }
        
        showToast("Entering immersive Focus Mode. Block out all distractions. 🧘", "info", 4000);
    };

    const closeFocusMode = () => {
        focusOverlay.classList.remove('active');
        activeFocusTaskId = null;
        showToast("Exited Focus Mode", "info");
    };

    exitFocusBtn.addEventListener('click', closeFocusMode);

    focusCompleteBtn.addEventListener('click', () => {
        if (activeFocusTaskId) {
            const taskItem = document.querySelector(`.task-item[data-id="${activeFocusTaskId}"]`);
            toggleTaskComplete(activeFocusTaskId, taskItem);
            closeFocusMode();
        }
    });

    // --- Collapsible Achievements Trophies section ---
    achievementsToggleHeader.addEventListener('click', () => {
        const isCollapsed = achievementsGridWrapper.classList.contains('collapsed');
        if (isCollapsed) {
            achievementsGridWrapper.classList.remove('collapsed');
            achievementsToggleHeader.classList.add('active-chevron');
        } else {
            achievementsGridWrapper.classList.add('collapsed');
            achievementsToggleHeader.classList.remove('active-chevron');
        }
    });

    // --- Smooth Counting Percentage Animation ---
    const animatePercentageText = (target) => {
        const start = lastPercentage;
        const duration = 600; // Milliseconds
        let startTime = null;
        
        const step = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            // Cubic Easing Out
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(start + easeProgress * (target - start));
            
            progressPercentage.textContent = `${current}%`;
            
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                lastPercentage = target;
            }
        };
        window.requestAnimationFrame(step);
    };

    // --- Dynamic Motivational Engine with Rotating Slogans ---
    const activeQuotes = [
        "Momentum is building 🔥",
        "One task closer to greatness ✨",
        "You’re doing amazing 🚀",
        "Progress is progress, keep going! 💫",
        "Stay focused, stay clear ⚡",
        "A little closer to goals every tick 🎯"
    ];

    const updateMotivation = (total, completed) => {
        if (total === 0) {
            progressMotivation.textContent = "No tasks yet. Organize your chaos ✨";
            return;
        }
        
        const percentage = Math.round((completed / total) * 100);
        
        if (percentage === 0) {
            progressMotivation.textContent = "All focus items are pending. Make a start! 🚀";
        } else if (percentage === 100) {
            progressMotivation.textContent = "Outstanding! Absolute clarity achieved 🏆";
        } else {
            // Pick a random motivational slogan to cycle through
            let index = Math.floor(Math.random() * activeQuotes.length);
            while (index === lastQuoteIndex) {
                index = Math.floor(Math.random() * activeQuotes.length);
            }
            lastQuoteIndex = index;
            progressMotivation.textContent = activeQuotes[index];
        }
    };

    // --- Premium Data Visualization: Weekly Activity Trend ---
    const renderWeeklyChart = () => {
        const now = new Date();
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        
        const completedInLast7Days = tasks.filter(task => {
            if (!task.completed) return false;
            const completedAt = task.completedAt || task.createdAt; // robust fallback
            return completedAt >= sevenDaysAgo;
        });

        // Count completions per day of the week
        const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        completedInLast7Days.forEach(task => {
            const completedAt = task.completedAt || task.createdAt;
            const day = new Date(completedAt).getDay();
            counts[day] = (counts[day] || 0) + 1;
        });

        const maxCount = Math.max(...Object.values(counts), 1);

        const dayMapping = {
            0: 'bar-sun',
            1: 'bar-mon',
            2: 'bar-tue',
            3: 'bar-wed',
            4: 'bar-thu',
            5: 'bar-fri',
            6: 'bar-sat'
        };

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        Object.keys(dayMapping).forEach(dayNum => {
            const barId = dayMapping[dayNum];
            const barEl = document.getElementById(barId);
            if (barEl) {
                const count = counts[dayNum] || 0;
                const percentageHeight = (count / maxCount) * 100;
                barEl.style.height = `${percentageHeight}%`;
                
                // Update the parent's title for hover description
                const parentEl = barEl.closest('.chart-bar-wrapper');
                if (parentEl) {
                    parentEl.title = `${dayNames[dayNum]}: ${count} task${count === 1 ? '' : 's'} completed`;
                }
            }
        });
    };

    // --- UI Stats Engine & Progress Display ---
    const updateStats = () => {
        const total = tasks.length;
        const completed = tasks.filter(t => t.completed).length;
        const pending = total - completed;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        // Update raw numbers
        statTotal.textContent = total;
        statPending.textContent = pending;
        statCompleted.textContent = completed;
        
        // Trigger smooth counting percentage text
        animatePercentageText(completionRate);

        // Update Circular Dial (Circumference ~ 232.48)
        const circumference = 232.48;
        const strokeOffset = circumference - (completionRate / 100) * circumference;
        progressRingBar.style.strokeDashoffset = strokeOffset;

        // Update Mobile Horizontal Progress Bar
        horizontalProgress.style.width = `${completionRate}%`;

        // Update Motivation subtitler
        updateMotivation(total, completed);

        // Update Compact Strip percentage and progress bar
        const compactPercentage = document.getElementById('compact-percentage');
        if (compactPercentage) {
            compactPercentage.textContent = `${completionRate}%`;
        }

        const compactProgressBar = document.getElementById('compact-progress-bar');
        if (compactProgressBar) {
            const miniCircumference = 62.83;
            const miniOffset = miniCircumference - (completionRate / 100) * miniCircumference;
            compactProgressBar.style.strokeDashoffset = miniOffset;
        }

        // Render Weekly Focus Analytics Chart
        renderWeeklyChart();
    };

    // --- HTML Helper: Clean escaping to prevent XSS ---
    const escapeHTML = (text) => {
        const div = document.createElement('div');
        div.innerText = text;
        return div.innerHTML;
    };

    // Format local due date display
    const formatDateDisplay = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr + 'T00:00:00'); // avoid timezone shifts
        const options = { month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    };

    // Determine overdue task state
    const isOverdue = (dateStr) => {
        if (!dateStr) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(dateStr + 'T00:00:00');
        return due < today;
    };

    // --- Core Task List Renderer ---
    const renderList = () => {
        taskList.innerHTML = '';
        
        const query = searchInput.value.toLowerCase().trim();

        // Apply filters & search query
        const filteredTasks = tasks.filter(task => {
            // Apply status filter
            if (currentFilter === 'pending' && task.completed) return false;
            if (currentFilter === 'completed' && !task.completed) return false;
            
            // Apply search matching
            if (query) {
                const textMatch = task.text.toLowerCase().includes(query);
                const catMatch = task.category ? task.category.toLowerCase().includes(query) : false;
                return textMatch || catMatch;
            }
            
            return true;
        });

        // Toggle Empty State UI
        if (filteredTasks.length === 0) {
            emptyState.style.display = 'flex';
            taskList.style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            taskList.style.display = 'flex';
        }

        // Generate Task Cards
        filteredTasks.forEach(task => {
            const taskItem = document.createElement('li');
            taskItem.className = `task-item ${task.completed ? 'completed' : ''}`;
            taskItem.dataset.id = task.id;

            taskItem.innerHTML = `
                <div class="task-left">
                    <label class="checkbox-container" aria-label="Toggle completed task">
                        <input type="checkbox" ${task.completed ? 'checked' : ''}>
                        <span class="checkmark"></span>
                    </label>
                    <div style="display: flex; flex-direction: column; gap: 0.22rem; min-width: 0; flex: 1;">
                        <div class="task-title-flex" style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; min-width: 0;">
                            <span class="task-content" title="Double click to edit">${escapeHTML(task.text)}</span>
                            ${task.category ? `<span class="cat-tag ${task.category}">${task.category.toUpperCase()}</span>` : ''}
                        </div>
                        ${task.dueDate ? `<div style="display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center;"><span class="date-tag ${task.completed ? 'upcoming' : (isOverdue(task.dueDate) ? 'overdue' : 'upcoming')}"><i data-lucide="calendar"></i> ${formatDateDisplay(task.dueDate)}</span></div>` : ''}
                    </div>
                </div>
                <div class="task-right">
                    <span class="prio-badge ${task.priority}">${task.priority}</span>
                    ${!task.completed ? `
                    <button class="action-btn focus" aria-label="Focus mode">
                        <i data-lucide="play"></i>
                    </button>` : ''}
                    <button class="action-btn edit" aria-label="Edit task">
                        <i data-lucide="edit-3"></i>
                    </button>
                    <button class="action-btn delete" aria-label="Delete task">
                        <i data-lucide="trash"></i>
                    </button>
                </div>
            `;

            // Setup HTML5 Draggable events for sorting reorder
            taskItem.setAttribute('draggable', 'true');
            
            taskItem.addEventListener('dragstart', (e) => {
                taskItem.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', task.id);
            });
            
            taskItem.addEventListener('dragend', () => {
                taskItem.classList.remove('dragging');
                document.querySelectorAll('.task-item').forEach(item => {
                    item.classList.remove('drag-over');
                });
            });
            
            taskItem.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const draggingItem = document.querySelector('.task-item.dragging');
                if (draggingItem && draggingItem !== taskItem) {
                    taskItem.classList.add('drag-over');
                }
            });
            
            taskItem.addEventListener('dragleave', () => {
                taskItem.classList.remove('drag-over');
            });
            
            taskItem.addEventListener('drop', (e) => {
                e.preventDefault();
                taskItem.classList.remove('drag-over');
                const draggedId = e.dataTransfer.getData('text/plain');
                if (draggedId && draggedId !== task.id) {
                    reorderTasks(draggedId, task.id);
                }
            });

            // Setup Interactive Task Card Action Listeners
            const checkbox = taskItem.querySelector('input[type="checkbox"]');
            const checkmarkSpan = taskItem.querySelector('.checkmark');
            const taskTextNode = taskItem.querySelector('.task-content');
            const focusBtn = taskItem.querySelector('.action-btn.focus');
            const editBtn = taskItem.querySelector('.action-btn.edit');
            const deleteBtn = taskItem.querySelector('.action-btn.delete');

            // 1. Completion Toggle with Sparkle Physics
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    const rect = checkmarkSpan.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2 + window.scrollX;
                    const centerY = rect.top + rect.height / 2 + window.scrollY;
                    triggerSparkles(centerX, centerY);
                }
                toggleTaskComplete(task.id, taskItem);
            });

            // 2. Double-Click to Edit
            taskTextNode.addEventListener('dblclick', () => {
                if (!task.completed) openEditModal(task.id);
            });

            // 3. Focus Button click
            if (focusBtn) {
                focusBtn.addEventListener('click', () => openFocusMode(task.id));
            }

            // 4. Edit Button click
            editBtn.addEventListener('click', () => openEditModal(task.id));

            // 5. Delete Action
            deleteBtn.addEventListener('click', () => deleteTask(task.id, taskItem));

            taskList.appendChild(taskItem);
        });

        // Parse Lucide Icons
        safeHydrateIcons();
    };

    // --- Task Reordering Sort logic ---
    const reorderTasks = (draggedId, targetId) => {
        const draggedIdx = tasks.findIndex(t => t.id === draggedId);
        const targetIdx = tasks.findIndex(t => t.id === targetId);
        
        if (draggedIdx !== -1 && targetIdx !== -1) {
            // Splice array reorder
            const [draggedTask] = tasks.splice(draggedIdx, 1);
            tasks.splice(targetIdx, 0, draggedTask);
            
            saveTasks();
            renderList();
            showToast("Tasks reordered successfully ✨", "success");
        }
    };

    // --- Task CRUD Modules & State Updates ---

    // A. Add Task
    todoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const text = taskInput.value.trim();
        
        // Haptic shake validation on invalid submissions
        if (!text) {
            inputContainerBox.classList.add('shake');
            inputContainerBox.addEventListener('animationend', () => {
                inputContainerBox.classList.remove('shake');
            }, { once: true });
            
            showToast("Focus item cannot be blank", "danger");
            return;
        }

        // Selected Priority
        const selectedPriorityInput = document.querySelector('input[name="priority"]:checked');
        const priority = selectedPriorityInput ? selectedPriorityInput.value : 'low';

        // Selected Category
        const categorySelect = document.getElementById('task-category');
        const customCatInput = document.getElementById('task-category-custom');
        let category = categorySelect ? categorySelect.value : 'work';
        if (category === 'custom') {
            const customVal = customCatInput ? customCatInput.value.trim() : '';
            category = customVal ? customVal.toLowerCase() : 'custom';
        }
        
        // Selected Due Date
        const dueDateInput = document.getElementById('task-duedate');
        const dueDate = dueDateInput ? dueDateInput.value : '';

        const newTask = {
            id: Date.now().toString(),
            text: text,
            completed: false,
            priority: priority,
            category: category,
            dueDate: dueDate,
            createdAt: Date.now()
        };

        // Update list & trigger render
        tasks.push(newTask);
        saveTasks();
        updateStats();

        // Feed user toast notification
        showToast("Task added successfully ✨", "success");

        // Switch to "all" filter if completed is active
        if (currentFilter === 'completed') {
            switchFilter('all');
        } else {
            renderList();
        }

        // Clean input & reset defaults
        taskInput.value = '';
        if (dueDateInput) dueDateInput.value = '';
        if (categorySelect) categorySelect.value = 'work';
        if (customCatInput) {
            customCatInput.value = '';
            customCatInput.style.display = 'none';
        }
        
        // Reset active priority labels back to low
        priorityLabels.forEach(l => l.classList.remove('active'));
        const lowPrioLabel = document.querySelector('.priority-label.low');
        if (lowPrioLabel) {
            lowPrioLabel.classList.add('active');
            const lowRadio = lowPrioLabel.querySelector('input');
            if (lowRadio) lowRadio.checked = true;
        }

        taskInput.focus();
    });

    // B. Toggle Completion
    const toggleTaskComplete = (id, element) => {
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            task.completedAt = task.completed ? Date.now() : null;
            saveTasks();
            
            // Toggle visual class safely
            if (task.completed) {
                if (element) element.classList.add('completed');
                showToast("Task completed! Keep it up 🚀", "success");
                
                // Gain XP and update streaks
                gainXP(10);
                checkAndUpdateStreak();
            } else {
                if (element) element.classList.remove('completed');
                showToast("Task set back to pending", "info");
                
                // Deduct XP
                loseXP(10);
            }
            
            updateStats();
            
            // Delay rendering slightly if filter forces it off-screen to let check animations complete
            setTimeout(() => {
                if (currentFilter !== 'all') {
                    renderList();
                } else {
                    renderList(); // Refresh focus buttons and overdue states
                }
            }, 350);
        }
    };

    // C. Task Deletion
    const deleteTask = (id, element) => {
        element.classList.add('removing');

        // Cleanup state after collapse animation completes
        element.addEventListener('animationend', (e) => {
            if (e.animationName === 'fadeOutScale') {
                tasks = tasks.filter(t => t.id !== id);
                saveTasks();
                updateStats();
                renderList();
                
                showToast("Task deleted", "danger");
            }
        });
    };

    // D. Clear All Completed Tasks
    clearCompletedBtn.addEventListener('click', () => {
        const completedCount = tasks.filter(t => t.completed).length;
        if (completedCount === 0) {
            showToast("No completed tasks to clear", "info");
            return;
        }

        const confirmClear = confirm(`Clear all ${completedCount} completed task(s)? ✨`);
        if (confirmClear) {
            tasks = tasks.filter(t => !t.completed);
            saveTasks();
            updateStats();
            renderList();
            showToast("Completed tasks cleared", "danger");
        }
    });

    // --- Real-time Search input binding ---
    searchInput.addEventListener('input', () => {
        renderList();
    });

    // --- Premium Glassmorphic Edit Modal Actions ---
    const openEditModal = (id) => {
        const task = tasks.find(t => t.id === id);
        if (!task) return;
        
        if (task.completed) {
            showToast("Completed tasks cannot be edited", "info");
            return;
        }

        activeEditingTaskId = id;
        editTaskInput.value = task.text;
        editModal.classList.add('active');
        
        setTimeout(() => {
            editTaskInput.focus();
            editTaskInput.select();
        }, 120);
    };

    const closeEditModal = () => {
        editModal.classList.remove('active');
        activeEditingTaskId = null;
    };

    const saveModalChanges = () => {
        if (!activeEditingTaskId) return;

        const newText = editTaskInput.value.trim();
        
        if (!newText) {
            editTaskInput.classList.add('shake');
            editTaskInput.addEventListener('animationend', () => {
                editTaskInput.classList.remove('shake');
            }, { once: true });
            
            showToast("Task focus cannot be empty", "danger");
            return;
        }

        const task = tasks.find(t => t.id === activeEditingTaskId);
        if (task) {
            if (task.text !== newText) {
                task.text = newText;
                saveTasks();
                renderList();
                showToast("Changes saved successfully", "success");
            }
            closeEditModal();
        }
    };

    modalCloseBtn.addEventListener('click', closeEditModal);
    modalCancelBtn.addEventListener('click', closeEditModal);
    modalSaveBtn.addEventListener('click', saveModalChanges);
    
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) {
            closeEditModal();
        }
    });

    editTaskInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveModalChanges();
        } else if (e.key === 'Escape') {
            closeEditModal();
        }
    });

    // --- Filter Switching Engine ---
    const switchFilter = (filter) => {
        currentFilter = filter;
        
        filterButtons.forEach(btn => {
            if (btn.dataset.filter === filter) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        renderList();
        updateFilterPill();
    };

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            switchFilter(btn.dataset.filter);
        });
    });

    // --- Compact Mode Toggle Logic ---
    const initCompactMode = () => {
        const isCompact = safeGetItem('aetherlist_compact_mode') === 'true';
        const grid = document.getElementById('stats-dashboard-grid');
        const strip = document.getElementById('compact-dashboard-strip');
        const icon = document.getElementById('compact-toggle-icon');
        const text = document.getElementById('compact-toggle-text');

        if (isCompact) {
            grid?.classList.add('collapsed');
            strip?.classList.remove('collapsed');
            if (text) text.textContent = "Full View";
            if (icon) {
                icon.setAttribute('data-lucide', 'maximize-2');
            }
        } else {
            grid?.classList.remove('collapsed');
            strip?.classList.add('collapsed');
            if (text) text.textContent = "Compact View";
            if (icon) {
                icon.setAttribute('data-lucide', 'minimize-2');
            }
        }
        safeHydrateIcons();
    };

    const toggleCompactMode = () => {
        const grid = document.getElementById('stats-dashboard-grid');
        const strip = document.getElementById('compact-dashboard-strip');
        const icon = document.getElementById('compact-toggle-icon');
        const text = document.getElementById('compact-toggle-text');

        const isCurrentlyCompact = grid?.classList.contains('collapsed');

        if (isCurrentlyCompact) {
            grid?.classList.remove('collapsed');
            strip?.classList.add('collapsed');
            if (text) text.textContent = "Compact View";
            if (icon) icon.setAttribute('data-lucide', 'minimize-2');
            safeSetItem('aetherlist_compact_mode', 'false');
            showToast("Switched to Full Dashboard View 🖥️", "info");
        } else {
            grid?.classList.add('collapsed');
            strip?.classList.remove('collapsed');
            if (text) text.textContent = "Full View";
            if (icon) icon.setAttribute('data-lucide', 'maximize-2');
            safeSetItem('aetherlist_compact_mode', 'true');
            showToast("Switched to Collapsed Compact View 📱", "info");
        }
        safeHydrateIcons();
    };

    const compactBtn = document.getElementById('dashboard-compact-btn');
    if (compactBtn) {
        compactBtn.addEventListener('click', toggleCompactMode);
    }

    const compactPomoPlay = document.getElementById('compact-pomo-play');
    if (compactPomoPlay) {
        compactPomoPlay.addEventListener('click', startPausePomodoro);
    }

    const initPomodoro = () => {
        if (durationDropdown) {
            const isPreset = Array.from(durationDropdown.options).some(opt => parseInt(opt.value) === userPomoDuration);
            if (isPreset) {
                durationDropdown.value = userPomoDuration;
                if (customDurationContainer) customDurationContainer.style.display = 'none';
            } else {
                durationDropdown.value = 'custom';
                if (customDurationContainer) {
                    customDurationContainer.style.display = 'flex';
                }
                if (customDurationInput) {
                    customDurationInput.value = userPomoDuration;
                }
            }
        }
        updatePomodoroUI();
    };

    // --- Startup Initialization and Auditing ---
    loadTasks();
    initStreakCheck();
    updateStats();
    updateGamificationUI();
    initPomodoro();
    initCompactMode();
    renderList();
    
    // Set initial filter active pill translation position
    setTimeout(updateFilterPill, 80);

    // Allow theme transitions after page load
    setTimeout(() => {
        document.documentElement.classList.remove('no-transition');
    }, 100);
});
