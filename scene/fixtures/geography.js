// SCHEMATIC DEVELOPMENT FIXTURE. These shapes are not the boundaries of Astana.
const polygon = points => [[points.concat([points[0]])]];
export const geography = {
  schemaVersion: 1, id: 'schematic-six-districts', status: 'fixture', viewBox: [0, 0, 1000, 740],
  projection: { sourceCrs: 'none', method: 'illustrative planar fixture', parameters: {} },
  boundaryDate: null, sources: [],
  regions: [
    { regionId: 'saryarka', label: 'Сарыарка', simulationDistrict: 'Сарыарка', labelAnchor: [260, 200],
      polygons: polygon([[80, 100], [320, 70], [415, 170], [380, 335], [195, 355], [70, 240]]), sourceIds: [] },
    { regionId: 'baikonur', label: 'Байконур', simulationDistrict: 'Байконур', labelAnchor: [495, 200],
      polygons: polygon([[320, 70], [610, 85], [650, 275], [545, 355], [380, 335], [415, 170]]), sourceIds: [] },
    { regionId: 'almaty', label: 'Алматы', simulationDistrict: 'Алматы', labelAnchor: [765, 270],
      polygons: polygon([[610, 85], [810, 130], [935, 270], [875, 440], [665, 435], [545, 355], [650, 275]]), sourceIds: [] },
    { regionId: 'nura', label: 'Нура', simulationDistrict: 'Нура', labelAnchor: [270, 500],
      polygons: polygon([[70, 240], [195, 355], [380, 335], [420, 590], [330, 680], [135, 620], [60, 440]]), sourceIds: [] },
    { regionId: 'esil', label: 'Есиль', simulationDistrict: 'Есиль', labelAnchor: [525, 520],
      polygons: polygon([[380, 335], [545, 355], [665, 435], [655, 625], [490, 690], [330, 680], [420, 590]]), sourceIds: [] },
    { regionId: 'saraishyk', label: 'Сарайшық', simulationDistrict: null, labelAnchor: [780, 550],
      polygons: polygon([[665, 435], [875, 440], [935, 545], [855, 650], [655, 625]]), sourceIds: [] },
  ],
  paths: [
    { id: 'decorative-walk', kind: 'walking', points: [[230, 460], [305, 460], [305, 540], [230, 540], [230, 460]], sourceIds: [], illustrative: true },
    { id: 'decorative-road', kind: 'road', points: [[155, 400], [335, 390], [370, 570], [170, 590], [155, 400]], sourceIds: [], illustrative: true },
    { id: 'decorative-bus', kind: 'bus', points: [[165, 420], [335, 410], [355, 565], [185, 575], [165, 420]], sourceIds: [], illustrative: true },
    { id: 'scenario-lrt', kind: 'lrt-scenario', points: [[205, 610], [320, 610], [370, 555]], sourceIds: [], illustrative: true },
  ],
};
