import { faces, uvs } from './faceMeshData';

export type FacePaintLandmark = {
  x: number;
  y: number;
  z?: number;
};

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('WebGL shader allocation failed.');

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || 'unknown shader error';
    gl.deleteShader(shader);
    throw new Error(log);
  }

  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();

  if (!program) throw new Error('WebGL program allocation failed.');

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);

  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) || 'unknown link error';
    gl.deleteProgram(program);
    throw new Error(log);
  }

  return program;
}

function uvPoint(index: number, size: number) {
  const uv = uvs[index];
  return {
    x: uv[0] * size,
    y: (1 - uv[1]) * size,
  };
}

function eyeBounds(indices: number[], size: number) {
  const points = indices.map((index) => uvPoint(index, size));
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  return {
    cx: (Math.min(...xs) + Math.max(...xs)) * 0.5,
    cy: (Math.min(...ys) + Math.max(...ys)) * 0.5,
    rx: (Math.max(...xs) - Math.min(...xs)) * 0.72,
    ry: (Math.max(...ys) - Math.min(...ys)) * 1.05,
  };
}

function createFacePaintTexture(size = 1024): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Face paint texture canvas creation failed.');

  // Base coat. The mesh boundary itself clips the paint to the face contour.
  ctx.fillStyle = 'rgba(236, 232, 219, 0.96)';
  ctx.fillRect(0, 0, size, size);

  // Symmetric blue paint bands. These live in canonical UV space and therefore
  // deform with the tracked face rather than floating as a 2D overlay.
  const center = uvPoint(1, size);
  const forehead = uvPoint(10, size);
  const leftCheek = uvPoint(234, size);
  const rightCheek = uvPoint(454, size);
  const nose = uvPoint(1, size);
  const chin = uvPoint(152, size);

  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.strokeStyle = '#5a8fd8';
  ctx.fillStyle = '#5a8fd8';
  ctx.lineCap = 'round';

  const paintBand = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width: number,
  ) => {
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(
      (x1 + x2) * 0.5,
      (y1 + y2) * 0.5 - width * 0.15,
      x2,
      y2,
    );
    ctx.stroke();
  };

  paintBand(leftCheek.x, leftCheek.y, center.x - size * 0.03, center.y, size * 0.055);
  paintBand(rightCheek.x, rightCheek.y, center.x + size * 0.03, center.y, size * 0.055);
  paintBand(
    center.x - size * 0.18,
    forehead.y + size * 0.035,
    center.x - size * 0.035,
    nose.y - size * 0.07,
    size * 0.038,
  );
  paintBand(
    center.x + size * 0.18,
    forehead.y + size * 0.035,
    center.x + size * 0.035,
    nose.y - size * 0.07,
    size * 0.038,
  );

  ctx.beginPath();
  ctx.moveTo(center.x, forehead.y + size * 0.015);
  ctx.lineTo(center.x - size * 0.055, forehead.y + size * 0.10);
  ctx.lineTo(center.x, forehead.y + size * 0.075);
  ctx.lineTo(center.x + size * 0.055, forehead.y + size * 0.10);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.45;
  paintBand(
    center.x - size * 0.19,
    chin.y - size * 0.04,
    center.x + size * 0.19,
    chin.y - size * 0.04,
    size * 0.026,
  );
  ctx.restore();

  // Reveal the real eyes through the paint. The hole positions are derived
  // from the canonical UVs, not hard-coded screen coordinates.
  const leftEye = eyeBounds([33, 133, 159, 145], size);
  const rightEye = eyeBounds([263, 362, 386, 374], size);

  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';

  for (const eye of [leftEye, rightEye]) {
    ctx.beginPath();
    ctx.ellipse(
      eye.cx,
      eye.cy,
      Math.max(size * 0.033, eye.rx),
      Math.max(size * 0.018, eye.ry),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // Soft mouth opening so lip motion still looks human.
  const mouthLeft = uvPoint(61, size);
  const mouthRight = uvPoint(291, size);
  const mouthTop = uvPoint(13, size);
  const mouthBottom = uvPoint(14, size);
  const mouthCx = (mouthLeft.x + mouthRight.x) * 0.5;
  const mouthCy = (mouthTop.y + mouthBottom.y) * 0.5;
  const mouthRx = Math.abs(mouthRight.x - mouthLeft.x) * 0.44;
  const mouthRy = Math.max(
    size * 0.010,
    Math.abs(mouthBottom.y - mouthTop.y) * 1.15,
  );

  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(mouthCx, mouthCy, mouthRx, mouthRy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  return canvas;
}

export class FacePaintRenderer {
  private readonly gl: WebGLRenderingContext;

  private readonly backgroundProgram: WebGLProgram;
  private readonly faceProgram: WebGLProgram;

  private readonly backgroundPositionBuffer: WebGLBuffer;
  private readonly backgroundUvBuffer: WebGLBuffer;
  private readonly facePositionBuffer: WebGLBuffer;
  private readonly faceUvBuffer: WebGLBuffer;
  private readonly faceIndexBuffer: WebGLBuffer;

  private readonly videoTexture: WebGLTexture;
  private readonly paintTexture: WebGLTexture;

  private readonly facePositions = new Float32Array(468 * 2);
  private readonly faceIndices = new Uint16Array(faces);
  private readonly faceUvs = new Float32Array(468 * 2);

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: true,
      desynchronized: true,
      premultipliedAlpha: false,
    });

    if (!gl) {
      throw new Error('Face paint mode requires WebGL.');
    }

    this.gl = gl;

    this.backgroundProgram = createProgram(
      gl,
      `
      attribute vec2 aPosition;
      attribute vec2 aUv;
      varying vec2 vUv;

      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
        vUv = aUv;
      }
      `,
      `
      precision mediump float;
      uniform sampler2D uTexture;
      varying vec2 vUv;

      void main() {
        gl_FragColor = texture2D(uTexture, vUv);
      }
      `,
    );

    this.faceProgram = createProgram(
      gl,
      `
      attribute vec2 aPosition;
      attribute vec2 aUv;
      varying vec2 vUv;

      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
        vUv = aUv;
      }
      `,
      `
      precision mediump float;
      uniform sampler2D uTexture;
      varying vec2 vUv;

      void main() {
        vec4 paint = texture2D(uTexture, vUv);
        if (paint.a < 0.01) discard;
        gl_FragColor = paint;
      }
      `,
    );

    const makeBuffer = () => {
      const buffer = gl.createBuffer();
      if (!buffer) throw new Error('WebGL buffer allocation failed.');
      return buffer;
    };

    this.backgroundPositionBuffer = makeBuffer();
    this.backgroundUvBuffer = makeBuffer();
    this.facePositionBuffer = makeBuffer();
    this.faceUvBuffer = makeBuffer();
    this.faceIndexBuffer = makeBuffer();

    const backgroundPositions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);

    const backgroundUvs = new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      0, 1,
      1, 0,
      1, 1,
    ]);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.backgroundPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, backgroundPositions, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.backgroundUvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, backgroundUvs, gl.STATIC_DRAW);

    for (let i = 0; i < 468; i++) {
      this.faceUvs[i * 2] = uvs[i][0];
      this.faceUvs[i * 2 + 1] = uvs[i][1];
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.faceUvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.faceUvs, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.faceIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.faceIndices, gl.STATIC_DRAW);

    const makeTexture = () => {
      const texture = gl.createTexture();
      if (!texture) throw new Error('WebGL texture allocation failed.');
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return texture;
    };

    this.videoTexture = makeTexture();
    this.paintTexture = makeTexture();

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, this.paintTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      createFacePaintTexture(),
    );

    gl.disable(gl.CULL_FACE);
    gl.disable(gl.DEPTH_TEST);
  }

  private bindAttribute(
    program: WebGLProgram,
    name: string,
    buffer: WebGLBuffer,
    size: number,
  ) {
    const { gl } = this;
    const location = gl.getAttribLocation(program, name);
    if (location < 0) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  }

  private bindTexture(program: WebGLProgram, texture: WebGLTexture) {
    const { gl } = this;
    const location = gl.getUniformLocation(program, 'uTexture');

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    if (location) gl.uniform1i(location, 0);
  }

  private drawVideo(video: HTMLVideoElement) {
    const { gl } = this;

    gl.useProgram(this.backgroundProgram);

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      video,
    );

    this.bindAttribute(
      this.backgroundProgram,
      'aPosition',
      this.backgroundPositionBuffer,
      2,
    );
    this.bindAttribute(
      this.backgroundProgram,
      'aUv',
      this.backgroundUvBuffer,
      2,
    );
    this.bindTexture(this.backgroundProgram, this.videoTexture);

    gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private drawFace(landmarks: FacePaintLandmark[]) {
    const { gl } = this;

    for (let i = 0; i < 468; i++) {
      const landmark = landmarks[i];
      this.facePositions[i * 2] = landmark.x * 2 - 1;
      this.facePositions[i * 2 + 1] = 1 - landmark.y * 2;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.facePositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.facePositions, gl.DYNAMIC_DRAW);

    gl.useProgram(this.faceProgram);

    this.bindAttribute(
      this.faceProgram,
      'aPosition',
      this.facePositionBuffer,
      2,
    );
    this.bindAttribute(
      this.faceProgram,
      'aUv',
      this.faceUvBuffer,
      2,
    );

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.faceIndexBuffer);
    this.bindTexture(this.faceProgram, this.paintTexture);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.drawElements(
      gl.TRIANGLES,
      this.faceIndices.length,
      gl.UNSIGNED_SHORT,
      0,
    );

    gl.disable(gl.BLEND);
  }

  render(
    video: HTMLVideoElement,
    landmarks?: FacePaintLandmark[],
  ) {
    const { gl } = this;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.drawVideo(video);

    if (landmarks && landmarks.length >= 468) {
      this.drawFace(landmarks);
    }
  }

  dispose() {
    const { gl } = this;

    gl.deleteTexture(this.videoTexture);
    gl.deleteTexture(this.paintTexture);

    gl.deleteBuffer(this.backgroundPositionBuffer);
    gl.deleteBuffer(this.backgroundUvBuffer);
    gl.deleteBuffer(this.facePositionBuffer);
    gl.deleteBuffer(this.faceUvBuffer);
    gl.deleteBuffer(this.faceIndexBuffer);

    gl.deleteProgram(this.backgroundProgram);
    gl.deleteProgram(this.faceProgram);
  }
}
