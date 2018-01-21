var Model = function(obj_file){
  var objDoc = new OBJDoc('filename');
  var result = objDoc.parse(obj_file, 1, false)
  var data   = objDoc.getDrawingInfo();

  this.colors    = data.colors;
  this.indices   = data.indices;
  this.vertices  = data.vertices;
  this.normals   = data.normals;
};

var canvas = null;
var image = null;
var teapot = {
  frame:     0,
  elevation: -1,
  rotation:  0,
  animate:   false,
  model:     null,
  string:    null
};

var gl = null;

var programs = {
  floor: null,
  teapot: null,
  shadow: null
}

var camera = new (function(){
  this.x = 0.0;
  this.y = 0.5;
  this.z = -10.0;
})();

var fbo = {
  buffer: null,
  width:  2048,
  height: 2048
};

var look_at = vec3(0.0, 0.0, -3.0);

var init = function( params ){
  canvas = document.getElementById("gl-canvas");
  gl = WebGLUtils.setupWebGL(canvas, { alpha: false, stencil: true } );

  if (!gl) alert("WebGL isn’t available")

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.0, 0.3, 0.99, 1.0);

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LESS);

  // gl.enable(gl.CULL_FACE);
  // gl.cullFace(gl.BACK);

  programs['floor']  = initShaders( gl, "vertex-shader-floor",  "fragment-shader-floor" );
  programs['teapot'] = initShaders( gl, "vertex-shader-teapot", "fragment-shader-teapot" );
  programs['shadow'] = initShaders( gl, "vertex-shader-shadow", "fragment-shader-shadow" );

  setup_floor();
  setup_teapot();
  setup_light();
  setup_fbo();

  var call_render = function(){
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT );


    update_teapot();
    update_light();

    var mvpFromLightMatrices = render_fbo();

    render_floor( { mvpFromLightMatrix: mvpFromLightMatrices['mvpFromLightFloorMatrix']  });
    render_teapot( { reflection: true });
    render_teapot( { mvpFromLightMatrix: mvpFromLightMatrices['mvpFromLightTeapotMatrix'] });

    window.requestAnimFrame(call_render);
  };
  call_render()
}

/* ========== Rendering part ========== */

/* Framebuffer object */
var setup_fbo = function(){
  var texture, depthBuffer;
  var framebuffer = gl.createFramebuffer();

  texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fbo['width'], fbo['height'], 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

  depthBuffer = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, fbo['width'], fbo['height']);

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);

  framebuffer.texture = texture;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);

  fbo['buffer'] = framebuffer;
};

var render_fbo = function(){
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo['buffer']);
  gl.viewport(0, 0, fbo['width'], fbo['height']);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

  gl.useProgram(programs['shadow']);

  var mvpFromLightTeapotMatrix = render_teapot({ shadow: true });
  var mvpFromLightFloorMatrix  = render_floor({ shadow: true });

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

  return ({
    mvpFromLightTeapotMatrix: mvpFromLightTeapotMatrix,
    mvpFromLightFloorMatrix:  mvpFromLightFloorMatrix
  });
};

/* FLOOR */
var floor_buffers = {
  floor: {
    vertex_buffer:  null,
    vPosition_loc:  null,

    texture:        null,
    uSampler_loc:   null,
    uShadowMap_loc: null,

    texture_buffer: null,
    vTexCoord_loc:  null,

    modelViewMatrix_loc:    null,
    projectionMatrix_loc:   null,
    mvpMatrixFromLight_loc: null
  },
  shadow: {
    vertex_buffer:  null,
    vPosition_loc:  null,

    modelViewMatrix_loc:    null,
    projectionMatrix_loc:   null,
    mvpMatrixFromLight_loc: null
  }
};

