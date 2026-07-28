// CORE ENGINE - HORMIGONMIX AI (ICPA & LARRARD INTEGRATED)
import { 
    supabase, 
    signUp, 
    signIn, 
    signOut, 
    getSession, 
    onAuthStateChange, 
    saveConcreteMix, 
    getUserMixes, 
    deleteMix 
} from './supabase-client.js';

// Concrete Classes defaults for ICPA rational design
const CONCRETE_CLASSES = {
    "H8": { fce: 8, bolomeyA: 16.0, slump: 3.0 },
    "H15": { fce: 15, bolomeyA: 14.5, slump: 6.0 },
    "H20": { fce: 20, bolomeyA: 13.5, slump: 7.0 },
    "H21": { fce: 21, bolomeyA: 13.0, slump: 8.0 },
    "H25": { fce: 25, bolomeyA: 12.5, slump: 9.0 },
    "H30": { fce: 30, bolomeyA: 12.0, slump: 10.0 },
    "H35": { fce: 35, bolomeyA: 11.5, slump: 12.0 },
    "H38": { fce: 38, bolomeyA: 11.0, slump: 13.0 },
    "H40": { fce: 40, bolomeyA: 10.5, slump: 14.0 },
    "H45": { fce: 45, bolomeyA: 10.0, slump: 15.0 }
};

// Sieve Sizes for ASTM series (mm)
const SIEVE_SIZES = [37.5, 25.0, 19.0, 9.5, 4.75, 2.36, 1.18, 0.6, 0.3, 0.15];
const G_FACTOR_SIEVES = [4.75, 2.36, 1.18, 0.6, 0.3, 0.15];
const FM_SIEVES = [37.5, 19.0, 9.5, 4.75, 2.36, 1.18, 0.6, 0.3, 0.15];

const SIEVE_SERIES_LABELS = {
    "ASTM": {
        "37.5": '1 1/2"',
        "25.0": '1"',
        "19.0": '3/4"',
        "9.5": '3/8"',
        "4.75": 'N° 4',
        "2.36": 'N° 8',
        "1.18": 'N° 16',
        "0.6": 'N° 30',
        "0.3": 'N° 50',
        "0.15": 'N° 100',
        "0.0": "Fondo (Pan)"
    },
    "IRAM": {
        "37.5": "37,5 mm",
        "25.0": "25,0 mm",
        "19.0": "19,0 mm",
        "9.5": "9,50 mm",
        "4.75": "4,75 mm",
        "2.36": "2,36 mm",
        "1.18": "1,18 mm",
        "0.6": "600 μm",
        "0.3": "300 μm",
        "0.15": "150 μm",
        "0.0": "Fondo"
    },
    "UNE": {
        "37.5": "37,5 mm",
        "25.0": "25,0 mm",
        "19.0": "20,0 mm",
        "9.5": "10,0 mm",
        "4.75": "5,00 mm",
        "2.36": "2,00 mm",
        "1.18": "1,00 mm",
        "0.6": "0,50 mm",
        "0.3": "0,25 mm",
        "0.15": "0,125 mm",
        "0.0": "Fondo"
    },
    "ISO": {
        "37.5": "37,5 mm",
        "25.0": "25,0 mm",
        "19.0": "20,0 mm",
        "9.5": "10,0 mm",
        "4.75": "5,00 mm",
        "2.36": "2,00 mm",
        "1.18": "1,00 mm",
        "0.6": "500 μm",
        "0.3": "250 μm",
        "0.15": "125 μm",
        "0.0": "Fondo"
    },
    "ACI": {
        "37.5": "1-1/2 in. (37.5 mm)",
        "25.0": "1 in. (25.0 mm)",
        "19.0": "3/4 in. (19.0 mm)",
        "9.5": "3/8 in. (9.5 mm)",
        "4.75": "No. 4 (4.75 mm)",
        "2.36": "No. 8 (2.36 mm)",
        "1.18": "No. 16 (1.18 mm)",
        "0.6": "No. 30 (600 μm)",
        "0.3": "No. 50 (300 μm)",
        "0.15": "No. 100 (150 μm)",
        "0.0": "Pan (Fondo)"
    }
};

// Abaco 1: Water Demand Lookup Grid (MF vs Slump)
// Columns: Slump [2, 5, 10, 15, 20] cm
// Rows: MF [3.0, 4.0, 5.0, 6.0, 6.5]
const ABACO1_GRID = {
    mfValues: [3.0, 4.0, 5.0, 6.0, 6.5],
    slumpValues: [2, 5, 10, 15, 20],
    data: [
        [204, 218, 234, 244, 250], // MF 3.0
        [174, 187, 202, 212, 220], // MF 4.0
        [151, 164, 178, 188, 195], // MF 5.0
        [134, 145, 156, 165, 172], // MF 6.0
        [127, 138, 148, 157, 163]  // MF 6.5
    ]
};

// State Variables
let chartInstance = null;
let currentChartMode = 'sieves'; // 'sieves' or 'larrard'
let lastCalculatedPassingSand = [];
let lastCalculatedPassingStone = [];
let currentClimateTemp = 20; // Default temperature (20°C)

const PREDEFINED_ADDITIVES = {
    "sikacrete_plus": {
        name: "Sikacrete® PLUS",
        minDosage: 0.50,
        maxDosage: 0.90,
        defaultDosage: 0.65,
        density: 1.11,
        type: "plasticizer",
        getReduction: (dosage) => 7.0 + (dosage - 0.5) * 7.5
    },
    "sikacrete_plast": {
        name: "Sikacrete® (Plastificante)",
        minDosage: 0.50,
        maxDosage: 1.20,
        defaultDosage: 0.65,
        density: 1.11,
        type: "plasticizer",
        getReduction: (dosage) => 7.0 + (dosage - 0.5) * 5.7
    },
    "sikafume_silice": {
        name: "SikaFume® (Microsílice)",
        minDosage: 5.00,
        maxDosage: 10.00,
        defaultDosage: 8.00,
        density: 2.20,
        type: "fume",
        getReduction: (dosage) => 0
    },
    "protex_plast_plus": {
        name: "PROTEX Plast Plus",
        minDosage: 0.20,
        maxDosage: 0.70,
        defaultDosage: 0.40,
        density: 1.03,
        type: "plasticizer",
        getReduction: (dosage) => 8.0 + (dosage - 0.2) * 14.0
    },
    "protex_hidro": {
        name: "PROTEX Hidro (Líquido)",
        minDosage: 1.00,
        maxDosage: 3.00,
        defaultDosage: 2.00,
        density: 1.00,
        type: "hidrofugo",
        getReduction: (dosage) => 0
    },
    "protex_1": {
        name: "PROTEX 1 (Hidrófugo Pasta)",
        minDosage: 1.00,
        maxDosage: 3.00,
        defaultDosage: 2.00,
        density: 1.00,
        type: "hidrofugo",
        getReduction: (dosage) => 0
    },
    "protex_20_s_plus": {
        name: "PROTEX 20 S Plus",
        minDosage: 0.40,
        maxDosage: 0.70,
        defaultDosage: 0.50,
        density: 1.09,
        type: "plasticizer",
        getReduction: (dosage) => 8.0 + (dosage - 0.4) * 13.3
    },
    "protex_19_s": {
        name: "PROTEX 19 S",
        minDosage: 0.30,
        maxDosage: 0.70,
        defaultDosage: 0.50,
        density: 1.05,
        type: "plasticizer",
        getReduction: (dosage) => 5.0 + (dosage - 0.3) * 7.5
    },
    "protex_3": {
        name: "PROTEX 3 (Inc. Aire)",
        minDosage: 0.05,
        maxDosage: 0.15,
        defaultDosage: 0.10,
        density: 1.00,
        type: "plasticizer",
        getReduction: (dosage) => 0
    },
    "protex_2011": {
        name: "PROTEX 2011 (Superplast.)",
        minDosage: 0.40,
        maxDosage: 0.80,
        defaultDosage: 0.60,
        density: 1.10,
        type: "plasticizer",
        getReduction: (dosage) => 10.0 + (dosage - 0.4) * 12.5
    },
    "protex_rapid_30sc": {
        name: "PROTEX Rapid 30SC",
        minDosage: 1.00,
        maxDosage: 2.50,
        defaultDosage: 1.50,
        density: 1.25,
        type: "plasticizer",
        getReduction: (dosage) => 0
    },
    "protex_bombeo": {
        name: "PROTEX Bombeo",
        minDosage: 0.30,
        maxDosage: 0.80,
        defaultDosage: 0.50,
        density: 1.08,
        type: "plasticizer",
        getReduction: (dosage) => 5.0 + (dosage - 0.3) * 6.0
    },
    "protex_plast_50l": {
        name: "PROTEX Plast 50L",
        minDosage: 0.30,
        maxDosage: 0.70,
        defaultDosage: 0.50,
        density: 1.04,
        type: "plasticizer",
        getReduction: (dosage) => 5.0 + (dosage - 0.3) * 12.5
    },
    "protex_frio_10": {
        name: "PROTEX Frio 10",
        minDosage: 1.00,
        maxDosage: 3.00,
        defaultDosage: 2.00,
        density: 1.20,
        type: "plasticizer",
        getReduction: (dosage) => 0
    },
    "protex_retard": {
        name: "PROTEX Retard",
        minDosage: 0.20,
        maxDosage: 0.50,
        defaultDosage: 0.35,
        density: 1.05,
        type: "plasticizer",
        getReduction: (dosage) => 0
    },
    "personalizado": {
        name: "[Personalizado / Otro]",
        minDosage: 0.00,
        maxDosage: 15.00,
        defaultDosage: 0.50,
        density: 1.00,
        type: "plasticizer",
        getReduction: (dosage) => dosage * 12.3
    }
};

const CLASS_STRENGTHS = { 
    "H8": 8, 
    "H15": 15, 
    "H20": 20, 
    "H21": 21, 
    "H25": 25, 
    "H30": 30, 
    "H35": 35, 
    "H38": 38, 
    "H40": 40, 
    "H45": 45, 
    "Personalizado": 0 
};

const CLASS_SEQUENCE = ["H8", "H15", "H20", "H21", "H25", "H30", "H35", "H38", "H40", "H45", "Personalizado"];
let currentClassIndex = 3; // H21 default

const EXPOSURE_CONSTRAINTS = {
    "ninguna": { minClass: "H8", maxWC: 0.85, minAir: 1.0, additives: [] },
    "a2": { minClass: "H21", maxWC: 0.60, minAir: 1.0, additives: [{ typeKey: "sikacrete_plus", dosage: 0.65 }] },
    "a3": { minClass: "H25", maxWC: 0.50, minAir: 1.0, additives: [{ typeKey: "protex_plast_plus", dosage: 0.40 }] },
    "h1": { minClass: "H25", maxWC: 0.50, minAir: 1.0, additives: [{ typeKey: "protex_hidro", dosage: 2.00 }] },
    "c1": { minClass: "H25", maxWC: 0.50, minAir: 5.0, additives: [{ typeKey: "protex_3", dosage: 0.10 }] },
    "c2": { minClass: "H30", maxWC: 0.45, minAir: 6.0, additives: [{ typeKey: "protex_3", dosage: 0.10 }] },
    "q1": { minClass: "H25", maxWC: 0.50, minAir: 1.0, additives: [{ typeKey: "protex_plast_plus", dosage: 0.40 }] },
    "q2": { minClass: "H30", maxWC: 0.45, minAir: 1.0, additives: [{ typeKey: "protex_2011", dosage: 0.60 }] },
    "q3": { minClass: "H35", maxWC: 0.40, minAir: 1.0, additives: [{ typeKey: "sikafume_silice", dosage: 8.00 }, { typeKey: "protex_2011", dosage: 0.70 }] },
    "m1": { minClass: "H30", maxWC: 0.45, minAir: 1.0, additives: [{ typeKey: "sikafume_silice", dosage: 8.00 }, { typeKey: "protex_2011", dosage: 0.60 }] },
    "m2": { minClass: "H35", maxWC: 0.40, minAir: 1.0, additives: [{ typeKey: "sikafume_silice", dosage: 10.00 }, { typeKey: "protex_2011", dosage: 0.70 }] }
};



