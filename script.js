// --- Contributors Toggle Logic ---
const toggleBtn = document.getElementById('toggle-contributors');
const contributorsList = document.getElementById('contributors-list');
const toggleText = document.getElementById('toggle-text');
const toggleIcon = document.getElementById('toggle-icon');

if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
        contributorsList.classList.toggle('hidden-contributors');
        if (contributorsList.classList.contains('hidden-contributors')) {
            toggleText.innerText = 'Show Contributors';
            toggleIcon.innerText = '﹀';
        } else {
            toggleText.innerText = 'Hide Contributors';
            toggleIcon.innerText = '︿';
        }
    });
}

// --- Theme and Tab Switching ---
const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => {
    const currentTheme = document.body.getAttribute('data-theme');
    document.body.setAttribute('data-theme', currentTheme === 'dark' ? 'light' : 'dark');
});

function switchTab(tabId) {
    // Hide all contents and remove active states
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    // Show the selected content
    document.getElementById(tabId).classList.add('active');
    
    // Safely highlight the clicked tab button
    const activeButton = document.querySelector(`button[onclick*="${tabId}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
}

// --- Physics Constants and State ---
const TRUE_ETA = 80e9; // 80 GPa for steel baseline
const I_CRADLE = 0.002; 

let isSimulating = false;
let chartInstance = null;
window.expData = {};

// Track the number of clicks/trials for each phase
let trials = { cradle: 0, both: 0 };
let rawTimes = { cradle: [], both: [] };

// DOM Elements
const sliders = {
    l: document.getElementById('slider-l'),
    r: document.getElementById('slider-r'),
    M: document.getElementById('slider-m'),
    Lcyl: document.getElementById('slider-Lcyl'),
    Rcyl: document.getElementById('slider-Rcyl')
};
const vals = {
    l: document.getElementById('val-l'),
    r: document.getElementById('val-r'),
    M: document.getElementById('val-m'),
    Lcyl: document.getElementById('val-Lcyl'),
    Rcyl: document.getElementById('val-Rcyl')
};

Object.keys(sliders).forEach(key => {
    sliders[key].addEventListener('input', (e) => {
        vals[key].innerText = e.target.value;
        resetExperiment(); 
    });
});

function calculatePhysics() {
    // Convert cm to meters, mm to meters
    const l = parseFloat(sliders.l.value) / 100; 
    const r = parseFloat(sliders.r.value) * 1e-3; 
    const M = parseFloat(sliders.M.value); 
    const Lcyl = parseFloat(sliders.Lcyl.value) / 100; 
    const Rcyl = parseFloat(sliders.Rcyl.value) / 100; 

    const I1 = M * ((Math.pow(Lcyl, 2) / 12) + (Math.pow(Rcyl, 2) / 4));
    const C = (Math.PI * TRUE_ETA * Math.pow(r, 4)) / (2 * l);
    const T0 = 2 * Math.PI * Math.sqrt(I_CRADLE / C);
    const T1 = 2 * Math.PI * Math.sqrt((I_CRADLE + I1) / C);

    return { l, r, M, Lcyl, Rcyl, I1, T0, T1 };
}

function runSimulation(mode) {
    if (isSimulating || trials[mode] >= 3) return;
    
    isSimulating = true;
    const currentTrial = trials[mode] + 1;
    document.getElementById('sim-status').innerText = `Oscillating (${mode === 'cradle' ? 'Cradle Only' : 'Both'} - Trial ${currentTrial}/3)...`;
    
    const physics = calculatePhysics();
    const period = mode === 'cradle' ? physics.T0 : physics.T1;
    
    const cylinderDOM = document.getElementById('cylinder');
    if (mode === 'both') cylinderDOM.classList.remove('hidden');

    let startTime = null;
    const duration = 2000; 
    const frequency = 1 / (period / 10); 
    
    function animate(time) {
        if (!startTime) startTime = time;
        const elapsed = time - startTime;
        
        // 180 degrees for maximum visual torsional effect
        const angle = 180 * Math.cos(2 * Math.PI * frequency * (elapsed / 1000)) * Math.exp(-elapsed / 2000);
        document.getElementById('cradle').style.transform = `rotateY(${angle}deg)`;
        cylinderDOM.style.transform = `rotateY(${angle}deg)`;

        if (elapsed < duration) {
            requestAnimationFrame(animate);
        } else {
            finishSimulation(mode, physics, period);
        }
    }
    requestAnimationFrame(animate);
}

function finishSimulation(mode, physics, period) {
    isSimulating = false;
    
    // Generate 1 trial with experimental noise
    const singleTrialTime = (period * 30) + (Math.random() * 0.4 - 0.2);
    
    // Save data and increment trial counter
    rawTimes[mode].push(singleTrialTime);
    trials[mode]++;
    
    const prefix = mode === 'cradle' ? 'c' : 'b';
    
    // Update the correct row in the table
    document.getElementById(`${prefix}-t${trials[mode]}`).innerText = singleTrialTime.toFixed(2);
    
    if (trials[mode] < 3) {
        // Prepare UI for the next single trial
        document.getElementById('sim-status').innerText = `Trial ${trials[mode]} recorded. Click to run next trial.`;
        document.getElementById(`btn-${mode}`).innerText = `${mode === 'cradle' ? '1. Oscillate Cradle' : '2. Oscillate Cradle + Cylinder'} (Trial ${trials[mode] + 1}/3)`;
    } else {
        // All 3 trials complete for this phase
        document.getElementById('sim-status').innerText = `${mode === 'cradle' ? 'Cradle' : 'Cradle + Cylinder'} phase complete.`;
        
        const t_sum = rawTimes[mode].reduce((a, b) => a + b, 0);
        const t_mean = t_sum / 3;
        const final_T = t_mean / 30;

        document.getElementById(`${prefix}-tmean`).innerText = t_mean.toFixed(2);
        
        if (mode === 'cradle') {
            document.getElementById(`c-T0`).innerHTML = `T<sub>0</sub> = ${final_T.toFixed(3)}`;
            
            // Switch buttons
            document.getElementById('btn-cradle').disabled = true;
            document.getElementById('btn-cradle').innerText = "1. Cradle Complete ✓";
            
            document.getElementById('btn-both').disabled = false;
            document.getElementById('btn-both').innerText = "2. Oscillate Cradle + Cylinder (Trial 1/3)";
            
            window.expData.T0 = final_T;
        } else {
            document.getElementById(`b-T1`).innerHTML = `T<sub>1</sub> = ${final_T.toFixed(3)}`;
            
            // Lock buttons
            document.getElementById('btn-both').disabled = true;
            document.getElementById('btn-both').innerText = "2. Both Complete ✓";
            
            window.expData.T1 = final_T;
            calculateFinalResults(physics);
            drawGraph(period);
        }
    }
}

function calculateFinalResults(physics) {
    const { l, r, Lcyl, Rcyl, I1 } = physics;
    const T0 = window.expData.T0;
    const T1 = window.expData.T1;

    document.getElementById('calc-I1').innerText = I1.toExponential(4);
    
    // Formula calculation
    const eta = (8 * Math.PI * l * I1) / (Math.pow(r, 4) * (Math.pow(T1, 2) - Math.pow(T0, 2)));
    
    // Convert to strict 10^10 format visually 
    const eta_base = eta / 1e10;
    document.getElementById('calc-eta').innerHTML = `${eta_base.toFixed(2)} &times; 10<sup>10</sup> N&middot;m<sup>-2</sup>`;

    const delta_l = 0.002; 
    const delta_r = 0.00001; 
    const delta_T = 0.01; 
    const delta_L = 0.00005; 
    const delta_R = 0.00005; 

    const term1 = delta_l / l;
    const term2 = 4 * (delta_r / r);
    const term3 = Math.abs((2 * delta_T * (T1 + T0)) / (Math.pow(T1, 2) - Math.pow(T0, 2)));
    const term4 = ((2 * Lcyl * delta_L) + (6 * Rcyl * delta_R)) / (Math.pow(Lcyl, 2) + 3 * Math.pow(Rcyl, 2));

    const max_error_ratio = term1 + term2 + term3 + term4;
    const pct_error = max_error_ratio * 100;

    document.getElementById('calc-error').innerText = pct_error.toFixed(3);
}

function drawGraph(period) {
    const ctx = document.getElementById('oscillationGraph').getContext('2d');
    const labels = [], dataPoints = [];
    for(let t=0; t<=10; t+=0.1) {
        labels.push(t.toFixed(1));
        // Uses 180 degrees to match the visual swing
        dataPoints.push(180 * Math.cos(2 * Math.PI * (1/period) * t) * Math.exp(-0.2 * t));
    }

    if (chartInstance) chartInstance.destroy();
    const textColor = document.body.getAttribute('data-theme') === 'dark' ? '#f4f4f9' : '#333';

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `Angle vs Time (T ≈ ${period.toFixed(2)}s)`,
                data: dataPoints,
                borderColor: '#0056b3',
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: { title: { display: true, text: 'Time (s)', color: textColor }, ticks: {color: textColor} },
                y: { title: { display: true, text: 'Twist Angle (degrees)', color: textColor }, ticks: {color: textColor} }
            },
            plugins: { legend: { labels: { color: textColor } } }
        }
    });
}

function resetExperiment() {
    if (isSimulating) return;
    ['c-t1', 'c-t2', 'c-t3', 'c-tmean', 'b-t1', 'b-t2', 'b-t3', 'b-tmean'].forEach(id => {
        document.getElementById(id).innerText = "-";
    });
    
    document.getElementById('c-T0').innerHTML = "T<sub>0</sub> = -";
    document.getElementById('b-T1').innerHTML = "T<sub>1</sub> = -";
    document.getElementById('calc-I1').innerText = "-";
    document.getElementById('calc-eta').innerText = "-";
    document.getElementById('calc-error').innerText = "-";

    document.getElementById('btn-cradle').disabled = false;
    document.getElementById('btn-cradle').innerText = "1. Oscillate Cradle (Trial 1/3)";
    
    document.getElementById('btn-both').disabled = true;
    document.getElementById('btn-both').innerText = "2. Oscillate Cradle + Cylinder";
    
    document.getElementById('cylinder').classList.add('hidden');
    document.getElementById('cradle').style.transform = `rotateY(0deg)`;
    document.getElementById('sim-status').innerText = "Set dimensions and start oscillation...";
    
    if (chartInstance) chartInstance.destroy();
    window.expData = {};
    trials = { cradle: 0, both: 0 };
    rawTimes = { cradle: [], both: [] };
}