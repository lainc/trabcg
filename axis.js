var gl;
var shaderBaseImage = null;
var shaderAxis      = null;
var axis            = null;
var baseTexture     = null;

var texture         = new Array;
var normalMap       = new Matrix4();
var modelMat        = new Matrix4();
var MVPMat          = new Matrix4();
var textureOK       = 0;

var model           = new Array;
var material        = new Array;

var light1Color = [0.4, 0.4, 0.4, 1];
var light2Color = [1,1,1,1];

var light1Pos = new Vector3(4, 0, 3.5);
var light2Pos = new Vector3(5, 3, 3);

var camPos = [0.0, 0.0, 0.0];

var g_objDoc        = null; // The information of OBJ file
var g_drawingInfo   = null; // The information for drawing 3D model

var EARTH      = 0, // Indices para as texturas
    MOON       = 1;

var rotEarth      = 0.0,
    rotEarthOrbit = 0.0;
    deltaRot      = 2.0;

var video,
    videoImage,
    videoImageContext,
    videoTexture;

var imageData,
    detector,
    posit;

var modelSize   = 90.0; // tamanho em milimetros do marker


var rotMat      = new Matrix4();
var transMat    = new Matrix4();
var scaleMat    = new Matrix4();

// ********************************************************
var yaw         = 0.0,
    pitch       = 0.0,
    roll        = 0.0;

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
window.URL = window.URL || window.webkitURL;

function initGL(canvas) {

    var gl = canvas.getContext("webgl");
    if (!gl) {
        return (null);
        }

    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.enable(gl.CULL_FACE);
    gl.frontFace(gl.CCW);

    return gl;
}

function initTextures() {

    texture = new Array(g_drawingInfo.mtl.length*2);

    for(var i = 0 ; i < g_drawingInfo.mtl.length ; i++) {
        var m = g_drawingInfo.mtl[i];
        for(var j = 0 ; j < m.materials.length ; j++) {
            if (m.materials[j].mapKd == "")
                continue;
            initTexture(m.materials[j].mapKd, j*2);
            if (m.materials[j].mapKd.search(".png") != -1) {
                var normalMapFileName = m.materials[j].mapKd.replace(".png", "NM.png");
                initTexture(normalMapFileName, j*2+1);
                }
            }
        }
}

// forma textura a partir da imagem em filename e coloca no vetor texture
// na posição texInd.
function initTexture(filename, texInd) {

    var image = new Image();

    image.onload = function() {
        var t = gl.createTexture();

        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_2D, null);

        texture[texInd] = t;
        textureOK++;
        }
    image.src = filename;
}

// Read a file
function readOBJFile(fileName, scale, reverse) {
    var request = new XMLHttpRequest();

    request.onreadystatechange = function() {
        if (request.readyState === 4 && request.status !== 404)
            onReadOBJFile(request.responseText, fileName, scale, reverse);
        }
    request.open('GET', fileName, true); // Create a request to acquire the file
    request.send();                      // Send the request
}

// OBJ File has been read
function onReadOBJFile(fileString, fileName, scale, reverse) {
    var objDoc = new OBJDoc(fileName);  // Create a OBJDoc object
    var result = objDoc.parse(fileString, scale, reverse);  // Parse the file
    if (!result) {
        g_objDoc        = null;
        g_drawingInfo   = null;
        console.log("OBJ file parsing error.");
        return;
        }

    g_objDoc = objDoc;
}

