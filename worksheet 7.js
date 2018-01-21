var Quad = function(params){
  this.vertices = params['vertices'];

  if(params['image']){
    this.image    = params['image'];
  } else {
    this.texture_data = new Uint8Array([255, 0, 0, 255]);
  }

  if(params['edges']){
    this.edges = params['edges'];
  } else {
    this.edges = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0]
    ];
  }

  this.triangles = [
    [0, 1, 2],
    [2, 3, 0]
  ];
  this.normals = [];

  for (var i = 0; i < this.triangles.length; i++) {
    var triangle = this.triangles[i];

    var t1 = subtract(this.vertices[triangle[1]], this.vertices[triangle[0]]);
    var t2 = subtract(this.vertices[triangle[2]], this.vertices[triangle[0]]);
    var normal = vec4(normalize(cross(t2, t1)));

    this.normals.push(normal, normal, normal);
  }
};

  var sliderZoom = document.getElementById("myRangeZoom");
  var sliderCameraX = document.getElementById("myRangeX");
  var sliderCameraY = document.getElementById("myRangeY");
  var sliderCameraZ = document.getElementById("myRangeZ");
  var camera_zoom = 0.8;
  var camera_pos_x = 0.2;
  var camera_pos_y = 10;
  var camera_pos_z = 2;
// ===== RENDERER =====

var Obj = function(params){
  this.scene = params['scene'];
  this.model = params['model'];

  for(var propt in this)
    if(this[propt] === undefined)
      throw "Undefined " + propt + " in Obj()!"

  var program = this.program = this.scene.program;
  var gl      = this.gl      = this.scene.gl;

  this.buffers = {
    normals:   {}, // stores normal points for display purposes only
    vertices:  {}, // vertices
    edges:     {}, // lines connecting vertices
    triangles: {}  // triangles
  };

  this.to_render = {
    vertices:  false,
    edges:     false,
    normals:   false,
    triangles: true
  }

  this.shading_type = 1;
  this.light_type   = 'directional';

  this.a_light      = params['a_light'];
  this.casts_shadow = params['casts_shadow'];

  this.lightAmbient  = [255, 255, 255];
  this.lightDiffuse  = [255, 255, 255];
  this.lightSpecular = [255, 255, 255];

  this.materialAmbient  = [255, 255, 255];
  this.materialDiffuse  = [222, 20, 222];
  this.materialSpecular = [255, 255, 255];

  this.materialShinines = 100.0;

  this.texture_params = {
    'clamp_to_edge'         : gl.CLAMP_TO_EDGE,
    'repeat'                : gl.REPEAT,
    'mirrored_repeat'       : gl.MIRRORED_REPEAT,
    'linear'                : gl.LINEAR,
    'nearest'               : gl.NEAREST,
    'nearest_mipmap_nearest': gl.NEAREST_MIPMAP_NEAREST,
    'nearest_mipmap_linear' : gl.NEAREST_MIPMAP_LINEAR,
    'linear_mipmap_nearest' : gl.LINEAR_MIPMAP_NEAREST,
    'linear_mipmap_linear'  : gl.LINEAR_MIPMAP_LINEAR,
  }

  this.texture_wrap_s = 'repeat';
  this.texture_wrap_t = 'repeat';

  this.texture_min_filter = 'nearest';
  this.texture_mag_filter = 'nearest';

  this.transform_matrix = [
    vec4(1, 0, 0, 0),
    vec4(0, 1, 0, 0),
    vec4(0, 0, 1, 0),
    vec4(0, 0, 0, 1)
  ];
  this.angle = 0.0;

  this.init_geometry();
  this.init_lights();
}

