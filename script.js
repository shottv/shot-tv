// Shot TV conectado a Supabase
const SUPABASE_URL = "https://akpsjzcuimlwvehbammq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_23vVIVgRZbhBHm2xCbcczg_Zdg12tMn";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = id => document.getElementById(id);
let peliculas = [];
let usuario = null;
let peliculaEditando = null;

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
  const {data,error}=await db.from("peliculas").select("id,created_at,titulo,año,genero,portada,url,orden").order("orden",{ascending:true,nullsFirst:false}).order("created_at",{ascending:true});
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
      ${usuario?`<div class="card-actions" onclick="event.stopPropagation();">
        <button class="move" onclick="moverPelicula(${Number(m.id)}, -1)" title="Subir">⬆️</button>
        <button class="move" onclick="moverPelicula(${Number(m.id)}, 1)" title="Bajar">⬇️</button>
        <button class="edit" onclick="editar(${Number(m.id)})">Editar</button>
        <button class="delete" onclick="eliminar(${Number(m.id)})">Eliminar</button>
      </div>`:""}
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
  if(usuario){ cargarPublicidadAdmin(); cargarNegociosAdmin(); }
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

  const ponerPrimero = $("ponerPrimero").checked;

  // Si se coloca al principio, usamos un orden menor que el actual.
  // Así no tenemos que actualizar todas las películas existentes.
  const ordenNumerico = peliculas
    .map(m => Number(m.orden))
    .filter(n => Number.isFinite(n));
  const minOrden = ordenNumerico.length ? Math.min(...ordenNumerico) : 1;
  const maxOrden = ordenNumerico.length ? Math.max(...ordenNumerico) : 0;
  const nuevoOrden = ponerPrimero ? minOrden - 1 : maxOrden + 1;

  const {error}=await db.from("peliculas").insert({
    titulo,
    "año":anio,
    genero,
    portada,
    url,
    orden:nuevoOrden
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
  $("ponerPrimero").checked=true;
  btn.disabled=false;
  mensaje("adminMsg","Película agregada correctamente. 🎬");
  await cargarPeliculas();
}

async function moverPelicula(id, direccion){
  if(!usuario)return;
  const ordenadas=[...peliculas].sort((a,b)=>{
    const ao=Number(a.orden)||999999999;
    const bo=Number(b.orden)||999999999;
    return ao-bo;
  });
  const indice=ordenadas.findIndex(m=>Number(m.id)===Number(id));
  if(indice<0)return;
  const nuevoIndice=indice+direccion;
  if(nuevoIndice<0 || nuevoIndice>=ordenadas.length)return;
  const actual=ordenadas[indice];
  const vecino=ordenadas[nuevoIndice];
  const ordenActual=Number(actual.orden);
  const ordenVecino=Number(vecino.orden);
  if(!Number.isFinite(ordenActual)||!Number.isFinite(ordenVecino))return;

  const {error:tempError}=await db.from("peliculas").update({orden:-Number(actual.id)}).eq("id",actual.id);
  if(tempError){alert("No se pudo mover la película: "+tempError.message);return;}
  const {error:vecinoError}=await db.from("peliculas").update({orden:ordenActual}).eq("id",vecino.id);
  if(vecinoError){await db.from("peliculas").update({orden:ordenActual}).eq("id",actual.id);alert("No se pudo mover la película: "+vecinoError.message);return;}
  const {error:finalError}=await db.from("peliculas").update({orden:ordenVecino}).eq("id",actual.id);
  if(finalError){alert("No se pudo completar el movimiento: "+finalError.message);return;}
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


function cerrarEdicion(){
  peliculaEditando=null;
  $("editModal").classList.remove("open");
  $("editPortada").value="";
  mensaje("editMsg","");
}

function editar(id){
  if(!usuario)return;
  const m=peliculas.find(x=>Number(x.id)===Number(id));
  if(!m)return;
  peliculaEditando=m;
  $("editTitulo").value=m.titulo||"";
  $("editAnio").value=m.año||"";
  $("editGenero").value=m.genero||"";
  $("editUrl").value=m.url||"";
  $("editPortada").value="";
  mensaje("editMsg","");
  $("editModal").classList.add("open");
}

async function guardarEdicion(){
  if(!usuario||!peliculaEditando)return;
  const titulo=$("editTitulo").value.trim();
  const anio=Number($("editAnio").value)||null;
  const genero=$("editGenero").value.trim()||"Sin género";
  const url=$("editUrl").value.trim();
  const file=$("editPortada").files[0];
  if(!titulo||!url){
    mensaje("editMsg","Completa título y Direct Link (streaming).",true);
    return;
  }
  if(!/^https?:\/\//i.test(url)){
    mensaje("editMsg","El enlace de streaming no parece una URL válida.",true);
    return;
  }
  const btn=$("guardarEdicion");
  btn.disabled=true;
  mensaje("editMsg","Guardando cambios...");
  let nuevaPortada=peliculaEditando.portada;
  let nuevoPath=null;
  if(file){
    if(!file.type.startsWith("image/")){
      btn.disabled=false;
      mensaje("editMsg","La portada debe ser una imagen.",true);
      return;
    }
    const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
    nuevoPath=`${crypto.randomUUID()}-${nombreArchivoSeguro(file.name)}.${ext}`;
    const upload=await db.storage.from("posters").upload(nuevoPath,file,{cacheControl:"3600",upsert:false});
    if(upload.error){
      console.error(upload.error);
      btn.disabled=false;
      mensaje("editMsg","No se pudo subir la nueva portada: "+upload.error.message,true);
      return;
    }
    nuevaPortada=db.storage.from("posters").getPublicUrl(nuevoPath).data.publicUrl;
  }

  const {error}=await db.from("peliculas").update({titulo,"año":anio,genero,url,portada:nuevaPortada}).eq("id",peliculaEditando.id);
  if(error){
    if(nuevoPath) await db.storage.from("posters").remove([nuevoPath]);
    console.error(error);
    btn.disabled=false;
    mensaje("editMsg","No se pudieron guardar los cambios: "+error.message,true);
    return;
  }

  if(file && peliculaEditando.portada){
    try{
      const marker="/storage/v1/object/public/posters/";
      const pos=String(peliculaEditando.portada).indexOf(marker);
      if(pos>=0){
        const oldPath=decodeURIComponent(String(peliculaEditando.portada).slice(pos+marker.length));
        if(oldPath) await db.storage.from("posters").remove([oldPath]);
      }
    }catch(e){ console.warn("No se pudo limpiar la portada anterior:",e); }
  }
  btn.disabled=false;
  cerrarEdicion();
  await cargarPeliculas();
}

async function cargarPublicidad(){
  const banner=$("adBanner");
  const {data,error}=await db.from("ads").select("id,imagen,enlace,activo,created_at").eq("activo",true).order("created_at",{ascending:false}).limit(1);
  if(error){
    console.warn("No se pudo cargar publicidad:",error);
    banner.innerHTML="<span>PUBLICIDAD</span>"; banner.onclick=null; banner.style.cursor="default"; return;
  }
  const ad=data?.[0];
  if(!ad){ banner.innerHTML="<span>PUBLICIDAD</span>"; banner.onclick=null; banner.style.cursor="default"; return; }
  banner.innerHTML=`<img src="${esc(ad.imagen)}" alt="Publicidad">`;
  banner.style.cursor=ad.enlace?"pointer":"default";
  banner.onclick=()=>{ if(ad.enlace) window.open(ad.enlace,"_blank","noopener,noreferrer"); };
}

async function cargarPublicidadAdmin(){
  if(!usuario)return;
  const {data,error}=await db.from("ads").select("id,imagen,enlace,activo,created_at").order("created_at",{ascending:false}).limit(1);
  const box=$("adActual");
  if(error){ box.textContent="No se pudo consultar la publicidad."; return; }
  const ad=data?.[0];
  if(!ad){ box.innerHTML='<span class="ad-empty">No hay publicidad configurada.</span>'; return; }
  $("adLink").value=ad.enlace||""; $("adActivo").checked=!!ad.activo;
  box.innerHTML=`<div class="ad-preview"><div><strong>Publicidad actual</strong><span>${ad.activo?"ACTIVA":"INACTIVA"}</span></div><img src="${esc(ad.imagen)}" alt="Publicidad actual"><button id="eliminarAd" class="delete-ad">ELIMINAR PUBLICIDAD</button></div>`;
  $("eliminarAd").onclick=()=>eliminarPublicidad(ad);
}

function nombreArchivoAd(nombre){
  return nombre.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-+|-+$/g,"")||"banner";
}

async function guardarPublicidad(){
  if(!usuario){mensaje("adAdminMsg","Debes iniciar sesión.",true);return;}
  const file=$("adFile").files[0], enlace=$("adLink").value.trim(), activo=$("adActivo").checked;
  if(!file){mensaje("adAdminMsg","Selecciona una imagen para el banner.",true);return;}
  if(!file.type.startsWith("image/")){mensaje("adAdminMsg","El banner debe ser una imagen.",true);return;}
  if(enlace && !/^https?:\/\//i.test(enlace)){mensaje("adAdminMsg","El enlace debe comenzar con http:// o https://.",true);return;}
  const btn=$("guardarAd"); btn.disabled=true; mensaje("adAdminMsg","Subiendo banner...");
  const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
  const path=`${crypto.randomUUID()}-${nombreArchivoAd(file.name)}.${ext}`;
  const upload=await db.storage.from("ads").upload(path,file,{cacheControl:"3600",upsert:false});
  if(upload.error){btn.disabled=false;mensaje("adAdminMsg","No se pudo subir el banner: "+upload.error.message,true);return;}
  const imagen=db.storage.from("ads").getPublicUrl(path).data.publicUrl;
  if(activo){
    const {error:offError}=await db.from("ads").update({activo:false}).eq("activo",true);
    if(offError){await db.storage.from("ads").remove([path]);btn.disabled=false;mensaje("adAdminMsg","No se pudo activar el nuevo anuncio: "+offError.message,true);return;}
  }
  const {error}=await db.from("ads").insert({imagen,enlace,activo});
  if(error){await db.storage.from("ads").remove([path]);btn.disabled=false;mensaje("adAdminMsg","No se pudo guardar la publicidad: "+error.message,true);return;}
  $("adFile").value=""; btn.disabled=false; mensaje("adAdminMsg","Publicidad guardada correctamente. 📢");
  await cargarPublicidad(); await cargarPublicidadAdmin();
}

async function eliminarPublicidad(ad){
  if(!usuario || !confirm("¿Eliminar la publicidad actual?"))return;
  const {error}=await db.from("ads").delete().eq("id",ad.id);
  if(error){alert("No se pudo eliminar la publicidad: "+error.message);return;}
  try{
    const marker="/storage/v1/object/public/ads/", pos=String(ad.imagen||"").indexOf(marker);
    if(pos>=0){const path=decodeURIComponent(String(ad.imagen).slice(pos+marker.length));if(path) await db.storage.from("ads").remove([path]);}
  }catch(e){console.warn("No se pudo limpiar el banner:",e);}
  $("adLink").value=""; $("adActivo").checked=true; mensaje("adAdminMsg","Publicidad eliminada.");
  await cargarPublicidad(); await cargarPublicidadAdmin();
}


// =========================
// NEGOCIOS
// =========================
let negocios = [];
let negocioEditando = null;

function urlValida(valor){
  return !valor || /^https?:\/\/\S+$/i.test(valor);
}

function telefonoHref(valor){
  return String(valor || "").replace(/[^\d+]/g, "");
}

function whatsappHref(valor){
  const limpio = String(valor || "").replace(/\D/g, "");
  if(!limpio) return "";
  return limpio.length === 10 ? `https://wa.me/52${limpio}` : `https://wa.me/${limpio}`;
}

function nombreArchivoNegocio(nombre){
  return nombre.normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9._-]+/g,"-")
    .replace(/^-+|-+$/g,"") || "negocio";
}

