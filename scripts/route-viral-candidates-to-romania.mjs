import {routeViralCandidatesToRomania} from '../viral-romania-router.js';
const receipt=await routeViralCandidatesToRomania({supabaseUrl:process.env.SUPABASE_URL,serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY,approved:process.env.MPR_VIRAL_ROMANIA_ROUTING_APPROVED==='true'});console.log(JSON.stringify(receipt,null,2));
