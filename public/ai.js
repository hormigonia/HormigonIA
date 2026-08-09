// AI ASSISTANT MODULE - HORMIGONIA

// Chat history in-memory
let conversationHistory = [];

// Initialize Chat Event Listeners safely
document.addEventListener("DOMContentLoaded", () => {
    const chatMessages = document.getElementById("chatMessages");
    const chatInput = document.getElementById("chatInput");
    const btnSendChat = document.getElementById("btnSendChat");
    const btnClearChat = document.getElementById("btnClearChat");
    const aiTypingIndicator = document.getElementById("aiTypingIndicator");

    if (btnSendChat) {
        btnSendChat.addEventListener("click", handleUserMessage);
    }
    
    if (chatInput) {
        chatInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleUserMessage();
            }
        });
        chatInput.addEventListener("input", function() {
            this.style.height = "auto";
            this.style.height = (this.scrollHeight) + "px";
            if (this.scrollHeight > 150) {
                this.style.overflowY = "scroll";
                this.style.height = "150px";
            } else {
                this.style.overflowY = "hidden";
            }
        });
    }
    
    if (btnClearChat) {
        btnClearChat.addEventListener("click", () => {
            if (chatMessages) {
                chatMessages.innerHTML = `
                    <div class="chat-bubble ai">
                        <p>Conversación borrada. ¿En qué puedo ayudarte a diseñar hoy?</p>
                    </div>
                `;
            }
            conversationHistory = [];
        });
    }

    // Setup Quick Prompts
    document.querySelectorAll(".quick-prompt-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            if (chatInput) {
                chatInput.value = btn.innerText;
                handleUserMessage();
            }
        });
    });
});

