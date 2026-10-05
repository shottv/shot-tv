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
  if(usuario){ cargarPublicidadAdmin(); cargarNegociosAdmin(); cargarControlSolicitudes(); }
}

function escSolicitud(v){
  return esc(v==null?"":String(v));
}

function fechaSolicitud(v){
  if(!v)return "";
  try{return new Date(v).toLocaleString("es-MX",{dateStyle:"short",timeStyle:"short"});}
  catch{return String(v);}
}

function etiquetaEstado(estado){
  return ({pendiente:"⏳ Pendiente",revision:"🔵 En revisión",aprobado:"🟢 Aprobado",rechazado:"🔴 Rechazado",publicado:"🟣 Publicado"})[estado]||estado;
}

async function cargarControlSolicitudes(){
  if(!usuario)return;
  const msg=$("solicitudesAdminMsg");
  try{
    const [solRes,negRes]=await Promise.all([
      db.from("solicitudes_negocios").select("*").order("created_at",{ascending:false}),
      db.from("negocios").select("id",{count:"exact",head:true})
    ]);
    if(solRes.error)throw solRes.error;
    if(negRes.error)throw negRes.error;
    const solicitudes=solRes.data||[];
    const conteo={pendiente:0,revision:0,aprobado:0,rechazado:0,publicado:0};
    solicitudes.forEach(x=>{if(conteo[x.estado]!==undefined)conteo[x.estado]++;});
    $("statSolicitudes").textContent=solicitudes.length;
    $("statPendientes").textContent=conteo.pendiente;
    $("statRevision").textContent=conteo.revision;
    $("statAprobados").textContent=conteo.aprobado;
    $("statPublicados").textContent=conteo.publicado;
    $("statNegocios").textContent=negRes.count??0;
    if(!solicitudes.length){
      $("solicitudesAdminLista").innerHTML='<div class="solicitud-empty">Todavía no hay solicitudes de negocios.</div>';
      if(msg)msg.textContent="";
      return;
    }
    $("solicitudesAdminLista").innerHTML=solicitudes.map(s=>`
      <div class="solicitud-admin-row">
        <div class="solicitud-admin-main">
          <strong class="solicitud-registro">${escSolicitud(s.numero_registro)}</strong>
          <strong>${escSolicitud(s.nombre)}</strong>
          <span>${escSolicitud(s.categoria)}</span>
          <span>📅 ${escSolicitud(fechaSolicitud(s.created_at))}</span>
          <select class="solicitud-estado" data-solicitud-id="${escSolicitud(s.id)}" aria-label="Estado de la solicitud ${escSolicitud(s.numero_registro)}">
            <option value="pendiente" ${s.estado==="pendiente"?"selected":""}>⏳ Pendiente</option>
            <option value="revision" ${s.estado==="revision"?"selected":""}>🔵 En revisión</option>
            <option value="aprobado" ${s.estado==="aprobado"?"selected":""}>🟢 Aprobado</option>
            <option value="rechazado" ${s.estado==="rechazado"?"selected":""}>🔴 Rechazado</option>
            <option value="publicado" ${s.estado==="publicado"?"selected":""}>🟣 Publicado</option>
          </select>
        </div>
        <div class="solicitud-detalle">
          <span><b>Descripción:</b> ${escSolicitud(s.descripcion||"No proporcionada")}</span>
          <span><b>Dirección:</b> ${escSolicitud(s.direccion||"No proporcionada")}</span>
          <span><b>Teléfono:</b> ${escSolicitud(s.telefono||"No proporcionado")}</span>
          <span><b>WhatsApp:</b> ${escSolicitud(s.whatsapp||"No proporcionado")}</span>
          <span><b>Horario:</b> ${escSolicitud(s.horario||"No proporcionado")}</span>
          <span><b>Facebook:</b> ${escSolicitud(s.facebook||"No proporcionado")}</span>
          <span><b>Instagram:</b> ${escSolicitud(s.instagram||"No proporcionado")}</span>
          <span><b>Sitio web:</b> ${escSolicitud(s.sitio_web||"No proporcionado")}</span>
          <span><b>Google Maps:</b> ${escSolicitud(s.mapa||"No proporcionado")}</span>
        </div>
      </div>`).join("");
    document.querySelectorAll(".solicitud-estado").forEach(sel=>{
      sel.onchange=()=>actualizarEstadoSolicitud(sel.dataset.solicitudId,sel.value);
    });
    if(msg)msg.textContent="";
  }catch(error){
    console.error("Error cargando solicitudes:",error);
    if(msg)mensaje("solicitudesAdminMsg","No se pudieron cargar las solicitudes: "+error.message,true);
  }
}