Obj.prototype.init_geometry = function(){
  var _this = this;

  var gl = this.gl;
  var program = this.program;
  var buffers = this.buffers;
  var model = this.model;

  [{
      'name' : 'normals',
      'color': [0, 0, 1],
      'vertices' : function(){
        return model.normals
      }
    },{
      'name' : 'vertices',
      'color': [1, 1, 1],
      'vertices' : function(){
        return model.vertices
      }
    },{
      'name' : 'edges',
      'color': [1, 1, 1],
      'vertices' : function(){
        var vertices = [];

        model.edges.forEach(function(pair){
          vertices.push(
            model.vertices[pair[0]],
            model.vertices[pair[1]]
          );
        });

        return vertices;
      }
    },{
      'name': 'triangles',
      'color': [0.3, 0.3, 0.3],
      'vertices': function(){
        var vertices = [];

        model.triangles.forEach(function(triplet){
          vertices.push(
            model.vertices[triplet[0]],
            model.vertices[triplet[1]],
            model.vertices[triplet[2]]
          );
        });

        return vertices;
      },
      'normals': function(){
        var normals = [];

        model.normals.forEach(function(normal){
          normals.push(normal, normal, normal);
        });

        return normals;
      },
      'texture_coordinates': function(){
        return [
          vec2(0, 0),
          vec2(1, 0),
          vec2(1, 1),
          vec2(1, 1),
          vec2(0, 1),
          vec2(0, 0),
        ];
      }
    }
  ].forEach(function(_init){
    var buffer_group = buffers[_init['name']];
    var _vertices    = _init['vertices'].call();
    var _color       = _init['color'];

    gl.deleteBuffer(buffer_group.vertex_buffer);
    gl.deleteBuffer(buffer_group.color_buffer);
    gl.deleteBuffer(buffer_group.normals_buffer);
    gl.deleteBuffer(buffer_group.texture_buffer);
    gl.deleteBuffer(buffer_group.texture);

    // generate vertexes and populate buffer
    buffer_group.vertex_count = _vertices.length;
    buffer_group.vertex_buffer = gl.createBuffer();
    buffer_group.vPosition = gl.getAttribLocation( program, "vPosition" );
    gl.bindBuffer( gl.ARRAY_BUFFER, buffer_group.vertex_buffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(_vertices), gl.STATIC_DRAW);

    // generate colors and populate buffer
    var colors = [];
    for (var i = 0; i < _vertices.length; i++)
      colors.push(vec4(_color[0], _color[1], _color[2], 1))

    buffer_group.color_buffer = gl.createBuffer();
    buffer_group.vColor       = gl.getAttribLocation( program, "vColor" );
    gl.bindBuffer( gl.ARRAY_BUFFER, buffer_group.color_buffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW );

    // normals
    if(_init['normals']){
      var normals = _init['normals'].call();

      buffer_group.normals_count  = normals.length;
      buffer_group.normals_buffer = gl.createBuffer();
      buffer_group.vNormal        = gl.getAttribLocation(program, "vNormal");

      gl.bindBuffer( gl.ARRAY_BUFFER, buffer_group.normals_buffer);
      gl.bufferData( gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW );
    }

    // texture
    if(_init['texture_coordinates']){
      var texture_coors = _init['texture_coordinates'].call();

      buffer_group.uSampler = gl.getUniformLocation(program, "uSampler");

      if(model.image){
        gl.activeTexture(gl.TEXTURE0);
        buffer_group.texture  = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, buffer_group.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, model.image);
      } else {
        gl.activeTexture(gl.TEXTURE1);
        buffer_group.texture  = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, buffer_group.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, model.texture_data);
      }

      gl.generateMipmap( gl.TEXTURE_2D );

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, _this.texture_params[_this.texture_wrap_s]);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, _this.texture_params[_this.texture_wrap_t]);
      gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, _this.texture_params[_this.texture_min_filter]);
      gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, _this.texture_params[_this.texture_mag_filter]);
      gl.bindTexture(gl.TEXTURE_2D, null);

      buffer_group.texture_buffer = gl.createBuffer();
      buffer_group.vTexCoord = gl.getAttribLocation( program, "vTexCoord");
      gl.bindBuffer( gl.ARRAY_BUFFER, buffer_group.texture_buffer);
      gl.bufferData( gl.ARRAY_BUFFER, flatten(texture_coors), gl.STATIC_DRAW );
    }
  });

  this.do_shading_loc      = gl.getUniformLocation( program, "do_shading" );
  this.shading_type_loc    = gl.getUniformLocation( program, "shading_type" );
  this.is_shadow_loc       = gl.getUniformLocation( program, "is_shadow" );
  this.transorm_matrix_loc = gl.getUniformLocation( program, "transformMatrix" );
}

