uniform float uTime;
uniform float uWaveIntensity;
uniform float uMaxAlpha; // sets maximum greyness for background
uniform float uAnimationSpeed;
uniform float uBlurRadius;
uniform float uDotGreyness; // sets maximum greyness for dots
uniform float uExpansionDistance; // sets expansion for tracking TOP, effect => (1 + uExpansionDistance)
uniform float uIfBlur; // -1.0 -> sharpen edge; 0.0 -> disable blur; 1.0 -> enable blur

// sTD2DInputs[0] is image to be color shifted
// sTD2DInputs[1] is grey gradient image <- tracking TOP
layout(location = 0) out vec4 fragColor;

// 9-point blur with dot expansion applied before averaging
// treats brightness as distance field: dividing by expansion grows dark (dot) areas
// modified from: https://github.com/kiwipxl/GLSL-shaders/blob/master/blur.glsl
float blurTrackExpanded(vec2 pixel, float r, int index, float expansion) {
    float exponent = 1.0 + expansion;
    float s0 = pow(texture(sTD2DInputs[index], pixel + vec2(-r, -r)).r, exponent);
    float s1 = pow(texture(sTD2DInputs[index], pixel + vec2(0, -r)).r, exponent);
    float s2 = pow(texture(sTD2DInputs[index], pixel + vec2(r, -r)).r, exponent);
    float s3 = pow(texture(sTD2DInputs[index], pixel + vec2(-r, 0)).r, exponent);
    float s4 = pow(texture(sTD2DInputs[index], pixel).r, exponent);
    float s5 = pow(texture(sTD2DInputs[index], pixel + vec2(r, 0)).r, exponent);
    float s6 = pow(texture(sTD2DInputs[index], pixel + vec2(-r, r)).r, exponent);
    float s7 = pow(texture(sTD2DInputs[index], pixel + vec2(0, r)).r, exponent);
    float s8 = pow(texture(sTD2DInputs[index], pixel + vec2(r, r)).r, exponent);
    return (s0+s1+s2+s3+s4+s5+s6+s7+s8) / 9.0;
}

// this works without blur, triggered when uIfBlur == 0.0
float expandTrack(vec2 pixel, int index, float expansion) {
    return pow(texture(sTD2DInputs[index], pixel).r, 1.0 + expansion);
}

// this works with sharpen, triggered when uIfBlur = -1.0
float sharpenTrackExpanded(vec2 pixel, float r, int index, float expansion) {
    float center = texture(sTD2DInputs[index], pixel).r;
    float neighbours = (
        texture(sTD2DInputs[index], pixel + vec2(-r, -r)).r +
        texture(sTD2DInputs[index], pixel + vec2(0, -r)).r +
        texture(sTD2DInputs[index], pixel + vec2(r, -r)).r +
        texture(sTD2DInputs[index], pixel + vec2(-r, 0)).r +
        texture(sTD2DInputs[index], pixel + vec2(r, 0)).r +
        texture(sTD2DInputs[index], pixel + vec2(-r, r)).r +
        texture(sTD2DInputs[index], pixel + vec2(0, r)).r +
        texture(sTD2DInputs[index], pixel + vec2(r, r)).r
    ) / 8;
    float sharpened = clamp(2.0 * center - neighbours, 0.0, 1.0);
    return pow(sharpened, 1.0 + expansion);
}

// mix current color with grey -> color shift
vec4 greyMix(vec2 pixel, int index1, float desaturationAmount) {
    vec4 color1 = texture(sTD2DInputs[index1], pixel);
    float brightness = dot(color1.rgb, vec3(0.299, 0.587, 0.114));
    vec3 desaturated = mix(color1.rgb, vec3(brightness), desaturationAmount);
    return vec4(desaturated, color1.a);
}

// not being used
float mapValue(float value, float inMin, float inMax, float outMin, float outMax) {
    return outMin + (value - inMin) * (outMax - outMin) / (inMax - inMin);
}

// not being used
vec4 greyChange(vec2 pixel, int index1, float greyLevel, float factor) {
    vec4 color1 = texture(sTD2DInputs[index1], pixel);
    vec4 greyness = vec4(vec3(greyLevel), 1.0);
    vec4 newColor = vec4(0.0);
    newColor.r = mapValue(factor, 0, 1, color1.r, greyness.r);
    newColor.g = mapValue(factor, 0, 1, color1.g, greyness.g);
    newColor.b = mapValue(factor, 0, 1, color1.b, greyness.b);
    newColor.a = mapValue(factor, 0, 1, color1.a, greyness.a);
    return newColor;
}

void main() {
    float cookingTime = uTime * uAnimationSpeed;
    vec2 currentPixel = vUV.st; // position of current pixel renamed to currentPixel (x, y)

    // expand dots for better greyness contrast
    // so I don't have to modify Augmenta_Input tox
    // modifying tox -> global effect
    // shader        -> local specific effect
    float greyLevel;
    if (uIfBlur > 0.5) {
        greyLevel = blurTrackExpanded(currentPixel, uBlurRadius, 1, uExpansionDistance);
    }  else if (uIfBlur < -0.5) {
        greyLevel = sharpenTrackExpanded(currentPixel, uBlurRadius, 1, uExpansionDistance);
    } else {
        greyLevel = expandTrack(currentPixel, 1, uExpansionDistance);
    }

    // separate processing
    // calculate dots and background desaturation independently
    vec4 dotResult = greyMix(currentPixel, 0, uDotGreyness);
    vec4 bgResult = greyMix(currentPixel, 0, uMaxAlpha);

    // compose two greyness results
    vec4 colorAfter = mix(dotResult, bgResult, greyLevel);

    fragColor = colorAfter;
}