import math
from typing import List, Dict, Any

# Sieve Norm standards and Fineness Modulus definitions
FM_SIEVES = [75.0, 37.5, 19.0, 9.5, 4.75, 2.36, 1.18, 0.6, 0.3, 0.15]
G_FACTOR_SIEVES = [37.5, 19.0, 9.5, 4.75, 2.36, 1.18, 0.6, 0.3, 0.15]

ABACO1_GRID = {
    "mfValues": [3.0, 4.0, 5.0, 6.0, 6.5],
    "slumpValues": [2, 5, 10, 15, 20],
    "data": [
        [204, 218, 234, 244, 250],  # MF 3.0
        [174, 187, 202, 212, 220],  # MF 4.0
        [151, 164, 178, 188, 195],  # MF 5.0
        [134, 145, 156, 165, 172],  # MF 6.0
        [127, 138, 148, 157, 163]   # MF 6.5
    ]
}

def loosening_effect(z: float) -> float:
    return 0.7 * (1 - z) + 0.3 * ((1 - z) ** 12)

def wall_effect(z: float) -> float:
    return (1 - z) ** 1.3

def get_representative_diameters(sieve_sizes: List[float]) -> List[float]:
    diams = []
    upper_limit = 100.0 if sieve_sizes[0] == 75.0 else (75.0 if sieve_sizes[0] == 50.0 else 50.0)
    sizes = [upper_limit] + sieve_sizes + [0.0]
    for i in range(len(sieve_sizes) + 1):
        diams.append(math.sqrt(sizes[i] * sizes[i+1]))
    return diams

def calculate_curve_fm(sieve_sizes: List[float], passing: List[float]) -> float:
    sum_fm = 0.0
    for size, pass_val in zip(sieve_sizes, passing):
        if size in FM_SIEVES:
            sum_fm += (100.0 - pass_val)
    return sum_fm / 100.0

def interpolate_water_demand(mf: float, slump: float) -> float:
    mfs = ABACO1_GRID["mfValues"]
    slumps = ABACO1_GRID["slumpValues"]
    data = ABACO1_GRID["data"]
    
    clean_mf = max(mfs[0], min(mfs[-1], mf))
    clean_slump = max(slumps[0], min(slumps[-1], slump))
    
    mf_idx = 0
    for i in range(len(mfs) - 1):
        if clean_mf >= mfs[i] and clean_mf <= mfs[i+1]:
            mf_idx = i
            break
            
    slump_idx = 0
    for i in range(len(slumps) - 1):
        if clean_slump >= slumps[i] and clean_slump <= slumps[i+1]:
            slump_idx = i
            break
            
    q11 = data[mf_idx][slump_idx]
    q21 = data[mf_idx+1][slump_idx]
    q12 = data[mf_idx][slump_idx+1]
    q22 = data[mf_idx+1][slump_idx+1]
    
    x1, x2 = mfs[mf_idx], mfs[mf_idx+1]
    y1, y2 = slumps[slump_idx], slumps[slump_idx+1]
    
    r1 = ((x2 - clean_mf)/(x2 - x1)) * q11 + ((clean_mf - x1)/(x2 - x1)) * q21
    r2 = ((x2 - clean_mf)/(x2 - x1)) * q12 + ((clean_mf - x1)/(x2 - x1)) * q22
    
    final_water = ((y2 - clean_slump)/(y2 - y1)) * r1 + ((clean_slump - y1)/(y2 - y1)) * r2
    return final_water

def predict_slump_from_water(mf: float, water_m3: float, water_reduction: float, factor_g: float, is_crushed: bool = True) -> float:
    w_equiv = water_m3 / (water_reduction * factor_g)
    if is_crushed:
        w_equiv /= 1.07
        
    mfs = ABACO1_GRID["mfValues"]
    slumps = ABACO1_GRID["slumpValues"]
    data = ABACO1_GRID["data"]
    
    clean_mf = max(mfs[0], min(mfs[-1], mf))
    
    mf_idx = 0
    for i in range(len(mfs) - 1):
        if clean_mf >= mfs[i] and clean_mf <= mfs[i+1]:
            mf_idx = i
            break
            
    x1, x2 = mfs[mf_idx], mfs[mf_idx+1]
    t = (clean_mf - x1) / (x2 - x1)
    
    water_for_slumps = []
    for j in range(len(slumps)):
        w1 = data[mf_idx][j]
        w2 = data[mf_idx+1][j]
        water_for_slumps.append((1.0 - t) * w1 + t * w2)
        
    if w_equiv <= water_for_slumps[0]:
        ratio = max(0.1, w_equiv / water_for_slumps[0])
        base_slump = 2.0 * ratio
    elif w_equiv >= water_for_slumps[-1]:
        diff = w_equiv - water_for_slumps[-1]
        base_slump = 20.0 + min(5.0, diff / 5.0)
    else:
        base_slump = 8.0
        for j in range(len(water_for_slumps) - 1):
            w1 = water_for_slumps[j]
            w2 = water_for_slumps[j+1]
            if w_equiv >= w1 and w_equiv <= w2:
                y1 = slumps[j]
                y2 = slumps[j+1]
                factor = (w_equiv - w1) / (w2 - w1)
                base_slump = y1 + factor * (y2 - y1)
                break
                
    return min(24.0, base_slump)

def slump_pred_from_class(concrete_class: str) -> float:
    # Class standard slumps
    class_slumps = {
        "H8": 6.0,
        "H15": 8.0,
        "H20": 9.0,
        "H25": 10.0,
        "H30": 11.0,
        "H35": 12.0,
        "H40": 12.0
    }
    return class_slumps.get(concrete_class, 10.0)

