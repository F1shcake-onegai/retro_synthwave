// Wireframe Depth Effect shader

uniform float uTime;
uniform float uBaseDepth; // base bump depth
uniform float uBaseFreqX; // base bump cycles on X axis
uniform float uBaseFreqY; // base bump cycles on Y axis
uniform float uTrackDepth; // tracking pull strength
uniform float uMaxWarp; // max currentPixel shift, prevents crossing
uniform float uSubDivs; // small grids per large grid for noisy background, currently 3 * 3
uniform float uLargeLineWidth; // large grid line thickness
uniform float uSmallLineWidth; // small grid line thickness
uniform float uSpeed; // speed for base bump waves, waves in X and Y axis move towards top left in uSpeed
uniform float uNoise; // base noise amount correlation
uniform float uTrackBlur; // tracking feathering radius
// blur is to avoid sharp edges / edges with lines caused by a non-feathered sharp cut of brightness from 100% to 0

// 1280 x 1216 -> 29*28 in
const float COLS = 29.0;
const float ROWS = 28.0;
const float TAU = 6.28318530; // 2 * pi

// sTD2DInputs[0] is Wave CHOP to TOP
// sTD2DInputs[1] is tracking TOP 

layout(location = 0) out vec4 fragColor; // output to out0 as var RGBA

// generate periodic bumps with sin waves
// to mimic like cloth floating on evenly showing its wireframe
float baseHeight(vec2 pixel, float time) {
    // p.x * uBaseFreqX -> what period is it right now
    // period * TAU -> radians / arc
    // sin(arc) -> depth value
    return sin(pixel.x * uBaseFreqX * TAU + time * 0.15)   // +t -> move left
         * sin(pixel.y * uBaseFreqY * TAU - time * 0.15);  // -t -> move up
}

// 9-point blur on tracking input with radius r
// sum -> average -> smooth edges
// modified from: https://github.com/kiwipxl/GLSL-shaders/blob/master/blur.glsl
float blurTrack(vec2 pixel, float r) {
    return (
        texture(sTD2DInputs[1], pixel + vec2(-r, -r)).r +
        texture(sTD2DInputs[1], pixel + vec2(0, -r)).r +
        texture(sTD2DInputs[1], pixel + vec2(r, -r)).r +
        texture(sTD2DInputs[1], pixel + vec2(-r, 0)).r +
        texture(sTD2DInputs[1], pixel).r +
        texture(sTD2DInputs[1], pixel + vec2(r, 0)).r +
        texture(sTD2DInputs[1], pixel + vec2(-r, r)).r +
        texture(sTD2DInputs[1], pixel + vec2(0, r)).r +
        texture(sTD2DInputs[1], pixel + vec2(r, r)).r
    ) / 9;
}

// translates current brightness to a smoothed value
// clamp off 5% lowest brightness to avoid feedback - level caused grey background
float easeDepth(float b) {
    return smoothstep(0.05, 1, b);
}

float gridLine(float coord, float width) {
    float f = fract(coord); // only keeps fractional parts -> [0, 1.0)
    // smoothstep takes the 3rd parameter to compare
    // if var3 <= var1 -> 0
    // if var3 >= var2 -> 1
    // in between is smoothed value (0, 1) to not create a sharp edge
    return smoothstep(width, 0, f) + smoothstep(1 - width, 1, f);
}

void main() {
    vec2 currentPixel = vUV.st; // position of current pixel renamed to currentPixel (x, y)
    float t = uTime * uSpeed;

    // create a base noise from Wave CHOP input
    // Red and Green channel are set at ./CHOP to TOP/Data_Format
    float cx = texture(sTD2DInputs[0], vec2(currentPixel.x, 0.5)).r * 2 - 1; // 0 / 1 -> -1 / 1
    float cy = texture(sTD2DInputs[0], vec2(currentPixel.y, 0.5)).g * 2 - 1;
    vec2 noise = vec2(
        cx * sin(currentPixel.y * 17 + t * 0.1),
        cy * sin(currentPixel.x * 13 + t * 0.12)
    ) * uNoise;

    // generate periodic bumps
    // sin*sin height field -> depth (see baseHeight())
    float epsB = 0.003;
    float bR = baseHeight(currentPixel + vec2(epsB, 0), t);
    float bL = baseHeight(currentPixel - vec2(epsB, 0), t);
    float bU = baseHeight(currentPixel + vec2(0, epsB), t);
    float bD = baseHeight(currentPixel - vec2(0, epsB), t);
    vec2 baseGrad = vec2(bR - bL, bU - bD) / (2 * epsB);
    vec2 baseWarp = baseGrad * uBaseDepth;

    // tracking -> depth
    float blurR = max(uTrackBlur, 0.015); // default value for testing purpose
    // this can also be float blurR = uTrackBlur for touchdesigner only valuation
    float epsT = 0.03; // interval for gradient samples of pixels around current pixel

    // see blurTrack()
    // gets blurred / avg result from adjacent pixels
    float tR = blurTrack(currentPixel + vec2(epsT, 0), blurR);
    float tL = blurTrack(currentPixel - vec2(epsT, 0), blurR);
    float tU = blurTrack(currentPixel + vec2(0, epsT), blurR);
    float tD = blurTrack(currentPixel - vec2(0, epsT), blurR);
    
    // apply easing and clamp
    float hR = easeDepth(tR);
    float hL = easeDepth(tL);
    float hU = easeDepth(tU);
    float hD = easeDepth(tD);

    // calculate final gradient for tracking depth
    // central finite difference
    vec2 trackGrad = vec2(hL - hR, hD - hU) / (2 * epsT);
    vec2 trackWarp = trackGrad * uTrackDepth;

    // combines base depth and tracking depth
    vec2 totalWarp = baseWarp + trackWarp;
    float totalLength = length(totalWarp);
    float totalClamped = tanh(totalLength / uMaxWarp) * uMaxWarp; // tanh() -> (0, 1), totalClamped -> (0, uMaxWarp)
    totalWarp *= totalClamped / max(totalLength, 0.0001);

    vec2 modifiedPixel = currentPixel + noise + totalWarp;

    // draw grid
    // large grids
    vec2 largeCoord = modifiedPixel * vec2(COLS, ROWS);
    float largeLX = gridLine(largeCoord.x, uLargeLineWidth);
    float largeLY = gridLine(largeCoord.y, uLargeLineWidth);
    float largeLine = clamp(largeLX + largeLY, 0, 1);

    // small grids
    vec2 smallCoord = modifiedPixel * vec2(COLS * uSubDivs, ROWS * uSubDivs);
    float smallLX = gridLine(smallCoord.x, uSmallLineWidth);
    float smallLY = gridLine(smallCoord.y, uSmallLineWidth);
    float smallLine = clamp(smallLX + smallLY, 0, 1);

    // make large lines brighter and small lines darker (35% brightness)
    float grid = max(largeLine, smallLine * 0.35);

    fragColor = vec4(vec3(grid), 1);
}
