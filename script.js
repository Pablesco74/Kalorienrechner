document.addEventListener('DOMContentLoaded', () => {
    let kcalChart = null;

    // Konstanten
    const COLORS = {
        bmr: '#3B82F6',
        steps: '#22C55E',
        strength: '#F97316',
        cardio: '#EF4444'
    };

    const STEPS_CAL_FACTOR = 0.0005;
    const HEIGHT_ADJUSTMENT = 170;

    // DOM Elemente
    const inputs = document.querySelectorAll('input, select');
    const totalDisplay = document.getElementById('totalCalories');
    const statusDisplay = document.getElementById('statusMessage');

    // Berechnungs-Logik
    const calculations = {
        bmr: (g, gr, a, sex) => 
            sex === "mann" 
            ? (10 * g) + (6.25 * gr) - (5 * a) + 5 
            : (10 * g) + (6.25 * gr) - (5 * a) - 161,
        
        steps: (s, g, gr) => s * g * STEPS_CAL_FACTOR * (gr / HEIGHT_ADJUSTMENT),
        
        activity: (met, dauer, freq, g) => ((met * g * (dauer / 60)) * freq) / 7
    };

    function getInputValues() {
        return {
            g: parseFloat(document.getElementById('gewicht').value),
            gr: parseFloat(document.getElementById('groesse').value),
            a: parseFloat(document.getElementById('alter').value),
            sex: document.getElementById('geschlecht').value,
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
        return { valid: true };
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

        // Werte berechnen
        const bmr = calculations.bmr(val.g, val.gr, val.a, val.sex);
        const stepKcal = calculations.steps(val.steps, val.g, val.gr);
        const sportKcal = calculations.activity(val.sMet, val.sDur, val.sFreq, val.g);
        const cardioKcal = calculations.activity(val.cMet, val.cDur, val.cFreq, val.g);
        
        const total = bmr + stepKcal + sportKcal + cardioKcal;

        // Anzeige
        totalDisplay.textContent = Math.round(total).toLocaleString('de-DE');
        renderChart(bmr, stepKcal, sportKcal, cardioKcal);
    }

    function renderChart(bmr, steps, sport, cardio) {
        const ctx = document.getElementById('kcalChart').getContext('2d');
        
        if (kcalChart) {
            kcalChart.destroy();
        }

        kcalChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Grundumsatz', 'Schritte', 'Kraft', 'Cardio'],
                datasets: [{
                    data: [Math.round(bmr), Math.round(steps), Math.round(sport), Math.round(cardio)],
                    backgroundColor: [COLORS.bmr, COLORS.steps, COLORS.strength, COLORS.cardio],
                    borderWidth: 0,
                    borderRadius: 0,
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
                            color: '#94A3B8', 
                            padding: 20, 
                            usePointStyle: true, 
                            font: { size: 12 } 
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (item) => ` ${item.label}: ${item.raw.toLocaleString('de-DE')} kcal`
                        }
                    }
                }
            }
        });
    }

    // Event Listener für Live-Update
    // KRITISCH: Sowohl 'input' als auch 'change' Events registrieren!
    inputs.forEach(input => {
        input.addEventListener('input', updateUI);  // Für <input>-Felder
        input.addEventListener('change', updateUI); // Für <select>-Elemente
    });

    // Initialer Aufruf
    updateUI();
});