async function cargarNegocios(){
  const {data,error}=await db.from("negocios")
    .select("id,created_at,nombre,categoria,descripcion,imagen,direccion,telefono,whatsapp,horario,facebook,instagram,sitio_web,mapa,activo,destacado")
    .eq("activo",true)
    .order("destacado",{ascending:false})
    .order("created_at",{ascending:false});

  if(error){
    console.error("Error cargando negocios:", error);
    $("negociosEstado").textContent="No se pudieron cargar los negocios.";
    return;
  }
  negocios=data||[];
  renderNegocios();
}

function renderNegocios(){
  const q=($("buscarNegocio")?.value||"").toLowerCase().trim();
  const cat=$("filtroCategoria")?.value||"";
  const lista=negocios.filter(n=>{
    const texto=[n.nombre,n.categoria,n.descripcion,n.direccion].join(" ").toLowerCase();
    return (!q || texto.includes(q)) && (!cat || n.categoria===cat);
  });

  $("negociosEstado").textContent=lista.length
    ? `${lista.length} negocio${lista.length===1?"":"s"} encontrado${lista.length===1?"":"s"}.`
    : "No hay negocios para mostrar.";

  $("negociosGrid").innerHTML=lista.map(n=>{
    const wa=whatsappHref(n.whatsapp);
    const tel=telefonoHref(n.telefono);
    return `
      <article class="business-card ${n.destacado?"business-featured":""}">
        ${n.destacado?'<div class="business-badge">⭐ DESTACADO</div>':""}
        ${n.imagen?`<img src="${esc(n.imagen)}" alt="${esc(n.nombre)}" class="business-img">`:`<div class="business-img business-noimg">🏪</div>`}
        <div class="business-info">
          <div class="business-category">${esc(n.categoria)}</div>
          <h3>${esc(n.nombre)}</h3>
          ${n.descripcion?`<p>${esc(n.descripcion)}</p>`:""}
          ${n.direccion?`<div class="business-line">📍 ${esc(n.direccion)}</div>`:""}
          ${n.horario?`<div class="business-line">🕐 ${esc(n.horario)}</div>`:""}
          <div class="business-actions">
            ${wa?`<a class="business-btn whatsapp" href="${wa}" target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>`:""}
            ${tel?`<a class="business-btn" href="tel:${esc(tel)}">📞 Llamar</a>`:""}
            ${n.mapa?`<a class="business-btn" href="${esc(n.mapa)}" target="_blank" rel="noopener noreferrer">📍 Cómo llegar</a>`:""}
          </div>
          <div class="business-social">
            ${n.facebook?`<a href="${esc(n.facebook)}" target="_blank" rel="noopener noreferrer">Facebook</a>`:""}
            ${n.instagram?`<a href="${esc(n.instagram)}" target="_blank" rel="noopener noreferrer">Instagram</a>`:""}
            ${n.sitio_web?`<a href="${esc(n.sitio_web)}" target="_blank" rel="noopener noreferrer">Sitio web</a>`:""}
          </div>
        </div>
      </article>`;
  }).join("");
}

