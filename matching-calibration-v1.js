import {buildProductFingerprint} from './product-fingerprint-v1.js';
import {matchMarketplaceToSupplier} from './marketplace-supplier-matching-v1.js';

const base={
  category:'home',productType:'desk organizer',primaryFunction:'desk organization',packCount:1,material:'metal',
  dimensions:{lengthCm:30,widthCm:32,heightCm:28},unitWeightGrams:1700,formFactor:'desk organizer',
  technicalSpecs:{tiers:5,drawers:1,penHolders:2},sourceTitle:'5 tier metal desk organizer drawer 2 pen holders'
};

const CASES=Object.freeze([
  {id:'P01',expected:true,a:{},b:{}},
  {id:'P02',expected:true,a:{sourceTitle:'office desk organizer 5 tier metal'},b:{sourceTitle:'5 tier metal desk organizer for office'}},
  {id:'P03',expected:true,a:{dimensions:{lengthCm:30,widthCm:32,heightCm:28}},b:{dimensions:{lengthCm:31,widthCm:31.5,heightCm:28.5}}},
  {id:'P04',expected:true,a:{unitWeightGrams:1700},b:{unitWeightGrams:1800}},
  {id:'P05',expected:true,a:{technicalSpecs:{tiers:5,drawers:1,penHolders:2}},b:{technicalSpecs:{tiers:5,drawers:1,penHolders:2}}},
  {id:'N01',expected:false,a:{packCount:1},b:{packCount:2}},
  {id:'N02',expected:false,a:{material:'metal'},b:{material:'plastic'}},
  {id:'N03',expected:false,a:{dimensions:{lengthCm:30,widthCm:32,heightCm:28}},b:{dimensions:{lengthCm:45,widthCm:20,heightCm:15}}},
  {id:'N04',expected:false,a:{category:'home'},b:{category:'pet supplies'}},
  {id:'N05',expected:false,a:{formFactor:'desk organizer'},b:{formFactor:'wall rack'}},
  {id:'N06',expected:false,a:{productType:'desk organizer'},b:{productType:'shoe rack'}},
  {id:'N07',expected:false,a:{sourceTitle:'5 tier metal desk organizer'},b:{packCount:2,sourceTitle:'5 tier metal desk organizer'}},
  {id:'N08',expected:false,a:{technicalSpecs:{tiers:5,drawers:1,penHolders:2}},b:{technicalSpecs:{tiers:3,drawers:0,penHolders:0},dimensions:{lengthCm:45,widthCm:20,heightCm:15}}},
  {id:'N09',expected:false,a:{material:'metal',sourceTitle:'premium office organizer'},b:{material:'bamboo',sourceTitle:'premium office organizer'}},
  {id:'N10',expected:false,a:{category:'home',productType:'desk organizer'},b:{category:'automotive',productType:'desk organizer'}}
]);

const fp=overrides=>buildProductFingerprint({...base,...overrides});

export function runMatchingCalibration(){
  const rows=CASES.map(row=>{
    const result=matchMarketplaceToSupplier(fp(row.a),fp(row.b));
    const predicted=result.matchConfidence>=80&&result.screeningEconomicsEligible;
    return {id:row.id,expectedMatch:row.expected,predictedMatch:predicted,matchConfidence:result.matchConfidence,matchClass:result.matchClass,hardMismatches:result.hardMismatches,correct:predicted===row.expected};
  });
  const predictedPositive=rows.filter(r=>r.predictedMatch);
  const truePositive=predictedPositive.filter(r=>r.expectedMatch).length;
  const precision=predictedPositive.length?truePositive/predictedPositive.length:null;
  const accuracy=rows.filter(r=>r.correct).length/rows.length;
  return {schemaVersion:'MPR_MATCH_CALIBRATION_V1',caseCount:rows.length,precision,accuracy,rows,policy:{curatedFixtureIsNotRealWorldManualValidation:true,realWorldHighConfidenceSampleStillRequired:true}};
}

export const MatchingCalibrationCasesV1=CASES;
