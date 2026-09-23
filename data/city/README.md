# Astana real context — evidence register

Reviewed on **2026-09-23**. `context.json` follows the frozen v1 city contract. It contains source observations, not scenario constants, district allocation estimates or predictions. This register does not alter engine mathematics.

| Observation | Value and reference date | Intake status |
| --- | --- | --- |
| City population | 1,690,605 persons, 2026-08-01 | Verified city total |
| Population of each of the six districts | `null` | Compatible district count/boundary vintage not verified |
| Complete bus fleet stock | `null` | No dated complete inventory verified |
| Buses active daily | 1,210; reference date unknown | Unverified historical candidate |
| Bus routes served by that release | 105; reference date unknown | Unverified historical candidate |
| Measured LRT daily ridership | `null` | No measured daily count verified |

## Population evidence and geography

[BNS's Astana regional page](https://stat.gov.kz/ru/region/astana/) states the city population for 1 August 2026 in the first paragraph of its population and migration section. The observation date is the stated reference date; the retrieval date is separate. Publication date is not exposed for that changing page and is stored as `null`. [BNS reuse terms](https://stat.gov.kz/ru/description/) allow reuse with attribution, including in software.

The city total is usable at `regionId: "city"` independently of district polygon vintage. The six source polygons do not yet have a verified boundary date, so district population figures from other years cannot safely be joined to them. Each district therefore has an explicit unavailable observation. Do not divide the total by six, polygon areas, or engine population weights. `saraishyk` remains a geographic inspection region, with no additional simulation district.

## Transport evidence and limitations

[The city administration's transport record report](https://www.gov.kz/memleket/entities/astana/press/news/details/984403?lang=ru) gives daily bus release and route counts. The primary content retrieved for this intake did not expose its publication or reference date. The two counts are retained with `status: "unverified"` and `asOf: null` so the evidence is traceable without presenting it as current. Secondary reproductions found during research were dated April 2025; their dates were not silently assigned to the primary source. Fleet inventory remains unknown: daily release excludes reserve/out-of-service vehicles and cannot establish fleet stock.

[CTS's safety notice dated 17 May 2026](https://cts.gov.kz/ru/press-center/news/na-linii-lrt-zafiksirovany-otdelnye-sluchai-narusheniya-passazhirami-pravil-bezopasnosti/) describes passengers inside LRT trains and service delays. It supports the qualitative inference that passenger operations existed by that date. It does **not** establish the exact opening date, uninterrupted operations on 23 September, or measured daily ridership. No numeric operational-status field is added to the frozen contract. LRT sprites may represent an illustrative mode; they do not represent a measured fleet or real route.

No district bus allocation or surveyed bus/LRT path is provided. All-public-transport passenger records, planned LRT capacity, bus purchases and actual LRT ridership are distinct quantities. Unknown values are `null`, never zero. Only aggregate facts and attributed summaries are included; no personal records or source media are copied. Specific article republication licenses for gov.kz/CTS were not verified and are not claimed.

## Consumer rule

Use a numeric observation for source-driven visual density only when its `status` is `verified`, its date is present, and its geographic scope matches the requested view. This intake verifies only the city population. Neither of the undated transport candidates is eligible. Missing/incompatible data must trigger a labeled illustrative fallback, not inferred district counts. Document the chosen sampling function, cap, source/date and fallback in the world report; implementation and performance caps belong to the scene owner. Source counts never equal the number of sprites one for one.

Scenario outcomes may change illustrative movement or reactions but must not overwrite this register or claim measured future counts. Show source date beside any public count; do not relabel retrieval day as the date measured.

## Validation and refresh

Run `validateContext` from `tools/check-assets.mjs` after changes. Its schema check does not itself prove source accuracy. To promote transport candidates, verify a dated primary publication and its scope; to populate district totals, verify a compatible boundary date and the original district table. Preserve definitions, source locations, retrieval dates and uncertainty when refreshing the changing BNS page.