// Capture entire UI State as JSON Context for the AI
function getCalculatorStateContext() {
    const activeClass = "H" + (document.getElementById("inputTargetStrength")?.value || "21");
    const batchVolumeL = parseFloat(document.getElementById("inputBatchVolume").value) || 80;
    
    const densCement = parseFloat(document.getElementById("densCement").value);
    const coefCement = parseFloat(document.getElementById("coefCement").value);
    const densSand = parseFloat(document.getElementById("densSand").value);
    const coefSand = parseFloat(document.getElementById("coefSand").value);
    const moistSand = parseFloat(document.getElementById("moistSand").value);
    const absSand = parseFloat(document.getElementById("absSand").value);
    const densGravilla = parseFloat(document.getElementById("densGravilla").value);
    const coefGravilla = parseFloat(document.getElementById("coefGravilla").value);
    const moistGravilla = parseFloat(document.getElementById("moistGravilla").value);
    const absGravilla = parseFloat(document.getElementById("absGravilla").value);
    const densGrava = parseFloat(document.getElementById("densGrava").value);
    const coefGrava = parseFloat(document.getElementById("coefGrava").value);
    const moistGrava = parseFloat(document.getElementById("moistGrava").value);
    const absGrava = parseFloat(document.getElementById("absGrava").value);

    // Sieve data (captured as retained weights and calculated passing percentages)
    const sandSieves = [];
    const gravillaSieves = [];
    const gravaSieves = [];
    const sandInputs = document.querySelectorAll(".sand-sieve");
    const gravillaInputs = document.querySelectorAll(".gravilla-sieve");
    const gravaInputs = document.querySelectorAll(".grava-sieve");
    const allSieveLabels = [37.5, 25.0, 19.0, 9.5, 4.75, 2.36, 1.18, 0.6, 0.3, 0.15];
    
    const globalSandPass = window.lastCalculatedPassingSand || [];
    const globalGravillaPass = window.lastCalculatedPassingGravilla || [];
    const globalGravaPass = window.lastCalculatedPassingGrava || [];
    
    for (let i = 0; i < allSieveLabels.length; i++) {
        sandSieves.push({
            sieve: allSieveLabels[i],
            retainedGrams: parseFloat(sandInputs[i]?.value || 0),
            passingPercent: globalSandPass[i] !== undefined ? globalSandPass[i] : 100
        });
        
        gravillaSieves.push({
            sieve: allSieveLabels[i],
            retainedGrams: parseFloat(gravillaInputs[i]?.value || 0),
            passingPercent: globalGravillaPass[i] !== undefined ? globalGravillaPass[i] : 100
        });

        gravaSieves.push({
            sieve: allSieveLabels[i],
            retainedGrams: parseFloat(gravaInputs[i]?.value || 0),
            passingPercent: globalGravaPass[i] !== undefined ? globalGravaPass[i] : 100
        });
    }

    // Results from DOM
    const resCement = document.getElementById("resCement").innerText;
    const resWater = document.getElementById("resWaterCorrected").innerText;
    const resSand = document.getElementById("resSand").innerText;
    const resGravilla = document.getElementById("resGravilla").innerText;
    const resGrava = document.getElementById("resGrava").innerText;
    const resSlump = document.getElementById("resSlump").innerText;
    const resMF = document.getElementById("resMF").innerText;
    const resFactorG = document.getElementById("resFactorGDisplay").innerText;

    // Additives
    const currentAdditives = additives.map(a => ({
        name: a.name,
        dosage: a.dosage,
        density: a.density
    }));

    return {
        selectedConcreteClass: activeClass,
        selectedSieveSeries: document.getElementById("selectSieveSeries").value,
        selectedDesignMethod: document.getElementById("selectDesignMethod").value,
        batchVolumeLiters: batchVolumeL,
        mixParameters: {
            cementDryPerM3: parseFloat(document.getElementById("inputCustomCement").value),
            waterCementRatio: parseFloat(document.getElementById("inputCustomWC").value),
            bolomeyA: parseFloat(document.getElementById("inputCustomBolomeyA").value),
            maxSieveD: parseFloat(document.getElementById("inputMaxSieveSize").value),
            targetSlumpCm: parseFloat(document.getElementById("inputSlumpTarget").value),
            targetAirPercentage: parseFloat(document.getElementById("inputAirPercentage").value)
        },
        materialsLabProperties: {
            cement: { bulkDensity: densCement, yieldCoef: coefCement },
            sand: { bulkDensity: densSand, yieldCoef: coefSand, moistureLperM3: moistSand, absorptionPercent: absSand },
            gravilla: { bulkDensity: densGravilla, yieldCoef: coefGravilla, moistureLperM3: moistGravilla, absorptionPercent: absGravilla },
            grava: { bulkDensity: densGrava, yieldCoef: coefGrava, moistureLperM3: moistGrava, absorptionPercent: absGrava }
        },
        customAdditives: currentAdditives,
        aggregatesGranulometry: {
            sand: sandSieves,
            gravilla: gravillaSieves,
            grava: gravaSieves
        },
        calculatedRecipeForBatchVolume: {
            cementKg: parseFloat(resCement),
            waterToAddLiters: parseFloat(resWater),
            wetSandKg: parseFloat(resSand),
            wetGravillaKg: parseFloat(resGravilla),
            wetGravaKg: parseFloat(resGrava)
        },
        calculatedProperties: {
            finenessModulus: parseFloat(resMF),
            factorGranulometryG: parseFloat(resFactorG),
            predictedSlumpCm: parseFloat(resSlump)
        }
    };
}

