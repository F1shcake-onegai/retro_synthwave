uniform float uPixelScale;
uniform float uVignetteStrength;
uniform float uDistortionAmount;
uniform float uCenterDistortion;
uniform float uScanlineWidth;
uniform float uGridInterval;
uniform float uMask;

out vec4 fragColor;

void main()
{
    vec2 resolution = uTD2DInfos[0].res.zw;
    vec2 currentPos = vUV.st;

	// screen curve distortion
	// position -> depth -> distort
	// apply first so all later effects follow the style
    vec2 centered = currentPos * 2 - 1; // [0, 1] -> [-1, 1]

    // calculate distortion factor
	// center -> uCenterDistortion
	// corner -> uDistortionAmount
	// [0.15, 1.05]
    centered.x *= uCenterDistortion + uDistortionAmount * centered.y * centered.y;
    centered.y *= uCenterDistortion + uDistortionAmount * centered.x * centered.x;
    vec2 curvedPos = centered * 0.5 + 0.5; // [-1, 1] -> [0, 1]; align coords

    // shading based on distance from center
	// center gets 1.0, corner gets 0.88
    float distanceSquared = dot(centered, centered);
    float depthShade = 1 - 0.12 * distanceSquared;

    // pixel effect 
    float pixelSize = max(uPixelScale, 1); // clamp to 1, avoid pixels smaller than origin

    vec2 grid = floor(curvedPos * resolution / pixelSize); // find nearest pixel position
    vec2 snapPos  = (grid + 0.5) * pixelSize / resolution; // snap to grid
    vec4 color = texture(sTD2DInputs[0], snapPos); // apply original color to grid

    vec2 gridPos = fract(curvedPos * resolution / pixelSize); // it tells you n-th grid it is at

    // apply rgb separation effect by only enhancing one channel according to gridPos
	// this approach is similar to channelMix TOP -> 3 channels + transform X
    vec3 mask = vec3(uMask); // original low rgb value (0.15, 0.15, 0.15)
    float third = 1.0 / 3;
    if (gridPos.x < third) {
		mask.r = 1;
	} else if (gridPos.x < 2 * third) {
		mask.g = 1;
	} else {
		mask.b = 1;
	}
    color.rgb *= mask;

    // mimic scanline / interval of scanning
    float scanline = smoothstep(0, uScanlineWidth, gridPos.y) * smoothstep(1, 1 - uScanlineWidth, gridPos.y);
    color.rgb *= mix(0.3, 1, scanline);

    // grid border / interval of rgb components
    float gridX = smoothstep(0, uGridInterval, gridPos.x)
                * smoothstep(1, 1 - uGridInterval, gridPos.x);
    float gridY = smoothstep(0, uGridInterval, gridPos.y)
                * smoothstep(1, 1 - uGridInterval, gridPos.y);
    color.rgb *= mix(0.4, 1, gridX * gridY);

    // apply vignette effect (darker corners)
    float vig = 1 - distanceSquared * uVignetteStrength;
    vig = clamp(vig, 0, 1);
    vig = pow(vig, 1.6); // vig = vig ^ 1.6, similar to vig ^ 2 graph, goes steeper +x
    color.rgb *= vig;

	// apply depth shading
    color.rgb *= depthShade;

    // fill black gradient towards corner
    float edgeDist = max(abs(centered.x), abs(centered.y)); // center -> 0, edge -> 1
    float edgeFade = smoothstep(0.85, 1, edgeDist); // only starts filling at 15% border, which was transparent

    // mix with black to replace transparency at corners
    color.rgb = mix(color.rgb, vec3(0), edgeFade);
    color.a = mix(color.a, 1, edgeFade);

    fragColor = TDOutputSwizzle(color);
}
