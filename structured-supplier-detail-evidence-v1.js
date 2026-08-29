const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const lower=v=>clean(v).toLowerCase();
const num=v=>{const m=clean(v).replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):null;};

function flattenAttributes(row={}){
  const out=[];
  const add=(name,value)=>{if(clean(name)&&clean(value))out.push({name:clean(name),value:clean(value)});};
  const objects=[row.productDetails,row.specifications,row.specs,row.keyAttributes,row.details];
  for(const obj of objects){
    if(Array.isArray(obj)){for(const x of obj){if(x&&typeof x==='object')add(x.name??x.key??x.label??x.attributeName,x.value??x.val??x.attributeValue);}}
    else if(obj&&typeof obj==='object'){for(const [k,v] of Object.entries(obj)){if(v!==null&&v!==undefined&&typeof v!=='object')add(k,v);}}
  }
  if(Array.isArray(row.attributes)){for(const x of row.attributes){if(x&&typeof x==='object')add(x.name??x.key??x.label,x.value??x.val);}}
  return out;
}
function findAttr(attrs,names){
  const targets=names.map(lower);
  for(const a of attrs){const n=lower(a.name);if(targets.some(t=>n===t||n.includes(t)))return a.value;}
  return null;
}
function normalizeMaterial(v){
  const s=lower(v);if(!s)return null;
  if(/metal mesh|steel mesh|iron mesh/.test(s))return 'metal mesh';
  if(/stainless steel/.test(s))return 'stainless steel';
  if(/carbon steel/.test(s))return 'carbon steel';
  if(/steel|iron|metal/.test(s))return 'metal';
  if(/bamboo/.test(s))return 'bamboo';
  if(/wood|mdf/.test(s))return 'wood';
  if(/acrylic/.test(s))return 'acrylic';
  if(/plastic|abs|polypropylene|pp\b/.test(s))return 'plastic';
  if(/cotton/.test(s))return 'cotton';
  if(/neoprene/.test(s))return 'neoprene';
  if(/leather/.test(s))return /faux|pu/.test(s)?'faux leather':'leather';
  return clean(v);
}
function parseDimensions(v){
  const s=lower(v);if(!s)return null;
  const m=s.match(/(\d+(?:\.\d+)?)\s*(?:x|×|\*)\s*(\d+(?:\.\d+)?)(?:\s*(?:x|×|\*)\s*(\d+(?:\.\d+)?))?\s*(mm|cm|m|inch(?:es)?|in\b)/i);
  if(!m)return null;
  let vals=[Number(m[1]),Number(m[2]),m[3]?Number(m[3]):null].filter(x=>Number.isFinite(x));
  const unit=m[4].toLowerCase();
  if(unit==='mm')vals=vals.map(x=>x/10);else if(unit==='m')vals=vals.map(x=>x*100);else if(unit.startsWith('in'))vals=vals.map(x=>x*2.54);
  return {lengthCm:Number(vals[0].toFixed(3)),widthCm:Number(vals[1].toFixed(3)),heightCm:vals[2]===undefined?null:Number(vals[2].toFixed(3))};
}
function parseWeightGrams(v){
  const s=lower(v);const n=num(s);if(!Number.isFinite(n)||n<=0)return null;
  if(/\bkg\b/.test(s))return Math.round(n*1000);
  if(/\blb|pound/.test(s))return Math.round(n*453.59237);
  if(/\boz|ounce/.test(s))return Math.round(n*28.3495);
  if(/\bg\b|gram/.test(s))return Math.round(n);
  return null;
}
function explicitPackCount(text){
  const s=lower(text);for(const p of [/pack\s+of\s+(\d{1,3})\b/,/\b(\d{1,3})\s*[- ]?pack\b/,/\b(\d{1,3})\s*[- ]?piece\s+set\b/,/\bset\s+of\s+(\d{1,3})\b/]){const m=s.match(p);if(m&&Number(m[1])>0)return Number(m[1]);}return null;
}
function classifyProductType(text){
  const s=lower(text);const rules=[[/monitor stand|monitor riser/,'monitor stand'],[/desk organizer|desktop organizer|desk set organizer/,'desk organizer'],[/letter tray|file tray|file organizer|paper tray/,'file tray organizer'],[/cable clip|cord clip/,'cable clip'],[/cable management sleeve|cord sleeve/,'cable sleeve'],[/cable management box|cord organizer box/,'cable management box'],[/desk mat|desk pad|mouse pad/,'desk mat'],[/vanity organizer|makeup organizer/,'vanity organizer'],[/floating shelf|wall shelf/,'wall shelf'],[/storage box|storage basket/,'storage container'],[/charging station|docking station/,'charging station'],[/wireless charger/,'wireless charger'],[/can organizer|can rack|beverage dispenser/,'can organizer']];
  for(const [p,v] of rules)if(p.test(s))return v;return null;
}
function primaryFunction(type){return ({'monitor stand':'raise monitor','desk organizer':'organize desk supplies','file tray organizer':'organize documents','cable clip':'secure cables','cable sleeve':'bundle cables','cable management box':'conceal cables','desk mat':'protect desk surface','vanity organizer':'organize cosmetics','wall shelf':'wall storage','storage container':'store items','charging station':'organize and charge devices','wireless charger':'charge devices','can organizer':'organize beverage cans'})[type]??null;}
function technicalSpecs(text){
  const s=lower(text),o={};for(const [k,p] of [['tiers',/\b(\d{1,2})\s*[- ]?tier\b/],['compartments',/\b(\d{1,2})\s*[- ]?compartment/],['penHolders',/\b(\d{1,2})\s+pen\s+holders?\b/],['drawers',/\b(\d{1,2})\s+drawers?\b/]]){const m=s.match(p);if(m)o[k]=Number(m[1]);}return o;
}
export function adaptStructuredSupplierDetailEvidence(row={}){
  const attrs=flattenAttributes(row);
  const title=clean(row.title??row.productTitle??row.name);
  const description=clean(row.description??row.productDescription);
  const attrText=attrs.map(a=>`${a.name}: ${a.value}`).join(' | ');
  const combined=clean([title,description,attrText].filter(Boolean).join(' | '));
  const materialRaw=findAttr(attrs,['material','main material','product material']);
  const dimensionsRaw=findAttr(attrs,['product size','size','dimensions','dimension','unit size','product dimensions']);
  const weightRaw=findAttr(attrs,['unit weight','product weight','net weight','weight']);
  const packRaw=findAttr(attrs,['package quantity','pack quantity','pieces per set','pcs/set','set contains']);
  const productType=classifyProductType(combined);
  const material=normalizeMaterial(materialRaw)||normalizeMaterial(combined.match(/(?:material|made of)\s*[:\-]?\s*([^|,;]{2,60})/i)?.[1]);
  const dimensions=parseDimensions(dimensionsRaw)||parseDimensions(combined);
  const unitWeightGrams=parseWeightGrams(weightRaw);
  const packCount=explicitPackCount(packRaw)||explicitPackCount(title)||explicitPackCount(combined);
  const formFactor=/wall[- ]mounted|floating shelf/i.test(combined)?'wall mounted':/under[- ]desk/i.test(combined)?'under desk':/desktop|desk organizer|monitor stand|desk mat/i.test(combined)?'desktop':null;
  return {schemaVersion:'MPR_STRUCTURED_SUPPLIER_DETAIL_EVIDENCE_V1',title,attributes:attrs,fingerprintEvidence:{category:clean(row.category??row.categoryName)||null,productType,primaryFunction:primaryFunction(productType),material,dimensions,unitWeightGrams,packCount,formFactor,technicalSpecs:technicalSpecs(combined),sourceTitle:title},coverage:{attributeCount:attrs.length,materialKnown:Boolean(material),dimensionsKnown:Boolean(dimensions),unitWeightKnown:Boolean(unitWeightGrams),packCountKnown:Boolean(packCount),productTypeKnown:Boolean(productType)},truthPolicy:{structuredPublicDetailIsVerifiedQuote:false,structuredPublicDetailIsLandedCost:false,unknownEqualsZero:false,imageInferenceUsed:false,purchaseAuthorized:false,negotiationIncluded:false}};
}
