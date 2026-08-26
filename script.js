document.addEventListener('DOMContentLoaded', () => {
    let kcalChart = null;
    let lastUnlockedStep = 1;

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

        // Speziallogik für Training-Abschnitt
        if (sectionName === 'training') {
            const kraftFreq = document.getElementById('kraftFreq').value;
            const cardioFreq = document.getElementById('cardioFreq').value;

            // Beide müssen gesetzt sein (nicht leer)
            if (kraftFreq === '' || cardioFreq === '') return false;

            // Wenn Kraft-Training gewählt, müssen Met und Dur ausgefüllt sein
            if (kraftFreq !== '0') {
                const kraftMet = document.getElementById('kraftMet').value;
                const kraftDur = document.getElementById('kraftDur').value;
                if (kraftMet === '' || !kraftDur) return false;
            }

            // Wenn Cardio-Training gewählt, müssen Met und Dur ausgefüllt sein
            if (cardioFreq !== '0') {
                const cardioMet = document.getElementById('cardioMet').value;
                const cardioDur = document.getElementById('cardioDur').value;
                if (cardioMet === '' || !cardioDur) return false;
            }

            return true;
        }

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

    function scrollToElement(el) {
        const headerHeight = document.querySelector('.header')?.offsetHeight || 0;
        const viewportHeight = window.innerHeight - headerHeight;
        const elTop = el.getBoundingClientRect().top + window.scrollY - headerHeight;
        const target = elTop - (viewportHeight - el.offsetHeight) / 2;
        const start = window.scrollY;
        const distance = target - start;
        const duration = 1200;
        let startTime = null;

        function easeInOutCubic(t) {
            return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        }

        function step(timestamp) {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            window.scrollTo(0, start + distance * easeInOutCubic(progress));
            if (progress < 1) requestAnimationFrame(step);
        }

        requestAnimationFrame(step);
    }

    function updateSectionsVisibility() {
        SECTION_ORDER.forEach((sectionName) => {
            const section = sections[sectionName];
            if (!section || !section.element) return;

            if (section.step <= lastUnlockedStep) {
                section.element.classList.add('visible');
            } else {
                section.element.classList.remove('visible');
            }
        });

        updateButtonStates();
    }

    function updateButtonStates() {
        SECTION_ORDER.forEach((sectionName) => {
            const section = sections[sectionName];
            if (!section || !section.element) return;

            const btn = section.element.nextElementSibling?.classList?.contains('next-btn')
                ? section.element.nextElementSibling
                : section.element.querySelector('.next-btn');
            if (!btn) return;

            const isComplete = isSectionComplete(sectionName);
            const isVisible = section.element.classList.contains('visible');
            const isCurrent = section.step === lastUnlockedStep;

            if (isComplete && isVisible && isCurrent) {
                btn.classList.add('show');
            } else {
                btn.classList.remove('show');
            }
        });
    }

    function nextSection(currentStep) {
        if (currentStep < SECTION_ORDER.length) {
            // Verstecke Button des aktuellen Abschnitts
            const currentSectionName = SECTION_ORDER[currentStep - 1];
            const currentSection = sections[currentSectionName];
            const currentBtn = currentSection?.element?.nextElementSibling?.classList?.contains('next-btn')
                ? currentSection.element.nextElementSibling
                : currentSection?.element?.querySelector('.next-btn');
            if (currentBtn) {
                currentBtn.classList.remove('show');
            }

            lastUnlockedStep = currentStep + 1;
            updateUI();
            const nextIndex = currentStep;
            const nextSection = sections[SECTION_ORDER[nextIndex]];
            if (nextSection && nextSection.element) {
                setTimeout(() => scrollToElement(nextSection.element), 100);
            }
        }
    }

    // ---------- Theme ----------
    document.documentElement.setAttribute('data-theme', 'light');

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
            kraftFreq: parseFloat(document.getElementById('kraftFreq').value) || 0,
            kraftMet: parseFloat(document.getElementById('kraftMet').value) || 0,
            kraftDur: parseFloat(document.getElementById('kraftDur').value) || 0,
            cardioFreq: parseFloat(document.getElementById('cardioFreq').value) || 0,
            cardioMet: parseFloat(document.getElementById('cardioMet').value) || 0,
            cardioDur: parseFloat(document.getElementById('cardioDur').value) || 0
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

    function updateTrainingFieldsVisibility() {
        const kraftFreqVal = document.getElementById('kraftFreq').value;
        const cardioFreqVal = document.getElementById('cardioFreq').value;

        const kraftMetGroup = document.getElementById('kraftMet')?.closest('.form-group');
        const kraftDurGroup = document.getElementById('kraftDur')?.closest('.form-group');
        const cardioMetGroup = document.getElementById('cardioMet')?.closest('.form-group');
        const cardioDurGroup = document.getElementById('cardioDur')?.closest('.form-group');

        if (kraftMetGroup && kraftDurGroup) {
            if (kraftFreqVal === '0') {
                kraftMetGroup.classList.add('hidden');
                kraftDurGroup.classList.add('hidden');
            } else {
                kraftMetGroup.classList.remove('hidden');
                kraftDurGroup.classList.remove('hidden');
            }
        }

        if (cardioMetGroup && cardioDurGroup) {
            if (cardioFreqVal === '0') {
                cardioMetGroup.classList.add('hidden');
                cardioDurGroup.classList.add('hidden');
            } else {
                cardioMetGroup.classList.remove('hidden');
                cardioDurGroup.classList.remove('hidden');
            }
        }
    }

    inputs.forEach((input) => {
        input.addEventListener('input', updateUI);
        input.addEventListener('change', updateUI);
    });

    // Training-Felder Sichtbarkeit
    document.getElementById('kraftFreq')?.addEventListener('change', updateTrainingFieldsVisibility);
    document.getElementById('cardioFreq')?.addEventListener('change', updateTrainingFieldsVisibility);

    // Weiter-Button Event-Listener
    Object.keys(sections).forEach((sectionName) => {
        const section = sections[sectionName];
        const btn = section.element?.nextElementSibling?.classList?.contains('next-btn')
            ? section.element.nextElementSibling
            : section.element?.querySelector('.next-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                nextSection(section.step);
            });
        }
    });

    updateUI();
    updateTrainingFieldsVisibility();
});