// OBJ File has been read completly
function onReadComplete() {

    var groupModel = null;

    g_drawingInfo = g_objDoc.getDrawingInfo();

    for(var o = 0; o < g_drawingInfo.numObjects; o++) {

        groupModel = new Object();

        groupModel.vertexBuffer = gl.createBuffer();
        if (groupModel.vertexBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, groupModel.vertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, g_drawingInfo.vertices[o], gl.STATIC_DRAW);
            }
        else
            alert("ERROR: can not create vertexBuffer");

        groupModel.normalBuffer = gl.createBuffer();
        if (groupModel.normalBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, groupModel.normalBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, g_drawingInfo.normals[o], gl.STATIC_DRAW);
            }
        else
            alert("ERROR: can not create normalBuffer");

        groupModel.texCoordBuffer = gl.createBuffer();
        if (groupModel.texCoordBuffer) {
            gl.bindBuffer(gl.ARRAY_BUFFER, groupModel.texCoordBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, g_drawingInfo.textCoords[o], gl.STATIC_DRAW);
            }
        else
            alert("ERROR: can not create texCoordBuffer");

        groupModel.indexBuffer = gl.createBuffer();
        if (groupModel.indexBuffer) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, groupModel.indexBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g_drawingInfo.indices[o], gl.STATIC_DRAW);
            }
        else
            alert("ERROR: can not create indexBuffer");

        groupModel.numObjects   = g_drawingInfo.indices[o].length;
        groupModel.Material     = g_drawingInfo.materials[o];

        model.push(groupModel);
        }

    for(var i = 0; i < g_drawingInfo.mtl.length; i++)
        for(var j = 0; j < g_drawingInfo.mtl[i].materials.length; j++)
            material.push(g_drawingInfo.mtl[i].materials[j]);

    initTextures();
}

function updateScenes(markers) {
  var corners, corner, pose, i;

    if (markers.length > 0) {

        corners = markers[0].corners;

        for (i = 0; i < corners.length; ++ i) {
            corner = corners[i];

            corner.x = corner.x - (canvas.width / 2);
            corner.y = (canvas.height / 2) - corner.y;
            }

        pose = posit.pose(corners);

        yaw     = Math.atan2(pose.bestRotation[0][2], pose.bestRotation[2][2]);
        pitch   = -Math.asin(-pose.bestRotation[1][2]);
        roll    = Math.atan2(pose.bestRotation[1][0], pose.bestRotation[1][1]);

        // var r = pose.bestRotation;
        // var e = rotMat.elements;
        // e[0] = r[0][0];   e[4] = r[0][1];   e[8]  = r[0][2];   e[12] = 0;
        // e[1] = r[1][0];   e[5] = r[1][1];   e[9]  = r[1][2];   e[13] = 0;
        // e[2] = r[2][0];   e[6] = r[2][1];   e[10] = r[2][2];   e[14] = 1;
        // e[3] = 0;         e[7] = 0;         e[11] = 0;         e[15] = 1;
        rotMat.setIdentity();
        rotMat.rotate(yaw, 0.0, 1.0, 0.0);
        rotMat.rotate(pitch, 1.0, 0.0, 0.0);
        rotMat.rotate(roll, 0.0, 0.0, 1.0);

        transMat.setIdentity();
        transMat.translate(pose.bestTranslation[0], pose.bestTranslation[1], -pose.bestTranslation[2]);
        scaleMat.setIdentity();
        scaleMat.scale(modelSize, modelSize, modelSize);

        // console.log("pose.bestError = " + pose.bestError);
        // console.log("pose.alternativeError = " + pose.alternativeError);
        }
    else {
        transMat.setIdentity();
        rotMat.setIdentity();
        scaleMat.setIdentity();
        yaw     = 0.0;
        pitch   = 0.0;
        roll    = 0.0;
        }
};

