/** Cross-branch acceptance in real Chrome. No live AI requests or cloud account writes. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const base=process.env.AKIM_TEST_URL||'http://127.0.0.1:3045';
const output=resolve(process.env.AKIM_TEST_OUTPUT||'.codex-private/sync-browser');await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const page=await context.newPage();page.setDefaultTimeout(15000);
const report={checks:[],errors:[],failedResources:[],layouts:[],cityLoadMs:{}};
page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.failedResources.push({status:r.status(),url:r.url()});});
async function check(name,fn){await fn();report.checks.push(name);console.log('PASS '+name);}
async function ready(){await page.locator('.akim-atlas').waitFor({state:'attached',timeout:90000});await page.locator('#scene-notice').waitFor({state:'hidden',timeout:90000});}
async function layout(width){await page.setViewportSize({width,height:1000});const m=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,headerBottom:document.querySelector('.topbar').getBoundingClientRect().bottom,titleTop:document.querySelector('.page-heading').getBoundingClientRect().top,loginWidth:document.querySelector('.account-login-button').getBoundingClientRect().width,loginClipped:document.querySelector('.account-login-button').scrollWidth>document.querySelector('.account-login-button').clientWidth}));assert.ok(m.document<=width+1,JSON.stringify(m));assert.ok(m.titleTop>=m.headerBottom,JSON.stringify(m));assert.equal(m.loginClipped,false,JSON.stringify(m));report.layouts.push(m);if([320,1440].includes(width))await page.screenshot({path:resolve(output,`main-${width}.png`),fullPage:true});}
try{
 let start=Date.now();await page.goto(base,{waitUntil:'domcontentloaded'});await ready();report.cityLoadMs.astana=Date.now()-start;
 await check('Full Astana map, readable account controls and six responsive widths',async()=>{for(const w of [320,375,430,768,1024,1440])await layout(w);assert.ok(await page.locator('.atlas-layer-roads path').count()>0);});
 await check('District placement dialog and undo preserve the shared plan',async()=>{await page.locator('[data-focus-key="measure-M7"]').click();await page.locator('#placement-dialog').waitFor({state:'visible'});await page.locator('.placement-option').filter({hasText:'Нура'}).click();assert.equal(await page.locator('#selection-count').textContent(),'1/5');await page.locator('#undo-button').click();assert.equal(await page.locator('#selection-count').textContent(),'0/5');});
 await check('Official example scores 56.54 for budget 95 in the calculator',async()=>{await page.locator('#sample-button').click();await page.locator('#mode-calculator').click();await page.locator('#calculate-button').click();await page.locator('#results').waitFor({state:'visible'});assert.equal(await page.locator('#budget-used').textContent(),'95');assert.equal(await page.locator('#result-score').textContent(),'56,54');});
 for(const [city,name] of [['almaty','Алматы'],['shymkent','Шымкент']])await check(`${name} shows its own full geography without Astana scores`,async()=>{
  start=Date.now();await page.locator('#city-select').selectOption(city);await ready();report.cityLoadMs[city]=Date.now()-start;
  assert.equal(await page.locator('#city-name').textContent(),name);assert.equal(await page.locator('.atlas-svg').getAttribute('aria-label'),`Карта ${city==='almaty'?'Алматы':'Шымкента'}`);
  assert.equal(await page.locator('.command-panel').isVisible(),false);assert.equal(await page.locator('#results').isVisible(),false);assert.equal(await page.locator('.atlas-walk').isVisible(),false);assert.ok(await page.locator('.atlas-layer-buildings path').count()>0);
  await page.locator('[data-act="top"]').click();assert.equal(await page.locator('[data-act="top"]').getAttribute('aria-pressed'),'true');await page.screenshot({path:resolve(output,`${city}.png`)});
 });
 await check('Returning to Astana restores calculator mode, exact plan and score',async()=>{await page.locator('#city-select').selectOption('astana');await ready();assert.equal(await page.locator('#mode-calculator').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#selection-count').textContent(),'5/5');assert.equal(await page.locator('#budget-used').textContent(),'95');assert.equal(await page.locator('#result-score').textContent(),'56,54');await page.locator('#mode-game').click();});
 await check('Profile dialog opens and closes with the city selector present',async()=>{await page.locator('.account-login-button').click();await page.locator('.account-dialog').waitFor({state:'visible'});await page.keyboard.press('Escape');await page.locator('.account-dialog').waitFor({state:'hidden'});});
 await check('Reload restores valid draft and all modules load without browser errors',async()=>{await page.reload({waitUntil:'domcontentloaded'});await ready();assert.equal(await page.locator('#selection-count').textContent(),'5/5');assert.equal(await page.locator('#budget-used').textContent(),'95');assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedResources,[]);});
}catch(error){report.failure=error.message;process.exitCode=1;}finally{await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();}