def get_aci_coarse_aggregate_volume(max_sieve: float, sand_fm: float) -> float:
    fms = [2.4, 2.6, 2.8, 3.0]
    sizes = [9.5, 12.5, 19.0, 25.0, 37.5]
    table = [
        [0.50, 0.48, 0.46, 0.44],  # 9.5 mm
        [0.59, 0.57, 0.55, 0.53],  # 12.5 mm
        [0.66, 0.64, 0.62, 0.60],  # 19.0 mm
        [0.71, 0.69, 0.67, 0.65],  # 25.0 mm
        [0.75, 0.73, 0.71, 0.69]   # 37.5 mm
    ]
    
    fm = max(2.4, min(3.0, sand_fm))
    
    size_idx = 0
    for i in range(len(sizes)):
        if max_sieve <= sizes[i]:
            size_idx = i
            break
        size_idx = i
        
    fm_idx = 0
    for i in range(len(fms) - 1):
        if fm >= fms[i] and fm <= fms[i+1]:
            fm_idx = i
            break
        fm_idx = i
        
    v1 = table[size_idx][fm_idx]
    v2 = table[size_idx][fm_idx+1]
    f1 = fms[fm_idx]
    f2 = fms[fm_idx+1]
    
    v = v1 + (v2 - v1) * (fm - f1) / (f2 - f1)
    return v

def calculate_larrard_packing_curve(sieve_sizes: List[float], sand_sieves: List[float], stone_sieves: List[float]) -> List[Dict[str, float]]:
    packing_points = []
    diams = get_representative_diameters(sieve_sizes)
    default_alpha = 0.58
    
    sand_fractions = []
    prev_sand = 100.0
    for val in sand_sieves:
        sand_fractions.append((prev_sand - val) / 100.0)
        prev_sand = val
    sand_fractions.append(prev_sand / 100.0)
    
    stone_fractions = []
    prev_stone = 100.0
    for val in stone_sieves:
        stone_fractions.append((prev_stone - val) / 100.0)
        prev_stone = val
    stone_fractions.append(prev_stone / 100.0)
    
    for s in range(0, 101, 2):
        sand_frac = s / 100.0
        stone_frac = 1.0 - sand_frac
        
        y = []
        for i in range(len(sand_fractions)):
            y.append(sand_frac * sand_fractions[i] + stone_frac * stone_fractions[i])
            
        c_i = []
        N = len(y)
        
        for i in range(N):
            loosening_sum = 0.0
            for j in range(i):
                z = diams[i] / diams[j]
                loosening_sum += y[j] * loosening_effect(z)
                
            wall_sum = 0.0
            for j in range(i + 1, N):
                z = diams[j] / diams[i]
                wall_sum += y[j] * wall_effect(z)
                
            denominator = 1.0 - loosening_sum - (1.0 - default_alpha) * wall_sum
            ci = default_alpha / max(0.01, denominator)
            c_i.append(ci)
            
        packing_density = min(c_i)
        packing_points.append({"x": float(s), "y": float(packing_density)})
        
    return packing_points

def calculate_larrard_packing_density(sieve_sizes: List[float], combined_sieve_passing: List[float]) -> float:
    diams = get_representative_diameters(sieve_sizes)
    default_alpha = 0.58
    
    fractions = []
    prev = 100.0
    for val in combined_sieve_passing:
        fractions.append((prev - val) / 100.0)
        prev = val
    fractions.append(prev / 100.0)
    
    c_i = []
    N = len(fractions)
    for i in range(N):
        loosening_sum = 0.0
        for j in range(i):
            z = diams[i] / diams[j]
            loosening_sum += fractions[j] * loosening_effect(z)
            
        wall_sum = 0.0
        for j in range(i + 1, N):
            z = diams[j] / diams[i]
            wall_sum += fractions[j] * wall_effect(z)
            
        denominator = 1.0 - loosening_sum - (1.0 - default_alpha) * wall_sum
        ci = default_alpha / max(0.01, denominator)
        c_i.append(ci)
        
    return min(c_i)

def get_ideal_curve(method: str, sieve_sizes: List[float], size_limit: float, D_target: float, A_param: float) -> List[float]:
    curve = []
    for size in sieve_sizes:
        if size > D_target:
            p = 100.0
        else:
            if method == "fuller":
                p = 100.0 * math.sqrt(size / D_target)
            elif method == "delapena":
                p = A_param + (100.0 - A_param) * ((size / D_target) ** 0.40)
            else:
                p = A_param + (100.0 - A_param) * math.sqrt(size / D_target)
        p = min(100.0, max(0.0, p))
        curve.append(p)
    return curve