var setup_floor = function(){
  var floor_vertices = [
    vec4(-2.0, -1.0, 0.0,  1),
    vec4(2.0,  -1.0, 0.0,  1),
    vec4(2.0,  -1.0, -4.0, 1),
    vec4(-2.0, -1.0, -4.0, 1)
  ];

  /* Normal shader setup */
  gl.useProgram( programs['floor'] );
  var buffers = floor_buffers['floor'];

  buffers['vertex_buffer'] = gl.createBuffer();
  buffers['vPosition_loc'] = gl.getAttribLocation( programs['floor'], "vPosition" );
  gl.bindBuffer( gl.ARRAY_BUFFER, buffers['vertex_buffer'] );
  gl.bufferData( gl.ARRAY_BUFFER, flatten(floor_vertices), gl.STATIC_DRAW);

  buffers['uShadowMap_loc'] = gl.getUniformLocation(programs['floor'], "uShadowMap");
  buffers['uSampler_loc'] = gl.getUniformLocation(programs['floor'], "uSampler");

  gl.activeTexture(gl.TEXTURE1);
  buffers['texture'] = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, buffers['texture']);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

  gl.generateMipmap(gl.TEXTURE_2D );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.bindTexture(gl.TEXTURE_2D, null);

  buffers['texture_buffer'] = gl.createBuffer();
  buffers['vTexCoord_loc']  = gl.getAttribLocation( programs['floor'], "vTexCoord");

  gl.bindBuffer( gl.ARRAY_BUFFER, buffers['texture_buffer']);
  gl.bufferData( gl.ARRAY_BUFFER, flatten([vec2(0, 0), vec2(1, 0), vec2(1, 1), vec2(0, 1)]), gl.STATIC_DRAW );

  buffers['modelViewMatrix_loc']    = gl.getUniformLocation( programs['floor'], "modelViewMatrix" );
  buffers['projectionMatrix_loc']   = gl.getUniformLocation( programs['floor'], "projectionMatrix" );
  buffers['mvpMatrixFromLight_loc'] = gl.getUniformLocation( programs['floor'], "mvpMatrixFromLight" );

  /* Shadow setup */
  gl.useProgram( programs['shadow'] );
  var shadow_buffers = floor_buffers['shadow'];
  shadow_buffers['vertex_buffer'] = gl.createBuffer();
  shadow_buffers['vPosition_loc'] = gl.getAttribLocation( programs['shadow'], "vPosition" );
  gl.bindBuffer( gl.ARRAY_BUFFER, shadow_buffers['vertex_buffer'] );
  gl.bufferData( gl.ARRAY_BUFFER, flatten(floor_vertices), gl.STATIC_DRAW);
  shadow_buffers['modelViewMatrix_loc']  = gl.getUniformLocation( programs['shadow'], "modelViewMatrix" );
  shadow_buffers['projectionMatrix_loc'] = gl.getUniformLocation( programs['shadow'], "projectionMatrix" );
};

var render_floor = function( params ){
  var shadow = params && params['shadow'];
  var buffers = shadow ? floor_buffers['shadow'] : floor_buffers['floor'];

  if(shadow){
    var _camera = vec3(light.value[0], light.value[1], light.value[2]);
  } else {
    var _camera = vec3(camera.x, camera.y, camera.z);
  }

  if(!shadow) gl.useProgram(programs['floor']);

  gl.disable(gl.STENCIL_TEST);

  gl.bindBuffer( gl.ARRAY_BUFFER, buffers['vertex_buffer'] );
  gl.vertexAttribPointer( buffers['vPosition_loc'], 4, gl.FLOAT, false, 0, 0 );
  gl.enableVertexAttribArray( buffers['vPosition_loc'] );

  if(!shadow){
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbo['buffer'].texture);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, buffers['texture']);

    gl.uniform1i(buffers['uSampler_loc'], 1);
    gl.uniform1i(buffers['uShadowMap_loc'], 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers['texture_buffer']);
    gl.vertexAttribPointer(buffers['vTexCoord_loc'], 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(buffers['vTexCoord_loc']);
  }

  /* moving it a little bit */
  var transform = mat4();

  /* rotation */
  transform = rotate(3*teapot['rotation'], [1,1,1]);

  // transform[2][3] = -1;
  var modelViewMatrix = mult(
    lookAt(_camera, look_at, vec3(0.0, 1.0, 0.0)),
    transform
  );

  if(shadow){
    var projectionMatrix = perspective(90.0, 1, 0.01, 100.0);
  } else {
    var projectionMatrix = perspective(45.0, 1, 0.01, 100.0);
  }

  gl.uniformMatrix4fv(buffers['modelViewMatrix_loc'],  false, flatten(modelViewMatrix));
  gl.uniformMatrix4fv(buffers['projectionMatrix_loc'], false, flatten(projectionMatrix));

  if(params['mvpFromLightMatrix']){
    gl.uniformMatrix4fv(buffers['mvpMatrixFromLight_loc'], false, flatten(params['mvpFromLightMatrix']));
  }

  if(!shadow){
    gl.enable(gl.STENCIL_TEST);
    gl.stencilFunc(gl.ALWAYS, 1, 1);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);

    gl.drawArrays( gl.TRIANGLE_FAN, 0, 4 );
  }

  return mult(projectionMatrix, modelViewMatrix);
};

