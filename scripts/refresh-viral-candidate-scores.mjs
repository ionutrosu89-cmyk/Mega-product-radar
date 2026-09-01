import {refreshViralScores} from '../viral-score-refresh.js';
const receipt=await refreshViralScores({supabaseUrl:process.env.SUPABASE_URL,serviceRoleKey:process.env.SUPABASE_SERVICE_ROLE_KEY,approved:process.env.MPR_VIRAL_SCORE_REFRESH_APPROVED==='true'});console.log(JSON.stringify(receipt,null,2));