const ELEMENT_SETTINGS = {
    "fund_pilotes": {
        minClass: "H25",
        maxSieve: 19.0,
        additives: [
            { typeKey: "protex_bombeo", dosage: 0.50 }
        ]
    },
    "fund_directas": {
        minClass: "H25",
        maxSieve: 37.5,
        additives: [
            { typeKey: "protex_hidro", dosage: 2.00 }
        ]
    },
    "estructuras_elev": {
        minClass: "H21",
        maxSieve: 25.0,
        additives: [
            { typeKey: "sikacrete_plus", dosage: 0.65 }
        ]
    },
    "tabiques": {
        minClass: "H25",
        maxSieve: 19.0,
        additives: [
            { typeKey: "protex_2011", dosage: 0.60 }
        ]
    },
    "columnas_alta": {
        minClass: "H30",
        maxSieve: 19.0,
        additives: [
            { typeKey: "protex_2011", dosage: 0.70 },
            { typeKey: "sikafume_silice", dosage: 8.00 }
        ]
    },
    "pavimentos": {
        minClass: "H30",
        maxSieve: 37.5,
        additives: [
            { typeKey: "protex_3", dosage: 0.10 },
            { typeKey: "protex_19_s", dosage: 0.50 }
        ]
    },
    "pisos_ind": {
        minClass: "H25",
        maxSieve: 25.0,
        additives: [
            { typeKey: "protex_bombeo", dosage: 0.50 }
        ]
    },
    "proyectado": {
        minClass: "H25",
        maxSieve: 9.5,
        additives: [
            { typeKey: "protex_rapid_30sc", dosage: 1.50 }
        ]
    },
    "clima_frio": {
        minClass: "H25",
        maxSieve: 25.0,
        additives: [
            { typeKey: "protex_frio_10", dosage: 2.00 }
        ]
    },
    "clima_calido": {
        minClass: "H25",
        maxSieve: 25.0,
        additives: [
            { typeKey: "protex_retard", dosage: 0.35 }
        ]
    },
    "puentes": {
        minClass: "H35",
        maxSieve: 25.0,
        additives: [
            { typeKey: "sikafume_silice", dosage: 8.00 },
            { typeKey: "protex_2011", dosage: 0.75 }
        ]
    },
    "relleno": {
        minClass: "H8",
        maxSieve: 37.5,
        additives: []
    },
    "personalizado": {
        minClass: "H8",
        maxSieve: 37.5,
        additives: []
    }
};

let additives = [
    { id: "add_1", typeKey: "sikacrete_plast", name: "Sikacrete® (Plastificante)", dosage: 0.65, minDosage: 0.50, maxDosage: 1.20, density: 1.11, type: "plasticizer" },
    { id: "add_2", typeKey: "protex_hidro", name: "PROTEX Hidro (Líquido)", dosage: 2.00, minDosage: 1.00, maxDosage: 3.00, density: 1.00, type: "hidrofugo" }
];

// Universal loosening and wall effect functions for Larrard LPDM
function looseningEffect(z) {
    return 0.7 * (1 - z) + 0.3 * Math.pow(1 - z, 12);
}

function wallEffect(z) {
    return Math.pow(1 - z, 1.3);
}

// Sieve representative diameters (geometric mean of limits)
function getRepresentativeDiameters() {
    const diams = [];
    const sizes = [50.0, ...SIEVE_SIZES, 0.0];
    for (let i = 0; i < SIEVE_SIZES.length + 1; i++) {
        diams.push(Math.sqrt(sizes[i] * sizes[i+1]));
    }
    return diams;
}

// Bilinear Interpolation for Water Demand (Abaco 1)
function interpolateWaterDemand(mf, slump) {
    const mfs = ABACO1_GRID.mfValues;
    const slumps = ABACO1_GRID.slumpValues;
    
    // Clamp values to grid bounds
    const cleanMF = Math.max(mfs[0], Math.min(mfs[mfs.length - 1], mf));
    const cleanSlump = Math.max(slumps[0], Math.min(slumps[slumps.length - 1], slump));
    
    // Find surrounding indices
    let mfIdx = 0;
    for (let i = 0; i < mfs.length - 1; i++) {
        if (cleanMF >= mfs[i] && cleanMF <= mfs[i+1]) {
            mfIdx = i;
            break;
        }
    }
    
    let slumpIdx = 0;
    for (let i = 0; i < slumps.length - 1; i++) {
        if (cleanSlump >= slumps[i] && cleanSlump <= slumps[i+1]) {
            slumpIdx = i;
            break;
        }
    }
    
    // Grid corner values
    const q11 = ABACO1_GRID.data[mfIdx][slumpIdx];
    const q21 = ABACO1_GRID.data[mfIdx+1][slumpIdx];
    const q12 = ABACO1_GRID.data[mfIdx][slumpIdx+1];
    const q22 = ABACO1_GRID.data[mfIdx+1][slumpIdx+1];
    
    // Bilinear interpolation formula
    const x1 = mfs[mfIdx], x2 = mfs[mfIdx+1];
    const y1 = slumps[slumpIdx], y2 = slumps[slumpIdx+1];
    
    const r1 = ((x2 - cleanMF)/(x2 - x1)) * q11 + ((cleanMF - x1)/(x2 - x1)) * q21;
    const r2 = ((x2 - cleanMF)/(x2 - x1)) * q12 + ((cleanMF - x1)/(x2 - x1)) * q22;
    
    const finalWater = ((y2 - cleanSlump)/(y2 - y1)) * r1 + ((cleanSlump - y1)/(y2 - y1)) * r2;
    
    return finalWater;
}

// Initialise Application
document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    setupCollapsibles();
    renderAdditivesList();
    updateCounterUI();
    loadSampleSievesData(); // Load defaults on start
    updateSieveTableLabels();
    setupSupabaseIntegration();
});

// Event Listeners Setup
function setupEventListeners() {
    // Concrete Class Selector
    document.getElementById("selectConcreteClass").addEventListener("change", (e) => {
        const val = e.target.value;
        const customSection = document.getElementById("customParamsSection");
        const customNameDiv = document.getElementById("divCustomClassNameContainer");
        
        if (val === "Personalizado") {
            customNameDiv.classList.remove("hidden");
        } else {
            customNameDiv.classList.add("hidden");
        }
        
        // Bidirectional sync index
        const idx = CLASS_SEQUENCE.indexOf(val);
        if (idx !== -1) {
            currentClassIndex = idx;
            updateCounterUI();
        }
        
        calculateAndUpdate();
    });

    // Hx Counter buttons
    document.getElementById("btnIncreaseClass").addEventListener("click", () => {
        if (currentClassIndex < CLASS_SEQUENCE.length - 1) {
            currentClassIndex++;
            const newVal = CLASS_SEQUENCE[currentClassIndex];
            const select = document.getElementById("selectConcreteClass");
            select.value = newVal;
            select.dispatchEvent(new Event("change"));
        }
    });

    document.getElementById("btnDecreaseClass").addEventListener("click", () => {
        const elementVal = document.getElementById("selectStructuralElement").value;
        const settings = ELEMENT_SETTINGS[elementVal];
        const minClass = settings ? settings.minClass : "H8";
        const minIdx = CLASS_SEQUENCE.indexOf(minClass);
        
        if (currentClassIndex > minIdx) {
            currentClassIndex--;
            const newVal = CLASS_SEQUENCE[currentClassIndex];
            const select = document.getElementById("selectConcreteClass");
            select.value = newVal;
            select.dispatchEvent(new Event("change"));
        }
    });

    // Combined Project Constraints Solver (Element & Exposure)
    const applyProjectConstraints = () => {
        const elementVal = document.getElementById("selectStructuralElement").value;
        const exposureVal = document.getElementById("selectExposureClass").value;
        if (!elementVal) return;
        
        const elemSettings = ELEMENT_SETTINGS[elementVal];
        const expSettings = EXPOSURE_CONSTRAINTS[exposureVal];
        if (!elemSettings || !expSettings) return;
        
        const sieveInput = document.getElementById("inputMaxSieveSize");
        const classDropdown = document.getElementById("selectConcreteClass");
        
        // 1. Update sieve size (from structural element)
        sieveInput.value = elemSettings.maxSieve;
        
        // 2. Enforce minimum concrete class (maximum of element and exposure)
        const overallMinClass = getMinConcreteClass();
        updateConcreteClassDropdown(overallMinClass);
        
        const currentClass = classDropdown.value;
        const currentStrength = CLASS_STRENGTHS[currentClass] || 0;
        const minStrength = CLASS_STRENGTHS[overallMinClass] || 0;
        
        if (currentClass !== "Personalizado" && currentStrength < minStrength) {
            classDropdown.value = overallMinClass;
            classDropdown.dispatchEvent(new Event("change"));
        } else {
            updateCounterUI();
        }
        
        // 3. Clear and repopulate additives (union of element and exposure recommendations)
        additives = [];
        const recommendedAdditives = [...elemSettings.additives];
        expSettings.additives.forEach(item => {
            if (!recommendedAdditives.some(ra => ra.typeKey === item.typeKey)) {
                recommendedAdditives.push(item);
            }
        });
        
        recommendedAdditives.forEach((item, idx) => {
            const spec = PREDEFINED_ADDITIVES[item.typeKey];
            if (spec) {
                additives.push({
                    id: `add_${Date.now()}_${idx}`,
                    typeKey: item.typeKey,
                    name: spec.name,
                    dosage: item.dosage,
                    minDosage: spec.minDosage,
                    maxDosage: spec.maxDosage,
                    density: spec.density,
                    type: spec.type
                });
            }
        });
        
        // 4. Force air content if exposure requires it
        const airInput = document.getElementById("inputAirPercentage");
        if (parseFloat(airInput.value) < expSettings.minAir) {
            airInput.value = expSettings.minAir;
        }
        
        renderAdditivesList();
        checkSikaFumeVisibility();
        calculateAndUpdate();
    };

    document.getElementById("selectStructuralElement").addEventListener("change", applyProjectConstraints);
    document.getElementById("selectExposureClass").addEventListener("change", applyProjectConstraints);
    document.getElementById("selectDesignMethod").addEventListener("change", calculateAndUpdate);

    // Cement category change
    document.getElementById("selectCementCategory").addEventListener("change", calculateAndUpdate);

    // Manual specified strength change
    document.getElementById("inputManualStrength").addEventListener("input", calculateAndUpdate);



    // Volume slider
    document.getElementById("inputBatchVolume").addEventListener("input", (e) => {
        document.getElementById("batchVolumeDisplay").innerText = e.target.value;
        document.getElementById("resVolumeDisplay").innerText = e.target.value;
        calculateAndUpdate();
    });

    // Volume slider presets
    document.querySelectorAll(".btn-preset-vol").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const vol = e.currentTarget.dataset.vol;
            const slider = document.getElementById("inputBatchVolume");
            slider.value = vol;
            
            document.getElementById("batchVolumeDisplay").innerText = vol;
            document.getElementById("resVolumeDisplay").innerText = vol;
            calculateAndUpdate();
        });
    });



    // GPS Weather Button click listener
    document.getElementById("btnGetGpsWeather").addEventListener("click", fetchLocalWeatherAndLocation);
    // Custom class name input change listener
    document.getElementById("inputCustomClassName").addEventListener("input", (e) => {
        if (CLASS_SEQUENCE[currentClassIndex] === "Personalizado") {
            document.getElementById("displayConcreteClass").innerText = e.target.value.trim() || "Personalizado";
        }
    });
    // Custom parameters input changes promote to Personalizado
    const promoteToCustom = () => {
        const classSelect = document.getElementById("selectConcreteClass");
        if (classSelect.value !== "Personalizado") {
            classSelect.value = "Personalizado";
            classSelect.dispatchEvent(new Event("change"));
        }
        calculateAndUpdate();
    };

    ["inputCustomCement", "inputCustomWC", "inputCustomBolomeyA", "inputMaxSieveSize", "inputAirPercentage", "inputManualStrength", "selectCementCategory"].forEach(id => {
        document.getElementById(id).addEventListener("input", promoteToCustom);
        document.getElementById(id).addEventListener("change", promoteToCustom);
    });

    // Bucket calibration inputs REMOVED

    // Material properties inputs
    ["densCement", "coefCement", "densSand", "coefSand", "moistSand", "absSand", "densStone", "coefStone", "moistStone", "absStone"].forEach(id => {
        document.getElementById(id).addEventListener("input", calculateAndUpdate);
    });

    // Sieve inputs change
    document.querySelectorAll(".sand-sieve, .stone-sieve").forEach(input => {
        input.addEventListener("input", calculateAndUpdate);
    });

    // Sieve series select change
    document.getElementById("selectSieveSeries").addEventListener("change", () => {
        updateSieveTableLabels();
    });

    // Additive buttons
    document.getElementById("btnLoadSampleSieves").addEventListener("click", loadSampleSievesData);
    document.getElementById("btnExportPDF").addEventListener("click", () => window.print());
    
    // API modal events
    const apiModal = document.getElementById("apiModal");
    document.getElementById("toggleApiModal").addEventListener("click", () => {
        document.getElementById("inputApiKey").value = localStorage.getItem("gemini_api_key") || "";
        apiModal.classList.add("open");
    });
    document.getElementById("btnCloseApiModal").addEventListener("click", () => apiModal.classList.remove("open"));
    document.getElementById("btnSaveApiKey").addEventListener("click", () => {
        const key = document.getElementById("inputApiKey").value.trim();
        if (key) {
            localStorage.setItem("gemini_api_key", key);
            alert("API Key guardada correctamente.");
        } else {
            localStorage.removeItem("gemini_api_key");
        }
        updateApiStatus();
        apiModal.classList.remove("open");
    });
    document.getElementById("btnDeleteApiKey").addEventListener("click", () => {
        localStorage.removeItem("gemini_api_key");
        document.getElementById("inputApiKey").value = "";
        updateApiStatus();
        alert("API Key eliminada.");
        apiModal.classList.remove("open");
    });

    updateApiStatus();
}

