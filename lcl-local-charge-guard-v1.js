const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

export function localChargeScopeGuardV1(input={}){
  const shipmentMode=String(input.shipmentMode||'').toUpperCase();
  const chargeScope=String(input.chargeScope||'').toUpperCase();
  const unit=String(input.unit||'').toUpperCase();
  const explicitAllocation=input.explicitLclAllocation===true;

  if(!shipmentMode)return Object.freeze({status:'UNKNOWN',usable:false,blockers:Object.freeze(['SHIPMENT_MODE_REQUIRED'])});
  if(!chargeScope)return Object.freeze({status:'UNKNOWN',usable:false,blockers:Object.freeze(['CHARGE_SCOPE_REQUIRED'])});

  const containerScoped=chargeScope.includes('FCL')||unit.includes('CONTAINER')||unit==='BX';
  if(shipmentMode==='SEA_LCL'&&containerScoped&&!explicitAllocation){
    return Object.freeze({
      schemaVersion:'MPR_LOCAL_CHARGE_SCOPE_GUARD_V1',
      status:'BLOCKED_SCOPE_MISMATCH',
      usable:false,
      blockers:Object.freeze(['FCL_CONTAINER_CHARGE_CANNOT_BE_DIRECTLY_ALLOCATED_TO_LCL']),
      policy:'Per-container/FCL charges cannot be converted into LCL house-shipment charges without explicit consolidator allocation evidence.'
    });
  }
  return Object.freeze({
    schemaVersion:'MPR_LOCAL_CHARGE_SCOPE_GUARD_V1',
    status:'SCOPE_COMPATIBLE',
    usable:true,
    blockers:Object.freeze([]),
    policy:'Scope compatibility does not prove the charge applies; it only prevents known FCL/LCL misuse.'
  });
}

export function lclScreeningRangeV1({usdRon,sources=[]}={}){
  const fx=finite(usdRon)?Number(usdRon):null;
  if(fx===null||fx<=0)return Object.freeze({status:'UNKNOWN',blockers:Object.freeze(['USD_RON_REQUIRED'])});
  const allIn=[];
  const seaOnly=[];
  for(const s of Array.isArray(sources)?sources:[]){
    if(finite(s.totalBeforeDutyVatUsd))allIn.push(Number(s.totalBeforeDutyVatUsd));
    if(finite(s.lclSeaFreightUsdPerCbmMin))seaOnly.push(Number(s.lclSeaFreightUsdPerCbmMin));
    if(finite(s.lclSeaFreightUsdPerCbmMax))seaOnly.push(Number(s.lclSeaFreightUsdPerCbmMax));
  }
  return Object.freeze({
    schemaVersion:'MPR_LCL_SCREENING_RANGE_V1',
    status:(allIn.length||seaOnly.length)?'SCREENING_RANGE_READY':'NO_PUBLIC_RANGE',
    seaFreightUsdPerCbmMin:seaOnly.length?Math.min(...seaOnly):null,
    seaFreightUsdPerCbmMax:seaOnly.length?Math.max(...seaOnly):null,
    historicalAllInBeforeDutyVatUsdMin:allIn.length?Math.min(...allIn):null,
    historicalAllInBeforeDutyVatUsdMax:allIn.length?Math.max(...allIn):null,
    historicalAllInBeforeDutyVatRonMin:allIn.length?Number((Math.min(...allIn)*fx).toFixed(2)):null,
    historicalAllInBeforeDutyVatRonMax:allIn.length?Number((Math.max(...allIn)*fx).toFixed(2)):null,
    purchaseAuthorized:false,
    policy:'Sea-freight-only and all-in-before-duty/VAT figures stay distinct. Historical all-in examples are secondary screening evidence, not current quotes.'
  });
}
