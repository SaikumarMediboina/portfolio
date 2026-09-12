self.addEventListener("notificationclick", event => {
 event.notification.close();
 event.waitUntil((async()=>{const url=new URL("/expenses?add=1",self.location.origin).href;const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});for(const client of windows){if(new URL(client.url).origin===self.location.origin&&new URL(client.url).pathname==="/expenses"){await client.navigate(url);return client.focus();}}return self.clients.openWindow(url);})());
});
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");
const config=JSON.parse(new URL(self.location.href).searchParams.get("config")||"{}");
firebase.initializeApp(config);
firebase.messaging().onBackgroundMessage(payload=>self.registration.showNotification(payload.data?.title||"Expense reminder",{body:payload.data?.body||"Take a minute to add today’s expenses.",icon:"/profile-avatar.png",tag:"expense-daily-reminder",data:{url:"/expenses?add=1"}}));