function drawScene(markers) {

    var ViewMat = new Matrix4();
    var ProjMat = new Matrix4();


    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT);

    modelMat.setIdentity();
    ViewMat.setIdentity();
    // ProjMat.setIdentity();
    ProjMat.setOrtho(-1.0, 1.0, -1.0, 1.0, -1.0, 1.0);

    MVPMat.setIdentity();
    MVPMat.multiply(ProjMat);
    MVPMat.multiply(ViewMat);
    MVPMat.multiply(modelMat);

    drawTextQuad(baseTexture, shaderBaseImage, ProjMat);

    updateScenes(markers);

    ViewMat.setLookAt(  0.0, 0.0, 0.0,
                        0.0, 0.0, -1.0,
                        0.0, 1.0, 0.0 );

    ProjMat.setPerspective(40.0, gl.viewportWidth / gl.viewportHeight, 0.1, 1000.0);

    modelMat.setIdentity();
    modelMat.multiply(transMat);
    modelMat.multiply(rotMat);
    modelMat.multiply(scaleMat);

    MVPMat.setIdentity();
    MVPMat.multiply(ProjMat);
    MVPMat.multiply(ViewMat);
    MVPMat.multiply(modelMat);

    drawAxis(axis, shaderAxis, MVPMat);

    try {
        gl.useProgram(textShader);
        }
    catch(err){
        alert(err);
        console.error(err.description);
        }

    gl.uniformMatrix4fv(textShader.uViewMat, false, ViewMat.elements);
    gl.uniformMatrix4fv(textShader.uProjMat, false, ProjMat.elements);
    gl.uniform3fv(textShader.uCamPos, camPos);
    gl.uniform4fv(textShader.uLight1Color, light1Color);
    gl.uniform4fv(textShader.uLight2Color, light2Color);
    gl.uniform3fv(textShader.uLight1Pos, modelMat.multiplyVector3(light1Pos).elements);
    gl.uniform3fv(textShader.uLight2Pos, modelMat.multiplyVector3(light2Pos).elements);

    gl.enable(gl.DEPTH_TEST);
    // Desenha a Terra
    modelMat.rotate(rotEarth, 0, 1, 0);
    draw(model[0], textShader, gl.TRIANGLES, EARTH);

    // Desenha a Lua
    modelMat.rotate(rotEarth*1.2, 0.0, 1.0, 0.0);
    modelMat.translate(0.8, 0.0, 0.0);
    modelMat.scale(0.7, 0.7, 0.7);
    draw(model[0], textShader, gl.TRIANGLES, MOON);

    gl.disable(gl.DEPTH_TEST);
}

function draw(o, shaderProgram, primitive, index) {

    var matAmb      = new Vector4();
    var matDif      = new Vector4();
    var matSpec     = new Vector4();
    var Ns;

    normalMap.setInverseOf(modelMat);
    normalMap.transpose();
    MVPMat.multiply(modelMat);
    gl.uniformMatrix4fv(textShader.uModelMat, false, modelMat.elements);
    gl.uniformMatrix4fv(textShader.uNormMat, false, normalMap.elements);

    if (texture[index*2] != null) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture[index*2]);
        }
    if (texture[index*2+1] != null) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, texture[index*2+1]);
        }

    if (o.Material != -1) {
        matAmb.elements[0] = material[o.Material].Ka.r;
        matAmb.elements[1] = material[o.Material].Ka.g;
        matAmb.elements[2] = material[o.Material].Ka.b;
        matAmb.elements[3] = material[o.Material].Ka.a;

        matDif.elements[0] = material[o.Material].Kd.r;
        matDif.elements[1] = material[o.Material].Kd.g;
        matDif.elements[2] = material[o.Material].Kd.b;
        matDif.elements[3] = material[o.Material].Kd.a;

        matSpec.elements[0] = material[o.Material].Ks.r;
        matSpec.elements[1] = material[o.Material].Ks.g;
        matSpec.elements[2] = material[o.Material].Ks.b;
        matSpec.elements[3] = material[o.Material].Ks.a;

        Ns                  = material[o.Material].Ns;
        }
    else {
        matAmb.elements[0] =
        matAmb.elements[1] =
        matAmb.elements[2] = 0.2
        matAmb.elements[3] = 1.0;

        matDif.elements[0] =
        matDif.elements[1] =
        matDif.elements[2] = 0.8;
        matDif.elements[3] = 1.0;

        matSpec.elements[0] =
        matSpec.elements[1] =
        matSpec.elements[2] = 0.5;
        matSpec.elements[3] = 1.0;

        Ns                  = 100.0;
        }

    gl.uniform4fv(shaderProgram.uMatAmb, matAmb.elements);
    gl.uniform4fv(shaderProgram.uMatDif, matDif.elements);
    gl.uniform4fv(shaderProgram.uMatSpec, matSpec.elements);
    gl.uniform1f(shaderProgram.uExpSpec, Ns);
    gl.uniform1i(textShader.uTexture, 0);
    gl.uniform1i(textShader.uNormalMap, 1);

    if (o.vertexBuffer != null) {
        gl.bindBuffer(gl.ARRAY_BUFFER, o.vertexBuffer);
        gl.vertexAttribPointer(shaderProgram.vPositionAttr, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shaderProgram.vPositionAttr);
        }
    else
        alert("o.vertexBuffer == null");

    if (o.normalBuffer != null) {
        gl.bindBuffer(gl.ARRAY_BUFFER, o.normalBuffer);
        gl.vertexAttribPointer(shaderProgram.vNormalAttr, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shaderProgram.vNormalAttr);
        }
    else
        alert("o.normalBuffer == null");

    if (o.texCoordBuffer != null) {
        gl.bindBuffer(gl.ARRAY_BUFFER, o.texCoordBuffer);
        gl.vertexAttribPointer(shaderProgram.vTexCoordAttr, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shaderProgram.vTexCoordAttr);
        }
    else
        alert("o.texCoordBuffer == null");

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, o.indexBuffer);

    gl.drawElements(primitive, o.numObjects, gl.UNSIGNED_SHORT, 0);

    gl.bindTexture(gl.TEXTURE_2D, null);
}

