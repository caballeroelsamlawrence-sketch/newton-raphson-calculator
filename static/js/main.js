document.addEventListener('DOMContentLoaded', () => {

    /* ─── Smooth scroll ─────────────────────────────────────────── */
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    /* ─── Navbar scroll shadow ──────────────────────────────────── */
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (window.scrollY > 50) {
            navbar.style.boxShadow = isDark ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.1)';
            navbar.style.background = isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)';
        } else {
            navbar.style.boxShadow = 'none';
            navbar.style.background = isDark ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.8)';
        }
    });

    /* ─── Theme toggle ──────────────────────────────────────────── */
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
            window.dispatchEvent(new Event('scroll'));
            if (window.desmosCalc) {
                window.desmosCalc.updateSettings({ invertedColors: next === 'dark' });
            }
        });
    }

    /* ─── Color picker ──────────────────────────────────────────── */
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const color = btn.dataset.color;
            document.documentElement.setAttribute('data-color', color);
            localStorage.setItem('color', color);
            document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
        // Mark active on load
        if (btn.dataset.color === (localStorage.getItem('color') || 'blue')) {
            btn.classList.add('active');
        }
    });

    /* ─── History sidebar ───────────────────────────────────────── */
    const historyToggle  = document.getElementById('historyToggle');
    const closeHistoryBtn = document.getElementById('closeHistoryBtn');
    const historySidebar = document.getElementById('historySidebar');
    const historyOverlay = document.getElementById('historyOverlay');
    const historyList    = document.getElementById('historyList');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');

    let calcHistory = JSON.parse(localStorage.getItem('calcHistory') || '[]');

    function renderHistory() {
        if (!historyList) return;
        historyList.innerHTML = '';
        if (calcHistory.length === 0) {
            historyList.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem 0;">No calculations yet.</p>';
            return;
        }
        calcHistory.slice().reverse().forEach((item, idx) => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `<strong style="font-family:monospace">f(x) = ${item.func}</strong>
                <br><small style="color:var(--text-muted)">x₀ = ${item.x0} &nbsp;|&nbsp; Root ≈ ${item.root}</small>`;
            div.addEventListener('click', () => {
                document.getElementById('function_input').value = item.func;
                document.getElementById('initial_guess').value  = item.x0;
                closeHistorySidebar();
                document.getElementById('calcForm').dispatchEvent(new Event('submit'));
            });
            historyList.appendChild(div);
        });
    }

    function openHistorySidebar()  { historySidebar?.classList.add('active'); historyOverlay?.classList.add('active'); renderHistory(); }
    function closeHistorySidebar() { historySidebar?.classList.remove('active'); historyOverlay?.classList.remove('active'); }

    historyToggle?.addEventListener('click', openHistorySidebar);
    closeHistoryBtn?.addEventListener('click', closeHistorySidebar);
    historyOverlay?.addEventListener('click', closeHistorySidebar);
    clearHistoryBtn?.addEventListener('click', () => {
        calcHistory = [];
        localStorage.setItem('calcHistory', '[]');
        renderHistory();
    });

    /* ─── Desmos initialisation ─────────────────────────────────── */
    const calcContainer = document.getElementById('calculator-container');
    if (calcContainer && typeof Desmos !== 'undefined') {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        window.desmosCalc = Desmos.GraphingCalculator(calcContainer, {
            expressions:  true,
            settingsMenu: true,
            zoomButtons:  true,
            keypad:       true,
            invertedColors: isDark
        });
    }

    /* ─── Utility: update Desmos graph ──────────────────────────── */
    let iterHistory = [];   // [{x, fx, dfx}]

    function updateDesmos(funcStr, rootVal, history) {
        if (!window.desmosCalc) return;
        const calc = window.desmosCalc;
        calc.setBlank();

        // Convert Python-style func string to Desmos latex
        let desmosExpr = funcStr
            .replace(/\*\*/g, '^')
            .replace(/sympy\./g, '')
            .replace(/math\./g, '');

        calc.setExpression({ id: 'fn', latex: `f(x)=${desmosExpr}`, color: Desmos.Colors.BLUE });

        if (rootVal !== null && !isNaN(rootVal)) {
            calc.setExpression({
                id: 'root',
                latex: `(${rootVal}, 0)`,
                color: Desmos.Colors.GREEN,
                showLabel: true,
                label: `Root ≈ ${rootVal.toFixed(6)}`
            });
            calc.setMathBounds({
                left:   rootVal - 5,
                right:  rootVal + 5,
                bottom: -10,
                top:    10
            });
        }

        // Plot tangent lines for current iteration (controlled by slider)
        plotIterationStep(funcStr, history, parseInt(iterSlider?.value || 0));
    }

    function plotIterationStep(funcStr, history, stepIdx) {
        if (!window.desmosCalc || !history || history.length === 0) return;
        const calc = window.desmosCalc;

        // Remove previous iteration decorations
        ['iterPoint', 'tangentLine', 'nextPoint'].forEach(id => {
            try { calc.removeExpression({ id }); } catch(e) {}
        });

        if (stepIdx >= history.length) return;

        const item = history[stepIdx];
        const xn   = item.x;
        const fn   = item.f_x;
        const dfn  = item.df_x;

        // xn point on curve
        calc.setExpression({
            id: 'iterPoint',
            latex: `(${xn}, ${fn})`,
            color: Desmos.Colors.ORANGE,
            showLabel: true,
            label: `x_${stepIdx} = ${xn.toFixed(5)}`
        });

        // Tangent line: y = fn + dfn*(x - xn)
        if (dfn !== 0) {
            const b = fn - dfn * xn;
            const sign = b >= 0 ? '+' : '-';
            const tangentLatex = `y=${dfn}x${sign}${Math.abs(b)}`;
            calc.setExpression({
                id: 'tangentLine',
                latex: tangentLatex,
                color: Desmos.Colors.RED,
                lineStyle: Desmos.Styles.DASHED
            });

            // x-intercept of tangent
            const xNext = xn - fn / dfn;
            calc.setExpression({
                id: 'nextPoint',
                latex: `(${xNext}, 0)`,
                color: Desmos.Colors.PURPLE,
                showLabel: true,
                label: `x_${stepIdx+1} ≈ ${xNext.toFixed(5)}`
            });
        }
    }

    /* ─── Iteration slider ──────────────────────────────────────── */
    const iterSlider   = document.getElementById('iterationSlider');
    const sliderValue  = document.getElementById('sliderValue');
    let lastFuncStr = '';

    iterSlider?.addEventListener('input', () => {
        const v = parseInt(iterSlider.value);
        if (sliderValue) sliderValue.textContent = v;
        plotIterationStep(lastFuncStr, iterHistory, v);
    });

    /* ─── Render results table ──────────────────────────────────── */
    function renderTable(results) {
        const tbody = document.getElementById('resultsBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        results.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="num">${row.iter}</td>
                <td class="num">${row.x.toFixed(8)}</td>
                <td class="num">${row.f_x.toExponential(4)}</td>
                <td class="num">${row.df_x.toExponential(4)}</td>
                <td class="num">${row.error.toExponential(4)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    /* ─── Render step-by-step ───────────────────────────────────── */
    function renderSteps(steps) {
        const container = document.getElementById('stepsContent');
        if (!container) return;
        container.innerHTML = '';
        steps.forEach(step => {
            const div = document.createElement('div');
            div.className = 'dynamic-step';
            div.innerHTML = `<h5 class="step-title">${step.title}</h5>
                             <div class="step-body">${step.content}</div>`;
            container.appendChild(div);
        });
        // Re-render MathJax
        if (window.MathJax) MathJax.typesetPromise([container]).catch(() => {});
    }

    /* ─── Main form submission ──────────────────────────────────── */
    const calcForm    = document.getElementById('calcForm');
    const calcBtn     = document.getElementById('calculateBtn');
    const errorBanner = document.getElementById('errorBanner');
    const errorMsg    = document.getElementById('errorMsg');
    const resultsSection = document.getElementById('resultsSection');
    const successBanner  = document.getElementById('successBanner');
    const rootValue      = document.getElementById('rootValue');

    calcForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const func    = document.getElementById('function_input')?.value.trim();
        const x0      = document.getElementById('initial_guess')?.value.trim();
        const tol     = document.getElementById('tolerance')?.value.trim();
        const maxIter = document.getElementById('max_iter')?.value.trim();

        if (!func) return;

        // Loading state
        if (calcBtn) {
            calcBtn.disabled = true;
            calcBtn.innerHTML = '<div class="spinner"></div> COMPUTING…';
        }
        if (errorBanner) errorBanner.style.display = 'none';

        try {
            const res = await fetch('/api/calculate', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ function: func, x0, tolerance: tol, max_iter: maxIter })
            });
            const data = await res.json();

            if (!data.success || (data.error_msg && !data.results?.length)) {
                if (errorBanner) errorBanner.style.display = 'flex';
                if (errorMsg)    errorMsg.textContent = data.error_msg || 'An unknown error occurred.';
                if (resultsSection) resultsSection.style.display = 'none';
                return;
            }

            // Show results section
            if (resultsSection) resultsSection.style.display = 'block';

            // Success / warning banner
            if (data.root !== null && data.root !== undefined) {
                const rootNum = parseFloat(data.root);
                if (successBanner) successBanner.style.display = 'flex';
                if (rootValue) rootValue.textContent = rootNum.toFixed(10);
            } else {
                if (successBanner) successBanner.style.display = 'none';
                // Show non-fatal warning
                if (data.error_msg) {
                    if (errorBanner) errorBanner.style.display = 'flex';
                    if (errorMsg)    errorMsg.textContent = data.error_msg;
                }
            }

            // Table
            renderTable(data.results || []);

            // Steps
            renderSteps(data.steps || []);

            // Store for slider
            iterHistory = data.results || [];
            lastFuncStr = data.func_str || func;

            // Slider
            if (iterSlider) {
                iterSlider.max   = Math.max(0, iterHistory.length - 1);
                iterSlider.value = 0;
            }
            if (sliderValue) sliderValue.textContent = '0';

            // Desmos
            updateDesmos(lastFuncStr, data.root, iterHistory);

            // Save to history
            if (data.root !== null && data.root !== undefined) {
                calcHistory.push({ func, x0, root: parseFloat(data.root).toFixed(8) });
                if (calcHistory.length > 20) calcHistory.shift();
                localStorage.setItem('calcHistory', JSON.stringify(calcHistory));
            }

            // Scroll to results
            resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });

        } catch (err) {
            if (errorBanner) errorBanner.style.display = 'flex';
            if (errorMsg)    errorMsg.textContent = 'Network error: ' + err.message;
        } finally {
            if (calcBtn) {
                calcBtn.disabled = false;
                calcBtn.innerHTML = 'COMPUTE SOLUTION <span class="btn-dot"></span>';
            }
        }
    });

    /* ─── Find next root ────────────────────────────────────────── */
    document.getElementById('findNextRootBtn')?.addEventListener('click', () => {
        const guessInput = document.getElementById('initial_guess');
        if (guessInput) {
            const current = parseFloat(guessInput.value) || 0;
            guessInput.value = (current + (Math.random() * 4 - 2)).toFixed(4);
        }
        calcForm?.dispatchEvent(new Event('submit'));
    });

    /* ─── Export to Excel (.xlsx) ───────────────────────────────── */
    document.getElementById('exportExcelBtn')?.addEventListener('click', () => {
        if (typeof XLSX === 'undefined') {
            alert('SheetJS not loaded yet. Please wait a moment and try again.');
            return;
        }
        const table = document.getElementById('resultsTable');
        if (!table) return;

        const clone = table.cloneNode(true);
        // Clean up MathJax rendered headers
        clone.querySelectorAll('th').forEach(th => {
            th.innerText = th.innerText
                .replace(/\\[\(\)]/g, '')
                .replace(/[\\{}]/g, '')
                .trim();
        });

        const wb = XLSX.utils.table_to_book(clone, { sheet: 'Newton-Raphson' });
        XLSX.writeFile(wb, 'newton_raphson_results.xlsx');
    });

    /* ─── Download graph PNG ────────────────────────────────────── */
    document.getElementById('downloadGraphBtn')?.addEventListener('click', () => {
        if (!window.desmosCalc) return;
        window.desmosCalc.asyncScreenshot(
            { width: 1200, height: 800, targetPixelRatio: 2, preserveAxisNumbers: true },
            (dataUri) => {
                const a = document.createElement('a');
                a.href     = dataUri;
                a.download = 'newton_raphson_graph.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        );
    });

    /* ─── Keyboard shortcut: Enter submits form ─────────────────── */
    document.getElementById('function_input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            calcForm?.dispatchEvent(new Event('submit'));
        }
    });

    /* ─── Live LaTeX preview ───────────────────────────────────── */
    const funcField    = document.getElementById('function_input');
    const latexPreview = document.getElementById('latexPreview');

    function simpleLatex(str) {
        // Convert user input to rough LaTeX for preview
        let s = str
            .replace(/\*\*/g, '^')
            .replace(/\*/g, ' \\cdot ')
            .replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}')
            .replace(/sin\(/g, '\\sin(')
            .replace(/cos\(/g, '\\cos(')
            .replace(/tan\(/g, '\\tan(')
            .replace(/log\(/g, '\\log(')
            .replace(/ln\(/g, '\\ln(')
            .replace(/exp\(/g, '\\exp(')
            .replace(/pi/g, '\\pi');
        return s;
    }

    if (funcField && latexPreview) {
        funcField.addEventListener('input', () => {
            const val = funcField.value.trim();
            if (!val) {
                latexPreview.innerHTML = '\\( f(x) = \\text{enter a function above} \\)';
            } else {
                latexPreview.innerHTML = `\\( f(x) = ${simpleLatex(val)} \\)`;
            }
            if (window.MathJax) MathJax.typesetPromise([latexPreview]).catch(() => {});
        });
    }

    /* ─── Scroll to results after compute ──────────────────────── */
    const resultsPage = document.getElementById('results-page');
    if (resultsSection) {
        const observer = new MutationObserver(() => {
            if (resultsSection.style.display !== 'none' && resultsPage) {
                resultsPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        observer.observe(resultsSection, { attributes: true, attributeFilter: ['style'] });
    }

});