function limpiarFormularioNegocio(){
  negocioEditando=null;
  $("negNombre").value="";
  $("negCategoria").value="Comida";
  $("negImagen").value="";
  $("negDescripcion").value="";
  $("negDireccion").value="";
  $("negTelefono").value="";
  $("negWhatsapp").value="";
  $("negHorario").value="";
  $("negFacebook").value="";
  $("negInstagram").value="";
  $("negWeb").value="";
  $("negMapa").value="";
  $("negActivo").checked=true;
  $("negDestacado").checked=false;
  $("guardarNegocio").textContent="AGREGAR NEGOCIO";
  $("cancelarNegocio").classList.add("hidden");
}

async function cargarNegociosAdmin(){
  if(!usuario)return;
  const {data,error}=await db.from("negocios")
    .select("id,created_at,nombre,categoria,descripcion,imagen,direccion,telefono,whatsapp,horario,facebook,instagram,sitio_web,mapa,activo,destacado")
    .order("created_at",{ascending:false});

  if(error){
    console.error("Error cargando negocios para admin:",error);
    mensaje("negocioAdminMsg","No se pudieron consultar los negocios: "+error.message,true);
    return;
  }

  const lista=data||[];
  $("negociosAdminLista").innerHTML=lista.length ? lista.map(n=>`
    <div class="business-admin-row">
      ${n.imagen?`<img src="${esc(n.imagen)}" alt="">`:`<div class="business-admin-noimg">🏪</div>`}
      <div class="business-admin-data">
        <strong>${esc(n.nombre)}</strong>
        <span>${esc(n.categoria)} · ${n.activo?"ACTIVO":"INACTIVO"}${n.destacado?" · ⭐ DESTACADO":""}</span>
      </div>
      <div class="business-admin-actions">
        <button class="edit" onclick="editarNegocio(${Number(n.id)})">Editar</button>
        <button class="delete" onclick="eliminarNegocio(${Number(n.id)})">Eliminar</button>
      </div>
    </div>`).join("") : '<div class="ad-empty">No hay negocios registrados.</div>';
}