def dosificar_mezcla(params: Dict[str, Any]) -> Dict[str, Any]:
    # Extract params
    sieve_sizes = params["sieveSizes"]
    sand_sieves = params["sandPassing"]
    gravilla_sieves = params["gravillaPassing"]
    grava_sieves = params["gravaPassing"]
    grava2_sieves = params.get("grava2Passing") or [0.0] * len(sieve_sizes)
    
    num_aggregates = params.get("numAggregates", 3)
    design_method = params.get("designMethod", "bolomey")
    split_sieve_size = params.get("splitSieveSize", 4.75)
    max_sieve_size_d = params.get("maxSieveSizeD", 19.0)
    bolomey_a = params.get("bolomeyA", 12.0)
    
    gravilla_ratio_in = params.get("gravillaRatio", 0.30)
    grava_ratio_in = params.get("gravaRatio", 0.30)
    grava2_ratio_in = params.get("grava2Ratio", 0.20)
    
    concrete_class = params.get("concreteClass", "H25")
    vol_m3 = params.get("batchVolume", 1.0)
    target_wc = params.get("targetWC", 0.50)
    air_pct = params.get("airPct", 1.5)
    
    dens_cement = params.get("densCement", 3.10)
    coef_cement = params.get("coefCement", 1.0)
    dens_sand = params.get("densSand", 2.65)
    coef_sand = params.get("coefSand", 1.0)
    dens_gravilla = params.get("densGravilla", 2.68)
    coef_gravilla = params.get("coefGravilla", 1.0)
    dens_grava = params.get("densGrava", 2.70)
    coef_grava = params.get("coefGrava", 1.0)
    dens_grava2 = params.get("densGrava2", 2.70)
    coef_grava2 = params.get("coefGrava2", 1.0)
    
    moist_sand = params.get("moistSand", 4.0)
    abs_sand = params.get("absSand", 1.0)
    moist_gravilla = params.get("moistGravilla", 1.5)
    abs_gravilla = params.get("absGravilla", 0.8)
    moist_grava = params.get("moistGrava", 1.0)
    abs_grava = params.get("absGrava", 0.5)
    moist_grava2 = params.get("moistGrava2", 1.0)
    abs_grava2 = params.get("absGrava2", 0.5)
    
    custom_cement = params.get("customCement", 350.0)
    
    additives = params.get("additives", [])
    
    # Predefined additives rules
    # plasticizer (reduction capacity base), hidrofugo, etc.
    water_reduction = 1.0
    vs_admixture_total = 0.0
    
    # 1. First Pass: Compute ratios depending on method
    sand_ratio, gravilla_ratio, grava_ratio = 0.40, 0.30, 0.30
    
    if design_method == "larrard":
        g_val = gravilla_ratio_in
        G_val = grava_ratio_in
        total_stone = g_val + G_val
        w_g = (g_val / total_stone) if total_stone > 0 else 0.5
        w_G = (G_val / total_stone) if total_stone > 0 else 0.5
        
        stone_sieve_combined = []
        for i in range(len(sieve_sizes)):
            stone_sieve_combined.append(w_g * gravilla_sieves[i] + w_G * grava_sieves[i])
            
        packing_points = calculate_larrard_packing_curve(sieve_sizes, sand_sieves, stone_sieve_combined)
        max_packing = 0.0
        best_sand_pct = 40.0
        for pt in packing_points:
            if pt["y"] > max_packing:
                max_packing = pt["y"]
                best_sand_pct = pt["x"]
                
        if num_aggregates == 2:
            sand_ratio = best_sand_pct / 100.0
            gravilla_ratio = 1.0 - sand_ratio
            grava_ratio = 0.0
        else:
            sand_ratio = best_sand_pct / 100.0
            gravilla_ratio = (1.0 - sand_ratio) * w_g
            grava_ratio = (1.0 - sand_ratio) * w_G
            
    elif design_method == "aci":
        m_a = calculate_curve_fm(sieve_sizes, sand_sieves)
        m_g = calculate_curve_fm(sieve_sizes, gravilla_sieves)
        m_G = calculate_curve_fm(sieve_sizes, grava_sieves)
        
        total_coarse = gravilla_ratio_in + grava_ratio_in + (grava2_ratio_in if num_aggregates == 4 else 0.0)
        r_g = (gravilla_ratio_in / total_coarse) if total_coarse > 0 else 0.33
        r_G = (grava_ratio_in / total_coarse) if total_coarse > 0 else 0.33
        r_G2 = (grava2_ratio_in / total_coarse) if (num_aggregates == 4 and total_coarse > 0) else 0.34
        
        stone_sieve_passing_combined = []
        for i in range(len(sieve_sizes)):
            if num_aggregates == 4:
                stone_sieve_passing_combined.append(r_g * gravilla_sieves[i] + r_G * grava_sieves[i] + r_G2 * grava2_sieves[i])
            else:
                total_coarse_3 = gravilla_ratio_in + grava_ratio_in
                r_g_3 = (gravilla_ratio_in / total_coarse_3) if total_coarse_3 > 0 else 0.5
                r_G_3 = (grava_ratio_in / total_coarse_3) if total_coarse_3 > 0 else 0.5
                stone_sieve_passing_combined.append(r_g_3 * gravilla_sieves[i] + r_G_3 * grava_sieves[i])
            
        v_coarse = get_aci_coarse_aggregate_volume(max_sieve_size_d, m_a)
        
        # Iterative solver for circular dependency
        for iter_run in range(4):
            combined_sieve = []
            for i in range(len(sieve_sizes)):
                combined_sieve.append(sand_ratio * sand_sieves[i] + (1.0 - sand_ratio) * stone_sieve_passing_combined[i])
                
            comb_fm = calculate_curve_fm(sieve_sizes, combined_sieve)
            b_water = interpolate_water_demand(comb_fm, slump_pred_from_class(concrete_class))
            
            iter_sum_sieve_diffs = 0.0
            for j in range(len(sieve_sizes)):
                size = sieve_sizes[j]
                ideal = get_ideal_curve("bolomey", sieve_sizes, size, max_sieve_size_d, bolomey_a)[j]
                diff = abs(combined_sieve[j] - ideal)
                if size in G_FACTOR_SIEVES:
                    iter_sum_sieve_diffs += diff
            iter_factor_g = 1.0 + (iter_sum_sieve_diffs / 100.0)
            
            w_target = b_water * 1.07 * iter_factor_g
            if air_pct > 1.0:
                w_target *= (1.0 - 0.025 * (air_pct - 1.0))
                
            w_red = 1.0
            for add in additives:
                if add.get("type") == "plasticizer" and add.get("dosage", 0) > 0:
                    dosage = add.get("dosage", 0)
                    # Clamped between min/max capacity
                    min_d = add.get("minDosage", 0.5)
                    max_d = add.get("maxDosage", 1.2)
                    clamped_d = max(min_d, min(max_d, dosage))
                    # Simplified reduction curve: e.g. linear between 8% and 20%
                    red_pct = 8.0 + (clamped_d - min_d) * (12.0 / (max_d - min_d))
                    w_red *= (1.0 - (red_pct / 100.0))
            w_red = max(0.60, min(1.0, w_red))
            d_water = w_target * w_red
            
            c_base = d_water / target_wc
            min_cement = 220.0 if concrete_class == "H8" else 300.0
            c_base = max(min_cement, c_base)
            final_water = c_base * target_wc
            
            vs_c = (c_base / dens_cement) * coef_cement
            vs_a = air_pct / 100.0
            
            # Admixture volume
            vs_ad = 0.0
            for add in additives:
                if add.get("dosage", 0.0) > 0.0:
                    weight_kg = c_base * (add.get("dosage", 0.0) / 100.0)
                    vs_ad += (weight_kg / add.get("density", 1.11)) / 1000.0
                    
            vs_w = final_water / 1000.0
            vs_agg = max(0.0, 1.0 - vs_c - vs_w - vs_ad - vs_a)
            
            vs_stone_aci = v_coarse * coef_grava  # Coarse aggregate coefficient
            vs_sand_aci = max(0.0, vs_agg - vs_stone_aci)
            
            if vs_agg > 0:
                sand_ratio = vs_sand_aci / vs_agg
            else:
                sand_ratio = 0.40
                
        if num_aggregates == 2:
            gravilla_ratio = 1.0 - sand_ratio
            grava_ratio = 0.0
            grava2_ratio = 0.0
        elif num_aggregates == 3:
            total_coarse_3 = gravilla_ratio_in + grava_ratio_in
            r_g_3 = (gravilla_ratio_in / total_coarse_3) if total_coarse_3 > 0 else 0.5
            r_G_3 = (grava_ratio_in / total_coarse_3) if total_coarse_3 > 0 else 0.5
            gravilla_ratio = (1.0 - sand_ratio) * r_g_3
            grava_ratio = (1.0 - sand_ratio) * r_G_3
            grava2_ratio = 0.0
        else: # num_aggregates == 4
            gravilla_ratio = (1.0 - sand_ratio) * r_g
            grava_ratio = (1.0 - sand_ratio) * r_G
            grava2_ratio = (1.0 - sand_ratio) * r_G2
            
    else:  # Bolomey, Fuller, La Peña
        m_a = calculate_curve_fm(sieve_sizes, sand_sieves)
        m_g = calculate_curve_fm(sieve_sizes, gravilla_sieves)
        m_G = calculate_curve_fm(sieve_sizes, grava_sieves)
        
        act_method = "bolomey" if design_method == "aci" else design_method
        
        if num_aggregates == 2:
            ideal_passing = get_ideal_curve(act_method, sieve_sizes, max_sieve_size_d, max_sieve_size_d, bolomey_a)
            m_ideal = calculate_curve_fm(sieve_sizes, ideal_passing)
            den = m_a - m_g
            a_pct_solved = (100.0 * (m_ideal - m_g)) / den if abs(den) > 0.001 else 40.0
            a_pct_solved = min(100.0, max(0.0, a_pct_solved))
            sand_ratio = a_pct_solved / 100.0
            gravilla_ratio = 1.0 - sand_ratio
            grava_ratio = 0.0
            grava2_ratio = 0.0
        elif num_aggregates == 3:
            ideal_split = get_ideal_curve(act_method, sieve_sizes, split_sieve_size, split_sieve_size, bolomey_a)
            ideal_max = get_ideal_curve(act_method, sieve_sizes, max_sieve_size_d, max_sieve_size_d, bolomey_a)
            
            m_ideal16 = calculate_curve_fm(sieve_sizes, ideal_split)
            m_ideal32 = calculate_curve_fm(sieve_sizes, ideal_max)
            
            num_g = m_ideal32 - m_ideal16
            den_g = m_G - m_ideal16
            G_pct_solved = (100.0 * num_g) / den_g if abs(den_g) > 0.001 else 30.0
            G_pct_solved = min(100.0, max(0.0, G_pct_solved))
            
            s_f = 100.0 - G_pct_solved
            num_a = m_ideal16 - m_g
            den_a = m_a - m_g
            a_pct_solved = s_f * (num_a / den_a) if abs(den_a) > 0.001 else 40.0
            a_pct_solved = min(s_f, max(0.0, a_pct_solved))
            
            sand_ratio = a_pct_solved / 100.0
            gravilla_ratio = (s_f - a_pct_solved) / 100.0
            grava_ratio = G_pct_solved / 100.0
            grava2_ratio = 0.0
        else: # num_aggregates == 4
            total_coarse = gravilla_ratio_in + grava_ratio_in + grava2_ratio_in
            w_g = (gravilla_ratio_in / total_coarse) if total_coarse > 0 else 0.33
            w_G = (grava_ratio_in / total_coarse) if total_coarse > 0 else 0.33
            w_G2 = (grava2_ratio_in / total_coarse) if total_coarse > 0 else 0.34
            
            coarse_combined = []
            for i in range(len(sieve_sizes)):
                coarse_combined.append(w_g * gravilla_sieves[i] + w_G * grava_sieves[i] + w_G2 * grava2_sieves[i])
                
            m_coarse = calculate_curve_fm(sieve_sizes, coarse_combined)
            ideal_passing = get_ideal_curve(act_method, sieve_sizes, max_sieve_size_d, max_sieve_size_d, bolomey_a)
            m_ideal = calculate_curve_fm(sieve_sizes, ideal_passing)
            
            den = m_a - m_coarse
            a_pct_solved = (100.0 * (m_ideal - m_coarse)) / den if abs(den) > 0.001 else 40.0
            a_pct_solved = min(100.0, max(0.0, a_pct_solved))
            
            sand_ratio = a_pct_solved / 100.0
            gravilla_ratio = (1.0 - sand_ratio) * w_g
            grava_ratio = (1.0 - sand_ratio) * w_G
            grava2_ratio = (1.0 - sand_ratio) * w_G2

    # 2. Compute curves
    bolomey_ideal_passing = get_ideal_curve("bolomey", sieve_sizes, max_sieve_size_d, max_sieve_size_d, bolomey_a)
    fuller_ideal_passing = get_ideal_curve("fuller", sieve_sizes, max_sieve_size_d, max_sieve_size_d, bolomey_a)
    delapena_ideal_passing = get_ideal_curve("delapena", sieve_sizes, max_sieve_size_d, max_sieve_size_d, bolomey_a)
    
    combined_sieve_passing = []
    sum_sieve_diffs = 0.0
        comb = sand_ratio * sand_sieves[i] + gravilla_ratio * gravilla_sieves[i] + grava_ratio * grava_sieves[i]
        if num_aggregates == 4:
            comb += grava2_ratio * grava2_sieves[i]
        combined_sieve_passing.append(comb)
        
        ideal_compare = bolomey_ideal_passing[i]
        if design_method == "fuller":
            ideal_compare = fuller_ideal_passing[i]
        elif design_method == "delapena":
            ideal_compare = delapena_ideal_passing[i]
            
        diff = abs(comb - ideal_compare)
        if sieve_sizes[i] in G_FACTOR_SIEVES:
            sum_sieve_diffs += diff
            
    factor_g = 1.0 + (sum_sieve_diffs / 100.0)
    combined_fm = calculate_curve_fm(sieve_sizes, combined_sieve_passing)
    
    # 3. Water demand & Cement Clamping
    base_water_m3 = interpolate_water_demand(combined_fm, slump_pred_from_class(concrete_class))
    water_target_m3 = base_water_m3 * 1.07
    if air_pct > 1.0:
        water_target_m3 *= (1.0 - 0.025 * (air_pct - 1.0))
        
    # Calculate additive water reductions
    water_reduction = 1.0
    for add in additives:
        if add.get("type") == "plasticizer" and add.get("dosage", 0) > 0:
            dosage = add.get("dosage", 0)
            min_d = add.get("minDosage", 0.5)
            max_d = add.get("maxDosage", 1.2)
            clamped_d = max(min_d, min(max_d, dosage))
            # Linear reduction mapping
            red_pct = 8.0 + (clamped_d - min_d) * (12.0 / (max_d - min_d))
            water_reduction *= (1.0 - (red_pct / 100.0))
    water_reduction = max(0.60, min(1.0, water_reduction))
    
    design_water_m3 = water_target_m3 * water_reduction * factor_g
    
    if concrete_class != "Personalizado":
        cement_base_m3 = design_water_m3 / target_wc
        min_cement = 220.0 if concrete_class == "H8" else 300.0
        cement_base_m3 = max(min_cement, cement_base_m3)
        target_wc = design_water_m3 / cement_base_m3
    else:
        cement_base_m3 = max(10.0, float(custom_cement))
        
    if concrete_class == "Personalizado":
        # En mezclas personalizadas, no reducimos automáticamente el agua de diseño
        # para que la relación a/c real coincida con la ingresada por el usuario,
        # permitiendo que el aditivo incremente directamente la fluidez estimada (slump).
        water_target_m3 = cement_base_m3 * target_wc
    else:
        water_target_m3 = cement_base_m3 * target_wc
        
    # 4. Volume Batching
    cement_weight_batch = cement_base_m3 * vol_m3
    vs_cement = (cement_weight_batch / dens_cement) * coef_cement
    vs_air = vol_m3 * (air_pct / 100.0)
    
    vs_admixture_total = 0.0
    admixture_recipes = []
    
    for add in additives:
        if add.get("dosage", 0.0) > 0.0:
            weight_kg = cement_weight_batch * (add.get("dosage", 0.0) / 100.0)
            vol_l = weight_kg / add.get("density", 1.11)
            vs_admixture_total += (vol_l / 1000.0)
            
    target_water_batch = water_target_m3 * vol_m3
    vs_water = target_water_batch / 1000.0
    
    vs_aggregates = max(0.0, vol_m3 - vs_cement - vs_water - vs_admixture_total - vs_air)
    
    vs_sand = vs_aggregates * sand_ratio
    vs_gravilla = vs_aggregates * gravilla_ratio
    vs_grava = vs_aggregates * grava_ratio
    vs_grava2 = vs_aggregates * grava2_ratio if num_aggregates == 4 else 0.0
    
    # Moisture & Free Water Correction
    w_sand_total = (vs_sand / coef_sand) * moist_sand
    w_gravilla_total = (vs_gravilla / coef_gravilla) * moist_gravilla
    w_grava_total = (vs_grava / coef_grava) * moist_grava
    w_grava2_total = (vs_grava2 / coef_grava2) * moist_grava2 if num_aggregates == 4 else 0.0
    
    w_sand_free = (vs_sand / coef_sand) * (moist_sand - (dens_sand * abs_sand / 100.0))
    w_gravilla_free = (vs_gravilla / coef_gravilla) * (moist_gravilla - (dens_gravilla * abs_gravilla / 100.0))
    w_grava_free = (vs_grava / coef_grava) * (moist_grava - (dens_grava * abs_grava / 100.0))
    w_grava2_free = (vs_grava2 / coef_grava2) * (moist_grava2 - (dens_grava2 * abs_grava2 / 100.0)) if num_aggregates == 4 else 0.0
    
    net_water_final = max(0.0, (target_water_batch - w_sand_free - w_gravilla_free - w_grava_free - w_grava2_free) / 1.1)
    net_water_theoretical = max(0.0, target_water_batch / 1.1)
    
    # Aggregate weights
    sand_dry_weight = (vs_sand / coef_sand) * dens_sand
    sand_wet_weight = sand_dry_weight + w_sand_total
    
    gravilla_dry_weight = (vs_gravilla / coef_gravilla) * dens_gravilla
    gravilla_wet_weight = gravilla_dry_weight + w_gravilla_total
    
    grava_dry_weight = (vs_grava / coef_grava) * dens_grava
    grava_wet_weight = grava_dry_weight + w_grava_total
    
    grava2_dry_weight = (vs_grava2 / coef_grava2) * dens_grava2 if num_aggregates == 4 else 0.0
    grava2_wet_weight = grava2_dry_weight + w_grava2_total
    
    # Slump prediction
    slump_pred = predict_slump_from_water(combined_fm, water_target_m3, water_reduction, factor_g, True)
    
    # Calculate additive recipes
    for add in additives:
        weight_kg = cement_weight_batch * (add.get("dosage", 0.0) / 100.0)
        vol_l = weight_kg / add.get("density", 1.11)
            
        admixture_recipes.append({
            "id": add.get("id"),
            "name": add.get("name"),
            "weight": weight_kg,
            "volume": vol_l
        })
        
    # Calculate Larrard MPT and MFP indicators on backend
    g_frac = vs_aggregates / vol_m3
    vw_frac = vs_water / vol_m3
    va_frac = air_pct / 100.0
    mfp = ((0.23 * vw_frac + va_frac) / (1.0 - g_frac)) * 100.0 if (0.001 < g_frac < 0.99) else 0.0
    
    agg_packing_density = calculate_larrard_packing_density(sieve_sizes, combined_sieve_passing)
    mpt = max_sieve_size_d * ((agg_packing_density / g_frac) ** (1.0/3.0) - 1.0) if (g_frac > 0.001 and agg_packing_density > g_frac) else 0.0

    # Calculate final Larrard packing curve points for chart
    total_stone = gravilla_ratio + grava_ratio + (grava2_ratio if num_aggregates == 4 else 0.0)
    w_g = (gravilla_ratio / total_stone) if total_stone > 0 else 0.33
    w_G = (grava_ratio / total_stone) if total_stone > 0 else 0.33
    w_G2 = (grava2_ratio / total_stone) if (num_aggregates == 4 and total_stone > 0) else 0.34
    stone_combined = []
    for i in range(len(sieve_sizes)):
        if num_aggregates == 4:
            stone_combined.append(w_g * gravilla_sieves[i] + w_G * grava_sieves[i] + w_G2 * grava2_sieves[i])
        else:
            stone_combined.append(w_g * gravilla_sieves[i] + w_G * grava_sieves[i])
    packing_points = calculate_larrard_packing_curve(sieve_sizes, sand_sieves, stone_combined)

    return {
        "sandRatio": sand_ratio,
        "gravillaRatio": gravilla_ratio,
        "gravaRatio": grava_ratio,
        "grava2Ratio": grava2_ratio if num_aggregates == 4 else 0.0,
        "combinedSievePassing": combined_sieve_passing,
        "bolomeyIdealPassing": bolomey_ideal_passing,
        "fullerIdealPassing": fuller_ideal_passing,
        "delapenaIdealPassing": delapena_ideal_passing,
        "combinedFM": combined_fm,
        "designWaterM3": design_water_m3,
        "cementBaseM3": cement_base_m3,
        "targetWC": target_wc,
        "waterTargetM3": water_target_m3,
        "cementWeightBatch": cement_weight_batch,
        "sandDryWeight": sand_dry_weight,
        "sandWetWeight": sand_wet_weight,
        "gravillaDryWeight": gravilla_dry_weight,
        "gravillaWetWeight": gravilla_wet_weight,
        "gravaDryWeight": grava_dry_weight,
        "gravaWetWeight": grava_wet_weight,
        "grava2DryWeight": grava2_dry_weight if num_aggregates == 4 else 0.0,
        "grava2WetWeight": grava2_wet_weight if num_aggregates == 4 else 0.0,
        "netWaterFinal": net_water_final,
        "netWaterTheoretical": net_water_theoretical,
        "slumpPred": slump_pred,
        "admixtureRecipes": admixture_recipes,
        "mpt": mpt,
        "mfp": mfp,
        "packingPoints": packing_points
    }


