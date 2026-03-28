document.addEventListener('DOMContentLoaded', () => {
    let kcalChart = null;

    const SECTION_ORDER = ['grundumsatz', 'schritte', 'arbeit', 'training'];

    const sections = {
        grundumsatz: {
            step: 1,
            element: document.querySelector('[data-section="grundumsatz"]'),
            requiredFields: ['geschlecht', 'gewicht', 'groesse', 'alter']
        },
        schritte: {
            step: 2,
            element: document.querySelector('[data-section="schritte"]'),
            requiredFields: ['schritte']
        },
        arbeit: {
            step: 3,
            element: document.querySelector('[data-section="arbeit"]'),
            requiredFields: ['workDays', 'neatWork', 'neatRest']
        },
        training: {
            step: 4,
            element: document.querySelector('[data-section="training"]'),
            requiredFields: ['kraftFreq', 'kraftMet', 'kraftDur', 'cardioFreq', 'cardioMet', 'cardioDur']
        }
    };

    const canvasPanel = document.querySelector('.canvas-panel');

    function isSectionComplete(sectionName) {
        const section = sections[sectionName];
        if (!section || !section.element) return false;

        return section.requiredFields.every((fieldId) => {
            const field = document.getElementById(fieldId);
            if (!field) return false;

            if (field.type === 'number') {
                const val = parseFloat(field.value);
                const minAttr = field.getAttribute('min');
                const min = minAttr !== null && minAttr !== '' ? parseFloat(minAttr) : 0;
                return !isNaN(val) && val >= min;
            }

            return field.value !== '';
        });
    }

    function updateSectionsVisibility() {
        let allPreviousComplete = true;

        SECTION_ORDER.forEach((sectionName) => {
            const section = sections[sectionName];
            if (!section || !section.element) return;

            if (section.step === 1) {
                section.element.classList.add('visible');
                allPreviousComplete = isSectionComplete(sectionName);
                return;
            }

            if (allPreviousComplete) {
                section.element.classList.add('visible');
                allPreviousComplete = isSectionComplete(sectionName);
            } else {
                section.element.classList.remove('visible');
            }
        });
    }

    // ---------- Theme basiert auf System-Präferenz ----------
    const root = document.documentElement;

    function getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function applyTheme(theme) {
        root.setAttribute('data-theme', theme);
    }

    applyTheme(getSystemTheme());

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const newTheme = e.matches ? 'dark' : 'light';
        applyTheme(newTheme);

        if (kcalChart) {
            const lastData = kcalChart.data.datasets[0].data;
            const labels = kcalChart.data.labels;
            kcalChart.destroy();
            renderChartWithData(labels, lastData);
        }
    });

    function getChartColors() {
        const style = getComputedStyle(document.documentElement);
        return {
            bmr: style.getPropertyValue('--chart-bmr').trim() || '#E85D75',
            neat: style.getPropertyValue('--chart-neat').trim() || '#9DB4A0',
            steps: style.getPropertyValue('--chart-steps').trim() || '#F2CC8F',
            strength: style.getPropertyValue('--chart-strength').trim() || '#D97757',
            cardio: style.getPropertyValue('--chart-cardio').trim() || '#B4A5F5'
        };
    }

    const inputs = document.querySelectorAll('input, select');
    const totalDisplay = document.getElementById('totalCalories');
    const statusDisplay = document.getElementById('statusMessage');

    const calculations = {
        steps: (s, g, gr) => 3.5 * g * ((s * gr * 0.0041) / 1000) / 5
    };

    function getInputValues() {
        const kfaRaw = document.getElementById('kfa').value;
        const kfa = kfaRaw !== '' && kfaRaw != null ? parseFloat(kfaRaw) : null;

        let workDays = parseFloat(document.getElementById('workDays').value);
        if (isNaN(workDays)) workDays = 5;
        workDays = Math.max(0, Math.min(7, workDays));

        return {
            g: parseFloat(document.getElementById('gewicht').value),
            gr: parseFloat(document.getElementById('groesse').value),
            a: parseFloat(document.getElementById('alter').value),
            sex: document.getElementById('geschlecht').value,
            kfa,
            steps: parseFloat(document.getElementById('schritte').value) || 0,
            workDays,
            neatWork: parseFloat(document.getElementById('neatWork').value),
            neatRest: parseFloat(document.getElementById('neatRest').value),
            kraftFreq: parseFloat(document.getElementById('kraftFreq').value),
            kraftMet: parseFloat(document.getElementById('kraftMet').value),
            kraftDur: parseFloat(document.getElementById('kraftDur').value),
            cardioFreq: parseFloat(document.getElementById('cardioFreq').value),
            cardioMet: parseFloat(document.getElementById('cardioMet').value),
            cardioDur: parseFloat(document.getElementById('cardioDur').value)
        };
    }

    function validateInputs(val) {
        if (!val.g || !val.gr || !val.a) {
            return { valid: false, message: 'Bitte Basisdaten eingeben' };
        }
        if (val.g < 20 || val.g > 300) {
            return { valid: false, message: 'Gewicht muss zwischen 20 und 300 kg liegen' };
        }
        if (val.gr < 100 || val.gr > 250) {
            return { valid: false, message: 'Größe muss zwischen 100 und 250 cm liegen' };
        }
        if (val.a < 10 || val.a > 120) {
            return { valid: false, message: 'Alter muss zwischen 10 und 120 Jahren liegen' };
        }
        if (val.kfa != null && !isNaN(val.kfa)) {
            if (val.kfa < 5 || val.kfa > 60) {
                return { valid: false, message: 'KFA muss zwischen 5 und 60 % liegen' };
            }
        }
        return { valid: true };
    }

    function calculateBMR(val) {
        const hasKFA = val.kfa !== null && !isNaN(val.kfa) && val.kfa >= 5 && val.kfa <= 60;

        if (hasKFA && (val.kfa < 11 || val.kfa > 25)) {
            const lbm = val.g * (1 - (val.kfa / 100));
            return 370 + (21.6 * lbm);
        }

        return val.sex === 'mann'
            ? (10 * val.g) + (6.25 * val.gr) - (5 * val.a) + 5
            : (10 * val.g) + (6.25 * val.gr) - (5 * val.a) - 161;
    }

    function calculateNEAT(bmr, val) {
        const restDays = 7 - val.workDays;
        return bmr * ((val.workDays / 7 * val.neatWork) + (restDays / 7 * val.neatRest));
    }

    function calculateTraining(val) {
        const kraft = (val.kraftFreq * val.kraftMet * val.g * (val.kraftDur / 60)) / 7;
        const cardioM = (val.cardioFreq * val.cardioMet * val.g * (val.cardioDur / 60)) / 7;
        return { kraft, cardio: cardioM };
    }

    function setCanvasVisible(visible) {
        if (!canvasPanel) return;
        if (visible) {
            canvasPanel.classList.add('visible');
            canvasPanel.setAttribute('aria-hidden', 'false');
        } else {
            canvasPanel.classList.remove('visible');
            canvasPanel.setAttribute('aria-hidden', 'true');
        }
    }

    function updateUI() {
        const val = getInputValues();
        const validation = validateInputs(val);

        updateSectionsVisibility();

        const trainingEl = sections.training.element;
        const allComplete =
            trainingEl &&
            trainingEl.classList.contains('visible') &&
            SECTION_ORDER.every((s) => isSectionComplete(s));

        const showResult = allComplete && validation.valid;

        if (!showResult) {
            totalDisplay.textContent = '-';
            statusDisplay.innerHTML = validation.valid
                ? ''
                : `<span class="fehler">${validation.message}</span>`;
            if (kcalChart) {
                kcalChart.destroy();
                kcalChart = null;
            }
            setCanvasVisible(false);
            return;
        }

        statusDisplay.innerHTML = '';
        setCanvasVisible(true);

        const bmr = calculateBMR(val);
        const neatKcal = calculateNEAT(bmr, val);
        const stepKcal = calculations.steps(val.steps, val.g, val.gr);
        const training = calculateTraining(val);

        const total = bmr + neatKcal + stepKcal + training.kraft + training.cardio;

        totalDisplay.textContent = Math.round(total).toLocaleString('de-DE');
        renderChart(bmr, neatKcal, stepKcal, training.kraft, training.cardio);
    }

    function renderChartWithData(labels, data) {
        const ctx = document.getElementById('kcalChart').getContext('2d');
        const colors = getChartColors();

        if (kcalChart) {
            kcalChart.destroy();
        }

        kcalChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [colors.bmr, colors.neat, colors.steps, colors.strength, colors.cardio],
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '75%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-chart').trim(),
                            padding: 20,
                            usePointStyle: true,
                            font: { size: 12, weight: '600' }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (item) => ` ${item.label}: ${item.raw.toLocaleString('de-DE')} kcal`
                        },
                        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim(),
                        titleColor: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim(),
                        bodyColor: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim(),
                        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--input-border').trim(),
                        borderWidth: 1,
                        padding: 12
                    }
                }
            }
        });
    }

    function renderChart(bmr, neat, steps, sport, cardio) {
        const labels = ['Grundumsatz', 'NEAT', 'Schritte', 'Kraft', 'Cardio'];
        const data = [
            Math.round(bmr),
            Math.round(neat),
            Math.round(steps),
            Math.round(sport),
            Math.round(cardio)
        ];

        renderChartWithData(labels, data);
    }

    inputs.forEach((input) => {
        input.addEventListener('input', updateUI);
        input.addEventListener('change', updateUI);
    });

    updateUI();
});