Obj.prototype.init_lights = function(){
  var program = this.program;
  var gl = this.gl;

  var light_types = {
    directional: 0.0,
    positional:  1.0,
  }

  // lighting
  var lightPosition = vec4(0.0, 0.0, -15.0, light_types[this.light_type] );

  var lightAmbient  = vec4.apply(null, this.lightAmbient.map(function(n){ return 1/255*n }));
  var lightDiffuse  = vec4.apply(null, this.lightDiffuse.map(function(n){ return 1/255*n }));
  var lightSpecular = vec4.apply(null, this.lightSpecular.map(function(n){ return 1/255*n }));

  var materialAmbient  = vec4.apply(null, this.materialAmbient.map(function(n){ return 1/255*n }));
  var materialDiffuse  = vec4.apply(null, this.materialDiffuse.map(function(n){ return 1/255*n }));
  var materialSpecular = vec4.apply(null, this.materialSpecular.map(function(n){ return 1/255*n }));

  var ambientProduct = mult(lightAmbient, materialAmbient);
  var diffuseProduct = mult(lightDiffuse, materialDiffuse);
  var specularProduct = mult(lightSpecular, materialSpecular);

  gl.uniform4fv( gl.getUniformLocation(program, "ambientProduct" ),  flatten(ambientProduct));
  gl.uniform4fv( gl.getUniformLocation(program, "diffuseProduct" ),  flatten(diffuseProduct));
  gl.uniform4fv( gl.getUniformLocation(program, "specularProduct"),  flatten(specularProduct));
  gl.uniform4fv( gl.getUniformLocation(program, "lightPosition"  ),  flatten(lightPosition));

  gl.uniform1f( gl.getUniformLocation(program, "shininess"),  this.materialShinines);
}

Obj.prototype.render = function(){
  var _this       = this;
  var buffers     = this.buffers;
  var gl          = this.gl;
  var to_render   = this.to_render;
  var model       = this.model;

  var _do_shading   = this.do_shading_loc;
  var _shading_type = this.shading_type_loc;
  var _is_shadow    = this.is_shadow_loc;

  this.scene.upload_matrices();

  gl.uniformMatrix4fv(this.transorm_matrix_loc, false, flatten(this.transform_matrix));
  gl.uniform1i(_shading_type, this.shading_type);
  gl.uniform1i(_is_shadow,    false);

  [{
    'name':'normals',
    'mode':'POINTS'
  },{
    'name':'vertices',
    'mode':'POINTS'
  },{
    'name':'edges',
    'mode':'LINES'
  },{
    'name':'triangles',
    'mode':'TRIANGLES'
  }].forEach(function(_render){
    var buffer_group = buffers[_render['name']];

    if(buffer_group.vertex_count && to_render[_render['name']]){
      gl.bindBuffer( gl.ARRAY_BUFFER, buffer_group.vertex_buffer );
      gl.vertexAttribPointer( buffer_group.vPosition, 4, gl.FLOAT, false, 0, 0 );
      gl.enableVertexAttribArray( buffer_group.vPosition );

      gl.bindBuffer( gl.ARRAY_BUFFER, buffer_group.color_buffer );
      gl.vertexAttribPointer( buffer_group.vColor, 4, gl.FLOAT, false, 0, 0 );
      gl.enableVertexAttribArray( buffer_group.vColor );

      if(buffer_group.vNormal && buffer_group.normals_count){
        gl.uniform1i(_do_shading, true);
        gl.bindBuffer( gl.ARRAY_BUFFER, buffer_group.normals_buffer );
        gl.vertexAttribPointer(buffer_group.vNormal, 4, gl.FLOAT, false, 0, 0 );
        gl.enableVertexAttribArray(buffer_group.vNormal);
      } else {
        gl.uniform1i(_do_shading, false);
      }

      // textures
      if(_render['name'] == 'triangles'){
        if(model.image){
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, buffer_group.texture);
          gl.uniform1i(buffer_group.uSampler, 0);
        } else {
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, buffer_group.texture);
          gl.uniform1i(buffer_group.uSampler, 1);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, buffer_group.texture_buffer);
        gl.vertexAttribPointer(buffer_group.vTexCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(buffer_group.vTexCoord);
      }

      gl.drawArrays( gl[_render['mode']], 0, buffer_group.vertex_count );

      // shadow business
      if(_this.casts_shadow){

        _this.scene.objects.forEach(function(object){
          if(object.a_light){
            gl.enable(gl.BLEND);
            gl.blendColor(1, 1, 1, 0.5);
            gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA);

            // model-view matrix for shadow then render
            var modelViewMatrix = lookAt(_this.scene.camera, _this.scene.at, _this.scene.up);

            var light = object.center;
            var m = mat4();

            m[3][3] = 0;
            // m[3][1] = -1/(light[1] + 0.999);
            m[3][1] = -1/(light[1] + 0.99);

            modelViewMatrix = mult(modelViewMatrix, translate(light[0], light[1], light[2]));
            modelViewMatrix = mult(modelViewMatrix, m);
            modelViewMatrix = mult(modelViewMatrix, translate(-light[0], -light[1], -light[2]));

            gl.uniform1i(_is_shadow, true);
            gl.uniformMatrix4fv(_this.scene.modelViewMatrixLoc,  false, flatten(modelViewMatrix));

            gl.drawArrays( gl[_render['mode']], 0, buffer_group.vertex_count );
            gl.disable(gl.BLEND);
          }

        });
      }

      gl.disableVertexAttribArray(buffer_group.vTexCoord);
      gl.disableVertexAttribArray(buffer_group.vPosition);
      gl.disableVertexAttribArray(buffer_group.vColor);
      gl.disableVertexAttribArray(buffer_group.vNormal);
    }
  });
}

