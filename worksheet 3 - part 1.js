"use strict";

function main3Point() {
	var cubeVertices = [
		-1, -1, -1,
		 1, -1, -1,
		 1,  1, -1,
		-1,  1, -1,
		-1, -1,  1,
		 1, -1,  1,
		 1,  1,  1,
		-1,  1,  1,
	];
	var indices = [
		0, 1,
		1, 2,
		2, 3,
		3, 0,
		4, 5,
		5, 6,
		6, 7,
		7, 4,
		0, 4,
		1, 5,
		2, 6,
		3, 7,
	];

	var canvas = document.getElementById("canvasThreePoint");
	var gl = canvas.getContext("webgl");
	if (!gl) {
		return;
	}

	var program = webglUtils.createProgramFromScripts(
			gl, ["2d-vertex-shader", "2d-fragment-shader"]);
	gl.useProgram(program);

	var positionLoc = gl.getAttribLocation(program, "a_position");
	var worldViewProjectionLoc =
			gl.getUniformLocation(program, "u_worldViewProjection");

	var buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array(cubeVertices),
			gl.STATIC_DRAW);
	gl.enableVertexAttribArray(positionLoc);
	gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);

	var buffer = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
	gl.bufferData(
			gl.ELEMENT_ARRAY_BUFFER,
			new Uint16Array(indices),
			gl.STATIC_DRAW);

	function render() {

		webglUtils.resizeCanvasToDisplaySize(gl.canvas, window.devicePixelRatio);

		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

		gl.clear(gl.COLOR_BUFFER_BIT);

		var fieldOfView = 45; // 45 degrees
		var aspect = canvas.clientWidth / canvas.clientHeight;
		var projection = m4.perspective(fieldOfView, aspect, 1, 500);
		var radius = 5;
		var eye = [
				Math.sin(0.6) * radius,
				2,
				Math.cos(0.6) * radius];
		var target = [0, 0, 0];
		var up = [0, 1, 0];
		var camera = m4.lookAt(eye, target, up);
		var view = m4.inverse(camera);

		var worldViewProjection = m4.multiply(projection, view);
		gl.uniformMatrix4fv(
				worldViewProjectionLoc, false, worldViewProjection);

		gl.drawElements(gl.LINES, indices.length, gl.UNSIGNED_SHORT, 0);
	}
	render();
}

main3Point();