function editarNegocio(id){
  if(!usuario)return;
  const {data}= {data: null};
  // Se consulta por id para no depender de la lista pública de activos.
  db.from("negocios").select("*").eq("id",id).single().then(({data,error})=>{
    if(error){mensaje("negocioAdminMsg","No se pudo abrir el negocio: "+error.message,true);return;}
    negocioEditando=data;
    $("negNombre").value=data.nombre||"";
    $("negCategoria").value=data.categoria||"Comida";
    $("negImagen").value="";
    $("negDescripcion").value=data.descripcion||"";
    $("negDireccion").value=data.direccion||"";
    $("negTelefono").value=data.telefono||"";
    $("negWhatsapp").value=data.whatsapp||"";
    $("negHorario").value=data.horario||"";
    $("negFacebook").value=data.facebook||"";
    $("negInstagram").value=data.instagram||"";
    $("negWeb").value=data.sitio_web||"";
    $("negMapa").value=data.mapa||"";
    $("negActivo").checked=!!data.activo;
    $("negDestacado").checked=!!data.destacado;
    $("guardarNegocio").textContent="GUARDAR CAMBIOS DEL NEGOCIO";
    $("cancelarNegocio").classList.remove("hidden");
    $("negocioAdminMsg").textContent="";
    $("negNombre").scrollIntoView({behavior:"smooth",block:"center"});
  });
}