function updateApiStatus() {
    const key = localStorage.getItem("gemini_api_key");
    const badge = document.getElementById("apiStatusBadge");
    if (key) {
        badge.innerText = "API Conectada";
        badge.className = "badge badge-success";
    } else {
        badge.innerText = "Sin API Key";
        badge.className = "badge badge-error";
    }
}

function updateConcreteClassDropdown(minClass) {
    const dropdown = document.getElementById("selectConcreteClass");
    const minStrength = CLASS_STRENGTHS[minClass] || 0;
    
    for (let i = 0; i < dropdown.options.length; i++) {
        const option = dropdown.options[i];
        const val = option.value;
        
        if (val === "Personalizado") {
            option.disabled = false;
            option.text = "Personalizado";
            continue;
        }
        
        const strength = CLASS_STRENGTHS[val] || 0;
        if (strength < minStrength) {
            option.disabled = true;
            if (!option.text.includes("(No permitido")) {
                option.text = `${val} (No permitido - Mín ${minClass})`;
            }
        } else {
            option.disabled = false;
            option.text = val;
        }
    }
}

function getMinConcreteClass() {
    const elementVal = document.getElementById("selectStructuralElement").value;
    const exposureVal = document.getElementById("selectExposureClass").value;
    
    const elemSettings = ELEMENT_SETTINGS[elementVal];
    const expSettings = EXPOSURE_CONSTRAINTS[exposureVal];
    
    const elemMin = elemSettings ? elemSettings.minClass : "H8";
    const expMin = expSettings ? expSettings.minClass : "H8";
    
    const elemIdx = CLASS_SEQUENCE.indexOf(elemMin);
    const expIdx = CLASS_SEQUENCE.indexOf(expMin);
    
    return (elemIdx > expIdx) ? elemMin : expMin;
}

function updateCounterUI() {
    const displayVal = CLASS_SEQUENCE[currentClassIndex];
    const displaySpan = document.getElementById("displayConcreteClass");
    
    if (displayVal === "Personalizado") {
        const customName = document.getElementById("inputCustomClassName").value.trim();
        displaySpan.innerText = customName ? customName : "Personalizado";
    } else {
        displaySpan.innerText = displayVal;
    }
    
    // Disable minus if we are at the minimum class of the selected structural element or exposure class
    const minClass = getMinConcreteClass();
    const minIdx = CLASS_SEQUENCE.indexOf(minClass);
    
    document.getElementById("btnDecreaseClass").disabled = (currentClassIndex <= minIdx);
    document.getElementById("btnIncreaseClass").disabled = (currentClassIndex >= CLASS_SEQUENCE.length - 1);
}


// Collapsible panels
function setupCollapsibles() {
    document.querySelectorAll(".section-trigger").forEach(trigger => {
        trigger.addEventListener("click", () => {
            const section = trigger.parentElement;
            section.classList.toggle("collapsed");
        });
    });
}

// Load defaults
function loadSampleSievesData() {
    const sandDefaults = [0, 0, 0, 0, 0, 120, 180, 200, 200, 150, 150];
    const stoneDefaults = [20, 230, 200, 350, 150, 50, 0, 0, 0, 0, 0];
    
    const sandInputs = document.querySelectorAll(".sand-sieve");
    const stoneInputs = document.querySelectorAll(".stone-sieve");
    
    for (let i = 0; i < sandInputs.length; i++) {
        sandInputs[i].value = sandDefaults[i] !== undefined ? sandDefaults[i] : 0;
        stoneInputs[i].value = stoneDefaults[i] !== undefined ? stoneDefaults[i] : 0;
    }
    
    // Reset properties to default
    document.getElementById("moistSand").value = 80;
    document.getElementById("moistStone").value = 50;
    document.getElementById("absSand").value = 0.6;
    document.getElementById("absStone").value = 0.5;

    document.getElementById("densCement").value = 1400;
    document.getElementById("coefCement").value = 0.47;
    document.getElementById("densSand").value = 1650;
    document.getElementById("coefSand").value = 0.63;
    document.getElementById("densStone").value = 1600;
    document.getElementById("coefStone").value = 0.51;
    
    calculateAndUpdate();
}
function updateSieveTableLabels() {
    const series = document.getElementById("selectSieveSeries").value;
    const labels = SIEVE_SERIES_LABELS[series];
    if (!labels) return;
    
    const rows = document.querySelectorAll("#tableSieves tbody tr");
    rows.forEach(row => {
        const sizeKey = row.dataset.sieve;
        const newText = labels[sizeKey];
        if (newText) {
            const firstCell = row.cells[0];
            if (firstCell) {
                firstCell.innerHTML = `<strong>${newText}</strong>`;
            }
        }
    });
}

// Additives list render
function renderAdditivesList() {
    const container = document.getElementById("additivesList");
    container.innerHTML = "";
    
    additives.forEach((add, idx) => {
        const item = document.createElement("div");
        item.className = "additive-item";
        
        // Generate options for dropdown
        let selectOptions = "";
        Object.keys(PREDEFINED_ADDITIVES).forEach(key => {
            if (key === "personalizado") return;
            const spec = PREDEFINED_ADDITIVES[key];
            const selected = (add.typeKey === key) ? "selected" : "";
            selectOptions += `<option value="${key}" ${selected}>${spec.name}</option>`;
        });
        
        const spec = PREDEFINED_ADDITIVES[add.typeKey] || PREDEFINED_ADDITIVES["personalizado"];
        
        item.innerHTML = `
            <div class="form-group" style="display: flex; flex-direction: column; gap: 4px;">
                <select class="form-input add-select-in" data-id="${add.id}" style="font-size: 0.85rem; height: 36px; padding: 6px;">
                    ${selectOptions}
                </select>
                ${add.typeKey === "personalizado" ? `
                    <input type="text" value="${add.name}" class="form-input add-name-in" data-id="${add.id}" placeholder="Nombre personalizado" style="font-size: 0.8rem; height: 28px; margin-top: 4px;">
                ` : ""}
            </div>
            <div class="form-group" style="display: flex; flex-direction: column; justify-content: center;">
                <input type="number" value="${add.dosage}" step="0.05" min="${spec.minDosage}" max="${spec.maxDosage}" class="form-input add-dose-in" data-id="${add.id}" title="Dosis (%) respecto a cemento" style="text-align: center;">
                <span class="range-helper" style="font-size: 0.68rem; color: var(--text-muted); display: block; margin-top: 4px; text-align: center;">de ${spec.minDosage}% a ${spec.maxDosage}%</span>
            </div>
            <button class="btn btn-danger-xs btn-del-add" data-id="${add.id}" style="height: 36px; display: flex; align-items: center; justify-content: center;">🗑️</button>
        `;
        container.appendChild(item);
    });

    // Listeners for select dropdown change
    document.querySelectorAll(".add-select-in").forEach(select => {
        select.addEventListener("change", (e) => {
            const add = additives.find(a => a.id === e.target.dataset.id);
            const key = e.target.value;
            const spec = PREDEFINED_ADDITIVES[key];
            
            add.typeKey = key;
            add.name = spec.name;
            add.dosage = spec.defaultDosage;
            add.density = spec.density;
            add.minDosage = spec.minDosage;
            add.maxDosage = spec.maxDosage;
            add.type = spec.type;
            
            renderAdditivesList();
            checkSikaFumeVisibility();
            calculateAndUpdate();
        });
    });

    // Listeners for name edit (custom only)
    document.querySelectorAll(".add-name-in").forEach(input => {
        input.addEventListener("change", (e) => {
            const add = additives.find(a => a.id === e.target.dataset.id);
            add.name = e.target.value;
            checkSikaFumeVisibility();
            calculateAndUpdate();
        });
    });
    
    document.querySelectorAll(".add-dose-in").forEach(input => {
        input.addEventListener("input", (e) => {
            const add = additives.find(a => a.id === e.target.dataset.id);
            add.dosage = parseFloat(e.target.value) || 0;
            calculateAndUpdate();
        });
    });



    document.querySelectorAll(".btn-del-add").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = e.currentTarget.dataset.id;
            additives = additives.filter(a => a.id !== id);
            renderAdditivesList();
            checkSikaFumeVisibility();
            calculateAndUpdate();
        });
    });
}

function addAdditive() {
    const id = "add_" + Date.now();
    additives.push({
        id: id,
        typeKey: "protex_plast_plus",
        name: "PROTEX Plast Plus",
        dosage: 0.40,
        minDosage: 0.20,
        maxDosage: 0.70,
        density: 1.03,
        type: "plasticizer"
    });
    renderAdditivesList();
    checkSikaFumeVisibility();
    calculateAndUpdate();
}

function checkSikaFumeVisibility() {
    const guide = document.getElementById("fumeGuideSection");
    const hasFume = additives.some(a => {
        const name = a.name.toLowerCase();
        return name.includes("fume") || name.includes("silice") || name.includes("sílice") || name.includes("humo");
    });
    
    if (hasFume) {
        guide.classList.remove("collapsed");
    } else {
        guide.classList.add("collapsed");
    }
}

function getACICoarseAggregateVolume(maxSieve, sandFM) {
    // Columns: Sand FM [2.40, 2.60, 2.80, 3.00]
    // Rows: Max Sieve Size D [9.5, 12.5, 19.0, 25.0, 37.5]
    // Table values from ACI 211.1 Table 6.3.6
    const fms = [2.4, 2.6, 2.8, 3.0];
    const sizes = [9.5, 12.5, 19.0, 25.0, 37.5];
    const table = [
        [0.50, 0.48, 0.46, 0.44], // 9.5 mm
        [0.59, 0.57, 0.55, 0.53], // 12.5 mm
        [0.66, 0.64, 0.62, 0.60], // 19.0 mm
        [0.71, 0.69, 0.67, 0.65], // 25.0 mm
        [0.75, 0.73, 0.71, 0.69]  // 37.5 mm
    ];
    
    const fm = Math.max(2.4, Math.min(3.0, sandFM));
    
    // Find closest size index
    let sizeIdx = 0;
    for (let i = 0; i < sizes.length; i++) {
        if (maxSieve <= sizes[i]) {
            sizeIdx = i;
            break;
        }
        sizeIdx = i;
    }
    
    // Interpolate for fm
    let fmIdx = 0;
    for (let i = 0; i < fms.length - 1; i++) {
        if (fm >= fms[i] && fm <= fms[i+1]) {
            fmIdx = i;
            break;
        }
        fmIdx = i;
    }
    
    const v1 = table[sizeIdx][fmIdx];
    const v2 = table[sizeIdx][fmIdx+1];
    const f1 = fms[fmIdx];
    const f2 = fms[fmIdx+1];
    
    const v = v1 + (v2 - v1) * (fm - f1) / (f2 - f1);
    return v;
}