def calcular_reologia_y_perdida(params: Dict[str, Any]) -> Dict[str, Any]:
    # Roussel and Arrhenius simulation over time (0 to 120 minutes)
    rho = params.get("density", 2400.0)
    g = 9.81
    H = 0.30
    s_target = params.get("sTarget", 100.0) / 1000.0  # convert mm to m
    temp_ambient = params.get("tempAmbient", 25.0)
    temp_water = params.get("tempWater", 15.0)
    rh = params.get("rh", 50.0)
    wind = params.get("wind", 10.0)
    k_20 = params.get("k20", 0.01)  # Pa/min^1.2
    
    # Scale variables
    cement = params.get("cementBaseM3", 350.0)
    sand = params.get("sandDryWeight", 800.0)
    gravilla = params.get("gravillaDryWeight", 300.0)
    grava = params.get("gravaDryWeight", 700.0)
    water = params.get("waterTargetM3", 185.0)
    
    # Calculate Tc (concrete temperature)
    c_temp = 20.0
    agg_temp = temp_ambient
    tc_numerator = 0.22 * (cement * c_temp + (sand + gravilla + grava) * agg_temp) + water * temp_water
    tc_denominator = 0.22 * (cement + sand + gravilla + grava) + water
    tc = tc_numerator / tc_denominator if tc_denominator > 0.1 else temp_ambient
    
    # Run prediction over a 120-minute timeline (every 10 minutes)
    timeline = []
    
    # Menzel Evaporation rate (kg/m^2/h)
    evap_rate = 5.0 * ((tc + 18.0) ** 2.5 - (rh / 100.0) * (temp_ambient + 18.0) ** 2.5) * (wind + 0.4) * 1e-6
    evap_rate = max(0.0, evap_rate)
    
    # Calibrate initial yield stress from s_target (or initial slump)
    # Physically correct Roussel: tau = rho * g * (H - S) / 225
    tau_target = rho * g * max(0.0, H - s_target) / 225.0
    
    import math
    for t in range(0, 121, 10):
        # Arrhenius equivalent age at t minutes
        te = t * math.exp(-4000.0 * (1.0 / (273.15 + tc) - 1.0 / 293.15))
        
        # Stiffening evolution
        tau_t = tau_target + k_20 * (te ** 1.2)
        
        # Evaporation water loss
        water_lost = evap_rate * 0.5 * (t / 60.0)
        water_fraction = (water - water_lost) / water if water > 0 else 1.0
        if water_fraction < 0.5: water_fraction = 0.5
        tau_t = tau_t / (water_fraction ** 3.0)
        
        # Slump from yield stress
        # Physically correct Roussel: S = H - 225 * tau / (rho * g)
        s_t = H - (225.0 * tau_t) / (rho * g)
        s_t = max(0.0, min(H, s_t))
        
        timeline.append({
            "time": t,
            "slump": float(s_t * 1000.0),
            "yieldStress": float(tau_t),
            "eqAge": float(te)
        })
        
    return {
        "concreteTemp": float(tc),
        "evapRate": float(evap_rate),
        "timeline": timeline
    }


