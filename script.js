// MiCine conectado a Supabase
const SUPABASE_URL = "https://akpsjzcuimlwvehbammq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_23vVIVgRZbhBHm2xCbcczg_Zdg12tMn";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = id => document.getElementById(id);
let peliculas = [];
let usuario = null;

function esc(s){
  return String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

function mensaje(id, texto, error=false){
  const el=$(id);
  el.textContent=texto||"";
  el.className="mensaje"+(error?" error":"");
}

async function cargarPeliculas(){
  $("estado").textContent="Cargando catálogo...";
  const {data,error}=await db.from("peliculas").select("id,created_at,titulo,año,genero,portada,url").order("created_at",{ascending:false});
  if(error){
    console.error(error);
    $("estado").textContent="No se pudo cargar el catálogo.";
    return;
  }
  peliculas=data||[];
  render();
}

function render(){
  const q=$("buscar").value.toLowerCase().trim();
  const lista=peliculas.filter(m=>String(m.titulo||"").toLowerCase().includes(q));
  $("estado").textContent=lista.length?"":"No hay películas para mostrar.";
  $("grid").innerHTML=lista.map(m=>`
    <article class="card" onclick="abrir(${Number(m.id)})">
      ${usuario?`<button class="delete" onclick="event.stopPropagation();eliminar(${Number(m.id)})">Eliminar</button>`:""}
      <img class="poster" src="${esc(m.portada)}" alt="${esc(m.titulo)}">
      <div class="info">
        <h3>${esc(m.titulo)}</h3>
        <div class="meta">${esc(m.año)} · ${esc(m.genero)}</div>
      </div>
    </article>`).join("");
}

function mostrarAdmin(){
  const loginBox = $("loginBox");
  const adminPanel = $("adminPanel");
  const adminSection = $("admin");

  // Mostrar SOLO una de las dos vistas: login o panel de administrador.
  if(usuario){
    loginBox.hidden = true;
    loginBox.classList.add("hidden");
    adminPanel.hidden = false;
    adminPanel.classList.remove("hidden");
  }else{
    loginBox.hidden = false;
    loginBox.classList.remove("hidden");
    adminPanel.hidden = true;
    adminPanel.classList.add("hidden");
  }
  render();
}

function abrirAdministracion(e){
  if(e) e.preventDefault();
  const adminSection=$("admin");
  adminSection.classList.remove("hidden");
  mostrarAdmin();
  history.replaceState(null,"", "#admin");
  adminSection.scrollIntoView({behavior:"smooth",block:"start"});
  setTimeout(()=>{
    if(!usuario) $("loginEmail").focus();
  },250);
}

async function iniciarSesion(){
  const email=$("loginEmail").value.trim();
  const password=$("loginPassword").value;
  if(!email||!password){
    mensaje("loginMsg","Escribe correo y contraseña.",true);
    return;
  }
  $("loginBtn").disabled=true;
  mensaje("loginMsg","Iniciando sesión...");
  const {data,error}=await db.auth.signInWithPassword({email,password});
  $("loginBtn").disabled=false;
  if(error){
    mensaje("loginMsg","Correo o contraseña incorrectos.",true);
    return;
  }
  usuario=data.user;
  $("loginPassword").value="";
  mensaje("loginMsg","");
  mostrarAdmin();
  abrirAdministracion();
}

async function cerrarSesion(){
  await db.auth.signOut();
  usuario=null;
  mostrarAdmin();
}

function nombreArchivoSeguro(nombre){
  const base=nombre.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-+|-+$/g,"");
  return base||"poster";
}

