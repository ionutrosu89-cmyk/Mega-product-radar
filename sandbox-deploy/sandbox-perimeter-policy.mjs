const ROUTES=new Map([
 ['/api/billing/webhook',new Set(['POST'])],
 ['/api/internal/billing-readiness',new Set(['GET'])],
 ['/api/internal/paid-beta-runtime-readiness',new Set(['GET'])],
 ['/api/internal/legal-readiness',new Set(['GET'])],
 ['/api/internal/sandbox-preflight-readiness',new Set(['GET'])],
 ['/api/internal/billing-e2e-acceptance',new Set(['GET','POST'])],
 ['/api/internal/billing-e2e-sandbox-transition',new Set(['POST'])]
]);
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
const denied=(code,status)=>Response.json({ok:false,code},{status,headers});
export function sandboxPerimeterDecision(request,env={}){
 if(env.MPR_SANDBOX_ISOLATION!=='true')return denied('SANDBOX_ISOLATION_REQUIRED',503);
 let url;try{url=new URL(request.url)}catch{return denied('INVALID_URL',400)}
 if(!env.MPR_SANDBOX_HOST||url.protocol!=='https:'||url.hostname!==env.MPR_SANDBOX_HOST)return denied('SANDBOX_HOST_MISMATCH',403);
 const methods=ROUTES.get(url.pathname);
 if(!methods)return denied('SANDBOX_ROUTE_DENIED',403);
 if(!methods.has(request.method))return denied('SANDBOX_METHOD_DENIED',405);
 if(url.pathname==='/api/billing/webhook'){
   if(!request.headers.get('stripe-signature'))return denied('STRIPE_SIGNATURE_REQUIRED',400);
 }else if(!/^Bearer \S+$/i.test(request.headers.get('authorization')||'')){
   return denied('READINESS_AUTH_REQUIRED',401);
 }
 // This only admits the request to its handler. Signature/OIDC verification and
 // workspace authorization remain mandatory in the handler before any write.
 return null;
}