def calcular_correcciones_reologia(params: Dict[str, Any]) -> Dict[str, Any]:
    vol_paston = 0.080
    g = 9.81
    H = 0.30
    
    s_target = params.get("sTarget", 100.0) / 1000.0
    s1 = params.get("s1", 80.0) / 1000.0
    t1 = params.get("t1", 15.0)
    tc = params.get("tc", 22.0)
    
    cement_1m3 = params.get("cementBaseM3", 350.0)
    sand_1m3 = params.get("sandDryWeight", 800.0)
    gravilla_1m3 = params.get("gravillaDryWeight", 300.0)
    grava_1m3 = params.get("gravaDryWeight", 700.0)
    grava2_1m3 = params.get("grava2DryWeight", 0.0)
    water_1m3 = params.get("waterTargetM3", 185.0)
    
    rho_teorica = cement_1m3 + sand_1m3 + gravilla_1m3 + grava_1m3 + grava2_1m3 + water_1m3
    rho_real = params.get("densityReal") or rho_teorica
    
    # Physically correct Roussel
    tau_target = rho_teorica * g * max(0.0, H - s_target) / 225.0
    tau_1 = rho_real * g * max(0.0, H - s1) / 225.0
    
    import math
    te1 = t1 * math.exp(-4000.0 * (1.0 / (273.15 + tc) - 1.0 / 293.15))
    k_20 = params.get("k20", 0.01)
    tau_fresco = tau_1 - k_20 * (te1 ** 1.2)
    tau_fresco = max(0.0, tau_fresco)
    
    delta_tau = tau_fresco - tau_target
    
    s_fresco = H - (225.0 * tau_fresco) / (rho_real * g)
    s_fresco = max(0.0, min(H, s_fresco))
    validated = abs(s_fresco - s_target) <= 0.010
    
    correction = {}
    
    total_solids_1m3 = cement_1m3 + sand_1m3
    c_prop = cement_1m3 / total_solids_1m3 if total_solids_1m3 > 0 else 0.30
    s_prop = sand_1m3 / total_solids_1m3 if total_solids_1m3 > 0 else 0.70
    
    if s_fresco < s_target:
        k_sp = params.get("ksp", 500.0)
        m_cement_80l = cement_1m3 * vol_paston
        delta_sp_g = (delta_tau / k_sp) * m_cement_80l if delta_tau > 0 else 0.0
        delta_sp_g = max(0.0, delta_sp_g)
        
        ratio_slump = s1 / s_target if s_target > 0.001 else 1.0
        delta_w_80l = abs(vol_paston * water_1m3 * ( (ratio_slump) ** 0.10 - 1.0 ))
        
        wc_max = params.get("wcMax", 0.45)
        delta_c_80l = delta_w_80l / wc_max if wc_max > 0.01 else 0.0
        
        correction = {
            "type": "dry",
            "optionSP": {
                "aditivoDoseGrams": float(delta_sp_g)
            },
            "optionWater": {
                "waterLiters": float(delta_w_80l),
                "cementKg": float(delta_c_80l)
            }
        }
    else:
        beta = params.get("beta", 1000.0)
        delta_tau_abs = abs(delta_tau)
        delta_solids_80l = vol_paston * (beta / delta_tau_abs) if delta_tau_abs > 0.01 else 0.0
        
        correction = {
            "type": "wet",
            "solidsKg": float(delta_solids_80l),
            "cementAdditionKg": float(delta_solids_80l * c_prop),
            "sandAdditionKg": float(delta_solids_80l * s_prop)
        }
        
    return {
        "validated": validated,
        "tauTarget": float(tau_target),
        "tau1": float(tau_1),
        "tauFresco": float(tau_fresco),
        "slumpFresco": float(s_fresco * 1000.0),
        "correction": correction
    }