// CORE MATHEMATICS ENGINE - ICPA & LARRARD LPDM
function calculateAndUpdate() {
    // 1. Get parameters from UI
    const concreteClass = document.getElementById("selectConcreteClass").value;
    const batchVolumeL = parseFloat(document.getElementById("inputBatchVolume").value) || 80;
    const volM3 = batchVolumeL / 1000;
    
    const temp = currentClimateTemp;

    // Materials properties
    const densCement = parseFloat(document.getElementById("densCement").value) || 1400;
    const coefCement = parseFloat(document.getElementById("coefCement").value) || 0.47;
    const densSand = parseFloat(document.getElementById("densSand").value) || 1650;
    const coefSand = parseFloat(document.getElementById("coefSand").value) || 0.63;
    const moistSand = parseFloat(document.getElementById("moistSand").value) || 80;
    const absSand = parseFloat(document.getElementById("absSand").value) || 0.6;
    const densStone = parseFloat(document.getElementById("densStone").value) || 1600;
    const coefStone = parseFloat(document.getElementById("coefStone").value) || 0.51;
    const moistStone = parseFloat(document.getElementById("moistStone").value) || 50;
    const absStone = parseFloat(document.getElementById("absStone").value) || 0.5;

    // Bucket calibration REMOVED

    // Sieve curves inputs (Retained weight to Passing percentage)
    const sandInputs = document.querySelectorAll(".sand-sieve");
    const stoneInputs = document.querySelectorAll(".stone-sieve");
    
    const sandRetained = [];
    const stoneRetained = [];
    
    let totalSandWt = 0;
    let totalStoneWt = 0;
    
    for (let i = 0; i < sandInputs.length; i++) {
        const sandVal = parseFloat(sandInputs[i].value) || 0;
        const stoneVal = parseFloat(stoneInputs[i].value) || 0;
        sandRetained.push(sandVal);
        stoneRetained.push(stoneVal);
        totalSandWt += sandVal;
        totalStoneWt += stoneVal;
    }
    
    // Display totals
    document.getElementById("totalSandSample").innerText = Math.round(totalSandWt);
    document.getElementById("totalStoneSample").innerText = Math.round(totalStoneWt);
    
    // Prevent division by zero
    const cleanSandTotal = totalSandWt > 0 ? totalSandWt : 1000;
    const cleanStoneTotal = totalStoneWt > 0 ? totalStoneWt : 1000;
    
    // Calculate cumulative passing percentages
    const sandSievePassing = [];
    const stoneSievePassing = [];
    
    let cumRetainedSand = 0;
    let cumRetainedStone = 0;
    
    // Sieve sizes labels (excluding Fondo/0.0 for curves arrays, which only need length 10)
    const allSieveLabels = [37.5, 25.0, 19.0, 9.5, 4.75, 2.36, 1.18, 0.6, 0.3, 0.15];
    
    for (let i = 0; i < sandInputs.length; i++) {
        const pctSand = (sandRetained[i] / cleanSandTotal) * 100;
        cumRetainedSand += pctSand;
        const passingSandVal = Math.max(0, 100 - cumRetainedSand);
        
        const pctStone = (stoneRetained[i] / cleanStoneTotal) * 100;
        cumRetainedStone += pctStone;
        const passingStoneVal = Math.max(0, 100 - cumRetainedStone);
        
        // Save passing values for the 10 standard sizes
        if (i < 10) {
            sandSievePassing.push(passingSandVal);
            stoneSievePassing.push(passingStoneVal);
            
            // Update UI cells
            const sizeLabel = allSieveLabels[i].toFixed(1);
            const sandCell = document.getElementById("passSand_" + sizeLabel);
            const stoneCell = document.getElementById("passStone_" + sizeLabel);
            if (sandCell) sandCell.innerText = passingSandVal.toFixed(1) + "%";
        }
    }

    lastCalculatedPassingSand = [...sandSievePassing];
    lastCalculatedPassingStone = [...stoneSievePassing];
    window.lastCalculatedPassingSand = lastCalculatedPassingSand;
    window.lastCalculatedPassingStone = lastCalculatedPassingStone;

    // 2. Target parameters calculation (Rational design)
    // Concrete strength baseline
    let fce = 30; // H30 default
    if (concreteClass !== "Personalizado") {
        fce = parseInt(concreteClass.replace("H", "")) || 30;
        document.getElementById("inputManualStrength").value = fce;
    } else {
        fce = parseFloat(document.getElementById("inputManualStrength").value) || 30;
    }

    // S: Standard deviation S = 4.0 MPa constant for controlled engineering design
    const S = 4.0;

    // f'cm: target design strength
    const fcm = fce + 1.65 * S;
    document.getElementById("resStrengthFcm").innerText = fcm.toFixed(1);

    // Sieve matching for sand Ratio L2 (based on 4.75 mm sieve)
    const maxSieveSizeD = parseFloat(document.getElementById("inputMaxSieveSize").value) || 38.0;
    let bolomeyA = parseFloat(document.getElementById("inputCustomBolomeyA").value) || 13.0;

    // Durability constraints (Freeze/Thaw check)
    let airPct = parseFloat(document.getElementById("inputAirPercentage").value) || 1.5;
    let targetWC = parseFloat(document.getElementById("inputCustomWC").value) || 0.45;
    
    if (temp < -2) {
        // Freeze risk: force air content (5.0% min)
        airPct = Math.max(5.0, airPct);
        document.getElementById("inputAirPercentage").value = airPct;
        
        // Limit max w/c ratio to 0.45 (Table 7)
        targetWC = Math.min(0.45, targetWC);
        document.getElementById("inputCustomWC").value = targetWC;
        
        // Dynamic alert in UI
        let weatherAlert = document.getElementById("weatherAlertNotice");
        if (!weatherAlert) {
            weatherAlert = document.createElement("div");
            weatherAlert.id = "weatherAlertNotice";
            weatherAlert.className = "alert-banner error-banner";
            weatherAlert.style.marginTop = "10px";
            document.querySelector(".panel-inputs .panel-body").insertBefore(weatherAlert, document.getElementById("customParamsSection"));
        }
        weatherAlert.innerHTML = `❄️ <strong>Riesgo de Heladas:</strong> Temperatura bajo cero. Aire objetivo forzado a <strong>${airPct}%</strong> y relación a/c limitada a <strong>${targetWC}</strong> por durabilidad (ICPA Tabla 7).`;
    } else {
        const weatherAlert = document.getElementById("weatherAlertNotice");
        if (weatherAlert) weatherAlert.remove();
    }

    // Class defaults definitions
    const CLASS_DEFAULTS = {
        "H8": { cement: 220, wc: 0.80 },
        "H15": { cement: 260, wc: 0.65 },
        "H20": { cement: 280, wc: 0.55 },
        "H21": { cement: 300, wc: 0.50 },
        "H25": { cement: 330, wc: 0.47 },
        "H30": { cement: 350, wc: 0.45 },
        "H35": { cement: 370, wc: 0.42 },
        "H38": { cement: 380, wc: 0.40 },
        "H40": { cement: 390, wc: 0.38 },
        "H45": { cement: 400, wc: 0.35 }
    };

    let cementBaseM3 = 350;

    // Set parameters from class defaults if not personal
    if (concreteClass !== "Personalizado") {
        const data = CONCRETE_CLASSES[concreteClass];
        bolomeyA = data.bolomeyA;
        
        const baseWC = CLASS_DEFAULTS[concreteClass].wc;
        
        // Dynamic w/c ratio using Abrams' Law for selected cement category K
        // Adjust fcm for air content (loss is 5% per 1% air above 1.5%)
        const airCorrection = Math.max(0.40, 1 - 0.05 * Math.max(0, airPct - 1.5));
        // Crushed stone improves strength by ~20%, so we divide by 1.20 to find cement requirement
        const fcm_cemento = fcm / (1.20 * airCorrection);
        
        const cementCategory = document.getElementById("selectCementCategory").value;
        const CEMENT_K = { CPC40: 96, CPN50: 120, CPC30: 75, LC3: 85 };
        const K = CEMENT_K[cementCategory] || 96;
        
        // Abrams' formula inversion: wc_abrams = ln(K / fcm_cemento) / ln(8.5)
        let wc_abrams = Math.log(K / fcm_cemento) / Math.log(8.5);
        wc_abrams = Math.max(0.30, Math.min(0.85, wc_abrams));
        
        const exposureVal = document.getElementById("selectExposureClass").value;
        const expSettings = EXPOSURE_CONSTRAINTS[exposureVal];
        const maxAllowedWC = expSettings ? expSettings.maxWC : 0.85;
        
        // w/c design is the minimum of strength requirements (Abrams), durability limits (baseWC), and exposure constraints (maxAllowedWC)
        let computedWC = Math.min(wc_abrams, baseWC);
        computedWC = Math.min(computedWC, maxAllowedWC);
        
        // Apply freeze/thaw constraint
        if (temp < -2) {
            computedWC = Math.min(0.45, computedWC);
        }
        
        targetWC = computedWC;
        document.getElementById("inputCustomWC").value = targetWC.toFixed(2);
        document.getElementById("inputCustomBolomeyA").value = bolomeyA.toFixed(1);
    } else {
        const exposureVal = document.getElementById("selectExposureClass").value;
        const expSettings = EXPOSURE_CONSTRAINTS[exposureVal];
        const maxAllowedWC = expSettings ? expSettings.maxWC : 0.85;
        
        let customWC = parseFloat(document.getElementById("inputCustomWC").value) || 0.45;
        // Clamp to exposure limit if user exceeds it, or warn them
        if (customWC > maxAllowedWC) {
            customWC = maxAllowedWC;
            document.getElementById("inputCustomWC").value = customWC.toFixed(2);
        }
        targetWC = customWC;
    }

    // Solve sieve matching based on selected design method
    const designMethod = document.getElementById("selectDesignMethod").value;
    let sandRatio = 0.40;
    let stoneRatio = 0.60;
    
    if (designMethod === "aci") {
        // Calculate sand FM
        let sumSandFM = 0;
        for (let i = 0; i < SIEVE_SIZES.length; i++) {
            if (FM_SIEVES.includes(SIEVE_SIZES[i])) {
                sumSandFM += (100 - sandSievePassing[i]);
            }
        }
        const sandFM = sumSandFM / 100;
        const vCoarse = getACICoarseAggregateVolume(maxSieveSizeD, sandFM);
        
        // Iterative solver for circular dependency between sandRatio, combined FM, water demand and aggregate solid volumes
        for (let iter = 0; iter < 4; iter++) {
            const combinedSieve = [];
            for (let i = 0; i < SIEVE_SIZES.length; i++) {
                combinedSieve.push(sandRatio * sandSievePassing[i] + stoneRatio * stoneSievePassing[i]);
            }
            
            let sumMF = 0;
            for (let i = 0; i < SIEVE_SIZES.length; i++) {
                if (FM_SIEVES.includes(SIEVE_SIZES[i])) {
                    sumMF += (100 - combinedSieve[i]);
                }
            }
            const combFM = sumMF / 100;
            const bWater = interpolateWaterDemand(combFM, slumpPredFromClass(concreteClass));
            let wTarget = bWater * 1.07;
            if (airPct > 1.0) {
                wTarget = wTarget * (1 - 0.025 * (airPct - 1));
            }
            
            let wRed = 1.0;
            additives.forEach(add => {
                const spec = PREDEFINED_ADDITIVES[add.typeKey] || PREDEFINED_ADDITIVES["personalizado"];
                if (spec.type === "plasticizer" && add.dosage > 0) {
                    const clampedD = Math.max(spec.minDosage, Math.min(spec.maxDosage, add.dosage));
                    wRed = wRed * (1 - (spec.getReduction(clampedD) / 100));
                }
            });
            wRed = Math.max(0.60, Math.min(1.0, wRed));
            const dWater = wTarget * wRed;
            
            let cBase = dWater / targetWC;
            const minCement = (concreteClass === "H8") ? 220 : 300;
            cBase = Math.max(minCement, cBase);
            const finalWater = cBase * targetWC;
            
            // Solid volumes in 1m3 (Theoretical)
            const vs_c = (cBase / densCement) * coefCement;
            const vs_a = airPct / 100;
            
            let vs_ad = 0;
            additives.forEach(add => {
                const spec = PREDEFINED_ADDITIVES[add.typeKey] || PREDEFINED_ADDITIVES["personalizado"];
                if (spec.type === "plasticizer" || spec.type === "fume") {
                    const weightKg = cBase * (add.dosage / 100);
                    vs_ad += (weightKg / add.density) / 1000;
                }
            });
            
            const vs_w = finalWater / 1000;
            const vs_agg = Math.max(0, 1.0 - vs_c - vs_w - vs_ad - vs_a);
            
            // ACI Coarse Aggregate solid volume
            const vs_stone_aci = vCoarse * coefStone;
            const vs_sand_aci = Math.max(0, vs_agg - vs_stone_aci);
            
            if (vs_agg > 0) {
                sandRatio = vs_sand_aci / vs_agg;
                stoneRatio = 1 - sandRatio;
            } else {
                sandRatio = 0.40;
                stoneRatio = 0.60;
            }
        }
    } else {
        // Curve matching solvers: Bolomey, Fuller, or De la Peña
        const sieve475Index = 4;
        let ideal_475 = 0;
        if (designMethod === "fuller") {
            ideal_475 = 100 * Math.sqrt(4.75 / maxSieveSizeD);
        } else if (designMethod === "delapena") {
            ideal_475 = bolomeyA + (100 - bolomeyA) * Math.pow(4.75 / maxSieveSizeD, 0.40);
        } else {
            // Bolomey (default)
            ideal_475 = bolomeyA + (100 - bolomeyA) * Math.sqrt(4.75 / maxSieveSizeD);
        }
        
        const sand_475 = sandSievePassing[sieve475Index];
        const stone_475 = stoneSievePassing[sieve475Index];
        
        sandRatio = (ideal_475 - stone_475) / (sand_475 - stone_475);
        if (isNaN(sandRatio) || sandRatio < 0) sandRatio = 0.40;
        if (sandRatio > 1) sandRatio = 1.0;
        stoneRatio = 1 - sandRatio;
    }

    // Calculate curves
    const bolomeyIdealPassing = [];
    const combinedSievePassing = [];
    const sieveDifferences = [];
    let sumSieveDiffs = 0;

    for (let i = 0; i < SIEVE_SIZES.length; i++) {
        const size = SIEVE_SIZES[i];
        
        let ideal = 0;
        if (designMethod === "fuller") {
            ideal = 100 * Math.sqrt(size / maxSieveSizeD);
        } else if (designMethod === "delapena") {
            ideal = bolomeyA + (100 - bolomeyA) * Math.pow(size / maxSieveSizeD, 0.40);
        } else {
            // Bolomey or ACI (uses Bolomey as reference)
            ideal = bolomeyA + (100 - bolomeyA) * Math.sqrt(size / maxSieveSizeD);
        }
        bolomeyIdealPassing.push(ideal);
        
        const combined = sandRatio * sandSievePassing[i] + stoneRatio * stoneSievePassing[i];
        combinedSievePassing.push(combined);
        
        const diff = Math.abs(combined - ideal);
        sieveDifferences.push(diff);
        
        if (G_FACTOR_SIEVES.includes(size)) {
            sumSieveDiffs += diff;
        }
    }

    const factorG = 1 + (sumSieveDiffs / 100);

    // Combined Fineness Modulus (MF)
    let sumMF = 0;
    for (let i = 0; i < SIEVE_SIZES.length; i++) {
        const size = SIEVE_SIZES[i];
        if (FM_SIEVES.includes(size)) {
            sumMF += (100 - combinedSievePassing[i]);
        }
    }
    const combinedFM = sumMF / 100;

    // 3. Water demand from Abaco 1 (bilinear lookup)
    const baseWaterM3 = interpolateWaterDemand(combinedFM, slumpPredFromClass(concreteClass));
    
    // Correct water for crushed stone (+7%)
    let waterTargetM3 = baseWaterM3 * 1.07;
    
    // Correct water for air content: -2.5% per 1% air above 1%
    if (airPct > 1.0) {
        waterTargetM3 = waterTargetM3 * (1 - 0.025 * (airPct - 1));
    }

    // Dynamic water reduction from selected plasticizer additives based on their chemical ranges
    let waterReduction = 1.0;
    additives.forEach(add => {
        const spec = PREDEFINED_ADDITIVES[add.typeKey] || PREDEFINED_ADDITIVES["personalizado"];
        if (spec.type === "plasticizer" && add.dosage > 0) {
            const clampedDosage = Math.max(spec.minDosage, Math.min(spec.maxDosage, add.dosage));
            const reductionPct = spec.getReduction(clampedDosage);
            waterReduction = waterReduction * (1 - (reductionPct / 100));
        }
    });
    waterReduction = Math.max(0.60, Math.min(1.0, waterReduction));
    
    // Target design water (with plasticizer reduction applied)
    const designWaterM3 = waterTargetM3 * waterReduction;
    
    // Calculate required cement per m3 based on physical design water and target WC
    if (concreteClass !== "Personalizado") {
        cementBaseM3 = designWaterM3 / targetWC;
        // Clamp to regulatory structural concrete minimum (300 kg/m³) except H8 (220 kg/m³)
        const minCement = (concreteClass === "H8") ? 220 : 300;
        cementBaseM3 = Math.max(minCement, cementBaseM3);
        
        // Recalculate target WC for consistency if cement was clamped
        targetWC = designWaterM3 / cementBaseM3;
        
        document.getElementById("inputCustomWC").value = targetWC.toFixed(2);
        document.getElementById("inputCustomCement").value = Math.round(cementBaseM3);
    } else {
        cementBaseM3 = parseFloat(document.getElementById("inputCustomCement").value) || 350;
    }

    // Final water target per m3
    waterTargetM3 = cementBaseM3 * targetWC;

    // 4. Pastón volume batching
    const cementWeightBatch = cementBaseM3 * volM3;
    const vs_cement = (cementWeightBatch / densCement) * coefCement;
    const vs_air = volM3 * (airPct / 100);
    
    // Admixtures volumes (Only plasticizers/adiciones subtract volume in mix design volume calculation)
    let vs_admixture_total = 0;
    const admixtureRecipes = [];
    
    additives.forEach(add => {
        const spec = PREDEFINED_ADDITIVES[add.typeKey] || PREDEFINED_ADDITIVES["personalizado"];
        if (spec.type === "plasticizer" || spec.type === "fume") {
            const weightKg = cementWeightBatch * (add.dosage / 100);
            const volumeL = weightKg / add.density;
            const volumeM3 = volumeL / 1000;
            vs_admixture_total += volumeM3;
        }
    });

    const targetWaterBatch = waterTargetM3 * volM3;
    const vs_water = targetWaterBatch / 1000;

    // vs_ag: solid volume of aggregates
    const vs_aggregates = Math.max(0, volM3 - vs_cement - vs_water - vs_admixture_total - vs_air);
    
    const vs_sand = vs_aggregates * sandRatio;
    const vs_stone = vs_aggregates * stoneRatio;
    
    // Moisture contribution (Liters)
    const w_sand = (vs_sand / coefSand) * moistSand;
    const w_stone = (vs_stone / coefStone) * moistStone;

    // Net added water (theoretical, adjusted by mixing factor 1.1)
    const netWaterTheoretical = Math.max(0, (targetWaterBatch - w_sand - w_stone) / 1.1);

    // Final water corrected by Factor G (lab style)
    const netWaterFinal = netWaterTheoretical * factorG;

    // Aggregates weights
    const sandDryWeight = (vs_sand / coefSand) * densSand;
    const sandWetWeight = sandDryWeight + w_sand;

    const stoneDryWeight = (vs_stone / coefStone) * densStone;
    const stoneWetWeight = stoneDryWeight + w_stone;

    // Slump prediction: 80 * (w/c)^2 / factorG
    const slumpPred = 80 * Math.pow(targetWC, 2) / factorG;

    // Calculate final recipes for all additives (Sikacrete/PROTEX Plast = cement-based, Hidrófugo = water-based)
    additives.forEach(add => {
        let weightKg = 0;
        let volumeL = 0;
        const spec = PREDEFINED_ADDITIVES[add.typeKey] || PREDEFINED_ADDITIVES["personalizado"];
        
        if (spec.type === "hidrofugo") {
            // Excel style: 100 ml per Liter of net theoretical water (before G-factor) for 2% dosage
            // We scale it proportionally if the dosage is changed: (dosage / 2.0) * (netWaterTheoretical / 10) L
            volumeL = (add.dosage / 2.0) * (netWaterTheoretical / 10);
            weightKg = volumeL * add.density;
        } else {
            // Cement weight basis (plasticizer, fume, etc.)
            weightKg = cementWeightBatch * (add.dosage / 100);
            volumeL = weightKg / add.density;
        }
        
        admixtureRecipes.push({
            name: add.name,
            weightG: weightKg * 1000,
            volumeMl: volumeL * 1000
        });
    });

    // 5. Update Results to UI
    document.getElementById("resCement").innerText = cementWeightBatch.toFixed(1);
    document.getElementById("resCementPerM3").innerText = Math.round(cementBaseM3);
    document.getElementById("resWaterCorrected").innerText = netWaterFinal.toFixed(2);
    document.getElementById("resWaterTheoretical").innerText = netWaterTheoretical.toFixed(2);
    document.getElementById("resFactorGDisplay").innerText = factorG.toFixed(3);
    document.getElementById("resSand").innerText = sandWetWeight.toFixed(1);
    document.getElementById("resSandRatio").innerText = (sandRatio * 100).toFixed(1);
    document.getElementById("resStone").innerText = stoneWetWeight.toFixed(1);
    document.getElementById("resStoneRatio").innerText = (stoneRatio * 100).toFixed(1);

    // Bucket conversions REMOVED

    // Render admixtures
    const addResultsGrid = document.getElementById("additivesResultsGrid");
    addResultsGrid.innerHTML = "";
    admixtureRecipes.forEach(rec => {
        const card = document.createElement("div");
        card.className = "additive-res-card";
        card.innerHTML = `
            <div class="add-name">${rec.name}</div>
            <div style="text-align: right;">
                <div class="add-val-ml">${rec.volumeMl.toFixed(0)} <span style="font-size: 0.75rem;">ml</span></div>
                <div class="add-val-g">${rec.weightG.toFixed(0)} g</div>
            </div>
        `;
        addResultsGrid.appendChild(card);
    });

    // Quality Indicators
    document.getElementById("resSlump").innerText = slumpPred.toFixed(1);
    document.getElementById("resMF").innerText = combinedFM.toFixed(2);
    document.getElementById("resTotalDiff").innerText = sumSieveDiffs.toFixed(1);

    // Slump Pin
    const consistencyBadge = document.getElementById("resConsistencyBadge");
    const slumpPin = document.getElementById("slumpPin");
    let consistencyClass = "badge-success";
    let consistencyText = "Plástica";
    
    let pinPos = (slumpPred / 20) * 100;
    if (pinPos < 0) pinPos = 0;
    if (pinPos > 100) pinPos = 100;
    slumpPin.style.left = `${pinPos}%`;

    if (slumpPred < 3.0) {
        consistencyText = "Seca";
        consistencyClass = "badge-error";
    } else if (slumpPred >= 3.0 && slumpPred < 6.0) {
        consistencyText = "Plástica";
        consistencyClass = "badge-success";
    } else if (slumpPred >= 6.0 && slumpPred < 10.0) {
        consistencyText = "Blanda";
        consistencyClass = "badge-success";
    } else if (slumpPred >= 10.0 && slumpPred <= 15.0) {
        consistencyText = "Fluida";
        consistencyClass = "badge-success";
    } else {
        consistencyText = "Líquida";
        consistencyClass = "badge-error";
    }
    consistencyBadge.innerText = consistencyText;
    consistencyBadge.className = `badge ${consistencyClass}`;

    // 6. Manual Design Warnings (without AI intervention)
    const manualAlertsDiv = document.getElementById("manualDesignAlerts");
    if (manualAlertsDiv) {
        manualAlertsDiv.innerHTML = "";
        manualAlertsDiv.style.display = "none";
        
        if (concreteClass === "Personalizado") {
            const alerts = [];
            
            // Check 1: Cement content too low for structural concrete
            const minReqCement = 300;
            if (cementBaseM3 < minReqCement) {
                alerts.push(`⚠️ <strong>Bajo Contenido de Cemento:</strong> ${Math.round(cementBaseM3)} kg/m³ es menor al mínimo reglamentario estructural (300 kg/m³). Riesgo de baja durabilidad y segregación.`);
            }
            
            // Check 2: Strength vs w/c ratio (Abrams validation)
            const cementCategory = document.getElementById("selectCementCategory").value;
            const CEMENT_K = { CPC40: 96, CPN50: 120, CPC30: 75, LC3: 85 };
            const K = CEMENT_K[cementCategory] || 96;
            const fcm_calc = fce + 6.6; // target design strength with safety margin
            const maxSafeWC = Math.max(0.30, Math.min(0.85, Math.log(K / (fcm_calc / 1.20)) / Math.log(8.5)));
            
            if (targetWC > maxSafeWC + 0.02) {
                alerts.push(`❌ <strong>Relación A/C Excesiva:</strong> La relación a/c de ${targetWC.toFixed(2)} es muy alta para garantizar una resistencia de ${fce} MPa. Se sugiere reducirla a ${maxSafeWC.toFixed(2)} o aumentar el cemento.`);
            }
            
            // Check 3: Insufficient cement for the design water and w/c ratio
            const requiredCementForWC = waterTargetM3 / targetWC;
            if (cementBaseM3 < requiredCementForWC - 15) {
                alerts.push(`⚠️ <strong>Pasta Insuficiente:</strong> Con una relación a/c de ${targetWC.toFixed(2)} y agua de ${waterTargetM3.toFixed(0)} L, se requieren teóricamente ${Math.round(requiredCementForWC)} kg/m³ de cemento. Tu valor de ${Math.round(cementBaseM3)} kg/m³ es insuficiente.`);
            }
            
            // Check 4: Durability limit clamp notice
            const exposureVal = document.getElementById("selectExposureClass").value;
            const expSettings = EXPOSURE_CONSTRAINTS[exposureVal];
            if (expSettings && parseFloat(document.getElementById("inputCustomWC").value) > expSettings.maxWC) {
                alerts.push(`ℹ️ <strong>Límite de Exposición:</strong> Relación A/C limitada automáticamente a ${expSettings.maxWC.toFixed(2)} por clase de exposición ambiental (${exposureVal.toUpperCase()}).`);
            }
            
            if (alerts.length > 0) {
                manualAlertsDiv.style.display = "block";
                alerts.forEach(alertText => {
                    const alertCard = document.createElement("div");
                    alertCard.style.marginTop = "6px";
                    alertCard.style.padding = "8px 12px";
                    alertCard.style.fontSize = "0.75rem";
                    alertCard.style.borderRadius = "4px";
                    alertCard.style.borderLeft = "4px solid var(--error)";
                    alertCard.style.backgroundColor = "rgba(239, 68, 68, 0.08)";
                    alertCard.style.color = "var(--text)";
                    alertCard.style.lineHeight = "1.4";
                    alertCard.innerHTML = alertText;
                    manualAlertsDiv.appendChild(alertCard);
                });
            }
        }
    }

    // Update Chart
    updateChart(combinedSievePassing, bolomeyIdealPassing, sandSievePassing, stoneSievePassing);
}