async function agregarPelicula(){
  if(!usuario){
    mensaje("adminMsg","Debes iniciar sesión.",true);
    return;
  }
  const titulo=$("titulo").value.trim();
  const anio=Number($("anio").value)||null;
  const genero=$("genero").value.trim()||"Sin género";
  const url=$("url").value.trim();
  const file=$("portada").files[0];

  if(!titulo||!url||!file){
    mensaje("adminMsg","Completa título, portada y Direct Link (streaming).",true);
    return;
  }
  if(!/^https?:\/\//i.test(url)){
    mensaje("adminMsg","El enlace de streaming no parece una URL válida.",true);
    return;
  }
  if(!file.type.startsWith("image/")){
    mensaje("adminMsg","La portada debe ser una imagen.",true);
    return;
  }

  const btn=$("agregar");
  btn.disabled=true;
  mensaje("adminMsg","Subiendo portada y guardando película...");

  const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
  const path=`${crypto.randomUUID()}-${nombreArchivoSeguro(file.name)}.${ext}`;

  const upload=await db.storage.from("posters").upload(path,file,{cacheControl:"3600",upsert:false});
  if(upload.error){
    console.error(upload.error);
    btn.disabled=false;
    mensaje("adminMsg","No se pudo subir la portada: "+upload.error.message,true);
    return;
  }

  const {data:publicData}=db.storage.from("posters").getPublicUrl(path);
  const portada=publicData.publicUrl;

  const {error}=await db.from("peliculas").insert({
    titulo,
    "año":anio,
    genero,
    portada,
    url
  });

  if(error){
    await db.storage.from("posters").remove([path]);
    console.error(error);
    btn.disabled=false;
    mensaje("adminMsg","No se pudo guardar la película: "+error.message,true);
    return;
  }

  $("titulo").value="";
  $("anio").value="2026";
  $("genero").value="";
  $("portada").value="";
  $("url").value="";
  btn.disabled=false;
  mensaje("adminMsg","Película agregada correctamente. 🎬");
  await cargarPeliculas();
}

async function eliminar(id){
  if(!usuario)return;
  const pelicula=peliculas.find(m=>Number(m.id)===Number(id));
  if(!pelicula)return;
  if(!confirm(`¿Eliminar "${pelicula.titulo}"?`))return;

  const {error}=await db.from("peliculas").delete().eq("id",id);
  if(error){
    alert("No se pudo eliminar la película: "+error.message);
    return;
  }

  // Intentar borrar también la portada de Storage.
  try{
    const marker="/storage/v1/object/public/posters/";
    const pos=String(pelicula.portada||"").indexOf(marker);
    if(pos>=0){
      const path=decodeURIComponent(String(pelicula.portada).slice(pos+marker.length));
      if(path) await db.storage.from("posters").remove([path]);
    }
  }catch(e){ console.warn("No se pudo limpiar la portada:",e); }

  await cargarPeliculas();
}

function abrir(id){
  const m=peliculas.find(x=>Number(x.id)===Number(id));
  if(!m)return;
  $("ptitulo").textContent=m.titulo;
  $("player").src=m.url;
  $("modal").classList.add("open");
  $("player").play().catch(()=>{});
}

function cerrar(){
  $("player").pause();
  $("player").removeAttribute("src");
  $("player").load();
  $("modal").classList.remove("open");
}

$("buscar").oninput=render;
$("adminLink").onclick=abrirAdministracion;
document.querySelector('a[href="#catalogo"]').onclick=()=>{ $("admin").classList.add("hidden"); };
$("loginBtn").onclick=iniciarSesion;
$("logoutBtn").onclick=cerrarSesion;
$("agregar").onclick=agregarPelicula;
$("cerrar").onclick=cerrar;
$("modal").onclick=e=>{if(e.target===$("modal"))cerrar()};
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&$("modal").classList.contains("open"))cerrar();
  if(e.key==="Enter"&&document.activeElement===$("loginPassword"))iniciarSesion();
});

db.auth.getSession().then(({data})=>{
  usuario=data.session?.user||null;
  mostrarAdmin();
  cargarPeliculas();
});

db.auth.onAuthStateChange((_event,session)=>{
  usuario=session?.user||null;
  mostrarAdmin();
});