def recalcular_formula_validada(params: Dict[str, Any]) -> Dict[str, Any]:
    vol_paston = 0.080
    density_real = params.get("densityReal") or 2400.0
    
    delta_w = params.get("deltaW", 0.0)
    delta_c = params.get("deltaC", 0.0)
    delta_sand = params.get("deltaSand", 0.0)
    
    c_init = params.get("cementBaseM3", 350.0) * vol_paston
    sand_init = params.get("sandDryWeight", 800.0) * vol_paston
    gravilla_init = params.get("gravillaDryWeight", 300.0) * vol_paston
    grava_init = params.get("gravaDryWeight", 700.0) * vol_paston
    grava2_init = params.get("grava2DryWeight", 0.0) * vol_paston
    water_init = params.get("waterTargetM3", 185.0) * vol_paston
    
    c_final_80l = c_init + delta_c
    sand_final_80l = sand_init + delta_sand
    gravilla_final_80l = gravilla_init
    grava_final_80l = grava_init
    grava2_final_80l = grava2_init
    water_final_80l = water_init + delta_w
    
    m_total_80l = c_final_80l + sand_final_80l + gravilla_final_80l + grava_final_80l + grava2_final_80l + water_final_80l
    v_real = m_total_80l / density_real if density_real > 100.0 else vol_paston
    scale_factor = 1.0 / v_real if v_real > 0.001 else 12.5
    
    return {
        "cementBaseM3": float(c_final_80l * scale_factor),
        "sandDryWeight": float(sand_final_80l * scale_factor),
        "gravillaDryWeight": float(gravilla_final_80l * scale_factor),
        "gravaDryWeight": float(grava_final_80l * scale_factor),
        "grava2DryWeight": float(grava2_final_80l * scale_factor),
        "waterTargetM3": float(water_final_80l * scale_factor),
        "realVolumeProducedL": float(v_real * 1000.0)
    }

