/** Generated-export registry. Metadata derives from the committed producer manifests
 * and actual image headers. No network calls or preloading; consumers render only
 * selected entries. Character poses and vehicle directions are NOT animation cycles.
 * Project-owned artwork; redistribution license is not specified by its owner.
 */
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const entries = [
  {"path":"assets/exports/characters/citizen-01-sheet.png","family":"characters","sourceId":"generated-raster","width":512,"height":128,"anchor":[64,124],"projection":"upright","frameRects":[[0,0,128,128],[128,0,128,128],[256,0,128,128],[384,0,128,128]],"frameAnchor":[64,124],"frameLabels":["idle","walk","positive","concerned"]},
  {"path":"assets/exports/characters/citizen-01-still.png","family":"characters","sourceId":"generated-raster","width":128,"height":128,"anchor":[64,124],"projection":"upright"},
  {"path":"assets/exports/characters/citizen-02-sheet.png","family":"characters","sourceId":"generated-raster","width":512,"height":128,"anchor":[64,124],"projection":"upright","frameRects":[[0,0,128,128],[128,0,128,128],[256,0,128,128],[384,0,128,128]],"frameAnchor":[64,124],"frameLabels":["idle","walk","positive","concerned"]},
  {"path":"assets/exports/characters/citizen-02-still.png","family":"characters","sourceId":"generated-raster","width":128,"height":128,"anchor":[64,124],"projection":"upright"},
  {"path":"assets/exports/characters/citizen-03-sheet.png","family":"characters","sourceId":"generated-raster","width":512,"height":128,"anchor":[64,124],"projection":"upright","frameRects":[[0,0,128,128],[128,0,128,128],[256,0,128,128],[384,0,128,128]],"frameAnchor":[64,124],"frameLabels":["idle","walk","positive","concerned"]},
  {"path":"assets/exports/characters/citizen-03-still.png","family":"characters","sourceId":"generated-raster","width":128,"height":128,"anchor":[64,124],"projection":"upright"},
  {"path":"assets/exports/characters/emergency-sheet.png","family":"characters","sourceId":"generated-raster","width":512,"height":128,"anchor":[64,124],"projection":"upright","frameRects":[[0,0,128,128],[128,0,128,128],[256,0,128,128],[384,0,128,128]],"frameAnchor":[64,124],"frameLabels":["idle","walk","active","alert"]},
  {"path":"assets/exports/characters/emergency-still.png","family":"characters","sourceId":"generated-raster","width":128,"height":128,"anchor":[64,124],"projection":"upright"},
  {"path":"assets/exports/characters/maintenance-sheet.png","family":"characters","sourceId":"generated-raster","width":512,"height":128,"anchor":[64,124],"projection":"upright","frameRects":[[0,0,128,128],[128,0,128,128],[256,0,128,128],[384,0,128,128]],"frameAnchor":[64,124],"frameLabels":["idle","walk","active","alert"]},
  {"path":"assets/exports/characters/maintenance-still.png","family":"characters","sourceId":"generated-raster","width":128,"height":128,"anchor":[64,124],"projection":"upright"},
  {"path":"assets/exports/characters/mayor-sheet.png","family":"characters","sourceId":"generated-raster","width":512,"height":128,"anchor":[64,124],"projection":"upright","frameRects":[[0,0,128,128],[128,0,128,128],[256,0,128,128],[384,0,128,128]],"frameAnchor":[64,124],"frameLabels":["idle","selecting","thinking","celebrating"]},
  {"path":"assets/exports/characters/mayor-still.png","family":"characters","sourceId":"generated-raster","width":128,"height":128,"anchor":[64,124],"projection":"upright"},
  {"path":"assets/exports/effects/better-transit.svg","family":"effects","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/effects/citizen-calm.svg","family":"effects","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/effects/citizen-cheer.svg","family":"effects","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/effects/citizen-concerned.svg","family":"effects","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/effects/cleaner-air.svg","family":"effects","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/effects/clinic-access.svg","family":"effects","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/effects/connection-path.svg","family":"effects","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/effects/critical-warning.svg","family":"effects","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/effects/effects.css","family":"effects","sourceId":"generated-vector","type":"stylesheet"},
  {"path":"assets/exports/effects/finish-higher.svg","family":"effects","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/effects/finish-restrained.svg","family":"effects","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/effects/greenery-improved.svg","family":"effects","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/effects/negative-tradeoff.svg","family":"effects","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/effects/placement-pulse.svg","family":"effects","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/effects/positive-improvement.svg","family":"effects","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/effects/safer-roads.svg","family":"effects","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/effects/school-access.svg","family":"effects","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/effects/utilities-improved.svg","family":"effects","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/favicon/favicon-16.png","family":"favicon","sourceId":"generated-vector","width":16,"height":16,"anchor":[8.0,8.0]},
  {"path":"assets/exports/favicon/favicon-192.png","family":"favicon","sourceId":"generated-vector","width":192,"height":192,"anchor":[96.0,96.0]},
  {"path":"assets/exports/favicon/favicon-32.png","family":"favicon","sourceId":"generated-vector","width":32,"height":32,"anchor":[16.0,16.0]},
  {"path":"assets/exports/favicon/favicon-512.png","family":"favicon","sourceId":"generated-vector","width":512,"height":512,"anchor":[256.0,256.0]},
  {"path":"assets/exports/favicon/favicon-64.png","family":"favicon","sourceId":"generated-vector","width":64,"height":64,"anchor":[32.0,32.0]},
  {"path":"assets/exports/favicon/favicon.svg","family":"favicon","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/category-city-services.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/category-ecology.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/category-safety.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/category-social-services.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/category-transport.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/hud-budget.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/hud-compare.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/hud-critical.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/hud-info.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/hud-locked.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/hud-pause.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/hud-play.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/hud-quarter.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/hud-score.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/hud-selected.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/hud-skip.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/hud-sound-off.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/hud-sound-on.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/hud-synergy.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/hud-turn.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/hud-undo.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/hud-warning.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/indicator-B1-lighting.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/indicator-B2-crossing.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/indicator-C1-utilities.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/indicator-C2-requests.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/indicator-E1-greenery.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/indicator-E2-air.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/indicator-S1-education.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/indicator-S2-health.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/indicator-T1-traffic.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/indicator-T2-transit.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/logo-app.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/map-bus.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/map-citizen.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/map-citywide.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/map-district.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/map-lrt.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/map-road.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/icons/map-transport.svg","family":"icons","sourceId":"generated-vector","width":32.0,"height":32.0,"anchor":[16.0,16.0]},
  {"path":"assets/exports/policies/M01-M07/M01-tilted-object.svg","family":"policies","sourceId":"generated-vector","width":160.0,"height":120.0,"anchor":[80.0,110.0]},
  {"path":"assets/exports/policies/M01-M07/M01-ui-icon.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/policies/M01-M07/M01-world-marker.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":80.0,"anchor":[32.0,77.0]},
  {"path":"assets/exports/policies/M01-M07/M02-tilted-object.svg","family":"policies","sourceId":"generated-vector","width":160.0,"height":120.0,"anchor":[80.0,110.0]},
  {"path":"assets/exports/policies/M01-M07/M02-ui-icon.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/policies/M01-M07/M02-world-marker.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":80.0,"anchor":[32.0,77.0]},
  {"path":"assets/exports/policies/M01-M07/M03-tilted-object.svg","family":"policies","sourceId":"generated-vector","width":160.0,"height":120.0,"anchor":[80.0,110.0]},
  {"path":"assets/exports/policies/M01-M07/M03-ui-icon.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/policies/M01-M07/M03-world-marker.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":80.0,"anchor":[32.0,77.0]},
  {"path":"assets/exports/policies/M01-M07/M04-tilted-object.svg","family":"policies","sourceId":"generated-vector","width":160.0,"height":120.0,"anchor":[80.0,110.0]},
  {"path":"assets/exports/policies/M01-M07/M04-ui-icon.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/policies/M01-M07/M04-world-marker.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":80.0,"anchor":[32.0,77.0]},
  {"path":"assets/exports/policies/M01-M07/M05-tilted-object.svg","family":"policies","sourceId":"generated-vector","width":160.0,"height":120.0,"anchor":[80.0,110.0]},
  {"path":"assets/exports/policies/M01-M07/M05-ui-icon.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/policies/M01-M07/M05-world-marker.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":80.0,"anchor":[32.0,77.0]},
  {"path":"assets/exports/policies/M01-M07/M06-tilted-object.svg","family":"policies","sourceId":"generated-vector","width":160.0,"height":120.0,"anchor":[80.0,110.0]},
  {"path":"assets/exports/policies/M01-M07/M06-ui-icon.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/policies/M01-M07/M06-world-marker.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":80.0,"anchor":[32.0,77.0]},
  {"path":"assets/exports/policies/M01-M07/M07-tilted-object.svg","family":"policies","sourceId":"generated-vector","width":160.0,"height":120.0,"anchor":[80.0,110.0]},
  {"path":"assets/exports/policies/M01-M07/M07-ui-icon.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/policies/M01-M07/M07-world-marker.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":80.0,"anchor":[32.0,77.0]},
  {"path":"assets/exports/policies/M08-M14/M08-tilted-object.svg","family":"policies","sourceId":"generated-vector","width":160.0,"height":128.0,"anchor":[80.0,118.0]},
  {"path":"assets/exports/policies/M08-M14/M08-ui-icon.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/policies/M08-M14/M08-world-marker.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":80.0,"anchor":[32.0,77.0]},
  {"path":"assets/exports/policies/M08-M14/M09-tilted-object.svg","family":"policies","sourceId":"generated-vector","width":160.0,"height":128.0,"anchor":[80.0,118.0]},
  {"path":"assets/exports/policies/M08-M14/M09-ui-icon.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/policies/M08-M14/M09-world-marker.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":80.0,"anchor":[32.0,77.0]},
  {"path":"assets/exports/policies/M08-M14/M10-tilted-object.svg","family":"policies","sourceId":"generated-vector","width":160.0,"height":128.0,"anchor":[80.0,118.0]},
  {"path":"assets/exports/policies/M08-M14/M10-ui-icon.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/policies/M08-M14/M10-world-marker.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":80.0,"anchor":[32.0,77.0]},
  {"path":"assets/exports/policies/M08-M14/M11-tilted-object.svg","family":"policies","sourceId":"generated-vector","width":160.0,"height":128.0,"anchor":[80.0,118.0]},
  {"path":"assets/exports/policies/M08-M14/M11-ui-icon.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/policies/M08-M14/M11-world-marker.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":80.0,"anchor":[32.0,77.0]},
  {"path":"assets/exports/policies/M08-M14/M12-tilted-object.svg","family":"policies","sourceId":"generated-vector","width":160.0,"height":128.0,"anchor":[80.0,118.0]},
  {"path":"assets/exports/policies/M08-M14/M12-ui-icon.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/policies/M08-M14/M12-world-marker.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":80.0,"anchor":[32.0,77.0]},
  {"path":"assets/exports/policies/M08-M14/M13-tilted-object.svg","family":"policies","sourceId":"generated-vector","width":160.0,"height":128.0,"anchor":[80.0,118.0]},
  {"path":"assets/exports/policies/M08-M14/M13-ui-icon.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/policies/M08-M14/M13-world-marker.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":80.0,"anchor":[32.0,77.0]},
  {"path":"assets/exports/policies/M08-M14/M14-tilted-object.svg","family":"policies","sourceId":"generated-vector","width":160.0,"height":128.0,"anchor":[80.0,118.0]},
  {"path":"assets/exports/policies/M08-M14/M14-ui-icon.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":64.0,"anchor":[32.0,32.0]},
  {"path":"assets/exports/policies/M08-M14/M14-world-marker.svg","family":"policies","sourceId":"generated-vector","width":64.0,"height":80.0,"anchor":[32.0,77.0]},
  {"path":"assets/exports/style/palette.svg","family":"style","sourceId":"generated-vector","width":800.0,"height":380.0,"anchor":[400.0,190.0]},
  {"path":"assets/exports/style/preview-style.png","family":"style","sourceId":"generated-vector","width":1540,"height":615,"anchor":[770.0,307.5]},
  {"path":"assets/exports/style/preview-style.svg","family":"style","sourceId":"generated-vector","width":1540.0,"height":615.0,"anchor":[770.0,307.5]},
  {"path":"assets/exports/style/scene-tilted.svg","family":"style","sourceId":"generated-vector","width":800.0,"height":480.0,"anchor":[400.0,240.0]},
  {"path":"assets/exports/style/scene-top.svg","family":"style","sourceId":"generated-vector","width":640.0,"height":480.0,"anchor":[320.0,240.0]},
  {"path":"assets/exports/units/vehicles/bus/atlas.png","family":"vehicles","sourceId":"generated-raster","width":1280,"height":256,"anchor":[128,128],"frameRects":[[0,0,256,256],[256,0,256,256],[512,0,256,256],[768,0,256,256],[1024,0,256,256]],"frameLabels":["top/down","top/left","top/up","top/right","tilted/forward"],"frameAnchors":[[128,128],[128,128],[128,128],[128,128],[128,240]]},
  {"path":"assets/exports/units/vehicles/bus/tilted/forward/frame-01.png","family":"vehicles","sourceId":"generated-raster","width":256,"height":256,"anchor":[128.0,240.0]},
  {"path":"assets/exports/units/vehicles/bus/top/down/frame-01.png","family":"vehicles","sourceId":"generated-raster","width":256,"height":256,"anchor":[128.0,128.0]},
  {"path":"assets/exports/units/vehicles/bus/top/left/frame-01.png","family":"vehicles","sourceId":"generated-raster","width":256,"height":256,"anchor":[128.0,128.0]},
  {"path":"assets/exports/units/vehicles/bus/top/right/frame-01.png","family":"vehicles","sourceId":"generated-raster","width":256,"height":256,"anchor":[128.0,128.0]},
  {"path":"assets/exports/units/vehicles/bus/top/up/frame-01.png","family":"vehicles","sourceId":"generated-raster","width":256,"height":256,"anchor":[128.0,128.0]},
  {"path":"assets/exports/units/vehicles/car/atlas.png","family":"vehicles","sourceId":"generated-raster","width":1280,"height":256,"anchor":[128,128],"frameRects":[[0,0,256,256],[256,0,256,256],[512,0,256,256],[768,0,256,256],[1024,0,256,256]],"frameLabels":["top/down","top/left","top/up","top/right","tilted/forward"],"frameAnchors":[[128,128],[128,128],[128,128],[128,128],[128,240]]},
  {"path":"assets/exports/units/vehicles/car/tilted/forward/frame-01.png","family":"vehicles","sourceId":"generated-raster","width":256,"height":256,"anchor":[128.0,240.0]},
  {"path":"assets/exports/units/vehicles/car/top/down/frame-01.png","family":"vehicles","sourceId":"generated-raster","width":256,"height":256,"anchor":[128.0,128.0]},
  {"path":"assets/exports/units/vehicles/car/top/left/frame-01.png","family":"vehicles","sourceId":"generated-raster","width":256,"height":256,"anchor":[128.0,128.0]},
  {"path":"assets/exports/units/vehicles/car/top/right/frame-01.png","family":"vehicles","sourceId":"generated-raster","width":256,"height":256,"anchor":[128.0,128.0]},
  {"path":"assets/exports/units/vehicles/car/top/up/frame-01.png","family":"vehicles","sourceId":"generated-raster","width":256,"height":256,"anchor":[128.0,128.0]},
  {"path":"assets/exports/units/vehicles/lrt/atlas.png","family":"vehicles","sourceId":"generated-raster","width":1280,"height":256,"anchor":[128,128],"frameRects":[[0,0,256,256],[256,0,256,256],[512,0,256,256],[768,0,256,256],[1024,0,256,256]],"frameLabels":["top/down","top/left","top/up","top/right","tilted/forward"],"frameAnchors":[[128,128],[128,128],[128,128],[128,128],[128,240]]},
  {"path":"assets/exports/units/vehicles/lrt/tilted/forward/frame-01.png","family":"vehicles","sourceId":"generated-raster","width":256,"height":256,"anchor":[128.0,240.0]},
  {"path":"assets/exports/units/vehicles/lrt/top/down/frame-01.png","family":"vehicles","sourceId":"generated-raster","width":256,"height":256,"anchor":[128.0,128.0]},
  {"path":"assets/exports/units/vehicles/lrt/top/left/frame-01.png","family":"vehicles","sourceId":"generated-raster","width":256,"height":256,"anchor":[128.0,128.0]},
  {"path":"assets/exports/units/vehicles/lrt/top/right/frame-01.png","family":"vehicles","sourceId":"generated-raster","width":256,"height":256,"anchor":[128.0,128.0]},
  {"path":"assets/exports/units/vehicles/lrt/top/up/frame-01.png","family":"vehicles","sourceId":"generated-raster","width":256,"height":256,"anchor":[128.0,128.0]},
  {"path":"assets/exports/units/vehicles/service-van/atlas.png","family":"vehicles","sourceId":"generated-raster","width":1280,"height":256,"anchor":[128,128],"frameRects":[[0,0,256,256],[256,0,256,256],[512,0,256,256],[768,0,256,256],[1024,0,256,256]],"frameLabels":["top/down","top/left","top/up","top/right","tilted/forward"],"frameAnchors":[[128,128],[128,128],[128,128],[128,128],[128,240]]},
  {"path":"assets/exports/units/vehicles/service-van/tilted/forward/frame-01.png","family":"vehicles","sourceId":"generated-raster","width":256,"height":256,"anchor":[128.0,240.0]},
  {"path":"assets/exports/units/vehicles/service-van/top/down/frame-01.png","family":"vehicles","sourceId":"generated-raster","width":256,"height":256,"anchor":[128.0,128.0]},
  {"path":"assets/exports/units/vehicles/service-van/top/left/frame-01.png","family":"vehicles","sourceId":"generated-raster","width":256,"height":256,"anchor":[128.0,128.0]},
  {"path":"assets/exports/units/vehicles/service-van/top/right/frame-01.png","family":"vehicles","sourceId":"generated-raster","width":256,"height":256,"anchor":[128.0,128.0]},
  {"path":"assets/exports/units/vehicles/service-van/top/up/frame-01.png","family":"vehicles","sourceId":"generated-raster","width":256,"height":256,"anchor":[128.0,128.0]},
  {"path":"assets/exports/world/bench-tilted.svg","family":"world","sourceId":"generated-vector","width":320.0,"height":218.0,"anchor":[160.0,176.0]},
  {"path":"assets/exports/world/bench-top.svg","family":"world","sourceId":"generated-vector","width":256.0,"height":256.0,"anchor":[128.0,128.0]},
  {"path":"assets/exports/world/bridge-tilted.svg","family":"world","sourceId":"generated-vector","width":320.0,"height":218.0,"anchor":[160.0,148.0]},
  {"path":"assets/exports/world/bridge-top.svg","family":"world","sourceId":"generated-vector","width":256.0,"height":256.0,"anchor":[128.0,128.0]},
  {"path":"assets/exports/world/buildings/apartment-block-tilted.svg","family":"buildings","sourceId":"generated-vector","width":128.0,"height":128.0,"anchor":[64.0,112.0]},
  {"path":"assets/exports/world/buildings/apartment-block-top.svg","family":"buildings","sourceId":"generated-vector","width":128.0,"height":128.0,"anchor":[64.0,64.0]},
  {"path":"assets/exports/world/buildings/bus-stop-tilted.svg","family":"buildings","sourceId":"generated-vector","width":128.0,"height":128.0,"anchor":[64.0,112.0]},
  {"path":"assets/exports/world/buildings/bus-stop-top.svg","family":"buildings","sourceId":"generated-vector","width":128.0,"height":128.0,"anchor":[64.0,64.0]},
  {"path":"assets/exports/world/buildings/clinic-tilted.svg","family":"buildings","sourceId":"generated-vector","width":128.0,"height":128.0,"anchor":[64.0,112.0]},
  {"path":"assets/exports/world/buildings/clinic-top.svg","family":"buildings","sourceId":"generated-vector","width":128.0,"height":128.0,"anchor":[64.0,64.0]},
  {"path":"assets/exports/world/buildings/lrt-station-track-tilted.svg","family":"buildings","sourceId":"generated-vector","width":128.0,"height":128.0,"anchor":[64.0,112.0]},
  {"path":"assets/exports/world/buildings/lrt-station-track-top.svg","family":"buildings","sourceId":"generated-vector","width":128.0,"height":128.0,"anchor":[64.0,64.0]},
  {"path":"assets/exports/world/buildings/office-civic-tilted.svg","family":"buildings","sourceId":"generated-vector","width":128.0,"height":128.0,"anchor":[64.0,112.0]},
  {"path":"assets/exports/world/buildings/office-civic-top.svg","family":"buildings","sourceId":"generated-vector","width":128.0,"height":128.0,"anchor":[64.0,64.0]},
  {"path":"assets/exports/world/buildings/residential-house-tilted.svg","family":"buildings","sourceId":"generated-vector","width":128.0,"height":128.0,"anchor":[64.0,112.0]},
  {"path":"assets/exports/world/buildings/residential-house-top.svg","family":"buildings","sourceId":"generated-vector","width":128.0,"height":128.0,"anchor":[64.0,64.0]},
  {"path":"assets/exports/world/buildings/school-kindergarten-tilted.svg","family":"buildings","sourceId":"generated-vector","width":128.0,"height":128.0,"anchor":[64.0,112.0]},
  {"path":"assets/exports/world/buildings/school-kindergarten-top.svg","family":"buildings","sourceId":"generated-vector","width":128.0,"height":128.0,"anchor":[64.0,64.0]},
  {"path":"assets/exports/world/buildings/sports-court-tilted.svg","family":"buildings","sourceId":"generated-vector","width":128.0,"height":128.0,"anchor":[64.0,112.0]},
  {"path":"assets/exports/world/buildings/sports-court-top.svg","family":"buildings","sourceId":"generated-vector","width":128.0,"height":128.0,"anchor":[64.0,64.0]},
  {"path":"assets/exports/world/buildings/utility-cue-tilted.svg","family":"buildings","sourceId":"generated-vector","width":128.0,"height":128.0,"anchor":[64.0,112.0]},
  {"path":"assets/exports/world/buildings/utility-cue-top.svg","family":"buildings","sourceId":"generated-vector","width":128.0,"height":128.0,"anchor":[64.0,64.0]},
  {"path":"assets/exports/world/bus-lane-tilted.svg","family":"world","sourceId":"generated-vector","width":320.0,"height":218.0,"anchor":[160.0,148.0]},
  {"path":"assets/exports/world/bus-lane-top.svg","family":"world","sourceId":"generated-vector","width":256.0,"height":256.0,"anchor":[128.0,128.0]},
  {"path":"assets/exports/world/crosswalk-tilted.svg","family":"world","sourceId":"generated-vector","width":320.0,"height":218.0,"anchor":[160.0,148.0]},
  {"path":"assets/exports/world/crosswalk-top.svg","family":"world","sourceId":"generated-vector","width":256.0,"height":256.0,"anchor":[128.0,128.0]},
  {"path":"assets/exports/world/ground-grass-tilted.svg","family":"world","sourceId":"generated-vector","width":320.0,"height":218.0,"anchor":[160.0,148.0]},
  {"path":"assets/exports/world/ground-grass-top.svg","family":"world","sourceId":"generated-vector","width":256.0,"height":256.0,"anchor":[128.0,128.0]},
  {"path":"assets/exports/world/ground-terrain-tilted.svg","family":"world","sourceId":"generated-vector","width":320.0,"height":218.0,"anchor":[160.0,148.0]},
  {"path":"assets/exports/world/ground-terrain-top.svg","family":"world","sourceId":"generated-vector","width":256.0,"height":256.0,"anchor":[128.0,128.0]},
  {"path":"assets/exports/world/park-tilted.svg","family":"world","sourceId":"generated-vector","width":320.0,"height":218.0,"anchor":[160.0,148.0]},
  {"path":"assets/exports/world/park-top.svg","family":"world","sourceId":"generated-vector","width":256.0,"height":256.0,"anchor":[128.0,128.0]},
  {"path":"assets/exports/world/paved-plaza-tilted.svg","family":"world","sourceId":"generated-vector","width":320.0,"height":218.0,"anchor":[160.0,148.0]},
  {"path":"assets/exports/world/paved-plaza-top.svg","family":"world","sourceId":"generated-vector","width":256.0,"height":256.0,"anchor":[128.0,128.0]},
  {"path":"assets/exports/world/river-edge-tilted.svg","family":"world","sourceId":"generated-vector","width":320.0,"height":218.0,"anchor":[160.0,148.0]},
  {"path":"assets/exports/world/river-edge-top.svg","family":"world","sourceId":"generated-vector","width":256.0,"height":256.0,"anchor":[128.0,128.0]},
  {"path":"assets/exports/world/river-water-tilted.svg","family":"world","sourceId":"generated-vector","width":320.0,"height":218.0,"anchor":[160.0,148.0]},
  {"path":"assets/exports/world/river-water-top.svg","family":"world","sourceId":"generated-vector","width":256.0,"height":256.0,"anchor":[128.0,128.0]},
  {"path":"assets/exports/world/road-corner-tilted.svg","family":"world","sourceId":"generated-vector","width":320.0,"height":218.0,"anchor":[160.0,148.0]},
  {"path":"assets/exports/world/road-corner-top.svg","family":"world","sourceId":"generated-vector","width":256.0,"height":256.0,"anchor":[128.0,128.0]},
  {"path":"assets/exports/world/road-intersection-tilted.svg","family":"world","sourceId":"generated-vector","width":320.0,"height":218.0,"anchor":[160.0,148.0]},
  {"path":"assets/exports/world/road-intersection-top.svg","family":"world","sourceId":"generated-vector","width":256.0,"height":256.0,"anchor":[128.0,128.0]},
  {"path":"assets/exports/world/road-straight-tilted.svg","family":"world","sourceId":"generated-vector","width":320.0,"height":218.0,"anchor":[160.0,148.0]},
  {"path":"assets/exports/world/road-straight-top.svg","family":"world","sourceId":"generated-vector","width":256.0,"height":256.0,"anchor":[128.0,128.0]},
  {"path":"assets/exports/world/shadow-canopy-tilted.svg","family":"world","sourceId":"generated-vector","width":320.0,"height":218.0,"anchor":[160.0,176.0]},
  {"path":"assets/exports/world/shadow-canopy-top.svg","family":"world","sourceId":"generated-vector","width":256.0,"height":256.0,"anchor":[128.0,128.0]},
  {"path":"assets/exports/world/shadow-furniture-tilted.svg","family":"world","sourceId":"generated-vector","width":320.0,"height":218.0,"anchor":[160.0,176.0]},
  {"path":"assets/exports/world/shadow-furniture-top.svg","family":"world","sourceId":"generated-vector","width":256.0,"height":256.0,"anchor":[128.0,128.0]},
  {"path":"assets/exports/world/shrub-01-tilted.svg","family":"world","sourceId":"generated-vector","width":320.0,"height":218.0,"anchor":[160.0,176.0]},
  {"path":"assets/exports/world/shrub-01-top.svg","family":"world","sourceId":"generated-vector","width":256.0,"height":256.0,"anchor":[128.0,128.0]},
  {"path":"assets/exports/world/shrub-02-tilted.svg","family":"world","sourceId":"generated-vector","width":320.0,"height":218.0,"anchor":[160.0,176.0]},
  {"path":"assets/exports/world/shrub-02-top.svg","family":"world","sourceId":"generated-vector","width":256.0,"height":256.0,"anchor":[128.0,128.0]},
  {"path":"assets/exports/world/sidewalk-tilted.svg","family":"world","sourceId":"generated-vector","width":320.0,"height":218.0,"anchor":[160.0,148.0]},
  {"path":"assets/exports/world/sidewalk-top.svg","family":"world","sourceId":"generated-vector","width":256.0,"height":256.0,"anchor":[128.0,128.0]},
  {"path":"assets/exports/world/streetlight-tilted.svg","family":"world","sourceId":"generated-vector","width":320.0,"height":218.0,"anchor":[160.0,176.0]},
  {"path":"assets/exports/world/streetlight-top.svg","family":"world","sourceId":"generated-vector","width":256.0,"height":256.0,"anchor":[128.0,128.0]},
  {"path":"assets/exports/world/tree-01-tilted.svg","family":"world","sourceId":"generated-vector","width":320.0,"height":218.0,"anchor":[160.0,176.0]},
  {"path":"assets/exports/world/tree-01-top.svg","family":"world","sourceId":"generated-vector","width":256.0,"height":256.0,"anchor":[128.0,128.0]},
  {"path":"assets/exports/world/tree-02-tilted.svg","family":"world","sourceId":"generated-vector","width":320.0,"height":218.0,"anchor":[160.0,176.0]},
  {"path":"assets/exports/world/tree-02-top.svg","family":"world","sourceId":"generated-vector","width":256.0,"height":256.0,"anchor":[128.0,128.0]},
  {"path":"assets/exports/world/tree-03-tilted.svg","family":"world","sourceId":"generated-vector","width":320.0,"height":218.0,"anchor":[160.0,176.0]},
  {"path":"assets/exports/world/tree-03-top.svg","family":"world","sourceId":"generated-vector","width":256.0,"height":256.0,"anchor":[128.0,128.0]}
];
export const ART_INVENTORY = freeze(entries.map(entry => ({ ...entry, href: `/${entry.path}`, license: 'Project-owned; redistribution license not specified' })));
export const ART_FAMILIES = freeze([...new Set(ART_INVENTORY.map(entry => entry.family))]);
const byPath = new Map(ART_INVENTORY.map(entry => [entry.path, entry]));
/** Exact export path, with or without /assets/exports/. Unknown paths return null. */
export function assetArt(path) {
  if (typeof path !== 'string') return null;
  const key = path.replace(/^\//, '');
  return byPath.get(key.startsWith('assets/exports/') ? key : `assets/exports/${key}`) || null;
}
export const ART_STYLESHEET = '/assets/exports/effects/effects.css';
/** M1..M14 (M01 accepted); kind icon, object, marker. */
export function policyArt(id, kind = 'icon') {
  const match = /^M(0?[1-9]|1[0-4])$/.exec(String(id));
  const suffix = { icon: 'ui-icon', object: 'tilted-object', marker: 'world-marker' }[kind];
  if (!match || !suffix) return null;
  const n = Number(match[1]);
  return assetArt(`policies/${n <= 7 ? 'M01-M07' : 'M08-M14'}/M${String(n).padStart(2, '0')}-${suffix}.svg`);
}
const characterAliases = { person: 'citizen-01', citizen: 'citizen-01', worker: 'maintenance', 'citizen.01': 'citizen-01', 'citizen.02': 'citizen-02', 'citizen.03': 'citizen-03' };
const vehicleAliases = { service: 'service-van' };
/** Character stills, or selected vehicle direction. Numeric heading is degrees:
 * 0 right, 90 down, 180 left, 270 up. Tilted has one supplied forward view.
 * Optional variant='sheet'/'atlas' exposes pose/direction metadata for opt-in use.
 */
export function actorArt(kind, projection = 'top', heading = 'down', variant = 'still') {
  const name = String(kind).replace(/^(unit|vehicle)\./, '');
  const character = characterAliases[name] || name;
  if (['mayor', 'citizen-01', 'citizen-02', 'citizen-03', 'maintenance', 'emergency'].includes(character)) {
    return assetArt(`characters/${character}-${variant === 'sheet' ? 'sheet' : 'still'}.png`);
  }
  const vehicle = vehicleAliases[name] || name;
  if (!['bus', 'car', 'lrt', 'service-van'].includes(vehicle) || !['top', 'tilted'].includes(projection)) return null;
  if (variant === 'atlas') return assetArt(`units/vehicles/${vehicle}/atlas.png`);
  const direction = typeof heading === 'number' && Number.isFinite(heading)
    ? ['right', 'down', 'left', 'up'][Math.round(((heading % 360 + 360) % 360) / 90) % 4]
    : ['up', 'down', 'left', 'right'].includes(heading) ? heading : 'down';
  return assetArt(`units/vehicles/${vehicle}/${projection}/${projection === 'tilted' ? 'forward' : direction}/frame-01.png`);
}
const worldAliases = { home: 'residential-house', apartment: 'apartment-block', civic: 'office-civic', school: 'school-kindergarten', tree: 'tree-01', grass: 'ground-grass', 'street-light': 'streetlight', straight: 'road-straight', corner: 'road-corner', junction: 'road-intersection' };
/** Stable manifest ID or export basename, e.g. building.school, tree-02, bridge. */
export function worldArt(id, projection = 'top') {
  if (!['top', 'tilted'].includes(projection)) return null;
  const key = String(id).replace(/^(building|terrain|furniture|road)\./, '');
  const name = worldAliases[key] || key;
  return assetArt(`world/${name}-${projection}.svg`) || assetArt(`world/buildings/${name}-${projection}.svg`);
}
export function effectArt(id) { return assetArt(`effects/${String(id).replace(/^effect\./, '')}.svg`); }
export function iconArt(id) { return assetArt(`icons/${id}.svg`); }
export function faviconArt(size = 'svg') { return assetArt(`favicon/favicon${size === 'svg' ? '.svg' : `-${size}.png`}`); }
