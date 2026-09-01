import {collectYouTubeSignals} from './youtube-viral-collector.js';
import {persistViralObservations} from './viral-supabase-writer.js';
import {refreshViralScores} from './viral-score-refresh.js';
import {routeViralCandidatesToRomania} from './viral-romania-router.js';

export async function runViralPipeline(plan,options={},deps={}){
  const execute=options.execute===true;
  const base={schema:'MPR_VIRAL_PIPELINE_RUN_V1',mode:execute?'LIVE_AUTHORIZED':'DRY_RUN',plannedQueries:plan.length,stages:[],policy:{providerDataSpendEur:0,purchaseAuthorized:false,claimsSales:false,romaniaGapAssigned:false}};
  if(!execute)return {...base,status:'READY',nextAction:'CONFIGURE_SECRETS_AND_AUTHORIZE_LIVE_RUN'};
  const collect=deps.collect||collectYouTubeSignals,persist=deps.persist||persistViralObservations,refresh=deps.refresh||refreshViralScores,route=deps.route||routeViralCandidatesToRomania;
  const collection=await collect(plan,{apiKey:options.youtubeApiKey,termsApproved:options.youtubeTermsApproved===true,sourceEnabled:options.youtubeSourceEnabled===true,fetchImpl:options.fetchImpl});
  base.stages.push(stage('COLLECT',collection.status,collection.reason,collection.observations?.length||0));
  if(collection.status!=='COMPLETED')return {...base,status:'HELD',reason:collection.reason};
  const persistence=await persist(collection,{supabaseUrl:options.supabaseUrl,serviceRoleKey:options.serviceRoleKey,approved:options.productionWriteApproved===true,fetchImpl:options.fetchImpl});
  base.stages.push(stage('PERSIST',persistence.status,persistence.reason,persistence.insertedCount||0));
  if(persistence.status!=='COMPLETED')return {...base,status:'HELD',reason:persistence.reason};
  const scoring=await refresh({supabaseUrl:options.supabaseUrl,serviceRoleKey:options.serviceRoleKey,approved:options.scoreRefreshApproved===true,fetchImpl:options.fetchImpl});
  base.stages.push(stage('SCORE',scoring.status||'COMPLETED',scoring.reason,scoring.scoresRefreshed||0));
  if(scoring.status==='HELD')return {...base,status:'HELD',reason:scoring.reason};
  const routing=await route({supabaseUrl:options.supabaseUrl,serviceRoleKey:options.serviceRoleKey,approved:options.romaniaRoutingApproved===true,fetchImpl:options.fetchImpl});
  base.stages.push(stage('ROUTE_ROMANIA',routing.status||'COMPLETED',routing.reason,routing.targetsRouted||0));
  if(routing.status==='HELD')return {...base,status:'HELD',reason:routing.reason};
  return {...base,status:'COMPLETED',observationsCollected:collection.observations.length,observationsInserted:persistence.insertedCount,duplicates:persistence.duplicateCount,scoresRefreshed:scoring.scoresRefreshed,romaniaTargetsRouted:routing.targetsRouted};
}
function stage(name,status,reason,count){return {name,status,reason:reason||null,count:Number(count)||0};}