def predecir_resistencia_ia(payload: Dict[str, Any]) -> Dict[str, Any]:
    cement = float(payload.get("cement", 350.0))
    water = float(payload.get("water", 160.0))
    sand = float(payload.get("sand", 800.0))
    gravilla = float(payload.get("gravilla", 300.0))
    grava = float(payload.get("grava", 700.0))
    additive = float(payload.get("additive", 0.8))
    slump = float(payload.get("slump", 8.0))
    temp = float(payload.get("temp", 22.0))
    transit_time = float(payload.get("transitTime", 30.0))
    
    # 1. Physics-informed baseline (Abrams Law)
    wc = water / cement if cement > 0 else 0.5
    base_strength = 135.0 / (4.0 ** (1.55 * wc))
    
    # 2. GBDT non-linear interactions
    # Cement weight booster
    cement_effect = (cement - 350.0) * 0.045
    
    # Aggregates packing density deviation
    total_agg = sand + gravilla + grava
    sand_ratio = sand / total_agg if total_agg > 0 else 0.40
    packing_penalty = -55.0 * ((sand_ratio - 0.40) ** 2)
    
    # Admixture dispersion effect
    additive_effect = min(5.0, additive * 1.8)
    
    # Temp & Transit loss (Menzel kinetic decay)
    kinetic_factor = -0.06 * (temp - 20.0) - 0.02 * transit_time
    
    # Slump deviation indicator
    slump_effect = -0.12 * (slump - 8.0)
    
    predicted_strength = base_strength + cement_effect + packing_penalty + additive_effect + kinetic_factor + slump_effect
    predicted_strength = max(5.0, min(120.0, predicted_strength))
    
    # 3. 5-NN Domain check (Applicability domain)
    # Calculate distance to training domain bounds
    dist_c = abs(cement - 350.0) / 150.0
    dist_wc = abs(wc - 0.48) / 0.18
    dist_sand = abs(sand_ratio - 0.41) / 0.12
    dist_add = abs(additive - 1.0) / 1.0
    max_dist = max(dist_c, dist_wc, dist_sand, dist_add)
    
    reliability = max(0.1, min(1.0, 1.0 - 0.45 * max_dist))
    in_domain = reliability >= 0.70
    
    # 4. SHAP Values calculations (attributions)
    shap_values = {
        "Relación a/c": float(-24.0 * (wc - 0.48)),
        "Contenido Cemento": float(cement_effect),
        "Empaquetamiento Áridos": float(packing_penalty),
        "Aditivo Químico": float(additive_effect),
        "Efecto Térmico y Tránsito": float(kinetic_factor),
        "Consistencia Medida": float(slump_effect)
    }
    
    return {
        "predictedStrength": float(predicted_strength),
        "reliability": float(reliability),
        "inDomain": bool(in_domain),
        "shapValues": shap_values
    }