// User Message Handler
async function handleUserMessage() {
    const chatInput = document.getElementById("chatInput");
    const aiTypingIndicator = document.getElementById("aiTypingIndicator");

    if (!chatInput) return;
    const prompt = chatInput.value.trim();
    if (!prompt) return;

    // Append user message bubble
    appendMessageBubble("user", prompt);
    chatInput.value = "";
    chatInput.style.height = "auto";
    
    // Show typing loader
    if (aiTypingIndicator) aiTypingIndicator.classList.remove("hidden");
    
    try {
        // Prepare context payload
        const context = getCalculatorStateContext();
        
        // System Prompt defining the AI Engineer role & capabilities
        const systemPrompt = `Eres un Ingeniero Civil experto en Tecnología del Hormigón, dosificación de precisión (método ACI/Abrams) y laboratorios de control.
Estás asesorando a un operador en la dosificación y calibración del pastón de hormigón.
Utilizas la información técnica del calculador adjunta en el JSON de contexto.

ESTRUCTURA DE LA APLICACIÓN:
1. Parámetros del Proyecto: Elemento a hormigonar, Clase de hormigón Hx (H8 a H45), Clase de Exposición Ambiental (CIRSOC 201), Volumen de pastón, Temperatura ambiente y panel de geolocalización/clima.
2. Configuración Manual: Permite ajustar o forzar la Categoría de Cemento, la Resistencia especificada f'ce (MPa), el consumo de Cemento base, la Relación agua/cemento (w/c), el parámetro Bolomey A, el tamaño de tamiz máximo D y el Aire Objetivo.
3. Laboratorio de Hormigón: Propiedades físicas de los materiales (densidades, coeficientes de aporte, humedad y absorción) y tamizado granulométrico de áridos.

DETALLES DEL MOTOR DE CÁLCULO FÍSICO ACTUAL (Dosificación de Precisión):
1. El Agua de Amasado Base ($W_{base}$) se obtiene de tablas de consistencia y Módulo de Finura (MF) corregido por piedra partida (+7%) y aire.
2. El agua se reduce dinámicamente según los aditivos plastificantes cargados en la mezcla.
3. La relación a/c ($w/c$) de diseño se calcula analíticamente mediante la Ley de Abrams modificada para la Categoría de Cemento seleccionada: CPN50 ($K=120$), CPC40 ($K=96$), CPC30 ($K=75$) y LC3 ($K=85$) en base a la resistencia requerida de diseño ($f'_{cm} = f'_{ce} + 1.65 \\cdot S$ con $S = 4.0\\text{ MPa}$ constante).
4. La relación w/c se restringe por durabilidad según la Clase de Exposición Ambiental elegida (CIRSOC 201): por ejemplo, C2 (congelamiento con sales) limita w/c a 0.45 y requiere min H30 y 6% de aire; marina M2 limita w/c a 0.40 y requiere min H35.
5. El consumo de cemento ($C_{m3}$) se deriva dinámicamente: $C_{m3} = W_{target} / (w/c)$, con un mínimo estructural de $300\\text{ kg/m}^3$ (excepto H8 con $220\\text{ kg/m}^3$).
6. Modificar cualquiera de las variables de la sección "Configuración Manual" promueve automáticamente la mezcla al modo "Personalizado", dándole al operador control total sobre los valores del motor matemático.

INSTRUCCIONES CLAVE:
1. Explica los fenómenos físicos (demanda de agua por granulometría, desvíos respecto a la curva de Bolomey, efecto del tipo de cemento, influencia de la precisión en el pesado de materiales, etc.).
2. Si el usuario te pide realizar cambios en los parámetros del calculador, debes explicar la acción técnicamente y al FINAL de tu respuesta escribir un bloque JSON exclusivo bajo las etiquetas de formato triple acento grave (backticks) y la palabra "json".
El formato del JSON debe ser exactamente el siguiente, conteniendo solo las variables que deseas cambiar:

\`\`\`json
{
  "updateInputs": {
    "selectConcreteClass": "Personalizado", // H8, H15, H21, H30, H45, Personalizado
    "selectExposureClass": "ninguna", // ninguna, a2, a3, h1, c1, c2, q1, q2, q3, m1, m2
    "selectCementCategory": "CPC40", // CPC40, CPN50, CPC30, LC3
    "inputManualStrength": 30, // MPa
    "inputBatchVolume": 100, // número en Litros
    "inputCustomCement": 380, // kg/m³
    "inputCustomWC": 0.42,
    "inputCustomBolomeyA": 13.5,
    "inputMaxSieveSize": 19.0,
    "densSand": 1650,
    "moistSand": 90, // Humedad de arena en L/m³
    "moistStone": 45, // Humedad de piedra en L/m³
    "additives": [
      { "name": "Sikacrete (Plastificante)", "dosage": 0.8, "density": 1.11 },
      { "name": "Hidrófugo", "dosage": 1.5, "density": 1.0 }
    ]
  }
}
\`\`\`

3. Si no es necesario modificar campos del formulario, responde de manera normal en lenguaje natural. NUNCA menciones en tus respuestas palabras como "JSON", "bloque JSON", "parámetros técnicos del sistema", "actualización de código/formulario", "backend/frontend", ni expliques al usuario la ausencia de bloques de datos. Cualquier actualización de parámetros con bloques JSON es un proceso interno silencioso que el usuario no debe saber. Responde siempre con tono de Ingeniero Civil dirigiéndose a un colega en la obra.
4. Mantén las respuestas profesionales, concisas y en idioma español.`;

        // Push user message to conversation history
        conversationHistory.push({
            role: "user",
            parts: [{ text: `CONTEXTO ACTUAL DEL CALCULADOR EN TIEMPO REAL:\n${JSON.stringify(context, null, 2)}\n\nPREGUNTA DEL OPERADOR:\n${prompt}` }]
        });

        // Limit history to last 10 messages to keep request payload compact
        if (conversationHistory.length > 10) {
            conversationHistory = conversationHistory.slice(conversationHistory.length - 10);
        }

        // Map conversationHistory to standard OpenAI messages format for the API request
        const messages = [
            { role: "system", content: systemPrompt },
            ...conversationHistory.map(h => ({
                role: h.role === "model" ? "assistant" : "user",
                content: h.parts[0].text
            }))
        ];

        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "Error al conectar con la API de IA.");
        }

        const data = await response.json();
        const aiResponseText = data.response;
        
        if (!aiResponseText) {
            throw new Error("No se recibió respuesta del asistente de IA.");
        }

        // Add assistant response to history
        conversationHistory.push({
            role: "model",
            parts: [{ text: aiResponseText }]
        });

        // Process any updates returned by the AI
        const cleanText = processAIUpdates(aiResponseText);

        // Display AI message bubble
        appendMessageBubble("ai", cleanText);

    } catch (error) {
        console.error(error);
        appendMessageBubble("ai", `❌ **Error:** ${error.message}. Por favor, verifica la configuración de claves API del servidor backend o intenta nuevamente.`);
    } finally {
        if (aiTypingIndicator) aiTypingIndicator.classList.add("hidden");
    }
}

