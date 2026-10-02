const KEY="micine_streaming_v1";
let peliculas=JSON.parse(localStorage.getItem(KEY)||"null")||[];
const $=id=>document.getElementById(id);

function guardar(){localStorage.setItem(KEY,JSON.stringify(peliculas))}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

function render(){
  const q=$("buscar").value.toLowerCase().trim();
  $("grid").innerHTML=peliculas.map((m,i)=>({...m,i}))
    .filter(m=>m.titulo.toLowerCase().includes(q))
    .map(m=>`
      <article class="card" onclick="abrir(${m.i})">
        <button class="delete" onclick="event.stopPropagation();eliminar(${m.i})">Eliminar</button>
        <img class="poster" src="${m.portada}" alt="${esc(m.titulo)}">
        <div class="info">
          <h3>${esc(m.titulo)}</h3>
          <div class="meta">${esc(m.anio)} · ${esc(m.genero)}</div>
        </div>
      </article>`).join("");
}

$("agregar").onclick=()=>{
  const titulo=$("titulo").value.trim();
  const url=$("url").value.trim();
  const file=$("portada").files[0];

  if(!titulo||!url||!file){
    alert("Completa título, portada y Direct Link (streaming).");
    return;
  }

  if(!/^https?:\/\//i.test(url)){
    alert("El enlace no parece ser una URL válida.");
    return;
  }

  const reader=new FileReader();
  reader.onload=()=>{
    peliculas.push({
      titulo,
      anio:$("anio").value,
      genero:$("genero").value.trim()||"Sin género",
      portada:reader.result,
      url
    });
    guardar();
    render();
    $("titulo").value="";
    $("anio").value="2026";
    $("genero").value="";
    $("portada").value="";
    $("url").value="";
    alert("Película agregada correctamente.");
  };
  reader.readAsDataURL(file);
};

function abrir(i){
  const m=peliculas[i];
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

function eliminar(i){
  if(confirm("¿Eliminar esta película?")){
    peliculas.splice(i,1);
    guardar();
    render();
  }
}

$("buscar").oninput=render;
$("cerrar").onclick=cerrar;
$("modal").onclick=e=>{if(e.target===$("modal"))cerrar()};
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("modal").classList.contains("open"))cerrar()});
render();
