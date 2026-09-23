export const CITIES = Object.freeze({
  astana: Object.freeze({ id:'astana', name:'Астана', title:'Ваш план для Астаны', mapTitle:'Карта Астаны', placesTitle:'Места Астаны', center:[71.4304,51.1282], bbox:[71.2179,50.8575,71.7849,51.3511], simulation:true }),
  almaty: Object.freeze({ id:'almaty', name:'Алматы', title:'Откройте Алматы', mapTitle:'Карта Алматы', placesTitle:'Места Алматы', center:[76.9457275,43.2363924], bbox:[76.7420485,43.0328438,77.1667539,43.4037657], sourceUrl:'https://www.openstreetmap.org/node/26544289', simulation:false }),
  shymkent: Object.freeze({ id:'shymkent', name:'Шымкент', title:'Откройте Шымкент', mapTitle:'Карта Шымкента', placesTitle:'Места Шымкента', center:[69.5883282,42.3146962], bbox:[69.30185,42.1090168,69.9357152,42.4794403], sourceUrl:'https://www.openstreetmap.org/node/1466716533', simulation:false }),
});
export const CITY_MAP_FILES = Object.freeze(Object.fromEntries(Object.keys(CITIES).map(id=>[id,Object.freeze(Object.fromEntries(['roads','buildings','landscape'].map(layer=>[layer,`/scene/data/cities/${id}-${layer}.geojson`])))])));