// Helper: Target slump based on concrete class
// Helper: Target slump based on concrete class
function slumpPredFromClass(cClass) {
    if (cClass === "H8") return 3.0; // seca
    if (cClass === "H15") return 6.0; // plástica/blanda
    if (cClass === "H21") return 8.0; // blanda
    if (cClass === "H30") return 10.0; // fluida
    if (cClass === "H45") return 15.0; // fluida/alta
    return 8.0; // default personalizado
}

// Larrard Packing Model Analysis for Chart
function calculateLarrardPackingCurve(sandSieves, stoneSieves) {
    const packingPoints = [];
    const diams = getRepresentativeDiameters();
    const defaultAlpha = 0.58; // Specific packing density of aggregate fraction

    // Sieve fractions
    const sandFractions = [];
    const stoneFractions = [];
    
    let prevSand = 100.0;
    for (let i = 0; i < SIEVE_SIZES.length; i++) {
        sandFractions.push((prevSand - sandSieves[i]) / 100.0);
        prevSand = sandSieves[i];
    }
    sandFractions.push(prevSand / 100.0); // Pan fraction

    let prevStone = 100.0;
    for (let i = 0; i < SIEVE_SIZES.length; i++) {
        stoneFractions.push((prevStone - stoneSieves[i]) / 100.0);
        prevStone = stoneSieves[i];
    }
    stoneFractions.push(prevStone / 100.0); // Pan fraction

    // Loop through sand proportions from 0% to 100% (step 2%)
    for (let s = 0; s <= 100; s += 2) {
        const sandFrac = s / 100.0;
        const stoneFrac = 1.0 - sandFrac;
        
        const y = [];
        for (let i = 0; i < sandFractions.length; i++) {
            y.push(sandFrac * sandFractions[i] + stoneFrac * stoneFractions[i]);
        }

        const c_i = [];
        const N = y.length;
        
        for (let i = 0; i < N; i++) {
            let looseningSum = 0;
            for (let j = 0; j < i; j++) {
                const z = diams[i] / diams[j];
                looseningSum += y[j] * looseningEffect(z);
            }

            let wallSum = 0;
            for (let j = i + 1; j < N; j++) {
                const z = diams[j] / diams[i];
                wallSum += y[j] * wallEffect(z);
            }

            const denominator = 1.0 - looseningSum - (1.0 - defaultAlpha) * wallSum;
            const ci = defaultAlpha / Math.max(0.01, denominator);
            c_i.push(ci);
        }

        const packingDensity = Math.min(...c_i);
        packingPoints.push({ x: s, y: packingDensity });
    }

    return packingPoints;
}