async function actualizarEstadoSolicitud(id,estado){
  if(!usuario)return;
  const msg=$("solicitudesAdminMsg");
  const {error}=await db.from("solicitudes_negocios").update({estado}).eq("id",id);
  if(error){
    console.error(error);
    mensaje("solicitudesAdminMsg","No se pudo actualizar el estado: "+error.message,true);
    await cargarControlSolicitudes();
    return;
  }
  mensaje("solicitudesAdminMsg",`Estado actualizado: ${etiquetaEstado(estado)}`);
  await cargarControlSolicitudes();
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
  if(!usuario){alert("Debes iniciar sesión para cambiar el orden.");return;}

  const {data,error}=await db.from("peliculas")
    .select("id,titulo,orden,created_at")
    .order("orden",{ascending:true,nullsFirst:false})
    .order("created_at",{ascending:true});

  if(error){
    alert("No se pudo consultar el orden de las películas: "+error.message);
    return;
  }

  const lista=(data||[]).slice();
  const indice=lista.findIndex(m=>Number(m.id)===Number(id));
  if(indice<0){alert("No se encontró la película seleccionada.");return;}

  const nuevoIndice=indice+Number(direccion);
  if(nuevoIndice<0 || nuevoIndice>=lista.length)return;

  const actual=lista[indice];
  const vecino=lista[nuevoIndice];
  const ordenActual=Number(actual.orden);
  const ordenVecino=Number(vecino.orden);

  if(!Number.isFinite(ordenActual) || !Number.isFinite(ordenVecino)){
    alert("La película no tiene un número de orden válido.");
    return;
  }

  // Intercambiamos solamente las dos películas involucradas.
  // Primero usamos un valor temporal único para evitar una colisión de orden.
  const temporal=-(Math.abs(Number(actual.id))+1000000000);
  const {error:tempError}=await db.from("peliculas")
    .update({orden:temporal})
    .eq("id",actual.id);

  if(tempError){
    console.error("Error temporal al mover película:",tempError);
    alert("No se pudo iniciar el cambio de posición: "+tempError.message);
    return;
  }

  const {error:vecinoError}=await db.from("peliculas")
    .update({orden:ordenActual})
    .eq("id",vecino.id);

  if(vecinoError){
    await db.from("peliculas").update({orden:ordenActual}).eq("id",actual.id);
    console.error("Error al mover vecino:",vecinoError);
    alert("No se pudo mover la película: "+vecinoError.message);
    await cargarPeliculas();
    return;
  }

  const {error:finalError}=await db.from("peliculas")
    .update({orden:ordenVecino})
    .eq("id",actual.id);

  if(finalError){
    // Intento de restauración.
    await db.from("peliculas").update({orden:ordenActual}).eq("id",actual.id);
    await db.from("peliculas").update({orden:ordenVecino}).eq("id",vecino.id);
    console.error("Error final al mover película:",finalError);
    alert("No se pudo completar el cambio de posición: "+finalError.message);
    await cargarPeliculas();
    return;
  }

  // Actualización inmediata en pantalla.
  actual.orden=ordenVecino;
  vecino.orden=ordenActual;
  lista.sort((a,b)=>{
    const ao=Number(a.orden), bo=Number(b.orden);
    if(ao!==bo)return ao-bo;
    return new Date(a.created_at).getTime()-new Date(b.created_at).getTime();
  });
  peliculas=lista;
  render();
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

async function obtenerFotosNegocios(ids){
  if(!ids.length) return {};
  const {data,error}=await db.from("negocio_fotos")
    .select("id,negocio_id,url,orden,created_at")
    .in("negocio_id",ids)
    .order("orden",{ascending:true})
    .order("created_at",{ascending:true});
  if(error){
    console.warn("No se pudieron cargar las fotos adicionales:",error);
    return {};
  }
  return (data||[]).reduce((map,foto)=>{
    (map[foto.negocio_id] ||= []).push(foto);
    return map;
  },{});
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
  const fotos=await obtenerFotosNegocios(negocios.map(n=>n.id));
  negocios.forEach(n=>{n.fotos=fotos[n.id]||[];});
  renderNegocios();
}

function renderNegocios(){
  const q=($('buscarNegocio')?.value||"").toLowerCase().trim();
  const cat=$('filtroCategoria')?.value||"";
  const lista=negocios.filter(n=>{
    const texto=[n.nombre,n.categoria,n.descripcion,n.direccion].join(" ").toLowerCase();
    return (!q || texto.includes(q)) && (!cat || n.categoria===cat);
  });

  $('negociosEstado').textContent=lista.length
    ? `${lista.length} negocio${lista.length===1?"":"s"} encontrado${lista.length===1?"":"s"}.`
    : "No hay negocios para mostrar.";

  $('negociosGrid').innerHTML=lista.map(n=>{
    const wa=whatsappHref(n.whatsapp);
    const tel=telefonoHref(n.telefono);
    const fotos=Array.isArray(n.fotos)?n.fotos:[];
    const galeria=fotos.length ? `
      <div class="business-gallery" aria-label="Fotos de ${esc(n.nombre)}">
        ${fotos.map((foto,i)=>`<button type="button" class="business-gallery-item" onclick="verFotoNegocio(this.dataset.photoUrl)" data-photo-url="${esc(foto.url)}" aria-label="Ver foto ${i+1} de ${esc(n.nombre)}"><img src="${esc(foto.url)}" alt="${esc(n.nombre)} - foto ${i+1}" loading="lazy"></button>`).join("")}
      </div>` : "";
    return `
      <article class="business-card ${n.destacado?"business-featured":""}">
        ${n.destacado?'<div class="business-badge">⭐ DESTACADO</div>':""}
        ${n.imagen?`<button type="button" class="business-image-link" onclick="verFotoNegocio(this.dataset.photoUrl)" data-photo-url="${esc(n.imagen)}" aria-label="Abrir imagen de ${esc(n.nombre)}"><img src="${esc(n.imagen)}" alt="${esc(n.nombre)}" class="business-img"></button>`:`<div class="business-img business-noimg">🏪</div>`}
        ${galeria}
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
  $("negGaleria").value="";
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
  $("negocioGaleriaActual").innerHTML="";
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
  const fotos=await obtenerFotosNegocios(lista.map(n=>n.id));
  lista.forEach(n=>{n.fotos=fotos[n.id]||[];});

  // La lista administrativa conserva el mismo orden que se muestra públicamente:
  // destacados primero y, dentro de cada grupo, por created_at descendente.
  lista.sort((a,b)=>{
    const da=!!a.destacado, dbb=!!b.destacado;
    if(da!==dbb)return da? -1 : 1;
    return new Date(b.created_at).getTime()-new Date(a.created_at).getTime();
  });

  $('negociosAdminLista').innerHTML=lista.length ? lista.map((n,i)=>`
    <div class="business-admin-row">
      ${n.imagen?`<img src="${esc(n.imagen)}" alt="">`:`<div class="business-admin-noimg">🏪</div>`}
      <div class="business-admin-data">
        <strong>${esc(n.nombre)}</strong>
        <span>${esc(n.categoria)} · ${n.activo?"ACTIVO":"INACTIVO"}${n.destacado?" · ⭐ DESTACADO":""} · 📸 ${n.fotos.length} foto${n.fotos.length===1?"":"s"}</span>
      </div>
      <div class="business-admin-actions">
        <button class="move" onclick="moverNegocio(${Number(n.id)},-1)" title="Subir" ${i===0 || (!!lista[i-1].destacado!==!!n.destacado)?"disabled":""}>⬆️</button>
        <button class="move" onclick="moverNegocio(${Number(n.id)},1)" title="Bajar" ${i===lista.length-1 || (!!lista[i+1].destacado!==!!n.destacado)?"disabled":""}>⬇️</button>
        <button class="edit" onclick="editarNegocio(${Number(n.id)})">Editar</button>
        <button class="delete" onclick="eliminarNegocio(${Number(n.id)})">Eliminar</button>
      </div>
    </div>`).join("") : '<div class="ad-empty">No hay negocios registrados.</div>';
}

async function moverNegocio(id, direccion){
  if(!usuario)return;
  const {data,error}=await db.from("negocios")
    .select("id,nombre,created_at,destacado")
    .order("destacado",{ascending:false})
    .order("created_at",{ascending:false});
  if(error){
    mensaje("negocioAdminMsg","No se pudo consultar el orden de los negocios: "+error.message,true);
    return;
  }

  const lista=data||[];
  const indice=lista.findIndex(n=>Number(n.id)===Number(id));
  if(indice<0)return;
  const actual=lista[indice];
  const nuevoIndice=indice+Number(direccion);
  if(nuevoIndice<0 || nuevoIndice>=lista.length)return;
  const vecino=lista[nuevoIndice];

  // No permitimos que un negocio destacado salte al grupo no destacado o viceversa.
  if(!!actual.destacado!==!!vecino.destacado)return;

  const fechaActual=actual.created_at;
  const fechaVecino=vecino.created_at;
  const temporal=new Date(Date.now()+86400000).toISOString();

  const {error:tempError}=await db.from("negocios").update({created_at:temporal}).eq("id",actual.id);
  if(tempError){
    mensaje("negocioAdminMsg","No se pudo mover el negocio: "+tempError.message,true);
    return;
  }

  const {error:vecinoError}=await db.from("negocios").update({created_at:fechaActual}).eq("id",vecino.id);
  if(vecinoError){
    await db.from("negocios").update({created_at:fechaActual}).eq("id",actual.id);
    mensaje("negocioAdminMsg","No se pudo mover el negocio: "+vecinoError.message,true);
    return;
  }

  const {error:finalError}=await db.from("negocios").update({created_at:fechaVecino}).eq("id",actual.id);
  if(finalError){
    // Intento de restauración de ambos valores originales.
    await db.from("negocios").update({created_at:fechaActual}).eq("id",actual.id);
    await db.from("negocios").update({created_at:fechaVecino}).eq("id",vecino.id);
    mensaje("negocioAdminMsg","No se pudo completar el cambio de orden: "+finalError.message,true);
    return;
  }

  mensaje("negocioAdminMsg",`Orden actualizado: ${actual.nombre} ${direccion<0?"subió ⬆️":"bajó ⬇️"}.`);
  await cargarNegocios();
  await cargarNegociosAdmin();
}

function renderGaleriaAdmin(fotos){
  const box=$("negocioGaleriaActual");
  if(!box)return;
  if(!fotos?.length){
    box.innerHTML='<div class="galeria-vacia">No hay fotos adicionales todavía.</div>';
    return;
  }
  box.innerHTML=`<div class="galeria-admin-grid">${fotos.map((foto,i)=>`
    <div class="galeria-admin-item">
      <img src="${esc(foto.url)}" alt="Foto ${i+1}">
      <button type="button" class="delete-photo" onclick="eliminarFotoNegocio(${Number(foto.id)})">🗑️ Eliminar</button>
    </div>`).join("")}</div>`;
}

function editarNegocio(id){
  if(!usuario)return;
  db.from("negocios").select("*").eq("id",id).single().then(async ({data,error})=>{
    if(error){mensaje("negocioAdminMsg","No se pudo abrir el negocio: "+error.message,true);return;}
    negocioEditando=data;
    const fotos=await obtenerFotosNegocios([id]);
    negocioEditando.fotos=fotos[id]||[];
    $("negNombre").value=data.nombre||"";
    $("negCategoria").value=data.categoria||"Comida";
    $("negImagen").value="";
    $("negGaleria").value="";
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
    renderGaleriaAdmin(negocioEditando.fotos);
    $("guardarNegocio").textContent="GUARDAR CAMBIOS DEL NEGOCIO";
    $("cancelarNegocio").classList.remove("hidden");
    $("negocioAdminMsg").textContent="";
    $("negNombre").scrollIntoView({behavior:"smooth",block:"center"});
  });
}

async function subirFotosGaleria(negocioId,files){
  const fotosSubidas=[];
  const {data:existentes,error:countError}=await db.from("negocio_fotos")
    .select("id,url",{count:"exact"})
    .eq("negocio_id",negocioId);
  if(countError){
    console.error("No se pudo consultar la galería:",countError);
    return {fotos:[],error:countError.message};
  }

  const disponibles=Math.max(0,9-(existentes?.length||0));
  if(files.length>disponibles){
    return {fotos:[],error:`Este negocio ya tiene ${existentes?.length||0} fotos adicionales. Solo puedes agregar ${disponibles} más (máximo 9).`};
  }

  for(const file of files){
    if(!file.type.startsWith("image/")) continue;
    const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
    const path=`${crypto.randomUUID()}-${nombreArchivoNegocio(file.name)}.${ext}`;

    const upload=await db.storage.from("negocios").upload(path,file,{cacheControl:"3600",upsert:false});
    if(upload.error){
      console.error("Error Storage galería:",upload.error);
      return {fotos:fotosSubidas,error:`No se pudo subir "${file.name}": ${upload.error.message}`};
    }

    const url=db.storage.from("negocios").getPublicUrl(path).data.publicUrl;
    const orden=Date.now()+fotosSubidas.length;
    const {data,error}=await db.from("negocio_fotos")
      .insert({negocio_id:negocioId,url,orden})
      .select("id,negocio_id,url,orden,created_at")
      .single();

    if(error){
      await db.storage.from("negocios").remove([path]);
      console.error("Error DB galería:",error);
      return {fotos:fotosSubidas,error:`La foto "${file.name}" se subió, pero no pudo registrarse en la galería: ${error.message}`};
    }
    fotosSubidas.push(data);
  }
  return {fotos:fotosSubidas,error:null};
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
  const galleryFiles=[...($("negGaleria")?.files||[])];

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
    mensaje("negocioAdminMsg","La imagen principal debe ser una imagen.",true);
    return;
  }
  if(galleryFiles.some(f=>!f.type.startsWith("image/"))){
    mensaje("negocioAdminMsg","Todas las fotos adicionales deben ser imágenes.",true);
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
  let negocioId=negocioEditando?.id||null;

  if(negocioEditando){
    ({error}=await db.from("negocios").update(payload).eq("id",negocioEditando.id));
  }else{
    const resultado=await db.from("negocios").insert(payload).select("id").single();
    error=resultado.error;
    negocioId=resultado.data?.id||null;
  }

  if(error){
    if(nuevoPath) await db.storage.from("negocios").remove([nuevoPath]);
    console.error(error);
    btn.disabled=false;
    mensaje("negocioAdminMsg","No se pudo guardar el negocio: "+error.message,true);
    return;
  }

  // Si reemplazamos imagen principal, eliminar la anterior.
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

  let galleryError=null;
  let galleryCount=0;
  if(galleryFiles.length && negocioId){
    mensaje("negocioAdminMsg",`Subiendo ${galleryFiles.length} foto${galleryFiles.length===1?"":"s"} adicionales...`);
    const resultadoGaleria=await subirFotosGaleria(negocioId,galleryFiles);
    galleryCount=resultadoGaleria.fotos.length;
    galleryError=resultadoGaleria.error;
  }

  btn.disabled=false;
  await cargarNegocios();
  await cargarNegociosAdmin();

  if(galleryError){
    mensaje("negocioAdminMsg",`Negocio guardado. ${galleryCount} foto${galleryCount===1?"":"s"} adicional${galleryCount===1?"":"es"} guardada${galleryCount===1?"":"s"}. ${galleryError}`,true);
  }else if(galleryFiles.length){
    mensaje("negocioAdminMsg",`✅ Negocio guardado y ${galleryCount} foto${galleryCount===1?"":"s"} adicional${galleryCount===1?"":"es"} guardada${galleryCount===1?"":"s"}.`);
  }else{
    mensaje("negocioAdminMsg",negocioEditando?"Negocio actualizado correctamente. 🏪":"Negocio agregado correctamente. 🏪");
  }

  // Si estábamos editando, conservamos el formulario abierto y mostramos la galería actualizada.
  // Esto permite comprobar inmediatamente que las fotos quedaron guardadas.
  if(negocioId && negocioEditando){
    const fotosActualizadas=await obtenerFotosNegocios([negocioId]);
    negocioEditando.fotos=fotosActualizadas[negocioId]||[];
    renderGaleriaAdmin(negocioEditando.fotos);
    $("negGaleria").value="";
  }else{
    limpiarFormularioNegocio();
  }
}

async function eliminarFotoNegocio(id){
  if(!usuario)return;
  const {data,error}=await db.from("negocio_fotos").select("id,url,negocio_id").eq("id",id).single();
  if(error){alert("No se pudo consultar la foto: "+error.message);return;}
  if(!confirm("¿Eliminar esta foto de la galería?"))return;
  const {error:delError}=await db.from("negocio_fotos").delete().eq("id",id);
  if(delError){alert("No se pudo eliminar la foto: "+delError.message);return;}
  try{
    const marker="/storage/v1/object/public/negocios/";
    const pos=String(data.url||"").indexOf(marker);
    if(pos>=0){
      const path=decodeURIComponent(String(data.url).slice(pos+marker.length));
      if(path) await db.storage.from("negocios").remove([path]);
    }
  }catch(e){console.warn("No se pudo limpiar la foto:",e);}
  const fotos=await obtenerFotosNegocios([data.negocio_id]);
  if(negocioEditando?.id===data.negocio_id){
    negocioEditando.fotos=fotos[data.negocio_id]||[];
    renderGaleriaAdmin(negocioEditando.fotos);
  }
  await cargarNegocios();
  await cargarNegociosAdmin();
}

async function eliminarNegocio(id){
  if(!usuario)return;
  const {data,error:readError}=await db.from("negocios").select("id,nombre,imagen").eq("id",id).single();
  if(readError){alert("No se pudo consultar el negocio: "+readError.message);return;}
  if(!confirm(`¿Eliminar "${data.nombre}"?`))return;

  const fotos=await obtenerFotosNegocios([id]);
  const {error}=await db.from("negocios").delete().eq("id",id);
  if(error){alert("No se pudo eliminar el negocio: "+error.message);return;}

  try{
    const marker="/storage/v1/object/public/negocios/";
    const pos=String(data.imagen||"").indexOf(marker);
    if(pos>=0){
      const path=decodeURIComponent(String(data.imagen).slice(pos+marker.length));
      if(path) await db.storage.from("negocios").remove([path]);
    }
    for(const foto of (fotos[id]||[])){
      const posFoto=String(foto.url||"").indexOf(marker);
      if(posFoto>=0){
        const pathFoto=decodeURIComponent(String(foto.url).slice(posFoto+marker.length));
        if(pathFoto) await db.storage.from("negocios").remove([pathFoto]);
      }
    }
  }catch(e){console.warn("No se pudo limpiar las imágenes:",e);}

  mensaje("negocioAdminMsg","Negocio eliminado.");
  limpiarFormularioNegocio();
  await cargarNegocios();
  await cargarNegociosAdmin();
}

function abrirNegocios(e){
  if(e)e.preventDefault();
  $("admin").classList.add("hidden");
  $("catalogo").classList.add("hidden");
  $("buscar").classList.add("hidden");
  $("negocios").classList.remove("hidden");
  history.replaceState(null,"","#negocios");
  $("negocios").scrollIntoView({behavior:"smooth",block:"start"});
  cargarNegocios();
}

const WHATSAPP_REGISTRO_NEGOCIO = "526561273144";

function generarNumeroRegistro(){
  // Identificador corto y único para seguimiento: STV-XXXXXX
  // Se evita reutilizar un código ya generado en este dispositivo.
  const usados=JSON.parse(localStorage.getItem("shotTvRegistros")||"[]");
  let codigo="";
  do{
    codigo=Math.random().toString(36).slice(2,8).toUpperCase();
  }while(usados.includes(codigo));
  usados.push(codigo);
  if(usados.length>200) usados.splice(0,usados.length-200);
  localStorage.setItem("shotTvRegistros",JSON.stringify(usados));
  return `STV-${codigo}`;
}

function abrirRegistroNegocio(){
  const panel=$("registroNegocio");
  if(!panel)return;
  // El número nace en el momento exacto en que el cliente pulsa "Registra tu negocio".
  const numero=generarNumeroRegistro();
  $("regNumero").value=numero;
  limpiarRegistroNegocio(false);
  // limpiarRegistroNegocio(false) conserva el número recién generado.
  $("regNumero").value=numero;
  panel.classList.remove("hidden");
  panel.scrollIntoView({behavior:"smooth",block:"start"});
  setTimeout(()=>$("regNombre")?.focus(),350);
}

function cerrarRegistroNegocio(){
  const panel=$("registroNegocio");
  if(panel)panel.classList.add("hidden");
  limpiarRegistroNegocio(true);
}

function limpiarRegistroNegocio(limpiarNumero=true){
  ["regNombre","regDescripcion","regDireccion","regTelefono","regWhatsapp","regHorario","regFacebook","regInstagram","regWeb","regMapa"].forEach(id=>{ if($(id)) $(id).value=""; });
  if($("regCategoria")) $("regCategoria").value="Comida";
  if(limpiarNumero && $("regNumero")) $("regNumero").value="";
  mensaje("registroNegocioMsg","");
}

async function enviarRegistroPorWhatsApp(){
  const boton=$("enviarRegistroNegocio");
  const textoOriginal=boton?.textContent||"📲 ENVIAR SOLICITUD POR WHATSAPP";
  const nombre=$("regNombre").value.trim();
  const categoria=$("regCategoria").value.trim();
  const descripcion=$("regDescripcion").value.trim();
  const direccion=$("regDireccion").value.trim();
  const telefono=$("regTelefono").value.trim();
  const whatsapp=$("regWhatsapp").value.trim();
  const horario=$("regHorario").value.trim();
  const facebook=$("regFacebook").value.trim();
  const instagram=$("regInstagram").value.trim();
  const web=$("regWeb").value.trim();
  const mapa=$("regMapa").value.trim();
  const numeroRegistro=$("regNumero")?.value.trim() || generarNumeroRegistro();

  if($("regNumero")) $("regNumero").value=numeroRegistro;

  if(!nombre || !descripcion){
    mensaje("registroNegocioMsg","Completa el nombre y la descripción del negocio.",true);
    if(!nombre) $("regNombre").focus(); else $("regDescripcion").focus();
    return;
  }

  const mensajeWhatsApp=[
    "🏪 *SOLICITUD DE REGISTRO DE NEGOCIO — SHOT TV*",
    "",
    `*Número de registro:* ${numeroRegistro}`,
    "",
    `*Nombre:* ${nombre}`,
    `*Categoría:* ${categoria}`,
    `*Descripción:* ${descripcion}`,
    `*Dirección:* ${direccion||"No proporcionada"}`,
    `*Teléfono:* ${telefono||"No proporcionado"}`,
    `*WhatsApp:* ${whatsapp||"No proporcionado"}`,
    `*Horario:* ${horario||"No proporcionado"}`,
    `*Facebook:* ${facebook||"No proporcionado"}`,
    `*Instagram:* ${instagram||"No proporcionado"}`,
    `*Sitio web:* ${web||"No proporcionado"}`,
    `*Google Maps:* ${mapa||"No proporcionado"}`,
    "",
    `📸 *IMPORTANTE:* ENVIE SU IMAGEN DE SU NEGOCIO CON EL NUMERO DE REGISTRO ${numeroRegistro}`
  ].join("\n");

  // Primero guardamos la solicitud en Supabase para que quede registrada
  // aunque el cliente después cierre WhatsApp.
  if(boton){
    boton.disabled=true;
    boton.textContent="⏳ GUARDANDO SOLICITUD...";
  }

  const datosSolicitud={
    numero_registro: numeroRegistro,
    nombre,
    categoria,
    descripcion,
    direccion: direccion || null,
    telefono: telefono || null,
    whatsapp: whatsapp || null,
    horario: horario || null,
    facebook: facebook || null,
    instagram: instagram || null,
    sitio_web: web || null,
    mapa: mapa || null,
    estado: "pendiente"
  };

  let resultado=await db.from("solicitudes_negocios").insert(datosSolicitud);

  // Si por una coincidencia extremadamente rara el código ya existe,
  // generamos otro y reintentamos una sola vez.
  if(resultado.error && resultado.error.code==="23505"){
    const nuevoNumero=generarNumeroRegistro();
    numeroRegistro=nuevoNumero;
    if($("regNumero")) $("regNumero").value=numeroRegistro;
    datosSolicitud.numero_registro=numeroRegistro;
    resultado=await db.from("solicitudes_negocios").insert(datosSolicitud);
  }

  if(resultado.error){
    console.error("Error guardando solicitud:",resultado.error);
    mensaje("registroNegocioMsg","No se pudo guardar la solicitud. Verifica tu conexión e inténtalo nuevamente.",true);
    if(boton){
      boton.disabled=false;
      boton.textContent=textoOriginal;
    }
    return;
  }

  // El mismo número guardado en Supabase se envía a WhatsApp.
  const mensajeFinal=mensajeWhatsApp.replaceAll(
    /\*Número de registro:\*:.*/g,
    `*Número de registro:* ${numeroRegistro}`
  ).replaceAll(
    /NUMERO DE REGISTRO (?:STV-[A-Z0-9]{6})/g,
    `NUMERO DE REGISTRO ${numeroRegistro}`
  );

  const url="https://wa.me/"+WHATSAPP_REGISTRO_NEGOCIO+"?text="+encodeURIComponent(mensajeFinal);
  if(boton){
    boton.textContent="✅ SOLICITUD GUARDADA — ABRIENDO WHATSAPP...";
  }
  window.location.href=url;
}

function verFotoNegocio(url){
  if(!url)return;
  const modal=$("businessPhotoModal");
  const img=$("businessPhotoViewer");
  if(!modal||!img)return;
  img.src=url;
  modal.classList.add("open");
  document.body.style.overflow="hidden";
}

function cerrarFotoNegocio(){
  const modal=$("businessPhotoModal");
  const img=$("businessPhotoViewer");
  if(img)img.removeAttribute("src");
  if(modal)modal.classList.remove("open");
  document.body.style.overflow="";
}

function abrirCatalogo(e){
  if(e)e.preventDefault();
  $("buscar").classList.remove("hidden");
  $("negocios").classList.add("hidden");
  $("admin").classList.add("hidden");
  $("catalogo").classList.remove("hidden");
  history.replaceState(null,"","#catalogo");
}


function detectarYouTube(url){
  try{
    const u=new URL(String(url||""));
    const host=u.hostname.toLowerCase().replace(/^www\./,"");
    if(host!=="youtube.com" && host!=="youtu.be" && !host.endsWith(".youtube.com")) return null;
    let id="";
    if(host==="youtu.be") id=u.pathname.split("/").filter(Boolean)[0]||"";
    else if(u.pathname.startsWith("/watch")) id=u.searchParams.get("v")||"";
    else if(u.pathname.startsWith("/live/")) id=u.pathname.split("/")[2]||"";
    else if(u.pathname.startsWith("/embed/")) id=u.pathname.split("/")[2]||"";
    else if(u.pathname.startsWith("/shorts/")) id=u.pathname.split("/")[2]||"";
    id=id.split("?")[0].split("&")[0];
    return /^[A-Za-z0-9_-]{6,20}$/.test(id)?id:null;
  }catch(e){return null;}
}

function esHls(url){
  return /\.m3u8(?:$|[?#])/i.test(String(url||""));
}

function mostrarSoloReproductor(tipo){
  const video=$("player");
  const yt=$("youtubePlayer");
  if(video) video.style.display = tipo === "video" ? "block" : "none";
  if(yt) yt.style.display = tipo === "youtube" ? "block" : "none";
}

function limpiarReproductores(){
  const video=$("player");
  const yt=$("youtubePlayer");
  if(video){
    try{video.pause();}catch(e){}
    if(window.__shotTvHls){try{window.__shotTvHls.destroy();}catch(e){} window.__shotTvHls=null;}
    video.removeAttribute("src");
    video.load();
    video.classList.add("hidden");
    video.style.display="none";
  }
  if(yt){
    yt.src="about:blank";
    yt.classList.add("hidden");
    yt.style.display="none";
  }
}

function reproducirFuente(url){
  const video=$("player");
  const yt=$("youtubePlayer");
  const youtubeId=detectarYouTube(url);
  limpiarReproductores();

  if(youtubeId){
    // Solo YouTube: el video HTML5 permanece completamente oculto.
    yt.src=`https://www.youtube.com/embed/${youtubeId}?autoplay=1&playsinline=1&rel=0`;
    yt.classList.remove("hidden");
    yt.style.display="block";
    return;
  }

  // Solo MP4/HLS: el iframe permanece completamente oculto.
  video.classList.remove("hidden");
  video.style.display="block";
  if(esHls(url) && window.Hls && Hls.isSupported()){
    const hls=new Hls({enableWorker:true});
    window.__shotTvHls=hls;
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED,()=>video.play().catch(()=>{}));
  }else{
    video.src=url;
    video.play().catch(()=>{});
  }
}

function abrir(id){
  const m=peliculas.find(x=>Number(x.id)===Number(id));
  if(!m)return;

  if(typeof window.gtag === "function"){
    window.gtag("event","movie_play",{
      movie_id:String(m.id),
      movie_title:String(m.titulo||""),
      movie_year:String(m.año||""),
      movie_genre:String(m.genero||"")
    });
  }

  $("ptitulo").textContent=m.titulo;
  $("modal").classList.add("open");
  reproducirFuente(m.url);
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
  limpiarReproductores();
  $("modal").classList.remove("open");
}

$("buscar").oninput=render;
$("buscarNegocio").oninput=renderNegocios;
$("filtroCategoria").onchange=renderNegocios;
$("catalogoLink").onclick=abrirCatalogo;
$("negociosLink").onclick=abrirNegocios;
$("adminLink").onclick=abrirAdministracion;
$("abrirRegistroNegocio").onclick=abrirRegistroNegocio;
$("cerrarRegistroNegocio").onclick=cerrarRegistroNegocio;
$("enviarRegistroNegocio").onclick=enviarRegistroPorWhatsApp;

$("loginBtn").onclick=iniciarSesion;
$("logoutBtn").onclick=cerrarSesion;
$("agregar").onclick=agregarPelicula;
$("guardarEdicion").onclick=guardarEdicion;
$("guardarAd").onclick=guardarPublicidad;
$("guardarNegocio").onclick=guardarNegocio;
$("refrescarSolicitudes").onclick=cargarControlSolicitudes;
$("cancelarNegocio").onclick=()=>{limpiarFormularioNegocio();mensaje("negocioAdminMsg","");};
$("cerrarEdicion").onclick=cerrarEdicion;
$("editModal").onclick=e=>{if(e.target===$("editModal"))cerrarEdicion()};
$("cerrar").onclick=cerrar;
$("modal").onclick=e=>{if(e.target===$("modal"))cerrar()};
$("cerrarFotoNegocio").onclick=cerrarFotoNegocio;
$("businessPhotoModal").onclick=e=>{if(e.target===$("businessPhotoModal"))cerrarFotoNegocio()};
cargarPublicidad();
cargarNegocios();
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&$("modal").classList.contains("custom-fullscreen")){ alternarPantallaCompleta(); return; }
  if(e.key==="Escape"&&$("modal").classList.contains("open"))cerrar();
  if(e.key==="Escape"&&$("businessPhotoModal").classList.contains("open"))cerrarFotoNegocio();
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
