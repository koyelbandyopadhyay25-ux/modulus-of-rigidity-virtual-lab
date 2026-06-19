// --- Theme and Tab Switching ---
const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('click', () => {
    const currentTheme = document.body.getAttribute('data-theme');
    document.body.setAttribute('data-theme', currentTheme === 'dark' ? 'light' : 'dark');
});

function switchTab(tabId) {
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
    if (isSimulating) return;
    isSimulating = true;
    document.getElementById('sim-status').innerText = "Oscillating (simulating 3 trials)...";
    
    const physics = calculatePhysics();
    const period = mode === 'cradle' ? physics.T0 : physics.T1;
    
    const cylinderDOM = document.getElementById('cylinder');
    if (mode === 'both') cylinderDOM.classList.remove('hidden');

    let startTime = null;
    const duration = 2500; 
    const frequency = 1 / (period / 10); 
    
    function animate(time) {
        if (!startTime) startTime = time;
        const elapsed = time - startTime;
        
        const angle = 45 * Math.cos(2 * Math.PI * frequency * (elapsed / 1000)) * Math.exp(-elapsed / 2000);
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
    document.getElementById('sim-status').innerText = "Trials complete.";
    
    const t_trials = [
        (period * 30) + (Math.random() * 0.4 - 0.2),
        (period * 30) + (Math.random() * 0.4 - 0.2),
        (period * 30) + (Math.random() * 0.4 - 0.2)
    ];
    
    const t_sum = t_trials.reduce((a, b) => a + b, 0);
    const t_mean = t_sum / 3;
    const final_T = t_mean / 30;

    const prefix = mode === 'cradle' ? 'c' : 'b';
    
    document.getElementById(`${prefix}-t1`).innerText = t_trials[0].toFixed(2);
    document.getElementById(`${prefix}-t2`).innerText = t_trials[1].toFixed(2);
    document.getElementById(`${prefix}-t3`).innerText = t_trials[2].toFixed(2);
    document.getElementById(`${prefix}-tmean`).innerText = t_mean.toFixed(2);
    
    if (mode === 'cradle') {
        document.getElementById(`c-T0`).innerHTML = `T<sub>0</sub> = ${final_T.toFixed(3)}`;
        document.getElementById('btn-cradle').disabled = true;
        document.getElementById('btn-both').disabled = false;
        window.expData.T0 = final_T;
    } else {
        document.getElementById(`b-T1`).innerHTML = `T<sub>1</sub> = ${final_T.toFixed(3)}`;
        document.getElementById('btn-both').disabled = true;
        window.expData.T1 = final_T;
        calculateFinalResults(physics);
    }
    drawGraph(period);
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
        dataPoints.push(45 * Math.cos(2 * Math.PI * (1/period) * t) * Math.exp(-0.2 * t));
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
    document.getElementById('btn-both').disabled = true;
    document.getElementById('cylinder').classList.add('hidden');
    document.getElementById('cradle').style.transform = `rotateY(0deg)`;
    document.getElementById('sim-status').innerText = "Set dimensions and start oscillation...";
    
    if (chartInstance) chartInstance.destroy();
    window.expData = {};
}