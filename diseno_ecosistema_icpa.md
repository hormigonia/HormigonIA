# Diseño del Ecosistema de Dosificación (ICPA / Racional)

Este documento detalla el esquema de base de datos relacional y los algoritmos matemáticos de corrección por humedad para el ecosistema **HormigónMix AI (Web & Mobile)** bajo la metodología **ICPA**.

---

## 1. Esquema de Base de Datos (Prisma/SQL Schema)

Para soportar las capacidades avanzadas del módulo web (Calculadora Pro) y la sincronización con la aplicación móvil (Asistente de Obra), proponemos el siguiente esquema de base de datos relacional.

```prisma
// Esquema de Base de Datos para el Ecosistema de Hormigón (Prisma ORM)

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Project {
  id          String       @id @default(uuid())
  name        String
  location    String?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  mixProfiles MixProfile[]
}

model MixProfile {
  id                    String                @id @default(uuid())
  projectId             String
  project               Project               @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name                  String
  createdAt             DateTime              @default(now())
  updatedAt             DateTime              @updatedAt
  
  // Parámetros de Diseño de la Mezcla
  cementCategory        CementCategory        // CP30, CP40, CP50
  targetStrengthFcm     Float                 // f'cm en MPa (f'cr)
  targetStrengthFce     Float                 // f'ce (especificada) en MPa (f'c)
  deviationS            Float                 // Desvío estándar (S) en MPa
  maxAggregateSizeD     Float                 // Tamaño Máximo (D) en mm
  targetSlump           Float                 // Asentamiento de diseño en cm
  bolomeyParameterA     Float                 // Parámetro A de Bolomey
  waterCementRatio      Float                 // Relación a/c calculada
  cementBaseKgM3        Float                 // Cemento base por m³ de hormigón
  waterTargetKgM3       Float                 // Agua teórica objetivo por m³
  airContentPct         Float                 @default(1.5) // Contenido de aire (%)
  
  // Proporciones del Agregado Combinado
  sandRatio             Float                 // Proporción de Arena en volumen (L2)
  stoneRatio            Float                 // Proporción de Piedra en volumen (M2)
  deviationG            Float                 // Factor de Desviación G

  // Relaciones
  materials             MaterialProperty[]
  admixtures            AdmixtureProfile[]
  calibrations          FieldCalibration[]
  moistureCorrections   MoistureCorrection[]
}

enum CementCategory {
  CP30
  CP40
  CP50
}

model MaterialProperty {
  id            String      @id @default(uuid())
  mixProfileId  String
  mixProfile    MixProfile  @relation(fields: [mixProfileId], references: [id], onDelete: Cascade)
  type          MaterialType
  name          String
  
  // Parámetros de Laboratorio
  bulkDensity       Float     // Densidad aparente en kg/m³
  solidDensity      Float     // Densidad real/sólida en kg/m³ (o calculada vía Coef. Aporte)
  yieldCoefficient  Float     // Coeficiente de aporte (si aplica para obra)
  absorptionPct     Float     // % de absorción del agregado (usado para agua libre)
  humidityPct       Float     @default(0.0) // Humedad actual de referencia (%)
  
  // Curva granulométrica del material
  sieves            MaterialSieve[]
}

enum MaterialType {
  CEMENT
  FINE_AGGREGATE
  COARSE_AGGREGATE
}

model MaterialSieve {
  id              String           @id @default(uuid())
  materialId      String
  materialProperty MaterialProperty @relation(fields: [materialId], references: [id], onDelete: Cascade)
  sieveSizeMm     Float            // Diámetro del tamiz (37.5, 19.0, etc.)
  passingPct      Float            // Porcentaje acumulado que pasa (%)
}

model AdmixtureProfile {
  id            String     @id @default(uuid())
  mixProfileId  String
  mixProfile    MixProfile @relation(fields: [mixProfileId], references: [id], onDelete: Cascade)
  name          String
  dosagePct     Float      // Dosis en % respecto al peso de cemento
  densityKgL    Float      // Densidad del aditivo en kg/L
}

// Calibración de Baldes de Obra (Mobile)
model FieldCalibration {
  id               String     @id @default(uuid())
  mixProfileId     String
  mixProfile       MixProfile @relation(fields: [mixProfileId], references: [id], onDelete: Cascade)
  createdAt        DateTime   @default(now())
  bucketVolumeL    Float      // Volumen del balde calibrado con agua (L)
  sandBucketWeight Float      // Peso del balde lleno de arena (kg)
  stoneBucketWeight Float     // Peso del balde lleno de piedra (kg)
  sandBulkDensity  Float      // Densidad aparente suelta en obra calculada (kg/m³)
  stoneBulkDensity Float      // Densidad aparente suelta en obra calculada (kg/m³)
}

// Historial de Correcciones por Humedad en Obra
model MoistureCorrection {
  id               String     @id @default(uuid())
  mixProfileId     String
  mixProfile       MixProfile @relation(fields: [mixProfileId], references: [id], onDelete: Cascade)
  createdAt        DateTime   @default(now())
  
  // Mediciones de Obra
  sandMoisturePct  Float      // Humedad medida de la arena (%)
  stoneMoisturePct Float      // Humedad medida de la piedra (%)
  batchVolumeL     Float      // Volumen del pastón a elaborar (L)
  
  // Resultados Calculados para Pesaje/Volumen
  cementWeightKg   Float
  sandWeightKg     Float      // Peso húmedo
  stoneWeightKg    Float      // Peso húmedo
  waterVolumeL     Float      // Agua neta a añadir al trompo
  
  // Equivalencia en Baldes (UX Mobile)
  cementBuckets    Float
  sandBuckets      Float
  stoneBuckets     Float
  waterBuckets     Float
}

---

## 2. Algoritmos Matemáticos de Corrección por Humedad (ICPA)

En el laboratorio de hormigón, los materiales se diseñan en estado **Saturado Superficialmente Seco (SSS)** o en estado **Seco**. En obra, sin embargo, los agregados contienen humedad libre que altera tanto el peso de los agregados que se cargan a la mezcladora como la cantidad de agua real agregada (relación a/c).

El ICPA establece las siguientes relaciones y flujos de cálculo que digitalizaremos en el **Core Engine**:

### A. Algoritmo de Corrección en Peso de Laboratorio
Dadas las constantes secas calculadas por el motor web por cada $m^3$:
*   $C_s$: Peso seco de Cemento (kg)
*   $S_s$: Peso seco de Arena (kg)
*   $P_s$: Peso seco de Piedra (kg)
*   $W_{objetivo}$: Agua de diseño objetivo (L o kg) según relación a/c.

Y las mediciones de obra/laboratorio:
*   $h_{sand}$: Humedad de la arena (%)
*   $abs_{sand}$: Absorción de la arena (%)
*   $h_{stone}$: Humedad de la piedra (%)
*   $abs_{stone}$: Absorción de la piedra (%)
*   $V_{paston}$: Volumen del pastón a mezclar en metros cúbicos ($m^3$) (Ej: $80\text{ L} = 0.08\text{ m}^3$)
*   $G$: Factor de desviación granulométrica de la mezcla combinada.

#### 1. Peso Húmedo de los Agregados (Carga física en báscula):
$$S_h = S_s \cdot \left(1 + \frac{h_{sand}}{100}\right) \cdot V_{paston}$$
$$P_h = P_s \cdot \left(1 + \frac{h_{stone}}{100}\right) \cdot V_{paston}$$

#### 2. Agua Libre Aportada por los Áridos:
Los agregados solo aportan agua libre a la mezcla si su humedad supera su porcentaje de absorción interno.
$$W_{libre, sand} = S_s \cdot \left(\frac{h_{sand} - abs_{sand}}{100}\right) \cdot V_{paston}$$
$$W_{libre, stone} = P_s \cdot \left(\frac{h_{stone} - abs_{stone}}{100}\right) \cdot V_{paston}$$

*Nota: Si el valor $h - abs$ es negativo, significa que el agregado está seco y absorberá parte del agua de mezcla. El algoritmo contempla esto automáticamente restando un aporte negativo (es decir, sumando agua de amasado).*

#### 3. Agua Neta de Amasado a Añadir (Con corrección granulométrica $G$):
Primero se descuenta el aporte de los áridos del agua teórica corregida por mermas en laboratorio (factor $1.1$ típico de fricción y evaporación de mezcladora):
$$W_{teorica, neta} = \frac{(W_{objetivo} \cdot V_{paston}) - W_{libre, sand} - W_{libre, stone}}{1.1}$$

Luego se aplica la corrección final de laboratorio por desviación de tamices ($G$):
$$W_{amasado, final} = W_{teorica, neta} \cdot G$$

---

### B. Implementación en Código (TypeScript/JavaScript)

El siguiente módulo implementa la lógica completa para su uso tanto en el Frontend Web como en la App Mobile.

```typescript
interface MixDesignInput {
  cementDryM3: number;      // kg/m³
  sandDryM3: number;        // kg/m³
  stoneDryM3: number;       // kg/m³
  waterTargetM3: number;    // L/m³
  
