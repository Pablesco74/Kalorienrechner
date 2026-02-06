document.addEventListener('DOMContentLoaded', () => {
    let kcalChart = null;

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
        
        steps: (s, g, gr) => s * g * 0.0005 * (gr / 170),
        
        activity: (met, dauer, freq, g) => ((met * g * (dauer / 60)) * freq) / 7
    };

    function updateUI() {
        const val = {
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

        // Validierung
        if (!val.g || !val.gr || !val.a) {
            totalDisplay.textContent = '-';
            statusDisplay.innerHTML = '<span class="fehler">Bitte Basisdaten eingeben</span>';
            if (kcalChart) kcalChart.destroy();
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
        totalDisplay.textContent = Math.round(total);
        renderChart(bmr, stepKcal, sportKcal, cardioKcal);
    }

    function renderChart(bmr, steps, sport, cardio) {
        const ctx = document.getElementById('kcalChart').getContext('2d');
        
        if (kcalChart) kcalChart.destroy();

        kcalChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Grundumsatz', 'Schritte', 'Kraft', 'Cardio'],
                datasets: [{
                    data: [Math.round(bmr), Math.round(steps), Math.round(sport), Math.round(cardio)],
                    backgroundColor: ['#3B82F6', '#22C55E', '#F97316', '#EF4444'],
                    borderWidth: 0,
                    borderRadius: 5,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                cutout: '75%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#94A3B8', padding: 20, usePointStyle: true, font: { size: 12 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: (item) => ` ${item.label}: ${item.raw} kcal`
                        }
                    }
                }
            }
        });
    }

    // Event Listener für Live-Update
inputs.forEach(input => {
    input.addEventListener('input', updateUI);
    input.addEventListener('change', updateUI); // Für <select>-Elemente
});

    // Initialer Aufruf
    updateUI();
});
