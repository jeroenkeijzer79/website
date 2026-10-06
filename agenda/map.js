const LEAFLET_CSS="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
let leafletPromise;

function loadLeaflet(){
  if(window.L) return Promise.resolve(window.L);
  if(leafletPromise) return leafletPromise;
  leafletPromise=new Promise((resolve,reject)=>{
    if(!document.querySelector('link[data-agenda-leaflet]')){
      const link=document.createElement("link");
      link.rel="stylesheet"; link.href=LEAFLET_CSS; link.dataset.agendaLeaflet="1";
      document.head.appendChild(link);
    }
    const script=document.createElement("script");
    script.src=LEAFLET_JS; script.onload=()=>resolve(window.L); script.onerror=reject;
    document.head.appendChild(script);
  });
  return leafletPromise;
}

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function geocode(address){
  const key="agenda-geocode:"+address.toLowerCase().trim();
  try{const cached=JSON.parse(localStorage.getItem(key)||"null");if(cached)return cached}catch{}
  const url="https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=nl&q="+encodeURIComponent(address);
  const response=await fetch(url,{headers:{Accept:"application/json"}});
  if(response.status===429){
    await sleep(2500);
    const retry=await fetch(url,{headers:{Accept:"application/json"}});
    if(!retry.ok)throw new Error("Geocoding mislukt");
    const data=await retry.json();
    if(!data.length)return null;
    const result={lat:Number(data[0].lat),lon:Number(data[0].lon),display:data[0].display_name};
    try{localStorage.setItem(key,JSON.stringify(result))}catch{}
    return result;
  }
  if(!response.ok)throw new Error("Geocoding mislukt");
  const data=await response.json();
  if(!data.length)return null;
  const result={lat:Number(data[0].lat),lon:Number(data[0].lon),display:data[0].display_name};
  try{localStorage.setItem(key,JSON.stringify(result))}catch{}
  return result;
}

async function geocodeEvent(event){
  const candidates=[];
  const add=value=>{
    const address=String(value||"").trim();
    if(address && !candidates.includes(address))candidates.push(address);
  };

  // Probeer eerst de specifieke locatie in combinatie met de plaats.
  if(event.location && event.place)add(event.location+", "+event.place+", Nederland");
  // Daarna alleen de locatie.
  add(event.location ? event.location+", Nederland" : "");
  // Als fallback altijd de plaats gebruiken.
  add(event.place ? event.place+", Nederland" : "");
  // Laatste fallback zonder "Nederland", voor plaatsnamen die anders niet goed worden herkend.
  add(event.place);

  for(let i=0;i<candidates.length;i++){
    const result=await geocode(candidates[i]);
    if(result)return result;
    if(i<candidates.length-1)await sleep(1200);
  }
  return null;
}

export async function showAgendaMap(container,events){
  container.innerHTML='<div class="agenda-map-loading">Locaties worden opgezocht…</div>';
  const L=await loadLeaflet();
  const map=L.map(container,{scrollWheelZoom:false,attributionControl:false}).setView([52.1,5.3],7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
    maxZoom:19,attribution:'&copy; OpenStreetMap-bijdragers'
  }).addTo(map);

  const bounds=[];
  const unique=[...new Map(events.filter(e=>e.location||e.place).map(e=>{
    const address=[e.location,e.place,"Nederland"].filter(Boolean).join(", ");
    return [address,e];
  })).entries()];

  for(let i=0;i<unique.length;i++){
    const [address,e]=unique[i];
    try{
      const p=await geocodeEvent(e);

      if(p){
        const marker=L.marker([p.lat,p.lon]).addTo(map);
        const title=String(e.name||"Optreden");
        const place=[e.location,e.place].filter(Boolean).join(" · ");
        marker.bindPopup("<strong>"+escMap(title)+"</strong><br>"+escMap(place)+(e.date?"<br>"+escMap(formatMapDate(e.date)):""));
        bounds.push([p.lat,p.lon]);
      }else{
        console.warn("Kaartlocatie kon niet worden gevonden:",address,e.place||"");
      }
    }catch(err){
      console.warn("Kaartlocatie kon niet worden gevonden:",address,err);
    }
    if(i<unique.length-1)await sleep(1200);
  }

  if(bounds.length)map.fitBounds(bounds,{padding:[30,30],maxZoom:14});
  else map.setView([52.1,5.3],7);
  setTimeout(()=>map.invalidateSize(),100);
}

function escMap(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function formatMapDate(v){const d=new Date(v+"T12:00:00");return d.toLocaleDateString("nl-NL",{day:"numeric",month:"long",year:"numeric"})}