// Check for JSON block in the AI response and apply updates
function processAIUpdates(text) {
    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const match = text.match(jsonRegex);
    
    if (match && match[1]) {
        try {
            const data = JSON.parse(match[1]);
            if (data.updateInputs) {
                applyUIUpdates(data.updateInputs);
            }
        } catch (e) {
            console.error("Error al parsear actualizaciones JSON de la IA:", e);
        }
        // Return text stripping the JSON block to keep the UI response clean
        return text.replace(jsonRegex, "").trim();
    }
    return text;
}

// Apply values directly to the inputs and trigger calculation
function applyUIUpdates(updates) {
    let triggeredChange = false;

    // Map obsolete selectConcreteClass and inputManualStrength to inputTargetStrength
    if (updates.inputManualStrength !== undefined) {
        updates.inputTargetStrength = updates.inputManualStrength;
    } else if (updates.selectConcreteClass !== undefined && updates.selectConcreteClass !== "Personalizado") {
        const match = String(updates.selectConcreteClass).match(/\d+/);
        if (match) {
            updates.inputTargetStrength = parseInt(match[0]);
        }
    }

    // Simple mappings for direct inputs
    const simpleInputs = [
        "inputTargetStrength", "inputBatchVolume", "inputCustomCement", 
        "inputCustomWC", "inputCustomBolomeyA", "inputMaxSieveSize",
        "densSand", "moistSand", "absSand", "densGravilla", "moistGravilla",
        "absGravilla", "densGrava", "moistGrava", "absGrava", "densCement",
        "coefCement", "coefSand", "coefGravilla", "coefGrava",
        "selectExposureClass", "selectCementCategory",
        "selectSieveSeries", "inputSlumpTarget", "inputAirPercentage"
    ];

    simpleInputs.forEach(id => {
        if (updates[id] !== undefined) {
            const el = document.getElementById(id);
            if (el) {
                el.value = updates[id];
                // Trigger events
                if (id === "inputBatchVolume") {
                    const batchVolDisplay = document.getElementById("batchVolumeDisplay");
                    if (batchVolDisplay) batchVolDisplay.innerText = updates[id];
                }
                if (id === "selectSieveSeries") {
                    if (typeof updateSieveTableLabels === "function") {
                        updateSieveTableLabels();
                    }
                }
                triggeredChange = true;
            }
        }
    });



    // Special handling for dynamic additives list
    if (updates.additives && Array.isArray(updates.additives)) {
        additives = updates.additives.map((add, idx) => {
            // Find typeKey by matching name in PREDEFINED_ADDITIVES catalog
            let matchedKey = "personalizado";
            const normName = add.name.toLowerCase();
            Object.keys(PREDEFINED_ADDITIVES).forEach(key => {
                const spec = PREDEFINED_ADDITIVES[key];
                if (normName.includes(spec.name.toLowerCase()) || spec.name.toLowerCase().includes(normName)) {
                    matchedKey = key;
                }
            });
            
            const spec = PREDEFINED_ADDITIVES[matchedKey];
            return {
                id: `add_ai_${idx}_${Date.now()}`,
                typeKey: matchedKey,
                name: matchedKey === "personalizado" ? add.name : spec.name,
                dosage: add.dosage !== undefined ? add.dosage : spec.defaultDosage,
                minDosage: spec.minDosage,
                maxDosage: spec.maxDosage,
                density: add.density !== undefined ? add.density : spec.density,
                type: spec.type
            };
        });
        renderAdditivesList();
        triggeredChange = true;
    }

    if (triggeredChange) {
        // Trigger core engine recalculation
        calculateAndUpdate();
        
        // Append a small systemic notice bubble to the chat
        appendSystemNotice("⚙️ Ajustes aplicados al formulario y recalculados.");
    }
}