// Chart.js Rendering & Update
function updateChart(combined, ideal, sand, stone) {
    const ctx = document.getElementById("sieveChart").getContext("2d");

    // Add toggle button to header if it doesn't exist
    if (!document.getElementById("chartModeToggle")) {
        const triggerDiv = document.querySelector(".panel-chart .panel-header");
        const toggleBtn = document.createElement("button");
        toggleBtn.id = "chartModeToggle";
        toggleBtn.className = "btn btn-secondary btn-xs";
        toggleBtn.innerText = "Ver Compacidad (Larrard)";
        toggleBtn.style.styleFloat = "right";
        toggleBtn.style.cssFloat = "right";
        toggleBtn.style.marginLeft = "auto";
        triggerDiv.appendChild(toggleBtn);
        
        toggleBtn.addEventListener("click", () => {
            if (currentChartMode === 'sieves') {
                currentChartMode = 'larrard';
                toggleBtn.innerText = "Ver Curvas Granulométricas";
            } else {
                currentChartMode = 'sieves';
                toggleBtn.innerText = "Ver Compacidad (Larrard)";
            }
            calculateAndUpdate();
        });
    }

    if (chartInstance) {
        chartInstance.destroy();
    }

    if (currentChartMode === 'sieves') {
        // RENDER SIEVE CURVES CHART
        const chartData = {
            labels: SIEVE_SIZES.map(s => s.toString()).reverse(),
            datasets: [
                {
                    label: "Combinada Real",
                    data: [...combined].reverse(),
                    borderColor: "#3b82f6",
                    backgroundColor: "rgba(59, 130, 246, 0.1)",
                    borderWidth: 3,
                    tension: 0.15,
                    fill: false
                },
                {
                    label: "Curva Ideal (Bolomey)",
                    data: [...ideal].reverse(),
                    borderColor: "#10b981",
                    borderDash: [5, 5],
                    borderWidth: 2.5,
                    tension: 0.1,
                    fill: false
                },
                {
                    label: "Arena (Fino)",
                    data: [...sand].reverse(),
                    borderColor: "#e2e8f0",
                    borderWidth: 1.5,
                    tension: 0.1,
                    fill: false,
                    hidden: true
                },
                {
                    label: "Piedra (Grueso)",
                    data: [...stone].reverse(),
                    borderColor: "#94a3b8",
                    borderWidth: 1.5,
                    tension: 0.1,
                    fill: false,
                    hidden: true
                }
            ]
        };

        chartInstance = new Chart(ctx, {
            type: "line",
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#f8fafc', font: { family: 'Inter', size: 10 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.raw.toFixed(1)}%`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        title: { display: true, text: 'Tamiz ASTM (mm) [Escala Inversa]', color: '#94a3b8', font: { size: 11 } },
                        ticks: { color: '#94a3b8' }
                    },
                    y: {
                        min: 0,
                        max: 100,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        title: { display: true, text: '% Pasante Acumulado', color: '#94a3b8', font: { size: 11 } },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });

        // Hide advice box if it exists
        const adviceBox = document.getElementById("larrardAdviceBox");
        if (adviceBox) adviceBox.style.display = "none";

    } else {
        // RENDER LARRARD PACKING CURVE CHART
        const packingPoints = calculateLarrardPackingCurve(sand, stone);
        
        let maxPacking = 0;
        let bestSandPct = 0;
        packingPoints.forEach(p => {
            if (p.y > maxPacking) {
                maxPacking = p.y;
                bestSandPct = p.x;
            }
        });

        const uiSandPct = Math.round(parseFloat(document.getElementById("resSandRatio").innerText)) || 40;

        const chartData = {
            labels: packingPoints.map(p => `${p.x}%`),
            datasets: [
                {
                    label: "Compacidad de Empaquetamiento (c)",
                    data: packingPoints.map(p => p.y),
                    borderColor: "#8b5cf6",
                    backgroundColor: "rgba(139, 92, 246, 0.1)",
                    borderWidth: 3,
                    tension: 0.2,
                    fill: true
                }
            ]
        };

        chartInstance = new Chart(ctx, {
            type: "line",
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#f8fafc', font: { family: 'Inter', size: 10 } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Compacidad (c): ${context.raw.toFixed(4)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        title: { display: true, text: 'Porcentaje de Arena en Agregado (%)', color: '#94a3b8', font: { size: 11 } },
                        ticks: { color: '#94a3b8', maxTicksLimit: 11 }
                    },
                    y: {
                        min: 0.5,
                        max: 0.75,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        title: { display: true, text: 'Compacidad Teórica (c)', color: '#94a3b8', font: { size: 11 } },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });

        // Update/Show Larrard advice box
        let adviceBox = document.getElementById("larrardAdviceBox");
        if (!adviceBox) {
            adviceBox = document.createElement("div");
            adviceBox.id = "larrardAdviceBox";
            adviceBox.style.marginTop = "10px";
            adviceBox.style.padding = "10px";
            adviceBox.style.borderRadius = "6px";
            adviceBox.style.fontSize = "0.8rem";
            adviceBox.style.backgroundColor = "rgba(139, 92, 246, 0.15)";
            adviceBox.style.border = "1px solid rgba(139, 92, 246, 0.3)";
            document.querySelector(".panel-chart .panel-body").appendChild(adviceBox);
        }
        adviceBox.style.display = "block";
        adviceBox.innerHTML = `
            <strong>💡 Optimización de Larrard (LPDM):</strong><br>
            • Compacidad Máxima teórica: <strong>${maxPacking.toFixed(4)}</strong> para <strong>${bestSandPct}% Arena</strong>.<br>
            • Tu selección actual (Bolomey): <strong>${uiSandPct}% Arena</strong> (Compacidad: <strong>${packingPoints.find(p => p.x === uiSandPct)?.y.toFixed(4) || 'N/A'}</strong>).
        `;
    }
}

async function fetchLocalWeatherAndLocation() {
    const btn = document.getElementById("btnGetGpsWeather");
    const spinner = document.getElementById("gpsLoadingSpinner");
    const detailsDiv = document.getElementById("gpsLocationDetails");
    const alertsDiv = document.getElementById("gpsWeatherAlerts");
    
    btn.disabled = true;
    spinner.classList.remove("hidden");
    detailsDiv.style.display = "none";
    alertsDiv.innerHTML = "";
    
    // Read the current manual input coordinates first as fallback (parse comma separated string)
    const coordsVal = document.getElementById("inputGpsCoords").value.trim();
    const parts = coordsVal.split(",");
    let fallbackLat = -34.6037;
    let fallbackLon = -58.3816;
    if (parts.length >= 2) {
        const latParsed = parseFloat(parts[0]);
        const lonParsed = parseFloat(parts[1]);
        if (!isNaN(latParsed) && !isNaN(lonParsed)) {
            fallbackLat = latParsed;
            fallbackLon = lonParsed;
        }
    }
    
    if (!navigator.geolocation) {
        console.warn("Geolocation not supported. Using fallback coordinates.");
        await fetchWeatherForCoordinates(fallbackLat, fallbackLon, true);
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            // Update input field with the actual detected GPS coordinates formatted as a string
            document.getElementById("inputGpsCoords").value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
            await fetchWeatherForCoordinates(lat, lon, false);
        },
        async (err) => {
            console.warn("GPS position acquisition failed or timed out. Using fallback coordinates.", err);
            // Inject a soft warning banner to tell the user that manual/fallback coordinates are being used
            alertsDiv.innerHTML = `
                <div style="font-size: 0.75rem; padding: 8px 12px; border-radius: 4px; border-left: 4px solid var(--warning); background-color: rgba(245, 158, 11, 0.08); color: var(--text); line-height: 1.4; margin-bottom: 8px;">
                    ⚠️ <strong>Acceso al GPS del dispositivo fallido/expirado:</strong> Usando las coordenadas ingresadas manualmente.
                </div>
            `;
            await fetchWeatherForCoordinates(fallbackLat, fallbackLon, true);
        },
        { timeout: 4000, enableHighAccuracy: false }
    );
}

