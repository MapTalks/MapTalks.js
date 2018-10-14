attribute vec3 aPosition;
attribute vec2 aShape;
attribute float aRotation;

uniform float cameraToCenterDistance;
uniform mat4 projViewModelMatrix;
uniform float markerPerspectiveRatio;

uniform vec2 canvasSize;
uniform float pitchWithMap;
uniform float mapPitch;

#include <fbo_picking_vert>

void main() {
    gl_Position = projViewModelMatrix * vec4(aPosition, 1.0);
    float distance = gl_Position.w;

    float distanceRatio = (1.0 - cameraToCenterDistance / distance) * markerPerspectiveRatio;
    //通过distance动态调整大小
    float perspectiveRatio = clamp(
        0.5 + 0.5 * (1.0 - distanceRatio),
        0.0, // Prevents oversized near-field symbols in pitched/overzoomed tiles
        4.0);

    vec2 shape = aShape * 2.0 / canvasSize; //乘以2.0

    //图标的旋转角度
    float angleSin = sin(aRotation);
    float angleCos = cos(aRotation);

    // section 3 随视角倾斜
    // 手动构造3x3旋转矩阵
    float pitch = mapPitch * pitchWithMap;
    // section 3 随视角倾斜
    // 手动构造3x3旋转矩阵 http://planning.cs.uiuc.edu/node102.html
    float pitchSin = sin(pitch);
    float pitchCos = cos(pitch);
    mat3 rotationMatrix = mat3(angleCos, -1.0 * angleSin * pitchCos, angleSin * pitchSin,
        angleSin, angleCos * pitchCos, -1.0 * angleCos * pitchSin,
        0.0, pitchSin, pitchCos);
    gl_Position.xy += (rotationMatrix * vec3(shape, 0.0)).xy * perspectiveRatio * gl_Position.w;

    fbo_picking_setData(gl_Position.w);
}