function webGLStart() {

    if (!navigator.getUserMedia) {
        document.getElementById("output").innerHTML =
            "Sorry. <code>navigator.getUserMedia()</code> is not available.";
        }
    navigator.getUserMedia({video: true}, gotStream, noStream);

    // assign variables to HTML elements
    video = document.getElementById("monitor");
    videoImage = document.getElementById("videoImage");
    videoImageContext = videoImage.getContext("2d");

    // background color if no video present
    videoImageContext.fillStyle = "#005337";
    videoImageContext.fillRect( 0, 0, videoImage.width, videoImage.height );


    canvas = document.getElementById("videoGL");
    gl = initGL(canvas);

    if (!gl) {
        alert("Could not initialise WebGL, sorry :-(");
        return;
        }

    shaderBaseImage = initShaders("baseImage", gl);
    if (shaderBaseImage == null) {
        alert("Erro na inicilizacao do shaderBaseImage!!");
        return;
        }

    shaderBaseImage.vPositionAttr   = gl.getAttribLocation(shaderBaseImage, "aVertexPosition");
    shaderBaseImage.vTexAttr        = gl.getAttribLocation(shaderBaseImage, "aVertexTexture");
    shaderBaseImage.uMVPMat         = gl.getUniformLocation(shaderBaseImage, "uMVPMat");
    shaderBaseImage.SamplerUniform  = gl.getUniformLocation(shaderBaseImage, "uSampler");

    if (    (shaderBaseImage.vertexPositionAttribute < 0)   ||
            (shaderBaseImage.vertexTextAttribute < 0)       ||
            (shaderBaseImage.SamplerUniform < 0)            ||
            !shaderBaseImage.uMVPMat ) {
        alert("shaderBaseImage attribute ou uniform nao localizado!");
        return;
        }

    baseTexture = initBaseImage();
    if (!baseTexture) {
        console.log('Failed to set the baseTexture vertex information');
        return;
        }
    initCameraTexture();

    shaderAxis                  = initShaders("Axis", gl);
    shaderAxis.vPositionAttr    = gl.getAttribLocation(shaderAxis, "aVertexPosition");
    shaderAxis.vColorAttr       = gl.getAttribLocation(shaderAxis, "aVertexColor");
    shaderAxis.uMVPMat          = gl.getUniformLocation(shaderAxis, "uMVPMat");

    if (    shaderAxis.vPositionAttr < 0    ||
            shaderAxis.vColorAttr < 0       ||
            !shaderAxis.uMVPMat ) {
        console.log("Error getAttribLocation shaderAxis");
        return;
        }

    axis = initAxisVertexBuffer();
    if (!axis) {
        console.log('Failed to set the AXIS vertex information');
        return;
        }

    detector    = new AR.Detector();
    posit       = new POS.Posit(modelSize, canvas.width);

    textShader = initShaders("normalMapping", gl);
    if (!textShader) {
        console.log("ERROR: create textShader");
        return;
        }

    textShader.vPositionAttr    = gl.getAttribLocation(textShader, "aVPosition");
    textShader.vNormalAttr      = gl.getAttribLocation(textShader, "aVNorm");
    textShader.vTexCoordAttr    = gl.getAttribLocation(textShader, "aVTexCoord");

    textShader.uTexture         = gl.getUniformLocation(textShader, "uTexture");
    textShader.uNormalMap       = gl.getUniformLocation(textShader, "uNormalMap");

    textShader.uModelMat        = gl.getUniformLocation(textShader, "uModelMat");
    textShader.uNormMat         = gl.getUniformLocation(textShader, "uNormMat");
    textShader.uViewMat         = gl.getUniformLocation(textShader, "uViewMat");
    textShader.uProjMat         = gl.getUniformLocation(textShader, "uProjMat");

    if (textShader.vPositionAttr < 0    ||
        textShader.vColorAttr < 0       ||
        textShader.vTexCoordAttr < 0    ||
        textShader.uTexture < 0         ||
        textShader.uNormalMap < 0       ||
        !textShader.uModelMat           ||
        !textShader.uViewMat            ||
        !textShader.uProjMat            ||
        !textShader.uNormMat ) {
        console.log("Error getAttribLocation textShader");
        return;
        }

    textShader.uCamPos          = gl.getUniformLocation(textShader, "uCamPos");
    textShader.uLight1Pos        = gl.getUniformLocation(textShader, "uL1Pos");
    textShader.uLight2Pos        = gl.getUniformLocation(textShader, "uL2Pos");
    textShader.uLight1Color      = gl.getUniformLocation(textShader, "uL1Color");
    textShader.uLight2Color      = gl.getUniformLocation(textShader, "uL2Color");
    textShader.uMatAmb          = gl.getUniformLocation(textShader, "uMatAmb");
    textShader.uMatDif          = gl.getUniformLocation(textShader, "uMatDif");
    textShader.uMatSpec         = gl.getUniformLocation(textShader, "uMatSpec");
    textShader.uExpSpec         = gl.getUniformLocation(textShader, "uExpSpec");

    if (textShader.uCamPos < 0          || textShader.uMatAmb < 0       ||
        textShader.uLight1Color < 0     || textShader.uLight1Pos < 0    ||
        textShader.uLight2Color < 0     || textShader.uLight2Pos < 0    ||
        textShader.uMatDif < 0          || textShader.uMatSpec < 0      ||
        textShader.uExpSpec < 0 ) {
        console.log("Error getAttribLocation");
        return;
        }

    rotMat.setIdentity();
    transMat.setIdentity();

    readOBJFile("modelos/orb.obj", 1, true);

    var tick = function() {   // Start drawing
        if (g_objDoc != null && g_objDoc.isMTLComplete()) { // OBJ and all MTLs are available
            onReadComplete();
            g_objDoc = null;
            }
        if ((model.length > 0) && (textureOK == 4)) {
            animate();
        }
        else
            requestAnimationFrame(tick, canvas);
        };
    requestAnimationFrame(tick);
}

