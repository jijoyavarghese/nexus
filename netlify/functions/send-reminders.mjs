import { schedule } from '@netlify/functions';
import webpush from 'web-push';

const SUPABASE_URL='https://gkugozrvqaifnpngwkqj.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrdWdovenJ2cWFpZm5wbmd3a3FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNDI4NzIsImV4cCI6MjA5NTkxODg3Mn0.ohiU1RnPHOPsFsMNHSYN5ZKnzj42Nbur2rDyTbR-wAM';

function todayInIndia(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const value=type=>parts.find(part=>part.type===type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

async function supabaseRequest(path,options={}){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{
    ...options,
    headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`,'Content-Type':'application/json',...(options.headers||{})}
  });
  if(!response.ok) throw new Error(await response.text());
  return response.status===204?null:response.json();
}

const runReminders=async()=>{
  const publicKey=process.env.VAPID_PUBLIC_KEY;
  const privateKey=process.env.VAPID_PRIVATE_KEY;
  if(!publicKey||!privateKey) throw new Error('VAPID credentials are not configured');
  webpush.setVapidDetails('mailto:noreply@nexus.local',publicKey,privateKey);
  const today=todayInIndia();
  const tasks=await supabaseRequest(`nx_tasks?due_date=lte.${today}&status=neq.done&select=id,title,due_date`);
  if(!tasks.length) return {statusCode:200,body:'No reminders due'};
  const subscriptions=await supabaseRequest('nx_push_subscriptions?select=id,endpoint,p256dh,auth');
  const dueToday=tasks.filter(task=>task.due_date===today).length;
  const overdue=tasks.length-dueToday;
  const body=`${dueToday?`${dueToday} due today`:''}${dueToday&&overdue?' · ':''}${overdue?`${overdue} overdue`:''}`;
  await Promise.all(subscriptions.map(async subscription=>{
    try{
      await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},JSON.stringify({title:'Nexus reminder',body,url:'/'}));
    }catch(error){
      if(error.statusCode===404||error.statusCode===410) await supabaseRequest(`nx_push_subscriptions?id=eq.${encodeURIComponent(subscription.id)}`,{method:'DELETE'});
      else console.error('Push delivery failed',error);
    }
  }));
  return {statusCode:200,body:`Sent reminders to ${subscriptions.length} device(s)`};
};

export const handler=schedule('30 3 * * *',runReminders);
