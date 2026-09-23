/** A bounding-box grid: querying never drops features by an arbitrary count. */
export function createSpatialIndex(features, boundsOf, cellSize = 40) {
  const cells = new Map(), broad = [], bounds = new Map();
  for (const feature of features) {
    const box = boundsOf(feature); if (!box) continue;
    bounds.set(feature, box);
    const x0=Math.floor(box.minX/cellSize),x1=Math.floor(box.maxX/cellSize),y0=Math.floor(box.minY/cellSize),y1=Math.floor(box.maxY/cellSize);
    if((x1-x0+1)*(y1-y0+1)>256){broad.push(feature);continue;}
    for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){const key=x+','+y;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(feature);}
  }
  return {query(box){
    const found=new Set(broad);
    const x0=Math.floor(box.minX/cellSize),x1=Math.floor(box.maxX/cellSize),y0=Math.floor(box.minY/cellSize),y1=Math.floor(box.maxY/cellSize);
    if((x1-x0+1)*(y1-y0+1)>10000){for(const feature of bounds.keys())found.add(feature);}
    else for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(const feature of cells.get(x+','+y)||[])found.add(feature);
    return [...found].filter(f=>{const b=bounds.get(f);return b.minX<=box.maxX&&b.maxX>=box.minX&&b.minY<=box.maxY&&b.maxY>=box.minY});
  }};
}
export function lineBounds(feature){
  if(!feature.points?.length)return null;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const [x,y]of feature.points){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}
  return {minX,minY,maxX,maxY};
}