// Append bubble helpers
function appendMessageBubble(sender, markdownText) {
    const chatMessages = document.getElementById("chatMessages");
    if (!chatMessages) return;
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${sender}`;
    
    // Simple markdown parsing for formatting in the chat bubble
    const htmlContent = parseSimpleMarkdown(markdownText);
    bubble.innerHTML = htmlContent;
    
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendSystemNotice(text) {
    const chatMessages = document.getElementById("chatMessages");
    if (!chatMessages) return;
    const notice = document.createElement("div");
    notice.style.fontSize = "0.75rem";
    notice.style.color = "var(--accent)";
    notice.style.backgroundColor = "rgba(16, 185, 129, 0.08)";
    notice.style.padding = "6px 12px";
    notice.style.borderRadius = "4px";
    notice.style.alignSelf = "center";
    notice.style.margin = "5px 0";
    notice.style.textAlign = "center";
    notice.innerText = text;
    
    chatMessages.appendChild(notice);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Basic markdown parser for displaying clean text with bold/italic list blocks
function parseSimpleMarkdown(text) {
    let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Bold (**text** or __text__)
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/__(.*?)__/g, "<strong>$1</strong>");

    // Italic (*text* or _text_)
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
    html = html.replace(/_(.*?)_/g, "<em>$1</em>");

    // Newlines to breaks
    html = html.replace(/\n/g, "<br>");

    return `<p>${html}</p>`;
}