async function fetchWeatherForCoordinates(lat, lon, isFallback) {
    const btn = document.getElementById("btnGetGpsWeather");
    const spinner = document.getElementById("gpsLoadingSpinner");
    const detailsDiv = document.getElementById("gpsLocationDetails");
    const alertsDiv = document.getElementById("gpsWeatherAlerts");
    
    try {
        let displayName = `Coordenadas: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        let address = {};
        let osmData = {};
        
        try {
            // Fetch location from OSM Nominatim with a 4-second timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            
            const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
            const osmResponse = await fetch(nominatimUrl, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'HormigonMixCalc/1.0',
                    'Accept-Language': 'es'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (osmResponse.ok) {
                osmData = await osmResponse.json();
                displayName = osmData.display_name || displayName;
                address = osmData.address || {};
            }
        } catch (err) {
            console.warn("OSM Nominatim reverse geocoding failed or timed out. Bypassing.", err);
        }
        
        // Fetch hourly weather from Open-Meteo
        const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=auto&forecast_days=3`;
        const weatherResponse = await fetch(openMeteoUrl);
        if (!weatherResponse.ok) throw new Error("Error al consultar el clima.");
        
        const weatherData = await weatherResponse.json();
        const current = weatherData.current;
        const hourly = weatherData.hourly;
        
        const currentTemp = current.temperature_2m;
        const currentHum = current.relative_humidity_2m;
        const currentWind = current.wind_speed_10m;
        
        // Update Temperature state variable
        currentClimateTemp = currentTemp;
        
        // Display Location & Current Weather details
        detailsDiv.style.display = "block";
        
        let forecastRows = "";
        for (let i = 0; i < hourly.time.length; i += 6) {
            if (i >= 72) break;
            const timeStr = hourly.time[i];
            const temp = hourly.temperature_2m[i];
            const hum = hourly.relative_humidity_2m[i];
            const wind = hourly.wind_speed_10m[i];
            
            const dateObj = new Date(timeStr);
            const formattedDate = dateObj.toLocaleDateString("es-AR", { day: 'numeric', month: 'numeric' });
            const formattedDay = dateObj.toLocaleDateString("es-AR", { weekday: 'short' });
            const formattedHour = dateObj.toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' });
            
            const hTc = temp + 2;
            const hr = hum / 100;
            const hEvap = Math.max(0, 5 * (Math.pow(hTc + 18, 2.5) - hr * Math.pow(temp + 18, 2.5)) * (wind + 4) * 1e-6);
            
            let riskIcon = "✅";
            let riskColor = "var(--success)";
            let riskText = "Curado Normal";
            if (temp < 3.0) {
                riskIcon = "❄️";
                riskColor = "var(--accent)";
                riskText = "Peligro Congelamiento";
            } else if (hEvap > 1.0) {
                riskIcon = "⚠️";
                riskColor = "var(--error)";
                riskText = "Evaporación Crítica";
            } else if (hEvap > 0.5) {
                riskIcon = "⛅";
                riskColor = "var(--warning)";
                riskText = "Evaporación Moderada";
            }
            
            forecastRows += `
                <div class="forecast-item" style="flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; background-color: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 6px; padding: 6px 10px; font-size: 0.72rem; min-width: 80px; text-align: center; gap: 3px;">
                    <span style="font-weight: 600; color: var(--text-muted); text-transform: capitalize;">${formattedDay} ${formattedDate}</span>
                    <span style="color: var(--text-muted); font-size: 0.65rem;">${formattedHour} hs</span>
                    <span style="font-size: 0.95rem; font-weight: 700; color: var(--text); margin: 2px 0;">${temp.toFixed(1)}°C</span>
                    <span style="color: ${riskColor}; font-size: 0.85rem;" title="${riskText}">${riskIcon}</span>
                    <span style="font-size: 0.62rem; color: var(--text-muted);">💨 ${wind.toFixed(0)} km/h</span>
                    <span style="font-size: 0.62rem; color: var(--text-muted);">💧 ${hum}%</span>
                </div>
            `;
        }
        
        detailsDiv.innerHTML = `
            <div style="margin-bottom: 8px;">
                <strong>📍 Ubicación detectada:</strong><br>
                <span style="font-size: 0.75rem; color: var(--text);">${displayName}</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; background-color: rgba(255,255,255,0.02); padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); margin-bottom: 12px; font-size: 0.75rem;">
                <div style="text-align: center;">⛅ <strong>Clima:</strong> ${currentTemp.toFixed(1)} °C</div>
                <div style="text-align: center;">💧 <strong>Hum:</strong> ${currentHum}%</div>
                <div style="text-align: center;">💨 <strong>Viento:</strong> ${currentWind.toFixed(1)} km/h</div>
            </div>
            <div style="margin-top: 5px; margin-bottom: 5px;">
                <strong>📅 Pronóstico de Curado (72 hs):</strong>
            </div>
            <div class="forecast-scroller" style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; margin-top: 5px;">
                ${forecastRows}
            </div>
        `;
        
        // 3. Evaporation Calculation
        const Tc = currentTemp + 2;
        const r = currentHum / 100;
        const Ta = currentTemp;
        const V = currentWind;
        const term1 = Math.pow(Tc + 18, 2.5);
        const term2 = r * Math.pow(Ta + 18, 2.5);
        const evapRate = Math.max(0, 5 * (term1 - term2) * (V + 4) * 1e-6);
        
        // 4. Analyse 72-hour forecast
        let minForecastTemp = 999;
        let maxForecastEvap = 0;
        let maxEvapTime = "";
        let freezeTime = "";
        
        for (let i = 0; i < hourly.time.length; i++) {
            const t = hourly.temperature_2m[i];
            if (t < minForecastTemp) {
                minForecastTemp = t;
                freezeTime = hourly.time[i];
            }
            const h = hourly.relative_humidity_2m[i];
            const w = hourly.wind_speed_10m[i];
            const hTc = t + 2;
            const hr = h / 100;
            const hEvap = Math.max(0, 5 * (Math.pow(hTc + 18, 2.5) - hr * Math.pow(t + 18, 2.5)) * (w + 4) * 1e-6);
            if (hEvap > maxForecastEvap) {
                maxForecastEvap = hEvap;
                maxEvapTime = hourly.time[i];
            }
        }
        
        // 5. Exposure Alerts
        const addressStr = JSON.stringify(osmData.address || {}).toLowerCase();
        const coastalKeywords = ["mar", "playa", "costa", "atlántico", "bahía", "puerto", "beach", "ocean", "del plata", "gesell", "pinamar", "necochea", "comodoro", "madryn"];
        const riverKeywords = ["río", "rio", "arroyo", "lago", "laguna", "delta", "tigre", "paraná", "uruguay", "lujan", "water"];
        const patagoniaProvinces = ["santa cruz", "chubut", "tierra del fuego", "río negro", "rio negro", "neuquén", "neuquen", "ushuaia", "bariloche"];
        
        let isMarine = coastalKeywords.some(kw => addressStr.includes(kw));
        let isRiver = riverKeywords.some(kw => addressStr.includes(kw));
        let province = (address.state || address.province || address.county || "").toLowerCase();
        let isPatagonia = patagoniaProvinces.some(kw => province.includes(kw) || addressStr.includes(kw));
        
        if (evapRate > 1.0) {
            alertsDiv.appendChild(createAlertCard("warning", "⚠️ Alta Evaporación Crítica Actual", `La tasa de evaporación actual es de <strong>${evapRate.toFixed(2)} kg/m²/h</strong>. Riesgo extremo de fisuración plástica. Se sugiere retardante (<strong>PROTEX Retard</strong>) o curador (<strong>PROTEX CB-WB</strong>).`));
            addAdditiveIfMissing("protex_retard", 0.35);
        } else if (evapRate > 0.5) {
            alertsDiv.appendChild(createAlertCard("info", "💡 Evaporación Moderada Actual", `La tasa de evaporación actual es de <strong>${evapRate.toFixed(2)} kg/m²/h</strong>. Mantener curado húmedo estándar.`));
        }
        
        if (minForecastTemp < 3.0) {
            const formattedTime = new Date(freezeTime).toLocaleString("es-AR", { weekday: 'short', hour: '2-digit', minute:'2-digit' });
            alertsDiv.appendChild(createAlertCard("error", "❄️ Peligro de Heladas (Curado Inicial 72hs)", `Se prevé una mínima de <strong>${minForecastTemp.toFixed(1)} °C</strong> el <strong>${formattedTime}</strong>. Riesgo de congelamiento. Se sugiere anticongelante <strong>PROTEX Frio 10</strong> y protección térmica del encofrado.`));
            addAdditiveIfMissing("protex_frio_10", 2.00);
        }
        
        if (maxForecastEvap > 1.0) {
            const formattedTime = new Date(maxEvapTime).toLocaleString("es-AR", { weekday: 'short', hour: '2-digit', minute:'2-digit' });
            alertsDiv.appendChild(createAlertCard("warning", "🔥 Riesgo de Deshidratación (Curado Inicial 72hs)", `Se prevé un pico de evaporación de <strong>${maxForecastEvap.toFixed(2)} kg/m²/h</strong> el <strong>${formattedTime}</strong>. Se recomienda retardante y membrana de curado.`));
            addAdditiveIfMissing("protex_retard", 0.35);
        }
        
        if (isMarine) {
            alertsDiv.appendChild(createAlertCard("warning", "🌊 Exposición Marina Detectada (Clase A3)", "La cercanía a la costa expone la armadura a cloruros. Se exige un hormigón de muy baja permeabilidad (mínimo H30). Se sugiere adicionar <strong>SikaFume®</strong> al 8.00% y <strong>PROTEX 2011 (Superplast.)</strong> para sellar poros."));
            addAdditiveIfMissing("sikafume_silice", 8.00);
            addAdditiveIfMissing("protex_2011", 0.60);
        }
        if (isRiver && !isMarine) {
            alertsDiv.appendChild(createAlertCard("info", "💧 Exposición a Humedad (Ríos/Delta)", "La cercanía a humedales o cuerpos de agua incrementa el riesgo de absorción capilar. Se sugiere incorporar el hidrófugo de masa <strong>PROTEX Hidro</strong> al 2.00% para impermeabilizar cimientos y bases."));
            addAdditiveIfMissing("protex_hidro", 2.00);
        }
        if (isPatagonia) {
            alertsDiv.appendChild(createAlertCard("error", "🏔️ Clima Frío Regional (Patagonia/Andes)", "Zona de heladas frecuentes y ciclos de congelamiento/deshielo. Se recomienda incorporar aire intencionalmente (<strong>PROTEX 3</strong> al 0.10%) para amortiguar tensiones por congelamiento del agua de poros."));
            addAdditiveIfMissing("protex_3", 0.10);
        }
        
        if (alertsDiv.children.length === 0) {
            alertsDiv.appendChild(createAlertCard("success", "✅ Condiciones Óptimas de Curado", "El pronóstico a 72hs indica clima templado y sin vientos fuertes. Sin riesgos de heladas o deshidratación prematura detectados."));
        }
        
        renderAdditivesList();
        checkSikaFumeVisibility();
        calculateAndUpdate();
        
    } catch (err) {
        console.error(err);
        alert("Error al obtener datos climáticos o geográficos: " + err.message);
    } finally {
        btn.disabled = false;
        spinner.classList.add("hidden");
    }
}

function createAlertCard(type, title, text) {
    const card = document.createElement("div");
    card.style.fontSize = "0.75rem";
    card.style.padding = "8px 12px";
    card.style.borderRadius = "4px";
    card.style.borderLeft = "4px solid";
    card.style.lineHeight = "1.4";
    card.style.marginTop = "6px";
    
    if (type === "error") {
        card.style.backgroundColor = "rgba(239, 68, 68, 0.08)";
        card.style.borderColor = "#ef4444";
        card.style.color = "#f87171";
    } else if (type === "warning") {
        card.style.backgroundColor = "rgba(245, 158, 11, 0.08)";
        card.style.borderColor = "#f59e0b";
        card.style.color = "#fbbf24";
    } else if (type === "info") {
        card.style.backgroundColor = "rgba(59, 130, 246, 0.08)";
        card.style.borderColor = "#3b82f6";
        card.style.color = "#60a5fa";
    } else {
        card.style.backgroundColor = "rgba(16, 185, 129, 0.08)";
        card.style.borderColor = "#10b981";
        card.style.color = "#34d399";
    }
    
    card.innerHTML = `<strong>${title}</strong><br>${text}`;
    return card;
}

