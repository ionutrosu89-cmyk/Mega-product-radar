export default async () => Response.json({
  ok:true,
  service:'mega-product-radar',
  mode:'PUBLIC_FREE_BETA',
  liveness:'UP',
  now:new Date().toISOString()
},{
  status:200,
  headers:{
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff'
  }
});

export const config={
  path:'/api/radar/health',
  method:'GET'
};