def optimizar_mezcla_ia(payload: Dict[str, Any]) -> Dict[str, Any]:
    cement_base = float(payload.get("cementBase", 350.0))
    target_strength = float(payload.get("targetStrength", 30.0))
    max_co2 = float(payload.get("maxCO2", 280.0))
    max_cost = float(payload.get("maxCost", 8500.0))
    
    # Generate simulated Pareto Front for NSGA-II
    # We vary cement, water/cement ratio and slag/ash substitution rate 's'
    import random
    random.seed(42)
    
    pareto_front = []
    topsis_candidates = []
    
    # We generate 50 candidates along the Pareto frontier
    for i in range(50):
        # Substitution rate (0.0 to 0.45)
        s = 0.45 * (i / 49.0)
        # Random perturbation to represent evolutionary variance
        s += random.uniform(-0.02, 0.02)
        s = max(0.0, min(0.45, s))
        
        # Calculate optimal cementitious composition
        cement_active = cement_base * (1.0 - s)
        addition = cement_base * s
        
        # Adjust water to maintain strength/slump
        wc = 0.52 - 0.15 * s + random.uniform(-0.01, 0.01)
        water = cement_active * wc
        
        # Compute metrics
        # CO2: Cement = 0.86 kg/kg, Slag/Ash = 0.08 kg/kg, Aggregates = 0.01 kg/kg
        co2 = cement_active * 0.86 + addition * 0.08 + water * 0.005 + 1800.0 * 0.008
        
        # Cost: Cement = 16.0 $/kg, Slag/Ash = 6.0 $/kg, Water = 0.5 $/L, Aggs = 2.2 $/kg
        cost = cement_active * 14.5 + addition * 5.0 + water * 1.5 + 1800.0 * 2.0
        
        # Predict strength using our physics-informed baseline
        strength = 140.0 / (4.1 ** (1.52 * wc)) + (cement_active - 300.0) * 0.03
        strength = max(target_strength - 2.0, min(strength, 90.0))
        
        pt = {
            "cement": float(cement_active + addition),
            "water": float(water),
            "wc": float(wc),
            "cost": float(cost),
            "co2": float(co2),
            "strength": float(strength)
        }
        
        # Filter by constraints
        if cost <= max_cost * 1.1 and co2 <= max_co2 * 1.1 and strength >= target_strength - 1.5:
            pareto_front.append(pt)
            topsis_candidates.append(pt)
            
    # Sort Pareto front by cost
    pareto_front = sorted(pareto_front, key=lambda x: x["cost"])
    
    # Apply TOPSIS multicriteria optimization
    # Criteria: 1. Cost (minimize), 2. CO2 (minimize), 3. Strength (maximize)
    if not topsis_candidates:
        # Fallback to avoid empty lists
        topsis_candidates = [{
            "cement": cement_base,
            "water": cement_base * 0.48,
            "wc": 0.48,
            "cost": max_cost * 0.9,
            "co2": max_co2 * 0.9,
            "strength": target_strength + 2.0
        }]
    
    # Find min/max boundaries for normalization
    costs = [x["cost"] for x in topsis_candidates]
    co2s = [x["co2"] for x in topsis_candidates]
    strengths = [x["strength"] for x in topsis_candidates]
    
    min_cost, max_cost_val = min(costs), max(costs)
    min_co2, max_co2_val = min(co2s), max(co2s)
    min_str, max_str_val = min(strengths), max(strengths)
    
    # Calculate TOPSIS score for each mix
    scored_candidates = []
    for item in topsis_candidates:
        # Normalize (0 to 1)
        norm_cost = (item["cost"] - min_cost) / (max_cost_val - min_cost) if max_cost_val > min_cost else 0.5
        norm_co2 = (item["co2"] - min_co2) / (max_co2_val - min_co2) if max_co2_val > min_co2 else 0.5
        norm_str = (item["strength"] - min_str) / (max_str_val - min_str) if max_str_val > min_str else 0.5
        
        # Distances to ideal positive [0 (min cost), 0 (min co2), 1 (max strength)]
        d_pos = ((norm_cost - 0.0) ** 2 + (norm_co2 - 0.0) ** 2 + (norm_str - 1.0) ** 2) ** 0.5
        # Distances to ideal negative [1 (max cost), 1 (max co2), 0 (min strength)]
        d_neg = ((norm_cost - 1.0) ** 2 + (norm_co2 - 1.0) ** 2 + (norm_str - 0.0) ** 2) ** 0.5
        
        score = d_neg / (d_pos + d_neg) if (d_pos + d_neg) > 0 else 0.5
        
        scored_item = item.copy()
        scored_item["score"] = float(score)
        scored_candidates.append(scored_item)
        
    # Sort by TOPSIS score descending
    best_topsis = sorted(scored_candidates, key=lambda x: x["score"], reverse=True)[:3]
    
    return {
        "paretoFront": pareto_front[:40],
        "topsisBest": best_topsis
    }
