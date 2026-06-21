import { buildPushHTTPRequest } from '@pushforge/builder';

function todayInIndia(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const value=type=>parts.find(part=>part.type===type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

async function supabaseRequest(path,env,options={}){
  const response=await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`,{
    ...options,
    headers:{apikey:env.SUPABASE_ANON_KEY,Authorization:`Bearer ${env.SUPABASE_ANON_KEY}`,'Content-Type':'application/json',...(options.headers||{})}
  });
  const body=await response.text();
  if(!response.ok) throw new Error(body);
  return body?JSON.parse(body):null;
}

async function getSubscriptions(env){
  return supabaseRequest('nx_push_subscriptions?select=id,endpoint,p256dh,auth',env);
}

async function sendPush(subscription,env,payload){
  try{
    const request=await buildPushHTTPRequest({
      privateJWK:env.VAPID_PRIVATE_JWK,
      subscription:{endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},
      message:{payload,adminContact:'mailto:jijoyavarghese@gmail.com',options:{urgency:'high'}}
    });
    const response=await fetch(request.endpoint,{method:'POST',headers:request.headers,body:request.body});
    if(!response.ok){
      const error=new Error(`Push service returned ${response.status}`);
      error.statusCode=response.status;
      throw error;
    }
  }catch(error){
    if(error.statusCode===404||error.statusCode===410) await supabaseRequest(`nx_push_subscriptions?id=eq.${encodeURIComponent(subscription.id)}`,env,{method:'DELETE'});
    else throw error;
  }
}

async function sendToAll(subscriptions,env,payload){
  await Promise.all(subscriptions.map(subscription=>sendPush(subscription,env,payload)));
}

async function sendTimedReminders(env){
  const now=new Date().toISOString();
  const tasks=await supabaseRequest(`nx_tasks?reminder_at=lte.${encodeURIComponent(now)}&reminder_sent_at=is.null&status=neq.done&select=id,title,reminder_at`,env);
  if(!tasks.length) return;
  const subscriptions=await getSubscriptions(env);
  for(const task of tasks){
    await sendToAll(subscriptions,env,{title:'Nexus task reminder',body:task.title,url:'/'});
    await supabaseRequest(`nx_tasks?id=eq.${encodeURIComponent(task.id)}`,env,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({reminder_sent_at:now})});
  }
}

async function sendDailySummary(env){
  const today=todayInIndia();
  const tasks=await supabaseRequest(`nx_tasks?due_date=lte.${today}&status=neq.done&select=id,due_date`,env);
  if(!tasks.length) return;
  const dueToday=tasks.filter(task=>task.due_date===today).length;
  const overdue=tasks.length-dueToday;
  const body=`${dueToday?`${dueToday} due today`:''}${dueToday&&overdue?' · ':''}${overdue?`${overdue} overdue`:''}`;
  await sendToAll(await getSubscriptions(env),env,{title:'Nexus reminder',body,url:'/'});
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==='/api/test-reminder'&&request.method==='POST'){
      const {endpoint}=await request.json();
      if(!endpoint) return Response.json({error:'Missing endpoint'},{status:400});
      const subscriptions=await supabaseRequest(`nx_push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}&select=id,endpoint,p256dh,auth`,env);
      if(!subscriptions.length) return Response.json({error:'Subscription not found'},{status:404});
      await sendPush(subscriptions[0],env,{title:'Nexus reminders enabled',body:'This device is ready to receive task reminders.',url:'/'});
      return Response.json({sent:true});
    }
    return env.ASSETS.fetch(request);
  },
  async scheduled(controller,env,ctx){
    ctx.waitUntil(controller.cron==='30 3 * * *'?sendDailySummary(env):sendTimedReminders(env));
  }
};