async function guardarNegocio(){
  if(!usuario){mensaje("negocioAdminMsg","Debes iniciar sesión.",true);return;}

  const nombre=$("negNombre").value.trim();
  const categoria=$("negCategoria").value.trim();
  const descripcion=$("negDescripcion").value.trim();
  const direccion=$("negDireccion").value.trim();
  const telefono=$("negTelefono").value.trim();
  const whatsapp=$("negWhatsapp").value.trim();
  const horario=$("negHorario").value.trim();
  const facebook=$("negFacebook").value.trim();
  const instagram=$("negInstagram").value.trim();
  const sitio_web=$("negWeb").value.trim();
  const mapa=$("negMapa").value.trim();
  const activo=$("negActivo").checked;
  const destacado=$("negDestacado").checked;
  const file=$("negImagen").files[0];

  if(!nombre||!categoria){
    mensaje("negocioAdminMsg","Completa nombre y categoría.",true);
    return;
  }

  for(const [campo,valor] of [["Facebook",facebook],["Instagram",instagram],["Sitio web",sitio_web],["Google Maps",mapa]]){
    if(valor && !urlValida(valor)){
      mensaje("negocioAdminMsg",`${campo} debe comenzar con http:// o https://.`,true);
      return;
    }
  }

  if(file && !file.type.startsWith("image/")){
    mensaje("negocioAdminMsg","La imagen del negocio debe ser una imagen.",true);
    return;
  }

  const btn=$("guardarNegocio");
  btn.disabled=true;
  mensaje("negocioAdminMsg",negocioEditando?"Guardando cambios...":"Subiendo imagen y guardando negocio...");

  let imagen=negocioEditando?.imagen||null;
  let nuevoPath=null;

  if(file){
    const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
    nuevoPath=`${crypto.randomUUID()}-${nombreArchivoNegocio(file.name)}.${ext}`;

    const upload=await db.storage.from("negocios").upload(nuevoPath,file,{cacheControl:"3600",upsert:false});
    if(upload.error){
      console.error(upload.error);
      btn.disabled=false;
      mensaje("negocioAdminMsg","No se pudo subir la imagen: "+upload.error.message,true);
      return;
    }
    imagen=db.storage.from("negocios").getPublicUrl(nuevoPath).data.publicUrl;
  }

  const payload={nombre,categoria,descripcion,imagen,direccion,telefono,whatsapp,horario,facebook,instagram,sitio_web,mapa,activo,destacado};

  let error=null;
  if(negocioEditando){
    ({error}=await db.from("negocios").update(payload).eq("id",negocioEditando.id));
  }else{
    ({error}=await db.from("negocios").insert(payload));
  }

  if(error){
    if(nuevoPath) await db.storage.from("negocios").remove([nuevoPath]);
    console.error(error);
    btn.disabled=false;
    mensaje("negocioAdminMsg","No se pudo guardar el negocio: "+error.message,true);
    return;
  }

  // Si reemplazamos imagen, intentar eliminar la anterior.
  if(negocioEditando && file && negocioEditando.imagen){
    try{
      const marker="/storage/v1/object/public/negocios/";
      const pos=String(negocioEditando.imagen).indexOf(marker);
      if(pos>=0){
        const oldPath=decodeURIComponent(String(negocioEditando.imagen).slice(pos+marker.length));
        if(oldPath) await db.storage.from("negocios").remove([oldPath]);
      }
    }catch(e){console.warn("No se pudo limpiar la imagen anterior:",e);}
  }

  btn.disabled=false;
  mensaje("negocioAdminMsg",negocioEditando?"Negocio actualizado correctamente. 🏪":"Negocio agregado correctamente. 🏪");
  limpiarFormularioNegocio();
  await cargarNegocios();
  await cargarNegociosAdmin();
}

