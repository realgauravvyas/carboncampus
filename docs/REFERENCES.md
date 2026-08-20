# Data sources and emission factors

Every number CarbonCampus multiplies by is listed here, with the published source it came from.
This file is generated from the registry itself (`shared/src/factors.ts` and
`shared/src/sources.ts`) by `scripts/gen-references.mjs`, so it cannot drift out of step with
the app.

- **Factor registry version:** 1.0.0
- **Last updated:** 2026-08-20
- **Campus pack:** IIT Guwahati — NEWNE grid (CEA all-India weighted average)
- **Method:** Emissions (kg CO₂e) = Activity Data × Emission Factor (IPCC Tier 1, GWP-100)

Uncertainty is the fractional 1-sigma value published with each factor. Day totals combine them in
quadrature, which is why the range shown in the app grows more slowly than the total.

---

## Energy

| Activity | Factor | Unit | Uncertainty | Basis | Source |
| --- | --- | --- | --- | --- | --- |
| Grid electricity | 0.716 | kg CO₂e/kWh | ±8% | CEA CO2 Baseline Database for the Indian Power Sector, v20 (FY 2023-24) — weighted average grid emission rate | [Central Electricity Authority](https://cea.nic.in/cdm-co2-baseline-database/?lang=en) |

## Transport

| Activity | Factor | Unit | Uncertainty | Basis | Source |
| --- | --- | --- | --- | --- | --- |
| Walk | 0 | kg CO₂e/passenger-km | — | Zero direct operational emissions | [IPCC / IGES](https://www.ipcc-nggip.iges.or.jp/public/2019rf/index.html) |
| Cycle | 0 | kg CO₂e/passenger-km | — | Zero direct operational emissions | [IPCC / IGES](https://www.ipcc-nggip.iges.or.jp/public/2019rf/index.html) |
| E-rickshaw | 0.026 | kg CO₂e/passenger-km | ±20% | 0.10 kWh/km over 4 passengers, at the CEA grid factor | [Central Electricity Authority](https://cea.nic.in/cdm-co2-baseline-database/?lang=en), [Ministry of Road Transport and Highways](https://morth.nic.in/road-transport-year-books) |
| Campus shuttle | 0.045 | kg CO₂e/passenger-km | ±18% | Diesel bus 4.5 km/l, 2.68 kg CO2/l, 40 seats at 65% occupancy (MoRTH fleet data) | [Ministry of Road Transport and Highways](https://morth.nic.in/road-transport-year-books), [IPCC / IGES](https://www.ipcc-nggip.iges.or.jp/public/2019rf/index.html) |
| City bus | 0.052 | kg CO₂e/passenger-km | ±20% | ASTC city fleet, MoRTH fuel economy with average occupancy | [Ministry of Road Transport and Highways](https://morth.nic.in/road-transport-year-books) |
| Train | 0.011 | kg CO₂e/passenger-km | ±25% | Indian Railways electric traction, passenger-km basis | [Central Electricity Authority](https://cea.nic.in/cdm-co2-baseline-database/?lang=en), [International Energy Agency](https://www.iea.org/countries/india) |
| Auto-rickshaw | 0.098 | kg CO₂e/passenger-km | ±20% | CNG 25 km/kg, 2.75 kg CO2/kg CNG, 1.7 passengers | [Ministry of Road Transport and Highways](https://morth.nic.in/road-transport-year-books), [IPCC / IGES](https://www.ipcc-nggip.iges.or.jp/public/2019rf/index.html) |
| Motorbike | 0.051 | kg CO₂e/passenger-km | ±15% | Petrol 45 km/l, 2.31 kg CO2/l (MoRTH fuel economy norms) | [Ministry of Road Transport and Highways](https://morth.nic.in/road-transport-year-books) |
| Scooter | 0.062 | kg CO₂e/passenger-km | ±15% | Petrol 37 km/l, 2.31 kg CO2/l | [Ministry of Road Transport and Highways](https://morth.nic.in/road-transport-year-books) |
| Car (shared by 3) | 0.058 | kg CO₂e/passenger-km | ±15% | Petrol car 13.5 km/l split across three occupants | [Ministry of Road Transport and Highways](https://morth.nic.in/road-transport-year-books) |
| Car (alone) | 0.171 | kg CO₂e/passenger-km | ±15% | Petrol car 13.5 km/l, 2.31 kg CO2/l, single occupant | [Ministry of Road Transport and Highways](https://morth.nic.in/road-transport-year-books) |
| Electric car | 0.107 | kg CO₂e/passenger-km | ±20% | 0.15 kWh/km at the CEA grid factor of 0.716 kg/kWh | [Central Electricity Authority](https://cea.nic.in/cdm-co2-baseline-database/?lang=en), [Ministry of Road Transport and Highways](https://morth.nic.in/road-transport-year-books) |
| Flight (domestic) | 0.244 | kg CO₂e/passenger-km | ±20% | DEFRA 2024 domestic short-haul including radiative forcing uplift | [DESNZ / DEFRA](https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting) |

## Food

| Activity | Factor | Unit | Uncertainty | Basis | Source |
| --- | --- | --- | --- | --- | --- |
| Vegan thali | 0.68 | kg CO₂e/meal | ±25% | Poore & Nemecek (2018) Science — cereals, pulses, vegetables, oil | [Poore](https://www.science.org/doi/10.1126/science.aaq0216) |
| Veg thali | 1.24 | kg CO₂e/meal | ±25% | Poore & Nemecek (2018) plus the Indian dairy share (paneer, curd, ghee) | [Poore](https://www.science.org/doi/10.1126/science.aaq0216) |
| Egg meal | 1.62 | kg CO₂e/meal | ±25% | Poore & Nemecek (2018) — eggs at 4.7 kg CO2e/kg over a veg base | [Poore](https://www.science.org/doi/10.1126/science.aaq0216) |
| Fish meal | 1.94 | kg CO₂e/meal | ±30% | Poore & Nemecek (2018) — farmed fish at 5.4 kg CO2e/kg over a veg base | [Poore](https://www.science.org/doi/10.1126/science.aaq0216) |
| Chicken meal | 2.51 | kg CO₂e/meal | ±25% | Poore & Nemecek (2018) — poultry at 9.9 kg CO2e/kg over a veg base | [Poore](https://www.science.org/doi/10.1126/science.aaq0216) |
| Mutton meal | 5.42 | kg CO₂e/meal | ±35% | Poore & Nemecek (2018) — mutton at 39.2 kg CO2e/kg over a veg base | [Poore](https://www.science.org/doi/10.1126/science.aaq0216) |
| Tea / coffee (cup) | 0.09 | kg CO₂e/serving | ±30% | Dairy milk 150 ml at 1.4 kg CO2e/l plus brewing energy | [Poore](https://www.science.org/doi/10.1126/science.aaq0216) |
| Delivered order | 0.51 | kg CO₂e/serving | ±35% | Packaging and last-mile delivery uplift over an equivalent mess meal | [Poore](https://www.science.org/doi/10.1126/science.aaq0216), [US Environmental Protection Agency](https://www.epa.gov/warm) |
| Food wasted (per kg) | 2.53 | kg CO₂e/serving | ±30% | Embedded production emissions plus CPCB landfill methane for the organic fraction | [Poore](https://www.science.org/doi/10.1126/science.aaq0216), [Central Pollution Control Board](https://cpcb.nic.in/annual-report-swm/) |

## Waste

| Activity | Factor | Unit | Uncertainty | Basis | Source |
| --- | --- | --- | --- | --- | --- |
| Plastic bottle (500 ml) | 0.083 | kg CO₂e/item | ±20% | PET production 3.0 kg CO2e/kg plus CPCB end-of-life, 28 g bottle | [US Environmental Protection Agency](https://www.epa.gov/warm), [Central Pollution Control Board](https://cpcb.nic.in/annual-report-swm/) |
| Disposable cup | 0.049 | kg CO₂e/item | ±25% | Paper/PS cup LCA with EPA WARM end-of-life equivalents | [US Environmental Protection Agency](https://www.epa.gov/warm) |
| Plastic bag | 0.033 | kg CO₂e/item | ±25% | LDPE 2.0 kg CO2e/kg, 16 g bag | [US Environmental Protection Agency](https://www.epa.gov/warm), [Central Pollution Control Board](https://cpcb.nic.in/annual-report-swm/) |
| Printed sheet (A4) | 0.0046 | kg CO₂e/item | ±25% | Virgin paper 0.92 kg CO2e/kg, 5 g per sheet | [US Environmental Protection Agency](https://www.epa.gov/warm) |
| Online order / parcel | 0.31 | kg CO₂e/item | ±35% | Corrugated packaging plus last-mile logistics per parcel | [US Environmental Protection Agency](https://www.epa.gov/warm) |
| E-waste (per kg) | 1.42 | kg CO₂e/item | ±40% | CPCB e-waste handling with EPA WARM recycling credit basis | [Central Pollution Control Board](https://cpcb.nic.in/annual-report-swm/), [US Environmental Protection Agency](https://www.epa.gov/warm) |

## Appliance power ratings

Rated power from BEE star-label appliance datasheets; duty-cycle averaged for fridge and lab share. Source: [Bureau of Energy Efficiency](https://beeindia.gov.in/en/programmesstandards-labeling).

| Appliance | Rated power |
| --- | --- |
| Ceiling fan | 70 W |
| Lights (LED/tube) | 20 W |
| Laptop | 60 W |
| Desktop / gaming PC | 200 W |
| Air conditioner | 1500 W |
| Geyser / immersion | 2000 W |
| Kettle / room heater | 1000 W |
| Mini fridge (avg) | 60 W |
| Lab equipment share | 400 W |

## Equivalents

The "what that adds up to" tiles convert kg CO₂e into something imaginable.

| Equivalent | Basis | Source |
| --- | --- | --- |
| trees absorbing for a year | 21 kg CO₂e each — ICFRE / FAO: a mature broadleaf tree sequesters about 21 kg CO2 a year | [US Environmental Protection Agency](https://www.epa.gov/energy/greenhouse-gases-equivalencies-calculator-calculations-and-references), [Forest Survey of India](https://fsi.nic.in/forest-report-2023) |
| km driven alone by car | 0.171 kg CO₂e each — Petrol car at 13.5 km/l | [Ministry of Road Transport and Highways](https://morth.nic.in/road-transport-year-books) |
| smartphone charges | 0.0086 kg CO₂e each — 12 Wh per full charge at the CEA grid factor | [Central Electricity Authority](https://cea.nic.in/cdm-co2-baseline-database/?lang=en) |
| hours of AC running | 1.074 kg CO₂e each — 1.5 kW air conditioner at the CEA grid factor | [Central Electricity Authority](https://cea.nic.in/cdm-co2-baseline-database/?lang=en) |
| days of a tube light left on | 0.344 kg CO₂e each — 20 W for 24 h at the CEA grid factor | [Central Electricity Authority](https://cea.nic.in/cdm-co2-baseline-database/?lang=en) |

---

## Full source register


### CO2 Baseline Database for the Indian Power Sector, v20
- **Publisher:** Central Electricity Authority (CEA), Government of India
- **Edition / year:** FY 2023-24
- **URL:** <https://cea.nic.in/cdm-co2-baseline-database/?lang=en>
- **Used for:** Grid emission rate for all electricity consumed on campus. Published yearly, so the pack is re-versioned yearly.

### Road Transport Year Book & fuel economy norms
- **Publisher:** Ministry of Road Transport and Highways (MoRTH)
- **Edition / year:** 2023-24
- **URL:** <https://morth.nic.in/road-transport-year-books>
- **Used for:** Vehicle fuel economy and fleet occupancy used to derive per-passenger-km factors for Indian conditions.

### UK Government GHG Conversion Factors for Company Reporting
- **Publisher:** DESNZ / DEFRA
- **Edition / year:** 2024
- **URL:** <https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting>
- **Used for:** Used only where no Indian equivalent is published — notably aviation with radiative forcing uplift.

### Reducing food’s environmental impacts through producers and consumers
- **Publisher:** Poore, J. & Nemecek, T., Science 360(6392), 987-992
- **Edition / year:** 2018
- **URL:** <https://www.science.org/doi/10.1126/science.aaq0216>
- **Used for:** The standard meta-analysis of food LCA (38,700 farms). Per-kg factors recombined into Indian mess-plate portions.

### Solid waste and plastic waste management annual reports
- **Publisher:** Central Pollution Control Board (CPCB), Government of India
- **Edition / year:** 2023-24
- **URL:** <https://cpcb.nic.in/annual-report-swm/>
- **Used for:** Indian end-of-life treatment mix — landfill share, recycling rates and the organic fraction that drives methane.

### Waste Reduction Model (WARM), v16
- **Publisher:** US Environmental Protection Agency
- **Edition / year:** 2024
- **URL:** <https://www.epa.gov/warm>
- **Used for:** Material-level life-cycle emission and end-of-life credits for plastics, paper and e-waste.

### Standards & Labelling programme appliance datasheets
- **Publisher:** Bureau of Energy Efficiency (BEE), Government of India
- **Edition / year:** 2024
- **URL:** <https://beeindia.gov.in/en/programmesstandards-labeling>
- **Used for:** Rated power draw for fans, lights, ACs, geysers and other hostel appliances.

### 2006 IPCC Guidelines for National Greenhouse Gas Inventories (2019 Refinement)
- **Publisher:** IPCC / IGES
- **Edition / year:** 2019
- **URL:** <https://www.ipcc-nggip.iges.or.jp/public/2019rf/index.html>
- **Used for:** The Tier-1 activity-data × emission-factor method this engine implements, and the GWP-100 basis for CO2e.

### GHG Protocol Corporate Standard & Scope 3 Standard
- **Publisher:** World Resources Institute / WBCSD
- **Edition / year:** 2015
- **URL:** <https://ghgprotocol.org/corporate-standard>
- **Used for:** Scope boundaries used to structure the campus inventory the admin portal exports.

### ISO 14064-1: Organization-level GHG quantification and reporting
- **Publisher:** International Organization for Standardization
- **Edition / year:** 2018
- **URL:** <https://www.iso.org/standard/66453.html>
- **Used for:** Reporting structure the campus inventory is designed to feed. CarbonCampus is not itself certified.

### Greenhouse Gas Equivalencies Calculator — calculations and references
- **Publisher:** US Environmental Protection Agency
- **Edition / year:** 2024
- **URL:** <https://www.epa.gov/energy/greenhouse-gases-equivalencies-calculator-calculations-and-references>
- **Used for:** Method behind the "trees", "km driven" and "phone charges" equivalents shown to users.

### India State of Forest Report — carbon stock assessment
- **Publisher:** Forest Survey of India
- **Edition / year:** 2023
- **URL:** <https://fsi.nic.in/forest-report-2023>
- **Used for:** Indian sequestration rates used to sanity-check the mature-tree equivalent.

### India Energy Outlook / electricity data
- **Publisher:** International Energy Agency
- **Edition / year:** 2024
- **URL:** <https://www.iea.org/countries/india>
- **Used for:** Cross-check on the national grid factor and its year-on-year trajectory.

---

## Citation block for slides

Paste this on a references slide:

> **Emission factors:** Central Electricity Authority, *CO₂ Baseline Database for the Indian Power
> Sector v20* (FY 2023-24); Ministry of Road Transport & Highways, *Road Transport Year Book*;
> Poore, J. & Nemecek, T. (2018), *Science* 360(6392), 987-992; Central Pollution Control Board,
> solid and plastic waste annual reports; US EPA, *WARM* v16; Bureau of Energy Efficiency,
> Standards & Labelling datasheets; DESNZ/DEFRA (2024) conversion factors for aviation.
> **Method:** IPCC 2006 Guidelines (2019 Refinement), Tier 1. **Reporting structure:** GHG Protocol
> Corporate Standard; ISO 14064-1. **Equivalents:** US EPA Greenhouse Gas Equivalencies Calculator;
> Forest Survey of India, *India State of Forest Report 2023*.

Short form, if the slide is tight:

> Factors: CEA v20 (grid), MoRTH (transport), Poore & Nemecek 2018 (food), CPCB + EPA WARM (waste),
> BEE (appliances), DEFRA 2024 (aviation). Method: IPCC Tier 1. Reporting: GHG Protocol / ISO 14064-1.
