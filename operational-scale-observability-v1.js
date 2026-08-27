import {deterministicFingerprint} from './data-pipeline-core-v1.js';

const finite=value=>Number.isFinite(Number(value))?Number(value):null;

export function percentile(values=[],p=95){
  const sorted=values.map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  if(!sorted.length)return null;
  const rank=Math.min(sorted.length-1,Math.max(0,Math.ceil((Math.max(0,Math.min(100,Number(p)))/100)*sorted.length)-1));
  return sorted[rank];
}

export function summarizeLatency(samplesMs=[],options={}){
  const samples=samplesMs.map(Number).filter(Number.isFinite);
  const p95LimitMs=Math.max(1,Number(options.p95LimitMs||1000));
  const totalMs=samples.reduce((sum,x)=>sum+x,0);
  return{
    schema:'MPR_LATENCY_SUMMARY_V1',
    sampleCount:samples.length,
    minMs:samples.length?Math.min(...samples):null,
    p50Ms:percentile(samples,50),
    p95Ms:percentile(samples,95),
    p99Ms:percentile(samples,99),
    maxMs:samples.length?Math.max(...samples):null,
    meanMs:samples.length?totalMs/samples.length:null,
    p95LimitMs,
    p95Acceptable:samples.length>0&&percentile(samples,95)<=p95LimitMs
  };
}

export function evaluateQueueHealth(metrics={},options={}){
  const depth=Math.max(0,Number(metrics.depth||0));
  const oldestAgeMs=Math.max(0,Number(metrics.oldestAgeMs||0));
  const processed=Math.max(0,Number(metrics.processed||0));
  const failed=Math.max(0,Number(metrics.failed||0));
  const maxDepth=Math.max(0,Number(options.maxDepth??1000));
  const maxOldestAgeMs=Math.max(0,Number(options.maxOldestAgeMs??60000));
  const maxFailureRate=Math.max(0,Number(options.maxFailureRate??0.01));
  const failureRate=(processed+failed)>0?failed/(processed+failed):0;
  const checks={
    depthWithinLimit:depth<=maxDepth,
    oldestAgeWithinLimit:oldestAgeMs<=maxOldestAgeMs,
    failureRateWithinLimit:failureRate<=maxFailureRate
  };
  const locallyHealthy=Object.values(checks).every(Boolean);
  const productionObserved=metrics.observationMode==='PRODUCTION_OBSERVED';
  return{
    schema:'MPR_QUEUE_HEALTH_V1',depth,oldestAgeMs,processed,failed,failureRate,
    limits:{maxDepth,maxOldestAgeMs,maxFailureRate},checks,locallyHealthy,productionObserved,
    queuesStable:locallyHealthy&&productionObserved,
    decision:locallyHealthy&&productionObserved?'QUEUE_STABLE':'QUEUE_NOT_PROVEN'
  };
}

export function createRestoreManifest(canonicalBatch={}){
  const payload={
    schema:'MPR_RESTORE_MANIFEST_V1',
    batchSchema:canonicalBatch?.manifest?.schema||null,
    canonicalFingerprint:canonicalBatch?.manifest?.fingerprint||null,
    canonicalCount:Number(canonicalBatch?.manifest?.canonicalCount||0),
    canonicalKeys:[...(canonicalBatch?.manifest?.canonicalKeys||[])].sort(),
    acceptedFingerprint:deterministicFingerprint(canonicalBatch?.accepted||[])
  };
  return{...payload,restoreFingerprint:deterministicFingerprint(payload)};
}

export function verifyArtifactRestore(originalBatch={},restoredBatch={}){
  const original=createRestoreManifest(originalBatch);
  const restored=createRestoreManifest(restoredBatch);
  const verified=original.restoreFingerprint===restored.restoreFingerprint;
  return{
    schema:'MPR_ARTIFACT_RESTORE_VERIFICATION_V1',
    verified,
    originalFingerprint:original.restoreFingerprint,
    restoredFingerprint:restored.restoreFingerprint,
    scope:'ARTIFACT_ROUND_TRIP_ONLY',
    productionPersistenceVerified:false
  };
}

export function buildOperationalScaleEvidence(input={},options={}){
  const latency=summarizeLatency(input.latencySamplesMs||[],options);
  const queue=evaluateQueueHealth(input.queueMetrics||{},options);
  const artifactRestore=input.artifactRestore||{verified:false,productionPersistenceVerified:false};
  const replayDeterministic=input.replayDeterministic===true;
  const throughputEventsPerSecond=finite(input.throughputEventsPerSecond);
  const evidence={
    schema:'MPR_OPERATIONAL_SCALE_EVIDENCE_V1',
    benchmarkScope:input.benchmarkScope||'LOCAL_PROCESS_BENCHMARK',
    latency,
    queue,
    artifactRestore,
    replayDeterministic,
    throughputEventsPerSecond,
    productionClaims:{
      p95Verified:input.benchmarkScope==='PRODUCTION_OBSERVED'&&latency.p95Acceptable,
      queuesStable:queue.queuesStable,
      restoreVerified:artifactRestore.productionPersistenceVerified===true&&artifactRestore.verified===true
    }
  };
  return{...evidence,fingerprint:deterministicFingerprint(evidence)};
}
