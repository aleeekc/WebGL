var layerCount = 600;
    var randomSeed = Math.random() * 10;
    var useLighting = true;
    var parameters = {
      //ambientColor : [0.1, 0.1, 0.3],
      //directionalColor : [1, 1, 0.7],
      ambientColor : [0.1, 0.1, 0.5],
      directionalColor : [1, 1, 0.1],
      lightingDirection :  [1, 0, 0],
    }
  
    function start() {
      var canvas = getCanvas();
      //canvas.width = document.body.clientWidth;
      //canvas.height = document.body.clientHeight;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    
      webGLStart();
    }
  
    function webGLStart() {
      var canvas = getCanvas();

      if (canvas.addEventListener) {
        // IE9, Chrome, Safari, Opera
        canvas.addEventListener("mousewheel", MouseWheelHandler, false);
        // Firefox
        canvas.addEventListener("DOMMouseScroll", MouseWheelHandler, false);
      }
      // IE 6/7/8
      else canvas.attachEvent("onmousewheel", MouseWheelHandler);

      initGL(canvas);
      initShaders();
      initBuffers();
      initLight();

      gl.clearColor(0.0, 0.0, 0.0, 0.0);
      gl.enable(gl.DEPTH_TEST);

        canvas.onmousedown = handleMouseDown;
          document.onmouseup = handleMouseUp;
          document.onmousemove = handleMouseMove;

      requestAnimFrame(generateAnimFrame);
    } 

    var zoom = 1.5;

    function MouseWheelHandler(e) {

      var delta = 0;

      if (!event) event = window.event;

      // normalize the delta
      if (event.wheelDelta) {

        // IE and Opera
        delta = event.wheelDelta / 60;

      } else if (event.detail) {

        // W3C
        delta = -event.detail / 2;
      }

      zoom = Math.min(3,Math.max(0.25,zoom + delta/20));
      return false;
    }
    
    function degToRad(degrees) {
          return degrees * Math.PI / 180;
      }

    var mouseDown = false;
      var lastMouseX = null;
      var lastMouseY = null;

      var moonRotationMatrix = mat4.create();
      mat4.identity(moonRotationMatrix);

      function handleMouseDown(event) {
          mouseDown = true;
          lastMouseX = event.clientX;
          lastMouseY = event.clientY;
      }


      function handleMouseUp(event) {
          mouseDown = false;
      }


      function handleMouseMove(event) {
          if (!mouseDown) {
              return;
          }
          var newX = event.clientX;
          var newY = event.clientY;

          var deltaX = newX - lastMouseX
          var newRotationMatrix = mat4.create();
          mat4.identity(newRotationMatrix);
          mat4.rotate(newRotationMatrix, degToRad(deltaX / 10), [0, 1, 0]);

          var deltaY = newY - lastMouseY;
          mat4.rotate(newRotationMatrix, degToRad(deltaY / 10), [1, 0, 0]);

          mat4.multiply(newRotationMatrix, moonRotationMatrix, moonRotationMatrix);

          lastMouseX = newX
          lastMouseY = newY;
      }

    var gl;
    function initGL(canvas) {
      try {
        gl = canvas.getContext("experimental-webgl");
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
      } 
      catch (e) {
      }
      if (!gl) {
        alert("Could not initialise WebGL");
      }
    }
    
    function getShader(gl, id) {
      var shaderScript = document.getElementById(id);
      if (!shaderScript) {
        return null;
      }

      var str = "";
      var k = shaderScript.firstChild;
      while (k) {
        if (k.nodeType == 3) {
          str += k.textContent;
        }
        k = k.nextSibling;
      }

      var shader;
      if (shaderScript.type == "x-shader/x-fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
      } else if (shaderScript.type == "x-shader/x-vertex") {
        shader = gl.createShader(gl.VERTEX_SHADER);
      } else {
        return null;
      }

      gl.shaderSource(shader, str);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
      }

      return shader;
    }
    
    var shaderProgram;

    function initShaders() {
      var fragmentShader = getShader(gl, "shader-fs-light");
      var vertexShader = getShader(gl, "shader-vs-light");

      shaderProgram = gl.createProgram();
      gl.attachShader(shaderProgram, vertexShader);
      gl.attachShader(shaderProgram, fragmentShader);
      gl.linkProgram(shaderProgram);

      if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Could not initialise shaders");
      }

      gl.useProgram(shaderProgram);

      shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
      gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

      shaderProgram.vertexColorAttribute = gl.getAttribLocation(shaderProgram, "aVertexColor");
      gl.enableVertexAttribArray(shaderProgram.vertexColorAttribute);

      shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
      gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

      shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
      shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
      
      shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
      shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
      shaderProgram.useLightingUniform = gl.getUniformLocation(shaderProgram, "uUseLighting");
      shaderProgram.ambientColorUniform = gl.getUniformLocation(shaderProgram, "uAmbientColor");
      shaderProgram.lightingDirectionUniform = gl.getUniformLocation(shaderProgram, "uLightingDirection");
      shaderProgram.directionalColorUniform = gl.getUniformLocation(shaderProgram, "uDirectionalColor");
    }
    

    
    var triangleVertexPositionBuffer;
    var triangleVertexColorBuffer;
    var triangleVertexNormalBuffer;
    var squareVertexPositionBuffer;
    var squareVertexColorBuffer;
    
    function initBuffers() {
      var planet = generatePlanet(2, layerCount, sineWaveDisplacement);
    
      triangleVertexPositionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, triangleVertexPositionBuffer);

      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(planet.vertices), gl.STATIC_DRAW);
      triangleVertexPositionBuffer.itemSize = 3;
      triangleVertexPositionBuffer.numItems = planet.vertexCount;
      
      
      triangleVertexColorBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, triangleVertexColorBuffer);

      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(planet.colors), gl.STATIC_DRAW);
      triangleVertexColorBuffer.itemSize = 4;
      triangleVertexColorBuffer.numItems = planet.vertexCount;
      
      
      triangleVertexNormalBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, triangleVertexNormalBuffer);
      
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(planet.normals), gl.STATIC_DRAW);
      triangleVertexNormalBuffer.itemSize = 3;
      triangleVertexNormalBuffer.numItems = planet.vertexCount;
    }
    
    function initLight() {
      // lighting stuff
      gl.uniform1i(shaderProgram.useLightingUniform, useLighting);
      if (useLighting) {
        gl.uniform3f(shaderProgram.ambientColorUniform, parameters.ambientColor[0], parameters.ambientColor[1], parameters.ambientColor[2]);//, 0.1, 0.1, 0.1);
        
        var lightingDirection = parameters.lightingDirection; //[0, 0, 1];
        var adjustedLD = vec3.create();
        vec3.normalize(adjustedLD, lightingDirection);
        vec3.scale(adjustedLD, adjustedLD, -1);
        gl.uniform3fv(shaderProgram.lightingDirectionUniform, adjustedLD);
        
        gl.uniform3f(shaderProgram.directionalColorUniform, parameters.directionalColor[0], parameters.directionalColor[1], parameters.directionalColor[2]);//0.8, 0.8, 0.8);
      }
    }
    
    var mvMatrix = mat4.create();
    var pMatrix = mat4.create();

    function setMatrixUniforms() {
      gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
      gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
    }
    
    var planetAngle = 0;
    
    function drawScene() {
      gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      mat4.perspective(pMatrix, zoom, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0);

      mat4.identity(mvMatrix);
      mat4.translate(mvMatrix, mvMatrix, [0.0, 0.0, -7.0]);
      mat4.rotate(mvMatrix, mvMatrix, planetAngle, [0.15, 1, 0.3]);
      
      var normalMatrix = mat3.create();
      var mvMatrix3 = mat3.create();
      mat3.fromMat4(mvMatrix3, mvMatrix);
      mat3.invert(normalMatrix, mvMatrix3);
      mat3.transpose(normalMatrix, normalMatrix);

      gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, normalMatrix);
      
      gl.bindBuffer(gl.ARRAY_BUFFER, triangleVertexPositionBuffer);
      gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, triangleVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, triangleVertexNormalBuffer);
      gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, triangleVertexNormalBuffer.itemSize, gl.FLOAT, false, 0, 0);
      
      gl.bindBuffer(gl.ARRAY_BUFFER, triangleVertexColorBuffer);
      gl.vertexAttribPointer(shaderProgram.vertexColorAttribute, triangleVertexColorBuffer.itemSize, gl.FLOAT, false, 0, 0);

      setMatrixUniforms();
      gl.drawArrays(gl.TRIANGLES, 0, triangleVertexPositionBuffer.numItems);

    }
      
    function getCanvas() {
      return document.getElementById("canvas");
    }
    
    function sqr(x) { return x * x; }
    
    function distance(a, b) {
      return Math.sqrt(sqr(a[0]-b[0]) + sqr(a[1]-b[1]) + sqr(a[2]-b[2]));
    }
    
    function triangleSurface(a, b, c) {
      var s = (a + b + c) / 2;
      return Math.sqrt(s * (s - a) * (s - b) * (s - c));
    }
    
    function equilateralness(a, b, c) {
      return triangleSurface(a, b, c) / sqr(a+b+c);
    }
    
    function flatten(nestedList) {
      var flattened = [];
      for(var i = 0; i < nestedList.length; ++i) {
        var elmt = nestedList[i];
        if (elmt instanceof Array) {
          flattened = flattened.concat(flatten(elmt));
        }
        else flattened.push(elmt);
      }
      return flattened;
    }
    
    
    function generateSphereCoordinates(radius, layerCount) {
      if (layerCount < 3) {
        throw new Exception("layerCount must be at least 3");
      }
      
      var deltaAngle = Math.PI / (layerCount - 1);
      var layerDistance = 2 * radius * Math.sin(deltaAngle / 2);
      var targetSegmentLength = layerDistance / Math.cos(Math.PI / 6);
      
      var layers = [];
      
      // 1. generirane na tochki po sloeve
      var t0 = Date.now();
      for(var i = 0; i < layerCount; ++i) {
        var layerAngle = -Math.PI/2   + deltaAngle * i;
        var y = radius * Math.sin(layerAngle);
        var layerRadius = Math.cos(layerAngle) * radius;
        var circumference = layerRadius * 2 * Math.PI;
        var pointsInLayerCount = Math.max(1, Math.round(circumference / targetSegmentLength)); 
        var actualSegmentLength = circumference / pointsInLayerCount;
        
        var deltaPointAngle = 2 * Math.PI / pointsInLayerCount;
        
        var layer = [];
        
        for(var j = 0; j < pointsInLayerCount; ++j) {
          var angle = deltaPointAngle * j;
          var x = layerRadius * Math.cos(angle);
          var z = layerRadius * Math.sin(angle);
          layer.push([x, y, z]);
        }
        
        layers.push(layer);
      }
      
      // 2. generirane na trriagalnici po tochkite
      var lowerOffset = 0;
      var upperOffset = 0;
      var getIndexOnLowerLayer = function(index) { return index + lowerOffset; }
      var getIndexOnUpperLayer = function(index) { return index + upperOffset; }
      
      var triangles = [];
      
      for(var i = 0; i < layerCount - 1; ++i) {
        var lowerLayer = layers[i];
        var upperLayer = layers[i+1];
      
        var lowerIndex = 0;
        var upperIndex = 0;
        
        lowerOffset = upperOffset;
        upperOffset += lowerLayer.length;
        
        do {
          var p1 = lowerLayer[lowerIndex];
          var p2 = upperLayer[upperIndex];
          var p3 = lowerLayer[(lowerIndex+1) % lowerLayer.length];
          var p4 = upperLayer[(upperIndex+1) % upperLayer.length];
          
          var a = distance(p1, p2);
          var b = distance(p1, p3);
          var c = distance(p2, p4);
          var d = distance(p1, p4);
          var e = distance(p2, p3);
          
          if (equilateralness(a, c, d) > equilateralness(a, b, e)) {
            triangles.push([getIndexOnLowerLayer(lowerIndex), getIndexOnUpperLayer((upperIndex+1) % upperLayer.length), getIndexOnUpperLayer(upperIndex)]);
            upperIndex = (upperIndex + 1) % upperLayer.length;
          }
          else {
            triangles.push([getIndexOnLowerLayer(lowerIndex), getIndexOnLowerLayer((lowerIndex+1) % lowerLayer.length), getIndexOnUpperLayer(upperIndex)]); 
            lowerIndex = (lowerIndex + 1) % lowerLayer.length;
          }
          
        } while (lowerIndex!=0 || upperIndex!=0)
      }
      
      //console.log("triangles= " + JSON.stringify(triangles));
      
      // 3. vrastane na kordinatite na triagalnicite
      // slagane na vertices v edin list
      var allVertices = [];
      for(var i = 0; i < layers.length; ++i) {
        var layer = layers[i];
        var n = layer.length;
        for(var j = 0; j < n; ++j) {
          allVertices.push(layer[j]);
        }
      }
      
      var triangleCoordinates = new Array(triangles.length);
      for(var i = 0; i < triangles.length; ++i) {
        var triangle = triangles[i];
        var coordinates = [allVertices[triangle[0]], allVertices[triangle[1]], allVertices[triangle[2]]];
        triangleCoordinates[i] = coordinates;
      }
      //console.log("triagalnici: " + triangleCoordinates);
      return triangleCoordinates;
    }
      
      
    var lastTick = 0;
    function updateWorld() {
      var currentTick = Date.now();
      var tick = Math.min(500, currentTick - lastTick);
      
      planetAngle += tick/1000 * 0.3 * Math.PI;
      
      lastTick = currentTick;
    }
        
    
    function sineWaveDisplacement(v) {
      var amp = 0.05;
      var x = v[0]*2;
      var y = v[1]*2;
      var z = v[2]*2;
      var sin = Math.sin;
      var cos = Math.cos;
      
      var d = 1 + amp * (sin(x+0.4)*sin(y+7.8)+cos(z+randomSeed)*cos(y+0.53)+0.4*sin(3*x+2.5)*sin(4*z-4)+0.10*sin(6*x-3*y+6.1)*sin(6*z+6.5)+0.04*cos(10*z+0.3)*sin(12*y+4));
      
      //console.log("da go eva: " + d);
      return d;
    }
    
    function randomColor(r, g, b, maxDelta) {
      r += (Math.random()-0.5) * 2 * maxDelta;
      g += (Math.random()-0.5) * 2 * maxDelta;
      b += (Math.random()-0.5) * 2 * maxDelta;
      return [
        Math.min(Math.max(0, r), 1), 
        Math.min(Math.max(0, g), 1), 
        Math.min(Math.max(0, b), 1)
         ];
    }
    
    function interpolateBetween2Colors(r1, g1, b1, r2, g2, b2, k) {
      var k = Math.min(Math.max(0, k), 1);
      return [
        r1 * (1 - k) + r2 * k,
        g1 * (1 - k) + g2 * k,
        b1 * (1 - k) + b2 * k
      ];
    }
    
    // interpolate color where list = [{r:, g:, b:, x:}, ...]
    function interpolateAlongGradient(list, k) {
      if (list.length < 1) {
        throw new Exception("Грешка");
      }
      
      var index = 0;
      while (list[index].x < k && index < list.length - 1) {
        ++index;
      }
      if (list[index].x < k || index == 0) {
        return [
          list[index].r,
          list[index].g,
          list[index].b ];
      }
      else {
        var kk = (k - list[index - 1].x) / (list[index].x - list[index - 1].x);
        
        return interpolateBetween2Colors(
          list[index-1].r, list[index-1].g, list[index-1].b, 
          list[index].r, list[index].g, list[index].b, 
          kk);
      }
    }
    
    
    // vrashta vertices i cvqt { vertices : [...] , colors : [...]} 
    function generatePlanet(radius, layerCount, displacementFunction) {
      var displacementFunction = displacementFunction || function(v) { return 1; };
      
      var vertices = generateSphereCoordinates(radius, layerCount);
      
      var flatVertices = [];
      var flatNormals = [];
      var flatColors = [];
      
      var seaColorScheme = 1;
      var groundColorScheme = 2;
      
      for(var i = 0; i < vertices.length; ++i) {
        var triangle = vertices[i];
        for(var j = 0; j < triangle.length; ++j) {
          var vertice = triangle[j];
          var displacement = displacementFunction(vertice);
          var effectiveDisplacement = Math.max(1, displacement);
          flatVertices.push(effectiveDisplacement * vertice[0], effectiveDisplacement * vertice[1], effectiveDisplacement * vertice[2]);
          
          if (displacement<=1) { // more
            switch (seaColorScheme) {
              case 0:
                flatColors.push(0.05, 0.15, 0.5, 1.0);
                break;
                
              case 1:
                var seaColor = interpolateAlongGradient([
                    {r: 0.1, g: 0.3, b: 0.75, x: 0},
                    {r: 0.05, g: 0.15, b: 0.5, x: 0.04},
                    {r: 0.03, g: 0.1, b: 0.35, x: 0.1}
                  ], (1-displacement) * 7);
                flatColors.push(seaColor[0]); // red
                flatColors.push(seaColor[1]); // green
                flatColors.push(seaColor[2]); // blue
                flatColors.push(1.0); // alpha
                break;
            }
          }
          else { // zemq
            switch (groundColorScheme) {
              case 0: // ravnina
                flatColors.push(0.4, 0.3, 0.2, 1.0);
                break;
                
              case 1: // sluchaen cvqt
                var groundColor = randomColor(0.4, 0.3, 0.2, 0.1);
                flatColors.push(groundColor[0]); // red
                flatColors.push(groundColor[1]); // green
                flatColors.push(groundColor[2]); // blue
                flatColors.push(1.0); // alpha
                break;
                
              case 2: // cvqt spored visochinata
                var groundColor = interpolateAlongGradient([
                    {r: 0.6, g: 0.6, b: 0.3, x: 0},
                    {r: 0.3, g: 0.2, b: 0.1, x: 0.08},
                    {r: 0.1, g: 0.25, b: 0.1, x: 0.2},
                    {r: 0.35, g: 0.35, b: 0.35, x: 0.8},
                    {r: 0.8, g: 0.8, b: 0.8, x: 1.0}
                  ], (displacement-1) * 7);
                flatColors.push(groundColor[0]); // red
                flatColors.push(groundColor[1]); // green
                flatColors.push(groundColor[2]); // blue
                flatColors.push(1.0); // alpha
                break;
            }
          }
        }

        //console.log(flatColors);
        
        var n = flatVertices.length;
        var x1 = flatVertices[n-9];
        var y1 = flatVertices[n-8];
        var z1 = flatVertices[n-7];
        var x2 = flatVertices[n-6];
        var y2 = flatVertices[n-5];
        var z2 = flatVertices[n-4];
        var x3 = flatVertices[n-3];
        var y3 = flatVertices[n-2];
        var z3 = flatVertices[n-1];
        var ux = x2-x1;
        var uy = y2-y1;
        var uz = z2-z1;
        var vx = x3-x1;
        var vy = y3-y1;
        var vz = z3-z1;
        var normalX = uy*vz - uz*vy;
        var normalY = uz*vx - ux*vz;
        var normalZ = uz*vx - ux*vz;
        var norm = Math.sqrt(normalX*normalX + normalY*normalY + normalZ*normalZ);
        if (norm == 0) norm = 1;
        normalX /= norm;
        normalY /= norm;
        normalZ /= norm;
        for(var k = 0; k < 3; ++k) { 
          flatNormals.push(normalX);
          flatNormals.push(normalY);
          flatNormals.push(normalZ);
        }
      }

      
      var triangleCount = flatVertices.length / 9;
      //console.log("triangleCount: " + triangleCount);
      return {
        vertices : flatVertices,
        colors : flatColors,
        normals : flatNormals,
        vertexCount : triangleCount * 3
      };
    }
    
    function generateAnimFrame() {
      updateWorld();
      
      drawScene();
      
      requestAnimFrame(generateAnimFrame);
    }
    
    window.requestAnimFrame = (function() {
      return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame ||
      function(/* function */callback, /* DOMElement */element) {
        window.setTimeout(callback, 1 / 60);
      }

    })();
      
      