  sandHumidityPct: number;  // %
  sandAbsorptionPct: number;// %
  stoneHumidityPct: number; // %
  stoneAbsorptionPct: number;// %
  
  batchVolumeL: number;     // Volumen del trompo en Litros
  deviationG: number;       // Factor G calculado de granulometría
}

interface BatchRecipe {
  cementWeightKg: number;
  sandWetWeightKg: number;
  stoneWetWeightKg: number;
  waterToAddL: number;
  waterTheoreticalL: number;
  waterContributedByAggregatesL: number;
}

export function calculateBatchMoistureCorrection(input: MixDesignInput): BatchRecipe {
  const volM3 = input.batchVolumeL / 1000; // conversión de litros a m³
  
  // 1. Cemento base para el pastón
  const cementWeight = input.cementDryM3 * volM3;
  
  // 2. Pesos secos de agregados para el volumen del pastón
  const sandDryBatch = input.sandDryM3 * volM3;
  const stoneDryBatch = input.stoneDryM3 * volM3;
  
  // 3. Corrección de agregados húmedos
  const sandWetWeight = sandDryBatch * (1 + input.sandHumidityPct / 100);
  const stoneWetWeight = stoneDryBatch * (1 + input.stoneHumidityPct / 100);
  
  // 4. Agua libre aportada por áridos (Humedad - Absorción)
  const sandFreeWater = sandDryBatch * ((input.sandHumidityPct - input.sandAbsorptionPct) / 100);
  const stoneFreeWater = stoneDryBatch * ((input.stoneHumidityPct - input.stoneAbsorptionPct) / 100);
  const totalContributedWater = sandFreeWater + stoneFreeWater;
  
  // 5. Agua de amasado neta (Teórica vs Corregida por G)
  const targetWaterBatch = input.waterTargetM3 * volM3;
  
  // Agua teórica descontando aporte de agregados, ajustada por el factor de amasado 1.1
  const waterTheoretical = Math.max(0, (targetWaterBatch - totalContributedWater) / 1.1);
  
  // Agua final corregida por desviación granulométrica (factor G)
  const waterFinal = waterTheoretical * input.deviationG;
  
  return {
    cementWeightKg: Math.round(cementWeight * 100) / 100,
    sandWetWeightKg: Math.round(sandWetWeight * 100) / 100,
    stoneWetWeightKg: Math.round(stoneWetWeight * 100) / 100,
    waterToAddL: Math.round(waterFinal * 100) / 100,
    waterTheoreticalL: Math.round(waterTheoretical * 100) / 100,
    waterContributedByAggregatesL: Math.round(totalContributedWater * 100) / 100
  };
}
```

---