Obj.prototype.tick = function(){
};

var Scene = function( params ){
  var gl      = this.gl      = params['gl'];
  var program = this.program = params['program'];

  for(var propt in this)
    if(this[propt] === undefined)
      throw "Undefined " + propt + " in Scene()!"

  this.objects = [];

  this.camera_scale = camera_zoom;//0.8;
  this.at = vec3(0.0, 0.0, 0.0);
  this.up = vec3(0.0, 1.0, 0.0);

  // camera position
  this.camera_x = 0.2;
  this.camera_y = 10;
  this.camera_z = 2;

  // Projection matrix
  this.fovy = 45.0;
  this.aspect = 1;
  this.near = 0.01;
  this.far = 100.0;

  // Matrix locations
  this.modelViewMatrixLoc  = gl.getUniformLocation( program, "modelViewMatrix" );
  this.projectionMatrixLoc = gl.getUniformLocation( program, "projectionMatrix" );
  this.normalMatrixLoc     = gl.getUniformLocation( program, "normalMatrix" );
  this.animate = 0;
  this.frame = 0;

  this.update();
};

Scene.prototype.render = function(){
  this.objects.forEach(function(o){ o.render() });
};

Scene.prototype.tick = function(){
  var _this = this;
  this.frame += 1;
  this.objects.forEach(function(o){ o.tick(_this.frame) });
};

Scene.prototype.update = function(){
  this.camera = vec3(
    camera_zoom*camera_pos_x,//this.camera_scale*this.camera_x,
    camera_zoom*camera_pos_y,//this.camera_scale*this.camera_y,
    camera_zoom*camera_pos_z,//this.camera_scale*this.camera_z
  );

  this.modelViewMatrix = lookAt(this.camera, this.at, this.up);
  this.projectionMatrix = perspective(this.fovy, this.aspect, this.near, this.far);
  this.normalMatrix = [
    vec3(this.modelViewMatrix[0][0], this.modelViewMatrix[0][1], this.modelViewMatrix[0][2]),
    vec3(this.modelViewMatrix[1][0], this.modelViewMatrix[1][1], this.modelViewMatrix[1][2]),
    vec3(this.modelViewMatrix[2][0], this.modelViewMatrix[2][1], this.modelViewMatrix[2][2])
  ];
};