function animate() {
    requestAnimationFrame( animate );
    rotEarth += deltaRot;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      videoImageContext.drawImage(video, 0, 0, canvas.width, canvas.height);
      videoTexture.needsUpdate = true;
      imageData = videoImageContext.getImageData(0, 0, canvas.width, canvas.height);

        var markers = detector.detect(imageData);
        drawCorners(markers);
        drawId(markers);
        drawScene(markers);
      }
}

function render() {

    if ( video.readyState === video.HAVE_ENOUGH_DATA ) {
        videoImageContext.drawImage( video, 0, 0, videoImage.width, videoImage.height );
        videoTexture.needsUpdate = true;
        imageData = videoImageContext.getImageData(0, 0, videoImage.width, videoImage.height);

        var markers = detector.detect(imageData);

        drawCorners(markers);

        drawScene(markers);
        }
}

function drawCorners(markers){
  var corners, corner, i, j;

  videoImageContext.lineWidth = 3;

  for (i = 0; i < markers.length; ++ i){
    corners = markers[i].corners;

    videoImageContext.strokeStyle = "red";
    videoImageContext.beginPath();

    for (j = 0; j < corners.length; ++ j){
      corner = corners[j];
      videoImageContext.moveTo(corner.x, corner.y);
      corner = corners[(j + 1) % corners.length];
      videoImageContext.lineTo(corner.x, corner.y);
    }

    videoImageContext.stroke();
    videoImageContext.closePath();

    videoImageContext.strokeStyle = "green";
    videoImageContext.strokeRect(corners[0].x - 2, corners[0].y - 2, 4, 4);
  }
};

