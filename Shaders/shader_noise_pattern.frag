uniform float uTime;
uniform float uDensity;

// reference: "Prospecting for Hash Functions" by Chris Wellons
// https://nullprogram.com/blog/2018/07/31/
uint hash(uint x){
    x ^= x >> 16u;
    x *= 0x45d9f3bu;
    x ^= x >> 16u;
    x *= 0x45d9f3bu;
    x ^= x >> 16u;
    return x;
}

out vec4 fragColor;
void main(){
    ivec2 px = ivec2(gl_FragCoord.xy);
    uint seed = uint(px.x) + uint(px.y) * 4096u + uint(uTime * 1000.0) * 16777216u;
    uint h = hash(seed);

    float n = float(h) / 4294967295.0; // normalize to 0-1

    float particle = n < uDensity ? n / uDensity : 0.0;

    fragColor = vec4(vec3(particle), particle);
}