/* TEAPOT */
var teapot_buffers = {
  teapot: {
    vertex_buffer:        null,
    indices_buffer:       null,
    normals_buffer:       null,

    modelViewMatrix_loc:  null,
    projectionMatrix_loc: null,
    normalMatrix_loc:     null,
  },
  shadow: {
    vertex_buffer:        null,
    indices_buffer:       null,
    normals_buffer:       null,

    modelViewMatrix_loc:  null,
    projectionMatrix_loc: null,
    normalMatrix_loc:     null,
  }
};

var setup_teapot = function(){
  teapot['model'] = new Model(teapot['string']);

  ['teapot', 'shadow'].forEach(function(key){
    var buffers = teapot_buffers[key];

    gl.useProgram( programs[key] );

    /* vertex positions */
    buffers['vertex_buffer'] = gl.createBuffer();
    buffers['vPosition_loc'] = gl.getAttribLocation( programs[key], "vPosition" );
    gl.bindBuffer( gl.ARRAY_BUFFER, buffers['vertex_buffer'] );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(teapot['model'].vertices), gl.STATIC_DRAW);

    /* indices */
    buffers['indices_buffer'] = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers['indices_buffer']);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, teapot['model'].indices, gl.STATIC_DRAW);

    /* normals */
    buffers['normals_buffer'] = gl.createBuffer();
    buffers['vNormal_loc'] = gl.getAttribLocation( programs[key], "vNormal" );
    gl.bindBuffer( gl.ARRAY_BUFFER, buffers['normals_buffer'] );
    gl.bufferData( gl.ARRAY_BUFFER, teapot['model'].normals, gl.STATIC_DRAW);

    /* matrixes */
    buffers['modelViewMatrix_loc']  = gl.getUniformLocation( programs[key], "modelViewMatrix" );
    buffers['projectionMatrix_loc'] = gl.getUniformLocation( programs[key], "projectionMatrix" );
    buffers['normalMatrix_loc']     = gl.getUniformLocation( programs[key], "normalMatrix" );
  });
};

