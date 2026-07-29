// SIMULATION & ROBUSTNESS TESTING MODULE - HORMIGONMIX AI
document.addEventListener("DOMContentLoaded", () => {
    const btnOpenSimModal = document.getElementById("btnOpenSimModal");
    const btnCloseSimulationModal = document.getElementById("btnCloseSimulationModal");
    const simulationModal = document.getElementById("simulationModal");
    const btnStartSimulation = document.getElementById("btnStartSimulation");
    const simProgressBar = document.getElementById("simProgressBar");
    const simProgressPct = document.getElementById("simProgressPct");
    const simCurrentCount = document.getElementById("simCurrentCount");
    const simSuccessCount = document.getElementById("simSuccessCount");
    const simFailedCount = document.getElementById("simFailedCount");
    const simLogConsole = document.getElementById("simLogConsole");

    if (!btnOpenSimModal) return;

    btnOpenSimModal.addEventListener("click", () => {
        simulationModal.classList.add("open");
    });

    btnCloseSimulationModal.addEventListener("click", () => {
        simulationModal.classList.remove("open");
    });

    btnStartSimulation.addEventListener("click", runRobustnessSimulation);

    function logToConsole(text, type = "info") {
        const color = type === "error" ? "#ef4444" : (type === "success" ? "#10b981" : "#a1a1aa");
        const entry = document.createElement("div");
        entry.style.color = color;
        entry.style.marginBottom = "3px";
        entry.innerHTML = `[${new Date().toLocaleTimeString()}] ${text}`;
        simLogConsole.appendChild(entry);
        simLogConsole.scrollTop = simLogConsole.scrollHeight;
    }

    async function runRobustnessSimulation() {
        btnStartSimulation.disabled = true;
        simLogConsole.innerHTML = "";
        logToConsole("Capturando estado inicial de la interfaz...", "info");

        // Save original UI state to restore it later
        const originalState = {
            selectStructuralElement: document.getElementById("selectStructuralElement").value,
            selectConcreteClass: document.getElementById("selectConcreteClass").value,
            selectExposureClass: document.getElementById("selectExposureClass").value,
            selectDesignMethod: document.getElementById("selectDesignMethod").value,
            selectCementCategory: document.getElementById("selectCementCategory").value,
            inputManualStrength: document.getElementById("inputManualStrength").value,
            inputBatchVolume: document.getElementById("inputBatchVolume").value,
            inputCustomCement: document.getElementById("inputCustomCement").value,
            inputCustomWC: document.getElementById("inputCustomWC").value,
            inputCustomBolomeyA: document.getElementById("inputCustomBolomeyA").value,
            inputMaxSieveSize: document.getElementById("inputMaxSieveSize").value,
            inputAirPercentage: document.getElementById("inputAirPercentage").value,
            moistSand: document.getElementById("moistSand").value,
            moistStone: document.getElementById("moistStone").value,
            absSand: document.getElementById("absSand").value,
            absStone: document.getElementById("absStone").value,
            densCement: document.getElementById("densCement").value,
            coefCement: document.getElementById("coefCement").value,
            densSand: document.getElementById("densSand").value,
            coefSand: document.getElementById("coefSand").value,
            densStone: document.getElementById("densStone").value,
            coefStone: document.getElementById("coefStone").value,
            sieveValues: Array.from(document.querySelectorAll(".sand-sieve, .gravilla-sieve, .grava-sieve")).map(el => el.value)
        };

        logToConsole("Iniciando bucle de simulación aleatoria (1000 iteraciones)...", "info");

        const elements = ["fund_pilotes", "fund_directas", "estructuras_elev", "tabiques", "columnas_alta", "pavimentos", "pisos_ind", "proyectado", "clima_frio", "clima_calido", "puentes", "relleno", "personalizado"];
        const classes = ["H8", "H15", "H20", "H21", "H25", "H30", "H35", "H38", "H40", "H45", "Personalizado"];
        const exposures = ["ninguna", "a2", "a3", "h1", "c1", "c2", "q1", "q2", "q3", "m1", "m2"];
        const methods = ["bolomey", "fuller", "delapena", "aci"];
        const categories = ["CPC40", "CPN50", "CPC30", "LC3"];

        let totalTests = 1000;
        let success = 0;
        let failed = 0;
        let batchSize = 50;

        for (let i = 0; i < totalTests; i += batchSize) {
            // Run a batch of tests
            for (let j = 0; j < batchSize && (i + j) < totalTests; j++) {
                const currentTestIndex = i + j + 1;
                
                // Randomize values
                const randomElement = elements[Math.floor(Math.random() * elements.length)];
                const randomClass = classes[Math.floor(Math.random() * classes.length)];
                const randomExposure = exposures[Math.floor(Math.random() * exposures.length)];
                const randomMethod = methods[Math.floor(Math.random() * methods.length)];
                const randomCategory = categories[Math.floor(Math.random() * categories.length)];
                
                // Apply randomized inputs directly to DOM
                document.getElementById("selectStructuralElement").value = randomElement;
                document.getElementById("selectConcreteClass").value = randomClass;
                document.getElementById("selectExposureClass").value = randomExposure;
                document.getElementById("selectDesignMethod").value = randomMethod;
                document.getElementById("selectCementCategory").value = randomCategory;
                
                // Random manual parameters (including edge cases)
                document.getElementById("inputManualStrength").value = (Math.random() * 80 - 10).toFixed(0); // -10 to 70 MPa (to test negative values)
                document.getElementById("inputBatchVolume").value = (Math.random() * 990 + 10).toFixed(0);
                document.getElementById("inputCustomCement").value = (Math.random() * 500 - 50).toFixed(0); // -50 to 450 kg/m³
                document.getElementById("inputCustomWC").value = (Math.random() * 0.8 + 0.1).toFixed(2); // 0.10 to 0.90 w/c
                document.getElementById("inputCustomBolomeyA").value = (Math.random() * 20 + 2).toFixed(1);
                document.getElementById("inputMaxSieveSize").value = [9.5, 12.5, 19.0, 25.0, 37.5][Math.floor(Math.random() * 5)];
                document.getElementById("inputAirPercentage").value = (Math.random() * 10).toFixed(1); // 0 to 10%
                
                // Aggregates moisture and absorption
                document.getElementById("moistSand").value = (Math.random() * 150).toFixed(0);
                document.getElementById("moistStone").value = (Math.random() * 100).toFixed(0);
                document.getElementById("absSand").value = (Math.random() * 4.0).toFixed(1);
                document.getElementById("absStone").value = (Math.random() * 3.0).toFixed(1);
                
                // Densities and coefficients (with chance of invalid inputs to test robustness)
                document.getElementById("densCement").value = (Math.random() * 2000 - 500).toFixed(0); // -500 to 1500
                document.getElementById("coefCement").value = (Math.random() * 0.8 - 0.2).toFixed(2); // -0.20 to 0.60
                document.getElementById("densSand").value = (Math.random() * 2000 - 500).toFixed(0);
                document.getElementById("coefSand").value = (Math.random() * 0.8 - 0.2).toFixed(2);
                document.getElementById("densStone").value = (Math.random() * 2000 - 500).toFixed(0);
                document.getElementById("coefStone").value = (Math.random() * 0.8 - 0.2).toFixed(2);
                
                // Sieves retained weights (can generate all-zero grids)
                const makeZero = Math.random() < 0.05; // 5% chance of all zero sieves
                document.querySelectorAll(".sand-sieve").forEach(el => {
                    el.value = makeZero ? "0" : (Math.random() * 300).toFixed(0);
                });
                document.querySelectorAll(".gravilla-sieve").forEach(el => {
                    el.value = makeZero ? "0" : (Math.random() * 300).toFixed(0);
                });
                document.querySelectorAll(".grava-sieve").forEach(el => {
                    el.value = makeZero ? "0" : (Math.random() * 400).toFixed(0);
                });

                // Trigger calculateAndUpdate
                try {
                    if (typeof window.calculateAndUpdate === "function") {
                        window.calculateAndUpdate();
                    }
                    
                    // Inspect results
                    const resCement = parseFloat(document.getElementById("resCement").innerText);
                    const resWater = parseFloat(document.getElementById("resWaterCorrected").innerText);
                    const resSand = parseFloat(document.getElementById("resSand").innerText);
                    const resGravilla = parseFloat(document.getElementById("resGravilla").innerText);
                    const resGrava = parseFloat(document.getElementById("resGrava").innerText);
                    const resSlump = parseFloat(document.getElementById("resSlump").innerText);
                    const resMF = parseFloat(document.getElementById("resMF").innerText);
                    const resFactorG = parseFloat(document.getElementById("resFactorGDisplay").innerText);

                    const hasNaN = isNaN(resCement) || isNaN(resWater) || isNaN(resSand) || isNaN(resGravilla) || isNaN(resGrava) || isNaN(resSlump) || isNaN(resMF) || isNaN(resFactorG);
                    const hasInf = !isFinite(resCement) || !isFinite(resWater) || !isFinite(resSand) || !isFinite(resGravilla) || !isFinite(resGrava) || !isFinite(resSlump) || !isFinite(resMF) || !isFinite(resFactorG);
                    const hasNegatives = resCement < 0 || resWater < 0 || resSand < 0 || resGravilla < 0 || resGrava < 0 || resSlump < 0 || resMF < 0 || resFactorG < 0;
                    
                    if (hasNaN || hasInf || hasNegatives) {
                        failed++;
                        logToConsole(`FALLO #${currentTestIndex}: Elem: ${randomElement}, Clase: ${randomClass}, Método: ${randomMethod}. Cemento: ${resCement}, Agua: ${resWater}, Arena: ${resSand}, Gravilla: ${resGravilla}, Grava: ${resGrava}, Slump: ${resSlump}, G: ${resFactorG}`, "error");
                    } else {
                        success++;
                    }
                } catch (err) {
                    failed++;
                    logToConsole(`EXCEPCIÓN #${currentTestIndex} con inputs aleatorios: ${err.message}`, "error");
                }
            }

            // Update progress UI
            const currentProgress = i + batchSize > totalTests ? totalTests : i + batchSize;
            const pct = Math.round((currentProgress / totalTests) * 100);
            simProgressBar.style.width = `${pct}%`;
            simProgressPct.innerText = `${pct}%`;
            simCurrentCount.innerText = currentProgress;
            simSuccessCount.innerText = success;
            simFailedCount.innerText = failed;

            // Yield control back to browser to prevent freezing and animate
            await new Promise(resolve => requestAnimationFrame(resolve));
        }

        logToConsole(`Simulación completada. Éxito: ${success}, Fallas: ${failed}`, failed > 0 ? "error" : "success");
        btnStartSimulation.disabled = false;

        logToConsole("Restaurando estado original de la interfaz...", "info");
        // Restore original UI state
        document.getElementById("selectStructuralElement").value = originalState.selectStructuralElement;
        document.getElementById("selectConcreteClass").value = originalState.selectConcreteClass;
        document.getElementById("selectExposureClass").value = originalState.selectExposureClass;
        document.getElementById("selectDesignMethod").value = originalState.selectDesignMethod;
        document.getElementById("selectCementCategory").value = originalState.selectCementCategory;
        document.getElementById("inputManualStrength").value = originalState.inputManualStrength;
        document.getElementById("inputBatchVolume").value = originalState.inputBatchVolume;
        document.getElementById("inputCustomCement").value = originalState.inputCustomCement;
        document.getElementById("inputCustomWC").value = originalState.inputCustomWC;
        document.getElementById("inputCustomBolomeyA").value = originalState.inputCustomBolomeyA;
        document.getElementById("inputMaxSieveSize").value = originalState.inputMaxSieveSize;
        document.getElementById("inputAirPercentage").value = originalState.inputAirPercentage;
        document.getElementById("moistSand").value = originalState.moistSand;
        document.getElementById("moistStone").value = originalState.moistStone;
        document.getElementById("absSand").value = originalState.absSand;
        document.getElementById("absStone").value = originalState.absStone;
        document.getElementById("densCement").value = originalState.densCement;
        document.getElementById("coefCement").value = originalState.coefCement;
        document.getElementById("densSand").value = originalState.densSand;
        document.getElementById("coefSand").value = originalState.coefSand;
        document.getElementById("densStone").value = originalState.densStone;
        document.getElementById("coefStone").value = originalState.coefStone;
        
        const sieveInputs = document.querySelectorAll(".sand-sieve, .gravilla-sieve, .grava-sieve");
        originalState.sieveValues.forEach((val, idx) => {
            if (sieveInputs[idx]) sieveInputs[idx].value = val;
        });

        // Trigger final recalculate to put the UI back in its initial state
        if (typeof window.calculateAndUpdate === "function") {
            window.calculateAndUpdate();
        }
        logToConsole("Interfaz restaurada exitosamente.", "success");
    }
});
