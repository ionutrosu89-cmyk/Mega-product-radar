export function createTop25HistoryHandler(){return async ()=>Response.json({ok:false,code:'HISTORICAL_TOP25_RETIRED'},{status:410,headers:{'Cache-Control':'no-store'}});}
export default createTop25HistoryHandler();
export const config={path:'/api/top25/history',method:'GET'};
