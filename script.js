document.addEventListener('DOMContentLoaded', () => {
    let kcalChart = null;

    // ---------- Theme basiert auf System-Präferenz ----------
    const root = document.documentElement;

    function getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function applyTheme(theme) {
        root.setAttribute('data-theme', theme);
    }

    // Setze Theme basierend auf System
    applyTheme(getSystemTheme());

    // Lausche auf System-Theme-Änderungen
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const newTheme = e.matches ? 'dark' : 'light';
        applyTheme(newTheme);
        
        // Chart neu rendern mit neuen Farben
        if (kcalChart) {
            const lastData = kcalChart.data.datasets[0].data;
            const labels = kcalChart.data.labels;
            kcalChart.destroy();
            renderChartWithData(labels, lastData);
        }
    });

    // Farben aus CSS-Variablen holen
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

    // DOM Elemente
    const inputs = document.querySelectorAll('input, select');
    const totalDisplay = document.getElementById('totalCalories');
    const statusDisplay = document.getElementById('statusMessage');
    const neatLevelSelect = document.getElementById('neatLevel');
    const neatGroups = document.querySelectorAll('.neat-group');

    // Berechnungs-Logik
    const calculations = {
        // Mifflin-St. Jeor (Standard)
        bmr: (g, gr, a, sex) => 
            sex === "mann" 
            ? (10 * g) + (6.25 * gr) - (5 * a) + 5 
            : (10 * g) + (6.25 * gr) - (5 * a) - 161,
        
        // Katch-McArdle (Expert, wenn KFA vorhanden)
        bmrExpert: (g, kfa) => {
            const lbm = g * (1 - (kfa / 100));
            return 370 + (21.6 * lbm);
        },
        
        steps: (s, g, gr) => 3.5 * g * ((s * gr * 0.0041) / 1000) / 5,
        
        activity: (met, dauer, freq, g) => ((met * g * (dauer / 60)) * freq) / 7
    };

    function getInputValues() {
        const kfaVal = document.getElementById('kfa').value;
        return {
            g: parseFloat(document.getElementById('gewicht').value),
            gr: parseFloat(document.getElementById('groesse').value),
            a: parseFloat(document.getElementById('alter').value),
            sex: document.getElementById('geschlecht').value,
            kfa: kfaVal !== '' ? parseFloat(kfaVal) : null,
            steps: parseFloat(document.getElementById('schritte').value) || 0,
            sMet: parseFloat(document.getElementById('sportIntensitaet').value),
            sDur: parseFloat(document.getElementById('sportDauer').value),
            sFreq: parseFloat(document.getElementById('sportFreq').value),
            cMet: parseFloat(document.getElementById('cardioIntensitaet').value),
            cDur: parseFloat(document.getElementById('cardioDauer').value),
            cFreq: parseFloat(document.getElementById('cardioFreq').value)
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
        const level = neatLevelSelect ? neatLevelSelect.value : '';
        if (level === 'expert' && val.kfa != null && !isNaN(val.kfa)) {
            if (val.kfa < 5 || val.kfa > 60) {
                return { valid: false, message: 'KFA muss zwischen 5 und 60 % liegen' };
            }
        }
        return { valid: true };
    }

    function getNeatKcal(bmr, weight) {
        if (!neatLevelSelect) return 0;

        const level = neatLevelSelect.value;

        // ANFÄNGER: Einfache Prozent-Auswahl
        if (level === 'beginner') {
            const factor = parseFloat(document.getElementById('neatBeginner').value) || 0;
            return bmr * factor;
        }

        // FORTGESCHRITTEN: Job + Freizeit
        if (level === 'intermediate') {
            const job = parseFloat(document.getElementById('neatJobInter').value) || 0;
            const leisure = parseFloat(document.getElementById('neatLeisure').value) || 0;
            return bmr * (job + leisure);
        }

        // EXPERTE: Gewichteter Wochendurchschnitt
        const jobFaktor = parseFloat(document.getElementById('neatJobExpert').value) || 0;
        const arbeitsTage = parseFloat(document.getElementById('neatWorkDays').value) || 0;
        
        const alltagFaktor = parseFloat(document.getElementById('neatDaily').value) || 0;
        
        const restDays = parseFloat(document.getElementById('neatRestDays').value) || 0;
        const restDayFaktor = parseFloat(document.getElementById('neatRestActivity').value) || 0;

        // Gewichteter Durchschnitt über die Woche
        const neatJob = (jobFaktor * arbeitsTage) / 7;
        const neatAlltag = alltagFaktor;  // Gilt jeden Tag
        const neatRest = (restDayFaktor * restDays) / 7;

        return bmr * (neatJob + neatAlltag + neatRest);
    }

    function updateUI() {
        const val = getInputValues();
        const validation = validateInputs(val);

        // Validierung
        if (!validation.valid) {
            totalDisplay.textContent = '-';
            statusDisplay.innerHTML = `<span class="fehler">${validation.message}</span>`;
            if (kcalChart) {
                kcalChart.destroy();
                kcalChart = null;
            }
            return;
        }

        statusDisplay.innerHTML = '';

        // BMR: Katch-McArdle NUR bei Expert + KFA, sonst zwingend Mifflin-St. Jeor
        const level = neatLevelSelect ? neatLevelSelect.value : '';
        const hasValidKfa = val.kfa != null && !isNaN(val.kfa) && val.kfa >= 5 && val.kfa <= 60;
        const useKatchMcArdle = level === 'expert' && hasValidKfa;

        let bmr;
        if (useKatchMcArdle) {
            bmr = calculations.bmrExpert(val.g, val.kfa);
        } else {
            bmr = calculations.bmr(val.g, val.gr, val.a, val.sex);
        }

        // Werte berechnen
        const neatKcal = getNeatKcal(bmr, val.g);
        const stepKcal = calculations.steps(val.steps, val.g, val.gr);
        const sportKcal = calculations.activity(val.sMet, val.sDur, val.sFreq, val.g);
        const cardioKcal = calculations.activity(val.cMet, val.cDur, val.cFreq, val.g);
        
        const total = bmr + neatKcal + stepKcal + sportKcal + cardioKcal;

        // Anzeige
        totalDisplay.textContent = Math.round(total).toLocaleString('de-DE');
        renderChart(bmr, neatKcal, stepKcal, sportKcal, cardioKcal);
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

    function updateNeatVisibility() {
        if (!neatLevelSelect) return;
        const current = neatLevelSelect.value;
        neatGroups.forEach(group => {
            if (group.dataset.level === current) {
                group.classList.add('neat-group-active');
            } else {
                group.classList.remove('neat-group-active');
            }
        });
        const kfaGroup = document.querySelector('.kfa-group');
        if (kfaGroup) {
            kfaGroup.style.display = current === 'expert' ? 'block' : 'none';
        }
    }

    // Event Listener für Live-Update
    inputs.forEach(input => {
        input.addEventListener('input', updateUI);
        input.addEventListener('change', updateUI);
    });

    if (neatLevelSelect) {
        neatLevelSelect.addEventListener('change', () => {
            updateNeatVisibility();
            updateUI();
        });
        updateNeatVisibility();
    }

    // Initialer Aufruf
    updateUI();
});
