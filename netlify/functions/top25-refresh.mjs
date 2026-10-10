// Retired: current rankings are refreshed by top25-live-refresh.
export function createTop25RefreshHandler(){return async ()=>new Response(null,{status:204});}
export default createTop25RefreshHandler();
