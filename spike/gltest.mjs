import createGL from 'gl';
const gl = createGL(64,64); const e=gl.getExtension('WEBGL_debug_renderer_info');
console.log(e? gl.getParameter(e.UNMASKED_RENDERER_WEBGL)+' | '+gl.getParameter(e.UNMASKED_VENDOR_WEBGL):'noext');