async function eliminarNegocio(id){
  if(!usuario)return;
  const {data,error:readError}=await db.from("negocios").select("id,nombre,imagen").eq("id",id).single();
  if(readError){alert("No se pudo consultar el negocio: "+readError.message);return;}
  if(!confirm(`¿Eliminar "${data.nombre}"?`))return;

  const {error}=await db.from("negocios").delete().eq("id",id);
  if(error){alert("No se pudo eliminar el negocio: "+error.message);return;}

  try{
    const marker="/storage/v1/object/public/negocios/";
    const pos=String(data.imagen||"").indexOf(marker);
    if(pos>=0){
      const path=decodeURIComponent(String(data.imagen).slice(pos+marker.length));
      if(path) await db.storage.from("negocios").remove([path]);
    }
  }catch(e){console.warn("No se pudo limpiar la imagen:",e);}

  mensaje("negocioAdminMsg","Negocio eliminado.");
  await cargarNegocios();
  await cargarNegociosAdmin();
}

function abrirNegocios(e){
  if(e)e.preventDefault();
  $("admin").classList.add("hidden");
  $("catalogo").classList.add("hidden");
  $("negocios").classList.remove("hidden");
  history.replaceState(null,"","#negocios");
  $("negocios").scrollIntoView({behavior:"smooth",block:"start"});
  cargarNegocios();
}

function abrirCatalogo(e){
  if(e)e.preventDefault();
  $("negocios").classList.add("hidden");
  $("admin").classList.add("hidden");
  $("catalogo").classList.remove("hidden");
  history.replaceState(null,"","#catalogo");
}


function abrir(id){
  const m=peliculas.find(x=>Number(x.id)===Number(id));
  if(!m)return;
  $("ptitulo").textContent=m.titulo;
  $("player").src=m.url;
  $("modal").classList.add("open");
  $("player").play().catch(()=>{});
}

function alternarPantallaCompleta(){
  const modal=$("modal");
  const boton=$("pantalla");
  const activa=modal.classList.toggle("custom-fullscreen");
  boton.textContent=activa?"⛶":"⛶";
  boton.title=activa?"Salir de pantalla completa":"Pantalla completa";
  document.body.style.overflow=activa?"hidden":"";
}

function cerrar(){
  $("modal").classList.remove("custom-fullscreen");
  document.body.style.overflow="";
  $("player").pause();
  $("player").removeAttribute("src");
  $("player").load();
  $("modal").classList.remove("open");
}

$("buscar").oninput=render;
$("buscarNegocio").oninput=renderNegocios;
$("filtroCategoria").onchange=renderNegocios;
$("catalogoLink").onclick=abrirCatalogo;
$("negociosLink").onclick=abrirNegocios;
$("adminLink").onclick=abrirAdministracion;

$("loginBtn").onclick=iniciarSesion;
$("logoutBtn").onclick=cerrarSesion;
$("agregar").onclick=agregarPelicula;
$("guardarEdicion").onclick=guardarEdicion;
$("guardarAd").onclick=guardarPublicidad;
$("guardarNegocio").onclick=guardarNegocio;
$("cancelarNegocio").onclick=()=>{limpiarFormularioNegocio();mensaje("negocioAdminMsg","");};
$("cerrarEdicion").onclick=cerrarEdicion;
$("editModal").onclick=e=>{if(e.target===$("editModal"))cerrarEdicion()};
$("cerrar").onclick=cerrar;
$("modal").onclick=e=>{if(e.target===$("modal"))cerrar()};
cargarPublicidad();
cargarNegocios();
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&$("modal").classList.contains("custom-fullscreen")){ alternarPantallaCompleta(); return; }
  if(e.key==="Escape"&&$("modal").classList.contains("open"))cerrar();
  if(e.key==="Escape"&&$("editModal").classList.contains("open"))cerrarEdicion();
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
