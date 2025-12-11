(() => {
  // ---- Утилиты матриц 4x4 (row-major) ----
  function matIdentity() {
    return [
      1,0,0,0,
      0,1,0,0,
      0,0,1,0,
      0,0,0,1
    ];
  }

  function matMul(a,b){
    const r = new Array(16).fill(0);
    for(let i=0;i<4;i++){
      for(let j=0;j<4;j++){
        let s=0;
        for(let k=0;k<4;k++){
          s += a[i*4+k]*b[k*4+j];
        }
        r[i*4+j]=s;
      }
    }
    return r;
  }

  function matTranslate(tx, ty, tz){
    const m = matIdentity();
    // row-major: последний столбец для переноса
    m[3] = tx;
    m[7] = ty;
    m[11] = tz;
    return m;
  }

  function matScale(sx,sy,sz){
    const m = matIdentity();
    m[0]=sx; m[5]=sy; m[10]=sz;
    return m;
  }

  function matRotateAxis(ax,ay,az,deg){
    let len = Math.hypot(ax,ay,az);
    if(len===0) return matIdentity();
    ax/=len; ay/=len; az/=len;
    const rad = deg*Math.PI/180;
    const c=Math.cos(rad), s=Math.sin(rad), t=1-c;

    const m = matIdentity();
    m[0] = t*ax*ax + c;
    m[1] = t*ax*ay - s*az;
    m[2] = t*ax*az + s*ay;

    m[4] = t*ax*ay + s*az;
    m[5] = t*ay*ay + c;
    m[6] = t*ay*az - s*ax;

    m[8] = t*ax*az - s*ay;
    m[9] = t*ay*az + s*ax;
    m[10]= t*az*az + c;
    return m;
  }

  function transformPoint(m, p){
    const x=p[0], y=p[1], z=p[2], w=1;
    const nx = m[0]*x + m[1]*y + m[2]*z + m[3]*w;
    const ny = m[4]*x + m[5]*y + m[6]*z + m[7]*w;
    const nz = m[8]*x + m[9]*y + m[10]*z + m[11]*w;
    return [nx, ny, nz];
  }

  // ---- Модель буквы D ----
  function buildLetterD(depth = 0.6, curveSegments=22){
    const vertices = [];
    const edges = [];
    const top = [ -0.6, 1.0 ];
    const bottom = [ -0.6, -1.0 ];
    const cx = -0.1, cy = 0;
    const radius = 1.0;
    const zf = depth/2;
    const zb = -depth/2;

    // front
    vertices.push([top[0], top[1], zf]);    // 0
    vertices.push([bottom[0], bottom[1], zf]); // 1
    for(let i=0;i<=curveSegments;i++){
      const t = Math.PI * (i/curveSegments);
      const x = cx + radius*Math.cos(Math.PI/2 - t);
      const y = cy + radius*Math.sin(Math.PI/2 - t);
      vertices.push([x,y,zf]);
    }
    const frontCount = vertices.length;

    // back
    const backStart = vertices.length;
    for(let i=0;i<frontCount;i++){
      const v = vertices[i];
      vertices.push([v[0], v[1], zb]);
    }

    // edges front
    edges.push([0,1]);
    edges.push([0,2]);
    edges.push([1, frontCount-1]);
    for(let i=2;i<frontCount-1;i++) edges.push([i,i+1]);

    // edges back
    edges.push([backStart+0, backStart+1]);
    edges.push([backStart+0, backStart+2]);
    edges.push([backStart+1, backStart + (frontCount-1)]);
    for(let i=backStart+2;i<backStart+frontCount-1;i++){
      edges.push([i,i+1]);
    }

    // side edges
    for(let i=0;i<frontCount;i++){
      edges.push([i, backStart+i]);
    }

    return {vertices, edges};
  }

  // ---- Канвасы и UI ----
  const mainCanvas = document.getElementById('mainCanvas');
  const ctx = mainCanvas.getContext('2d');
  const projXY = document.getElementById('projXY').getContext('2d');
  const projXZ = document.getElementById('projXZ').getContext('2d');
  const projYZ = document.getElementById('projYZ').getContext('2d');
  const matrixOut = document.getElementById('matrixOut');

  const model = buildLetterD(0.6,26);
  let currentMatrix = matIdentity();

  function clearCanvas(c,w,h){
    c.clearRect(0,0,w,h);
    c.fillStyle="#fff";
    c.fillRect(0,0,w,h);
  }

  // ---- Проекции ----
  function projectPerspective(p, w, h){
    const camZ = 3, f=600;
    const z = p[2] + camZ;
    const s = f / (z || 0.0001);
    return [p[0]*s + w/2, -p[1]*s + h/2];
  }

  function projectOrthoXY(p,w,h){ const s=80; return [p[0]*s+w/2, -p[1]*s+h/2]; }
  function projectOrthoXZ(p,w,h){ const s=80; return [p[0]*s+w/2, -p[2]*s+h/2]; }
  function projectOrthoYZ(p,w,h){ const s=80; return [p[1]*s+w/2, -p[2]*s+h/2]; }

  function drawProjectionCanvas(c,w,h,vertices,projector){
    clearCanvas(c,w,h);
    c.lineWidth=1.5; c.strokeStyle="#222";
    for(const e of model.edges){
      const a = projector(vertices[e[0]], w,h);
      const b = projector(vertices[e[1]], w,h);
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
    }
  }

  // ---- Основной рендер ----
  function draw(){
    clearCanvas(ctx, mainCanvas.width, mainCanvas.height);
    const showAxes = document.getElementById('showAxes').checked;
    if(showAxes){
      ctx.save();
      ctx.strokeStyle="#ccc"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(mainCanvas.width/2,0); ctx.lineTo(mainCanvas.width/2,mainCanvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,mainCanvas.height/2); ctx.lineTo(mainCanvas.width, mainCanvas.height/2); ctx.stroke();
      ctx.restore();
    }

    const transformed = model.vertices.map(v=>transformPoint(currentMatrix,v));

    ctx.lineWidth=parseInt(document.getElementById('lineWidth').value,10);
    ctx.strokeStyle="#111";

    const projection = document.getElementById('mainProjection').value;

    for(const e of model.edges){
      const a = transformed[e[0]];
      const b = transformed[e[1]];
      let pa, pb;
      if(projection==='perspective'){ pa = projectPerspective(a,ctx.canvas.width,ctx.canvas.height); pb = projectPerspective(b,ctx.canvas.width,ctx.canvas.height); }
      else if(projection==='ortho_xy'){ pa = projectOrthoXY(a,ctx.canvas.width,ctx.canvas.height); pb = projectOrthoXY(b,ctx.canvas.width,ctx.canvas.height); }
      else if(projection==='ortho_xz'){ pa = projectOrthoXZ(a,ctx.canvas.width,ctx.canvas.height); pb = projectOrthoXZ(b,ctx.canvas.width,ctx.canvas.height); }
      else if(projection==='ortho_yz'){ pa = projectOrthoYZ(a,ctx.canvas.width,ctx.canvas.height); pb = projectOrthoYZ(b,ctx.canvas.width,ctx.canvas.height); }

      ctx.beginPath();
      ctx.moveTo(pa[0],pa[1]);
      ctx.lineTo(pb[0],pb[1]);
      ctx.stroke();
    }

    drawProjectionCanvas(projXY,projXY.canvas.width,projXY.canvas.height,transformed,projectOrthoXY);
    drawProjectionCanvas(projXZ,projXZ.canvas.width,projXZ.canvas.height,transformed,projectOrthoXZ);
    drawProjectionCanvas(projYZ,projYZ.canvas.width,projYZ.canvas.height,transformed,projectOrthoYZ);
  }

  // ---- UI обработчики ----
  document.getElementById('applyTranslate').addEventListener('click', ()=>{
    const tx=parseFloat(document.getElementById('tx').value)||0;
    const ty=parseFloat(document.getElementById('ty').value)||0;
    const tz=parseFloat(document.getElementById('tz').value)||0;
    currentMatrix = matMul(matTranslate(tx,ty,tz), currentMatrix);
    draw();
  });

  document.getElementById('applyScale').addEventListener('click', ()=>{
    const sx=parseFloat(document.getElementById('sx').value)||1;
    const sy=parseFloat(document.getElementById('sy').value)||1;
    const sz=parseFloat(document.getElementById('sz').value)||1;
    currentMatrix = matMul(matScale(sx,sy,sz), currentMatrix);
    draw();
  });

  document.getElementById('applyRotate').addEventListener('click', ()=>{
    const angle=parseFloat(document.getElementById('angle').value)||0;
    const ax=parseFloat(document.getElementById('ax').value)||0;
    const ay=parseFloat(document.getElementById('ay').value)||0;
    const az=parseFloat(document.getElementById('az').value)||1;
    currentMatrix = matMul(matRotateAxis(ax,ay,az,angle), currentMatrix);
    draw();
  });

  document.getElementById('resetBtn').addEventListener('click', ()=>{
    currentMatrix = matIdentity();
    ['tx','ty','tz','sx','sy','sz','angle','ax','ay','az'].forEach(id=>{
      document.getElementById(id).value=(id.startsWith('s')?1: id.startsWith('a')? (id==='az'?1:0) : 0);
    });
    draw();
  });

  document.getElementById('exportMatrix').addEventListener('click', ()=>{
    let s="";
    for(let r=0;r<4;r++){
      s += currentMatrix.slice(r*4,r*4+4).map(x=>Number(x).toFixed(4)).join("\t")+"\n";
    }
    matrixOut.value=s;
  });

  document.getElementById('mainProjection').addEventListener('change', draw);
  document.getElementById('showAxes').addEventListener('change', draw);
  document.getElementById('lineWidth').addEventListener('input', draw);

  draw();
})();
