import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

class WebGLBackground {
    constructor() {
        this.canvas = document.querySelector('#webgl-canvas');
        if (!this.canvas) return;

        this.init();
        this.createFluidBackground();
        this.addMouseInteraction();
        this.animate();
        
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    init() {
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 25;

        this.clock = new THREE.Clock();
        this.shaderTime = 0;
        this.mouse = new THREE.Vector2(0.5, 0.5);
        this.targetMouse = new THREE.Vector2(0.5, 0.5);
        this.mouseVelocity = new THREE.Vector2(0.0, 0.0);
        this.prevMouse = new THREE.Vector2(0.5, 0.5);

        // Accessibility: Prefers Reduced Motion
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
            this.reducedMotion = e.matches;
        });

        // Theme observer
        const updateColors = () => {
            if(!this.fluidUniforms) return;
            const isDark = document.documentElement.classList.contains('dark');
            if (isDark) {
                // Dark mode: Deep black base, subtle warm/orange and faint grey highlights
                this.fluidUniforms.uColor1.value.set('#000000');  // pure black
                this.fluidUniforms.uColor2.value.set('#050505');  // extremely dark gray
                this.fluidUniforms.uColor3.value.set('#140800');  // extremely subtle dark warm orange
                this.fluidUniforms.uColor4.value.set('#0a0a0a');  // almost black grey
                this.fluidUniforms.uColor5.value.set('#9a3412');  // darker orange accent
                this.fluidUniforms.uBrightness.value = 0.5;
            } else {
                // Light mode: Soft white/light-gray base, subtle orange/cream, and very subtle black (dark grey)
                this.fluidUniforms.uColor1.value.set('#ffffff');  // white base
                this.fluidUniforms.uColor2.value.set('#f3f4f6');  // very light gray
                this.fluidUniforms.uColor3.value.set('#ffedd5');  // subtle orange/white
                this.fluidUniforms.uColor4.value.set('#e7e5e4');  // slightly warm light gray
                // We use uColor5 for the cursor hover glow (soft orange), and we'll mix a faint dark tone in the shader
                this.fluidUniforms.uColor5.value.set('#fed7aa');  // soft orange highlight
                this.fluidUniforms.uBrightness.value = 1.0;
            }
        };
        setTimeout(updateColors, 100);
        new MutationObserver(updateColors).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }

    createFluidBackground() {
        const geometry = new THREE.PlaneGeometry(150, 150, 2, 2);
        
        this.fluidUniforms = {
            uTime: { value: 0 },
            uMouse: { value: new THREE.Vector2(0.5, 0.5) },
            uMouseVelocity: { value: new THREE.Vector2(0.0, 0.0) },
            uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            uColor1: { value: new THREE.Color('#ffffff') },
            uColor2: { value: new THREE.Color('#f3f4f6') },
            uColor3: { value: new THREE.Color('#ffedd5') },
            uColor4: { value: new THREE.Color('#e7e5e4') },
            uColor5: { value: new THREE.Color('#fed7aa') },
            uBrightness: { value: 1.0 }
        };

        const material = new THREE.ShaderMaterial({
            uniforms: this.fluidUniforms,
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                precision highp float;

                uniform float uTime;
                uniform vec2 uMouse;
                uniform vec2 uMouseVelocity;
                uniform vec2 uResolution;
                uniform vec3 uColor1;
                uniform vec3 uColor2;
                uniform vec3 uColor3;
                uniform vec3 uColor4;
                uniform vec3 uColor5;
                uniform float uBrightness;
                varying vec2 vUv;

                // ---- Simplex-inspired smooth noise (no grid artifacts) ----
                vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

                float snoise(vec2 v) {
                    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                                       -0.577350269189626, 0.024390243902439);
                    vec2 i  = floor(v + dot(v, C.yy));
                    vec2 x0 = v - i + dot(i, C.xx);
                    vec2 i1;
                    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                    vec4 x12 = x0.xyxy + C.xxzz;
                    x12.xy -= i1;
                    i = mod289(i);
                    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                                           + i.x + vec3(0.0, i1.x, 1.0));
                    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                                            dot(x12.zw, x12.zw)), 0.0);
                    m = m * m;
                    m = m * m;
                    vec3 x = 2.0 * fract(p * C.www) - 1.0;
                    vec3 h = abs(x) - 0.5;
                    vec3 ox = floor(x + 0.5);
                    vec3 a0 = x - ox;
                    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
                    vec3 g;
                    g.x = a0.x * x0.x + h.x * x0.y;
                    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                    return 130.0 * dot(m, g);
                }

                // ---- FBM (Fractional Brownian Motion) for cloudy layers ----
                float fbm(vec2 st) {
                    float value = 0.0;
                    float amplitude = 0.5;
                    float frequency = 1.0;
                    // 3 octaves for massive, ultra-soft shapes (less detail, more elegant)
                    for (int i = 0; i < 3; i++) {
                        value += amplitude * snoise(st * frequency);
                        frequency *= 2.0;
                        amplitude *= 0.5;
                    }
                    return value;
                }

                // ---- Fluid domain warping (noise feeding into noise) ----
                float warpedNoise(vec2 st, float time, vec2 mouseInfluence) {
                    // First warp layer — extremely slow large movement for elegant feel
                    vec2 q = vec2(
                        fbm(st + vec2(0.0, 0.0) + time * 0.008),
                        fbm(st + vec2(5.2, 1.3) + time * 0.007)
                    );

                    // Mouse gently pushes the warp field
                    q += mouseInfluence * 0.15;

                    // Second warp layer — medium movement
                    vec2 r = vec2(
                        fbm(st + 4.0 * q + vec2(1.7, 9.2) + time * 0.012),
                        fbm(st + 4.0 * q + vec2(8.3, 2.8) + time * 0.015)
                    );

                    // Third warp layer — adds extra organic complexity
                    vec2 s = vec2(
                        fbm(st + 3.0 * r + vec2(3.1, 7.4) + time * 0.005),
                        fbm(st + 3.0 * r + vec2(6.8, 4.1) + time * 0.008)
                    );

                    return fbm(st + 3.5 * s);
                }

                void main() {
                    // Aspect-corrected UV
                    vec2 uv = vUv;
                    float aspect = uResolution.x / uResolution.y;
                    // Multiply by 0.7 to make the noise shapes massive and macro-scale
                    vec2 st = vec2(uv.x * aspect, uv.y) * 0.7;

                    // ---- Cursor influence (natural fluid push) ----
                    vec2 mouseUV = vec2(uMouse.x * aspect, uMouse.y);
                    vec2 stToMouse = st - mouseUV * 1.5;
                    float mouseDist = length(stToMouse);
                    
                    // Smooth radial falloff — cursor influence fades naturally
                    float influence = smoothstep(1.5, 0.0, mouseDist);
                    
                    // Direction-aware push: noise warps AWAY from cursor
                    vec2 pushDir = normalize(stToMouse + 0.001);
                    vec2 mouseWarp = pushDir * influence * 0.2; // Softer push
                    
                    // Add velocity-based streaking for natural motion feel
                    vec2 velWarp = uMouseVelocity * influence * 1.0;
                    
                    vec2 totalMouseInfluence = mouseWarp + velWarp;

                    // ---- Warped noise field ----
                    float f = warpedNoise(st, uTime, totalMouseInfluence);

                    // ---- Additional flowing layer for liquid motion ----
                    float flow1 = snoise(st * 0.5 + uTime * 0.03 + totalMouseInfluence * 0.3);
                    float flow2 = snoise(st * 0.8 - uTime * 0.02 + vec2(flow1 * 0.2));
                    float liquidMotion = (flow1 + flow2) * 0.25;

                    // Combine warped noise + liquid flow
                    float combined = f + liquidMotion;

                    // ---- Color mapping with smooth gradient bands ----
                    // Remap combined to 0-1 range
                    float t = combined * 0.5 + 0.5;
                    t = clamp(t, 0.0, 1.0);

                    // Multi-stop gradient: creates organic color blobs
                    vec3 color;
                    if (t < 0.25) {
                        color = mix(uColor1, uColor2, t * 4.0);
                    } else if (t < 0.5) {
                        color = mix(uColor2, uColor3, (t - 0.25) * 4.0);
                    } else if (t < 0.75) {
                        color = mix(uColor3, uColor4, (t - 0.5) * 4.0);
                    } else {
                        color = mix(uColor4, uColor1, (t - 0.75) * 4.0);
                    }

                    // Add the "very subtle black" (dark warm grey) as a rare deep shadow in the noise valleys
                    float shadowMap = smoothstep(0.1, 0.0, t);
                    vec3 subtleBlack = vec3(0.3, 0.3, 0.32); // very faint dark grey tint
                    color = mix(color, subtleBlack, shadowMap * 0.15); // extremely subtle

                    // ---- Hot accent glow near cursor ----
                    float accentGlow = smoothstep(0.8, 0.0, mouseDist) * 0.12;
                    color = mix(color, uColor5, accentGlow);

                    // ---- Extremely subtle warm yellow/cream overall tint based on flow ----
                    vec3 warmCream = vec3(1.0, 0.98, 0.94);
                    color = mix(color, warmCream, flow1 * 0.05);

                    // ---- Subtle brightness variation from the noise field ----
                    float brightness = 0.85 + 0.15 * (f * 0.5 + 0.5);
                    color *= brightness * uBrightness;

                    // ---- Vignette for depth ----
                    float vignette = 1.0 - smoothstep(0.3, 1.5, length(uv - 0.5) * 1.5);
                    color *= mix(0.7, 1.0, vignette);

                    gl_FragColor = vec4(color, 1.0);
                }
            `,
            transparent: true,
            depthWrite: false
        });

        const plane = new THREE.Mesh(geometry, material);
        plane.position.z = -30;
        this.scene.add(plane);
    }

    addMouseInteraction() {
        window.addEventListener('mousemove', (e) => {
            this.targetMouse.x = e.clientX / window.innerWidth;
            this.targetMouse.y = 1.0 - (e.clientY / window.innerHeight);
        });

        // Touch support
        window.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                this.targetMouse.x = e.touches[0].clientX / window.innerWidth;
                this.targetMouse.y = 1.0 - (e.touches[0].clientY / window.innerHeight);
            }
        }, { passive: true });
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        if (this.fluidUniforms) {
            this.fluidUniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
        }
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        const delta = this.clock.getDelta();
        
        // Respect prefers-reduced-motion: slow down animation significantly if enabled
        const timeDelta = this.reducedMotion ? delta * 0.05 : delta;
        this.shaderTime += timeDelta;

        // Smooth mouse lerp (very smooth, laggy feel = natural/liquid)
        this.mouse.lerp(this.targetMouse, 0.02);

        // Calculate mouse velocity (smoothed)
        this.mouseVelocity.x += (this.mouse.x - this.prevMouse.x - this.mouseVelocity.x) * 0.1;
        this.mouseVelocity.y += (this.mouse.y - this.prevMouse.y - this.mouseVelocity.y) * 0.1;
        // Dampen velocity over time
        this.mouseVelocity.multiplyScalar(0.95);
        
        this.prevMouse.copy(this.mouse);

        if(this.fluidUniforms) {
            this.fluidUniforms.uTime.value = this.shaderTime;
            this.fluidUniforms.uMouse.value.copy(this.mouse);
            this.fluidUniforms.uMouseVelocity.value.copy(this.mouseVelocity);
        }

        this.renderer.render(this.scene, this.camera);
    }
}

new WebGLBackground();