function addAdditiveIfMissing(typeKey, defaultDose) {
    const exists = additives.some(a => a.typeKey === typeKey);
    if (!exists) {
        const spec = PREDEFINED_ADDITIVES[typeKey];
        if (spec) {
            additives.push({
                id: `add_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                typeKey: typeKey,
                name: spec.name,
                dosage: defaultDose || spec.defaultDosage,
                minDosage: spec.minDosage,
                maxDosage: spec.maxDosage,
                density: spec.density,
                type: spec.type
            });
        }
    }
}

// ==========================================
// SUPABASE INTEGRATION & CLOUD PERSISTENCE
// ==========================================

function setupSupabaseIntegration() {
    const btnAuthModal = document.getElementById("btnAuthModal");
    const userSessionText = document.getElementById("userSessionText");
    const authModal = document.getElementById("authModal");
    const btnCloseAuthModal = document.getElementById("btnCloseAuthModal");
    const authForm = document.getElementById("authForm");
    const authModalTitle = document.getElementById("authModalTitle");
    const authModalSubtitle = document.getElementById("authModalSubtitle");
    const btnToggleAuthMode = document.getElementById("btnToggleAuthMode");
    const btnSubmitAuth = document.getElementById("btnSubmitAuth");
    const authErrorMsg = document.getElementById("authErrorMsg");
    const authSuccessMsg = document.getElementById("authSuccessMsg");
    const groupConfirmPassword = document.getElementById("groupConfirmPassword");

    const dbActionsRow = document.getElementById("dbActionsRow");
    const btnSaveMix = document.getElementById("btnSaveMix");
    const btnListMixes = document.getElementById("btnListMixes");
    const dbStatusText = document.getElementById("dbStatusText");

    const mixesModal = document.getElementById("mixesModal");
    const btnCloseMixesModal = document.getElementById("btnCloseMixesModal");
    const btnDismissMixes = document.getElementById("btnDismissMixes");
    const mixesListContainer = document.getElementById("mixesListContainer");

    let isSignUpMode = false;
    let currentUserSession = null;

    if (!supabase) {
        dbStatusText.innerText = "Sin conexión a base de datos (credenciales .env no cargadas)";
        btnAuthModal.disabled = true;
        btnAuthModal.title = "Supabase no configurado";
        return;
    }

    // Subscribe to Auth state changes
    onAuthStateChange((event, session) => {
        currentUserSession = session;
        if (session) {
            // User is authenticated
            const emailName = session.user.email.split("@")[0];
            userSessionText.innerText = `Cerrar Sesión (${emailName})`;
            btnAuthModal.classList.add("auth-active");
            btnAuthModal.title = "Cerrar la sesión de usuario activa";

            // Enable db actions
            btnSaveMix.removeAttribute("disabled");
            btnListMixes.removeAttribute("disabled");
            btnSaveMix.title = "Guardar esta mezcla en Supabase";
            btnListMixes.title = "Cargar una mezcla guardada anteriormente";
            dbStatusText.innerText = `Conectado como ${session.user.email}`;
        } else {
            // User is not authenticated
            userSessionText.innerText = "Iniciar Sesión";
            btnAuthModal.classList.remove("auth-active");
            btnAuthModal.title = "Iniciar Sesión / Registrarse";

            // Disable db actions
            btnSaveMix.setAttribute("disabled", "true");
            btnListMixes.setAttribute("disabled", "true");
            btnSaveMix.title = "Iniciá sesión para guardar dosificaciones";
            btnListMixes.title = "Iniciá sesión para ver tus mezclas";
            dbStatusText.innerText = "Iniciá sesión para guardar tus diseños de mezcla";
        }
    });

    // Auth Button click
    btnAuthModal.addEventListener("click", async () => {
        if (currentUserSession) {
            // Log out
            if (confirm("¿Estás seguro que querés cerrar la sesión activa?")) {
                try {
                    await signOut();
                    alert("Sesión cerrada.");
                } catch (err) {
                    alert("Error al cerrar sesión: " + err.message);
                }
            }
        } else {
            // Open auth modal
            isSignUpMode = false;
            updateAuthModalUI();
            authModal.classList.add("open");
        }
    });

    btnCloseAuthModal.addEventListener("click", () => {
        authModal.classList.remove("open");
    });

    // Toggle Mode
    btnToggleAuthMode.addEventListener("click", () => {
        isSignUpMode = !isSignUpMode;
        updateAuthModalUI();
    });

    // Submit Auth Form
    authForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("inputAuthEmail").value.trim();
        const password = document.getElementById("inputAuthPassword").value;
        
        authErrorMsg.style.display = "none";
        authSuccessMsg.style.display = "none";
        btnSubmitAuth.disabled = true;
        btnSubmitAuth.innerText = "Procesando...";

        try {
            if (isSignUpMode) {
                const confirmPassword = document.getElementById("inputAuthConfirmPassword").value;
                if (password !== confirmPassword) {
                    throw new Error("Las contraseñas no coinciden.");
                }
                await signUp(email, password);
                authSuccessMsg.innerText = "¡Registro exitoso! Por favor revisá tu casilla de correo para confirmar tu cuenta.";
                authSuccessMsg.style.display = "block";
                authForm.reset();
            } else {
                await signIn(email, password);
                authModal.classList.remove("open");
                authForm.reset();
            }
        } catch (err) {
            authErrorMsg.innerText = err.message || "Error al autenticar.";
            authErrorMsg.style.display = "block";
        } finally {
            btnSubmitAuth.disabled = false;
            btnSubmitAuth.innerText = isSignUpMode ? "Registrarse" : "Entrar";
        }
    });

    function updateAuthModalUI() {
        authErrorMsg.style.display = "none";
        authSuccessMsg.style.display = "none";
        if (isSignUpMode) {
            authModalTitle.innerText = "Registrarse";
            authModalSubtitle.innerText = "Creá una cuenta en HormigonIA para resguardar tus mezclas.";
            btnSubmitAuth.innerText = "Registrarse";
            btnToggleAuthMode.innerText = "¿Ya tenés cuenta? Iniciá Sesión";
            groupConfirmPassword.style.display = "block";
            document.getElementById("inputAuthConfirmPassword").setAttribute("required", "true");
        } else {
            authModalTitle.innerText = "Iniciar Sesión";
            authModalSubtitle.innerText = "Accedé a tu cuenta de HormigonIA para sincronizar tus dosificaciones.";
            btnSubmitAuth.innerText = "Entrar";
            btnToggleAuthMode.innerText = "¿No tenés cuenta? Registrate";
            groupConfirmPassword.style.display = "none";
            document.getElementById("inputAuthConfirmPassword").removeAttribute("required");
        }
    }

    // Save Mix
    btnSaveMix.addEventListener("click", async () => {
        const name = prompt("Ingresá un nombre identificatorio para esta dosificación (ej: Losa Primer Piso H21):");
        if (name === null) return; // Cancelled
        if (!name.trim()) {
            alert("El nombre de la dosificación no puede estar vacío.");
            return;
        }

        // Gather sieve weights
        const sandSieves = [];
        const stoneSieves = [];
        document.querySelectorAll(".sand-sieve").forEach(input => {
            sandSieves.push(parseFloat(input.value) || 0);
        });
        document.querySelectorAll(".stone-sieve").forEach(input => {
            stoneSieves.push(parseFloat(input.value) || 0);
        });

        const mixData = {
            name: name.trim(),
            concrete_class: document.getElementById("selectConcreteClass").value,
            design_method: document.getElementById("selectDesignMethod").value,
            exposure_class: document.getElementById("selectExposureClass").value,
            batch_volume: parseFloat(document.getElementById("inputBatchVolume").value) || 80,
            wc_ratio: parseFloat(document.getElementById("inputCustomWC").value) || 0.45,
            cement_base: parseFloat(document.getElementById("inputCustomCement").value) || 300,
            sieve_data: {
                sand: sandSieves,
                stone: stoneSieves
            },
            additives: additives,
            materials: {
                densCement: parseFloat(document.getElementById("densCement").value) || 1400,
                coefCement: parseFloat(document.getElementById("coefCement").value) || 0.47,
                densSand: parseFloat(document.getElementById("densSand").value) || 1650,
                coefSand: parseFloat(document.getElementById("coefSand").value) || 0.63,
                moistSand: parseFloat(document.getElementById("moistSand").value) || 0,
                absSand: parseFloat(document.getElementById("absSand").value) || 0,
                densStone: parseFloat(document.getElementById("densStone").value) || 1600,
                coefStone: parseFloat(document.getElementById("coefStone").value) || 0.51,
                moistStone: parseFloat(document.getElementById("moistStone").value) || 0,
                absStone: parseFloat(document.getElementById("absStone").value) || 0
            }
        };

        try {
            await saveConcreteMix(mixData);
            alert("Mezcla guardada con éxito en la nube.");
        } catch (err) {
            alert("Error al guardar mezcla: " + err.message);
        }
    });

    // List Mixes modal trigger
    btnListMixes.addEventListener("click", async () => {
        mixesListContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 30px;">Cargando dosificaciones...</div>';
        mixesModal.classList.add("open");

        try {
            const data = await getUserMixes();
            renderMixesList(data);
        } catch (err) {
            mixesListContainer.innerHTML = `<div style="text-align: center; color: var(--error); padding: 30px;">Error al cargar datos: ${err.message}</div>`;
        }
    });

    // Close mixes modal
    btnCloseMixesModal.addEventListener("click", () => {
        mixesModal.classList.remove("open");
    });
    btnDismissMixes.addEventListener("click", () => {
        mixesModal.classList.remove("open");
    });

    function renderMixesList(list) {
        mixesListContainer.innerHTML = "";
        if (list.length === 0) {
            mixesListContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 30px;">No tenés dosificaciones guardadas todavía.</div>';
            return;
        }

        list.forEach(mix => {
            const dateStr = new Date(mix.created_at).toLocaleDateString("es-AR", {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            const item = document.createElement("div");
            item.className = "mix-item";
            item.innerHTML = `
                <div class="mix-info">
                    <span class="mix-title">${mix.name}</span>
                    <div class="mix-meta">
                        <span>Clase: <strong>${mix.concrete_class}</strong></span>
                        <span>Método: <strong>${mix.design_method}</strong></span>
                        <span>Fecha: <strong>${dateStr}</strong></span>
                    </div>
                </div>
                <div class="mix-actions">
                    <button class="btn-delete-mix" data-id="${mix.id}" title="Eliminar dosificación">🗑️</button>
                </div>
            `;

            // Load mix on item click
            item.addEventListener("click", (e) => {
                if (e.target.classList.contains("btn-delete-mix")) return; // ignore delete click
                loadSelectedMix(mix);
            });

            // Delete listener
            item.querySelector(".btn-delete-mix").addEventListener("click", async (e) => {
                e.stopPropagation();
                if (confirm(`¿Estás seguro que querés eliminar la mezcla "${mix.name}"?`)) {
                    try {
                        await deleteMix(mix.id);
                        alert("Dosificación eliminada.");
                        // Refresh list
                        const updatedList = await getUserMixes();
                        renderMixesList(updatedList);
                    } catch (err) {
                        alert("Error al eliminar mezcla: " + err.message);
                    }
                }
            });

            mixesListContainer.appendChild(item);
        });
    }

    function loadSelectedMix(mix) {
        try {
            // Restore dropdowns
            document.getElementById("selectConcreteClass").value = mix.concrete_class;
            document.getElementById("selectDesignMethod").value = mix.design_method;
            document.getElementById("selectExposureClass").value = mix.exposure_class;
            document.getElementById("inputBatchVolume").value = mix.batch_volume;

            // Trigger Class Change logic to update custom panels visibility
            const customNameDiv = document.getElementById("divCustomClassNameContainer");
            if (mix.concrete_class === "Personalizado") {
                customNameDiv.classList.remove("hidden");
                // Set custom name if available in class defaults sequence or custom state
                document.getElementById("inputCustomClassName").value = mix.name;
            } else {
                customNameDiv.classList.add("hidden");
            }

            // Restore manual inputs
            document.getElementById("inputCustomWC").value = mix.wc_ratio;
            document.getElementById("inputCustomCement").value = mix.cement_base;

            // Restore materials
            if (mix.materials) {
                document.getElementById("densCement").value = mix.materials.densCement || 1400;
                document.getElementById("coefCement").value = mix.materials.coefCement || 0.47;
                document.getElementById("densSand").value = mix.materials.densSand || 1650;
                document.getElementById("coefSand").value = mix.materials.coefSand || 0.63;
                document.getElementById("moistSand").value = mix.materials.moistSand || 0;
                document.getElementById("absSand").value = mix.materials.absSand || 0;
                document.getElementById("densStone").value = mix.materials.densStone || 1600;
                document.getElementById("coefStone").value = mix.materials.coefStone || 0.51;
                document.getElementById("moistStone").value = mix.materials.moistStone || 0;
                document.getElementById("absStone").value = mix.materials.absStone || 0;
            }

            // Restore sieves
            if (mix.sieve_data) {
                const sandInputs = document.querySelectorAll(".sand-sieve");
                const stoneInputs = document.querySelectorAll(".stone-sieve");
                
                if (mix.sieve_data.sand && sandInputs.length === mix.sieve_data.sand.length) {
                    for (let i = 0; i < sandInputs.length; i++) {
                        sandInputs[i].value = mix.sieve_data.sand[i];
                    }
                }
                if (mix.sieve_data.stone && stoneInputs.length === mix.sieve_data.stone.length) {
                    for (let i = 0; i < stoneInputs.length; i++) {
                        stoneInputs[i].value = mix.sieve_data.stone[i];
                    }
                }
            }

            // Restore additives
            if (mix.additives) {
                additives = mix.additives;
            }

            // Close modal
            mixesModal.classList.remove("open");

            // Recalculate
            renderAdditivesList();
            checkSikaFumeVisibility();
            calculateAndUpdate();

            alert(`Mezcla "${mix.name}" cargada correctamente.`);
        } catch (err) {
            alert("Error al cargar la dosificación seleccionada: " + err.message);
        }
    }
}
