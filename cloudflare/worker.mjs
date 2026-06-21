import webpush from 'web-push';

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

async function sendReminders(env){
  if(!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_KEY) throw new Error('VAPID credentials are not configured');
  webpush.setVapidDetails('mailto:noreply@nexus.local',env.VAPID_PUBLIC_KEY,env.VAPID_PRIVATE_KEY);
  const today=todayInIndia();
  const tasks=await supabaseRequest(`nx_tasks?due_date=lte.${today}&status=neq.done&select=id,due_date`,env);
  if(!tasks.length) return;
  const subscriptions=await supabaseRequest('nx_push_subscriptions?select=id,endpoint,p256dh,auth',env);
  const dueToday=tasks.filter(task=>task.due_date===today).length;
  const overdue=tasks.length-dueToday;
  const body=`${dueToday?`${dueToday} due today`:''}${dueToday&&overdue?' · ':''}${overdue?`${overdue} overdue`:''}`;
  await Promise.all(subscriptions.map(subscription=>sendPush(subscription,env,{title:'Nexus reminder',body,url:'/'})));
}

async function sendPush(subscription,env,payload){
  webpush.setVapidDetails('mailto:noreply@nexus.local',env.VAPID_PUBLIC_KEY,env.VAPID_PRIVATE_KEY);
  try{
    await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},JSON.stringify(payload));
  }catch(error){
    if(error.statusCode===404||error.statusCode===410) await supabaseRequest(`nx_push_subscriptions?id=eq.${encodeURIComponent(subscription.id)}`,env,{method:'DELETE'});
    else throw error;
  }
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
    ctx.waitUntil(sendReminders(env));
  }
};