function drawId(markers) {
  var corners, corner, x, y, i, j;

  videoImageContext.strokeStyle = "blue";
  videoImageContext.lineWidth = 1;

  for (i = 0; i !== markers.length; ++ i){
    corners = markers[i].corners;

    x = Infinity;
    y = Infinity;

    for (j = 0; j !== corners.length; ++ j){
      corner = corners[j];

      x = Math.min(x, corner.x);
      y = Math.min(y, corner.y);
    }

    videoImageContext.strokeText(markers[i].id, x, y)
  }
}

function initCameraTexture() {

    videoTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    videoTexture.needsUpdate = false;
}

function initBaseImage() {

    var baseImage = new Object();
    var vPos = new Array;
    var vTex = new Array;

    vPos.push(-1.0);    // V0
    vPos.push(-1.0);
    vPos.push( 0.0);
    vPos.push( 1.0);    // V1
    vPos.push(-1.0);
    vPos.push( 0.0);
    vPos.push( 1.0);    // V2
    vPos.push( 1.0);
    vPos.push( 0.0);
    vPos.push(-1.0);    // V0
    vPos.push(-1.0);
    vPos.push( 0.0);
    vPos.push( 1.0);    // V2
    vPos.push( 1.0);
    vPos.push( 0.0);
    vPos.push(-1.0);    // V3
    vPos.push( 1.0);
    vPos.push( 0.0);

    vTex.push( 0.0);    // V0
    vTex.push( 0.0);
    vTex.push( 1.0);    // V1
    vTex.push( 0.0);
    vTex.push( 1.0);    // V2
    vTex.push( 1.0);
    vTex.push( 0.0);    // V0
    vTex.push( 0.0);
    vTex.push( 1.0);    // V2
    vTex.push( 1.0);
    vTex.push( 0.0);    // V3
    vTex.push( 1.0);

    baseImage.vertexBuffer = gl.createBuffer();
    if (baseImage.vertexBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, baseImage.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vPos), gl.STATIC_DRAW);
        }
    else
        alert("ERROR: can not create vertexBuffer");

    baseImage.textureBuffer = gl.createBuffer();
    if (baseImage.textureBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, baseImage.textureBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vTex), gl.STATIC_DRAW);
        }
    else
        alert("ERROR: can not create textureBuffer");

    baseImage.numItems = vPos.length/3.0;

    return baseImage;
}