var render_teapot = function( params ){
  var shadow = params && params['shadow'];
  var reflection = params && params['reflection'];
  var buffers = shadow ? teapot_buffers['shadow'] : teapot_buffers['teapot'];
  var _camera = shadow ? vec3(light.value[0], light.value[1], light.value[2]) : vec3(camera.x, camera.y, camera.z);

  if(!shadow) gl.useProgram(programs['teapot']);

  /* vertex positions */
  gl.bindBuffer( gl.ARRAY_BUFFER, buffers['vertex_buffer'] );
  gl.vertexAttribPointer( buffers['vPosition_loc'], 3, gl.FLOAT, false, 0, 0 );
  gl.enableVertexAttribArray( buffers['vPosition_loc'] );

  /* normals */
  if(!shadow){
    gl.bindBuffer( gl.ARRAY_BUFFER, buffers['normals_buffer'] );
    gl.vertexAttribPointer( buffers['vNormal_loc'], 3, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( buffers['vNormal_loc'] );
  }

  if(shadow){
    var projectionMatrix = perspective(80.0, 1, 0.01, 100.0);
  } else {
    var projectionMatrix = perspective(45.0, 1, 0.01, 100.0);
  }

  /* matrices */
  var transform = mat4();

  /* rotation */
  transform = rotate(3*teapot['rotation'], [1,1,1]);

  /* scale */            /* moving */
  transform[0][0] = 1/4; transform[0][3] = 0;
  transform[1][1] = 1/4; transform[1][3] = teapot['elevation'];
  transform[2][2] = 1/4; transform[2][3] = -2;

  var modelViewMatrix = mult(
    lookAt(_camera, look_at, vec3(0.0, 1.0, 0.0)),
    transform
  );

  var normalMatrix = [
    vec3(modelViewMatrix[0][0], modelViewMatrix[0][1], modelViewMatrix[0][2]),
    vec3(modelViewMatrix[1][0], modelViewMatrix[1][1], modelViewMatrix[1][2]),
    vec3(modelViewMatrix[2][0], modelViewMatrix[2][1], modelViewMatrix[2][2])
  ];

  gl.uniformMatrix4fv(buffers['modelViewMatrix_loc'],  false, flatten(modelViewMatrix));
  gl.uniformMatrix4fv(buffers['projectionMatrix_loc'], false, flatten(projectionMatrix));
  gl.uniformMatrix3fv(buffers['normalMatrix_loc'],     false, flatten(normalMatrix));

  if(params['mvpFromLightMatrix'])
    gl.uniformMatrix4fv(buffers['mvpMatrixFromLight_loc'], false, flatten(params['mvpFromLightMatrix']));

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers['indices_buffer']);
  gl.drawElements( gl.TRIANGLES, teapot['model'].indices.length, gl.UNSIGNED_SHORT, 0);


  if(shadow) return mult(projectionMatrix, modelViewMatrix);
  if(!reflection) return;

  // do the reflection
  var A = 0; var B = -1; var C = 0; var D = -1;
  var reflect = mat4(
    vec4(1-2*A*A,  -2*A*B, -2*A*C, -2*A*D),
    vec4(-2*B*A,  1-2*B*B,  -2*B*C,-2*B*D),
    vec4(-2*C*A,  -2*C*B, 1-2*C*C, -2*C*D),
    vec4(0,            0,       0,      1)
  );

  modelViewMatrix = mult(lookAt(_camera, look_at, vec3(0.0, 1.0, 0.0)), reflect);
  // modelViewMatrix = mult(modelViewMatrix, scalem(1/4, 1/4, 1/4));
  // transform = rotate(3*teapot['rotation'], [1,1,1]);
  // transform[1][3] += (teapot['elevation'] - 2);
  // transform[2][2] = -5;
  // transform[2][3] = -9;
  modelViewMatrix = mult(modelViewMatrix, transform);

  // draw reflections
  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.stencilFunc(gl.EQUAL, 1, 1);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

  gl.enable(gl.BLEND);
  gl.blendColor(1, 1, 1, 0.3);
  gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA);

  gl.uniformMatrix4fv(buffers['modelViewMatrix_loc'],  false, flatten(modelViewMatrix));
  gl.drawElements( gl.TRIANGLES, teapot['model'].indices.length, gl.UNSIGNED_SHORT, 0);
  gl.disable(gl.BLEND);
};

var update_teapot = function(){
  if(document.getElementById("teapot_check").checked){ //  teapot['animate']
    teapot['frame']    += 0.03;
    teapot['elevation'] = Math.sin(teapot['frame']);
    teapot['rotation']  = Math.cos(teapot['frame']);
  }
};

/* light */
var light = {
  animate: false,
  loc: null,
  value: new Float32Array([0.01, 5.0, -3.0]),
  angle: 0
};

var setup_light = function(){
  light['loc'] = gl.getUniformLocation( programs['teapot'], "lightPosition" );
};

var update_light = function(){
  gl.useProgram(programs['teapot']);

  if(document.getElementById("light_check").checked){  //light['animate']
    light['angle'] += 0.01;

    if(light['angle'] > 2*Math.PI)
      light['angle'] = 0;

    light['value'][0] = Math.cos(light['angle']);
    light['value'][2] = Math.sin(light['angle']) - 2;
  }

  gl.uniform3fv( light['loc'], light['value']);
};

var load_texture = function(callback){
  image = document.createElement('img');
  image.src = 'xamp23.png';
  image.onload = callback;
};

var load_teapot = function(callback){
   var xhr = new XMLHttpRequest();
   xhr.onreadystatechange = function() {
      if (xhr.readyState == XMLHttpRequest.DONE) {
        teapot['string'] = xhr.responseText;
        callback();
      }
  }
  xhr.open('GET', 'teapot.obj', true);
  xhr.send(null);
};

window.onload = function(){
  var slider = document.getElementById("myRange");

  slider.oninput = function() {
    camera.y = this.value;
  } ;

  load_texture(function(){
    load_teapot(function(){
      init();
    })
  });
}