Scene.prototype.upload_matrices = function(){
  var gl = this.gl;

  gl.uniformMatrix4fv(this.modelViewMatrixLoc,  false, flatten(this.modelViewMatrix));
  gl.uniformMatrix4fv(this.projectionMatrixLoc, false, flatten(this.projectionMatrix));
  gl.uniformMatrix3fv(this.normalMatrixLoc,     false, flatten(this.normalMatrix));
};

window.onload = function() {
  try {
    var image = document.createElement('img');
    image.src = 'xamp23.png';
    image.onload = function () {
      init({image: image});
    };
  }
  catch (e) { console.debug(e) }
}

var init = function( params ){
  var canvas = document.getElementById("gl-canvas");
  var gl = WebGLUtils.setupWebGL(canvas, { alpha: false });

  if (!gl) alert("WebGL isn’t available")

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.0, 0.3, 0.99, 1.0);

  // gl.clearColor(0, 0, 0, 1.0);
  gl.enable(gl.DEPTH_TEST);
  // gl.depthFunc(gl.LESS);

  // gl.enable(gl.CULL_FACE);
  // gl.cullFace(gl.BACK);

  var program = initShaders( gl, "vertex-shader", "fragment-shader" );
  gl.useProgram( program );

  var scene = new Scene({
    gl: gl,
    program: program
  });

  var floor = new Obj({
    scene: scene,
    model: new Quad({
      vertices: [
        vec4(-2.0, -1.0, 0.0,  1),
        vec4(2.0,  -1.0, 0.0,  1),
        vec4(2.0,  -1.0, -4.0, 1),
        vec4(-2.0, -1.0, -4.0, 1)
      ],
      image: params['image']
    })
  });

  var quad1 = new Obj({
    scene: scene,
    model: new Quad({
      vertices: [
        vec4(0.25, -0.5, -1.25, 1),
        vec4(0.75, -0.5, -1.25, 1),
        vec4(0.75, -0.5, -1.75, 1),
        vec4(0.25, -0.5, -1.75, 1)
      ]
    }),
    casts_shadow: true
  });

  var quad2 = new Obj({
    scene: scene,
    model: new Quad({
      vertices: [
        vec4(-1, -1.0, -2.5, 1),
        vec4(-1, -1.0, -3.5, 1),
        vec4(-1,  0.0, -3.5, 1),
        vec4(-1,  0.0, -2.5, 1)
      ]
    }),
    casts_shadow: true
  });

  scene.objects.push(floor);
  scene.objects.push(quad1);
  scene.objects.push(quad2);

  var light = new Obj({
    scene: scene,
    model: new Quad({
      vertices: [
        vec4(-0.25, 2, -1.75, 1),
        vec4( 0.25, 2, -1.75, 1),
        vec4( 0.25, 2, -2.25, 1),
        vec4(-0.25, 2, -2.25, 1),

        vec4(0.0, 2,  -2, 1),
        vec4(0.0, -1, -2, 1),
      ],
      edges: [[0, 2], [1, 3], [4,5]],
    }),
    a_light: true
  });

  light.to_render = {
    vertices:  true,
    edges:     true,
    normals:   false,
    triangles: false
  };

  light.center = [0, 2, -2];

  // light.transform_matrix[2][3] = -1;

  light.tick   = function(frame){
    this.angle += 0.01;

    if(this.angle > 2*Math.PI)
      this.angle -= 2*Math.PI;

    var x = 2*Math.sin(this.angle);
    var z = 2*Math.cos(this.angle);

    this.center[0] = x; //=
    this.center[2] = z; //
    this.transform_matrix[0][3] = x;
    this.transform_matrix[2][3] = 2 + z;
  };

  scene.objects.push(light);

  sliderZoom.oninput = function() {
            camera_zoom = this.value;
            scene.update();
        };

        sliderCameraX.oninput = function() {
            camera_pos_x = this.value;
            scene.update();
        };

        sliderCameraY.oninput = function() {
            camera_pos_y = this.value;
            scene.update();
        };

        sliderCameraZ.oninput = function() {
            camera_pos_z = this.value;
            scene.update();
        };

  var render = function(){
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

    scene.tick();
    scene.render();

    window.requestAnimFrame(function(){
      render()
    });
  }

  render();
}