function initAxisVertexBuffer() {

    var axis    = new Object(); // Utilize Object object to return multiple buffer objects
    var vPos    = new Array;
    var vColor  = new Array;

    // X Axis
    // V0
    vPos.push(0.0);
    vPos.push(0.0);
    vPos.push(0.0);
    vColor.push(1.0);
    vColor.push(0.0);
    vColor.push(0.0);
    vColor.push(1.0);
    // V1
    vPos.push(1.0);
    vPos.push(0.0);
    vPos.push(0.0);
    vColor.push(1.0);
    vColor.push(0.0);
    vColor.push(0.0);
    vColor.push(1.0);

    // Y Axis
    // V0
    vPos.push(0.0);
    vPos.push(0.0);
    vPos.push(0.0);
    vColor.push(0.0);
    vColor.push(1.0);
    vColor.push(0.0);
    vColor.push(1.0);
    // V2
    vPos.push(0.0);
    vPos.push(1.0);
    vPos.push(0.0);
    vColor.push(0.0);
    vColor.push(1.0);
    vColor.push(0.0);
    vColor.push(1.0);

    // Z Axis
    // V0
    vPos.push(0.0);
    vPos.push(0.0);
    vPos.push(0.0);
    vColor.push(0.0);
    vColor.push(0.0);
    vColor.push(1.0);
    vColor.push(1.0);
    // V3
    vPos.push(0.0);
    vPos.push(0.0);
    vPos.push(1.0);
    vColor.push(0.0);
    vColor.push(0.0);
    vColor.push(1.0);
    vColor.push(1.0);

    axis.vertexBuffer = gl.createBuffer();
    if (axis.vertexBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, axis.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vPos), gl.STATIC_DRAW);
        }
    else
        alert("ERROR: can not create vertexBuffer");

    axis.colorBuffer = gl.createBuffer();
    if (axis.colorBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, axis.colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vColor), gl.STATIC_DRAW);
        }
    else
        alert("ERROR: can not create colorBuffer");

    axis.numItems = vPos.length/3.0;

    return axis;
}

function drawTextQuad(o, shaderProgram, MVPMat) {

    try {
        gl.useProgram(shaderProgram);
        }
    catch(err){
        alert(err);
        console.error(err.description);
        }

    gl.uniformMatrix4fv(shaderProgram.uMVPMat, false, MVPMat.elements);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoImage);
    videoTexture.needsUpdate = false;
    gl.uniform1i(shaderProgram.SamplerUniform, 0);

    if (o.vertexBuffer != null) {
        gl.bindBuffer(gl.ARRAY_BUFFER, o.vertexBuffer);
        gl.vertexAttribPointer(shaderProgram.vPositionAttr, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shaderProgram.vPositionAttr);
        }
    else {
        alert("o.vertexBuffer == null");
        return;
        }

    if (o.textureBuffer != null) {
        gl.bindBuffer(gl.ARRAY_BUFFER, o.textureBuffer);
        gl.vertexAttribPointer(shaderProgram.vTexAttr, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shaderProgram.vTexAttr);
        }
    else {
        alert("o.textureBuffer == null");
        return;
        }

    gl.drawArrays(gl.TRIANGLES, 0, o.numItems);
}

function drawAxis(o, shaderProgram, MVPMat) {

    try {
        gl.useProgram(shaderProgram);
        }
    catch(err){
        alert(err);
        console.error(err.description);
        }

    gl.uniformMatrix4fv(shaderProgram.uMVPMat, false, MVPMat.elements);

    if (o.vertexBuffer != null) {
        gl.bindBuffer(gl.ARRAY_BUFFER, o.vertexBuffer);
        gl.vertexAttribPointer(shaderProgram.vPositionAttr, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shaderProgram.vPositionAttr);
        }
    else {
        alert("o.vertexBuffer == null");
        return;
        }

    if (o.colorBuffer != null) {
        gl.bindBuffer(gl.ARRAY_BUFFER, o.colorBuffer);
        gl.vertexAttribPointer(shaderProgram.vColorAttr, 4, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shaderProgram.vColorAttr);
        }
    else {
        alert("o.colorBuffer == null");
        return;
        }

    gl.drawArrays(gl.LINES, 0, o.numItems);
}

function gotStream(stream)  {
    if (window.URL) {
        video.src = window.URL.createObjectURL(stream);   }
    else {
        video.src = stream;
        }

    video.onerror = function(e) {
                            stream.stop();
                            };
    stream.onended = noStream;
}

function noStream(e) {
    var msg = "No camera available.";

    if (e.code == 1) {
        msg = "User denied access to use camera.";
        }
    document.getElementById("output").textContent = msg;
}

// TODO vê se ainda precisa VNormalW, aVNorm e uNormMat.