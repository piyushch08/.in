
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';

class WebGLBackground {
    constructor() {
        this.canvas = document.querySelector('#webgl-canvas');
        if (!this.canvas) return;

        this.init();
        this.createFluidBackground();
        this.createHyperspace();
        this.createPhysicsObjects();
        this.addLights();
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

        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, 0, 0),
        });
        
        // Add a gentle drag to slow objects down over time
        this.world.defaultContactMaterial.friction = 0;
        
        this.clock = new THREE.Clock();
        this.meshes = [];
        this.bodies = [];
        this.mouse = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
    }

    createFluidBackground() {
        const geometry = new THREE.PlaneGeometry(150, 150, 32, 32);
        
        // Very basic procedural noise shader
        this.fluidUniforms = {
            uTime: { value: 0 },
            uColor1: { value: new THREE.Color('#2563eb') }, // Blue
            uColor2: { value: new THREE.Color('#f97316') }, // Orange
            uColor3: { value: new THREE.Color('#a855f7') }, // Purple
            uColor4: { value: new THREE.Color('#eab308') }  // Yellow
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
                uniform float uTime;
                uniform vec3 uColor1;
                uniform vec3 uColor2;
                uniform vec3 uColor3;
                uniform vec3 uColor4;
                varying vec2 vUv;

                // Simple 2D noise
                float random(vec2 st) {
                    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
                }
                float noise(vec2 st) {
                    vec2 i = floor(st);
                    vec2 f = fract(st);
                    float a = random(i);
                    float b = random(i + vec2(1.0, 0.0));
                    float c = random(i + vec2(0.0, 1.0));
                    float d = random(i + vec2(1.0, 1.0));
                    vec2 u = f * f * (3.0 - 2.0 * f);
                    return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
                }

                void main() {
                    vec2 st = vUv * 3.0;
                    
                    // Animated noise
                    vec2 q = vec2(0.);
                    q.x = noise(st + uTime * 0.1);
                    q.y = noise(st + vec2(1.0));

                    vec2 r = vec2(0.);
                    r.x = noise(st + 1.0 * q + vec2(1.7, 9.2) + uTime * 0.15);
                    r.y = noise(st + 1.0 * q + vec2(8.3, 2.8) + uTime * 0.126);

                    float f = noise(st + r);

                    vec3 color = mix(uColor1, uColor2, clamp(f*f*4.0, 0.0, 1.0));
                    color = mix(color, uColor3, clamp(length(q), 0.0, 1.0));
                    color = mix(color, uColor4, clamp(length(r.x), 0.0, 1.0));

                    // Soften and blend
                    gl_FragColor = vec4((f*f*f + 0.6*f*f + 0.5*f)*color, 0.6);
                }
            `,
            transparent: true,
            depthWrite: false
        });

        const plane = new THREE.Mesh(geometry, material);
        plane.position.z = -30;
        this.scene.add(plane);
    }

    createHyperspace() {
        const particleCount = 1000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        
        for(let i = 0; i < particleCount * 3; i+=3) {
            positions[i] = (Math.random() - 0.5) * 60;
            positions[i+1] = (Math.random() - 0.5) * 60;
            positions[i+2] = (Math.random() - 0.5) * 60;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.1,
            transparent: true,
            opacity: 0.8
        });
        
        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    createPhysicsObjects() {
        // Create glassy/iridescent material
        const material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            metalness: 0.1,
            roughness: 0.1,
            transmission: 0.9, // glass-like
            ior: 1.5,
            thickness: 0.5,
            iridescence: 1.0,
            iridescenceIOR: 1.3,
            iridescenceThicknessRange: [100, 400]
        });

        const geometries = [
            new THREE.TorusGeometry(1, 0.4, 16, 100),
            new THREE.IcosahedronGeometry(1.2, 0),
            new THREE.SphereGeometry(1, 32, 32),
            new THREE.TorusKnotGeometry(0.8, 0.3, 100, 16)
        ];

        for(let i=0; i<8; i++) {
            const geo = geometries[i % geometries.length];
            const mesh = new THREE.Mesh(geo, material);
            
            // Random position
            mesh.position.set(
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 15,
                (Math.random() - 0.5) * 10
            );
            
            // Physics body
            const shape = new CANNON.Sphere(1.2); // Approximate collision
            const body = new CANNON.Body({
                mass: 1,
                shape: shape,
                position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z)
            });
            
            // Give them some initial spin
            body.angularVelocity.set(Math.random(), Math.random(), Math.random());
            
            this.world.addBody(body);
            this.scene.add(mesh);
            
            this.meshes.push(mesh);
            this.bodies.push(body);
        }
    }

    addLights() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient);

        const dirLight = new THREE.DirectionalLight(0xffffff, 2);
        dirLight.position.set(5, 5, 5);
        this.scene.add(dirLight);
        
        const pointLight = new THREE.PointLight(0xa855f7, 5, 20);
        pointLight.position.set(-5, -5, 5);
        this.scene.add(pointLight);
    }

    addMouseInteraction() {
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

            // Apply force to physics objects based on mouse hover
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.meshes);

            for(let intersect of intersects) {
                const index = this.meshes.indexOf(intersect.object);
                if(index > -1) {
                    const body = this.bodies[index];
                    // Push away from mouse
                    body.applyImpulse(
                        new CANNON.Vec3(
                            this.raycaster.ray.direction.x * 2,
                            this.raycaster.ray.direction.y * 2,
                            this.raycaster.ray.direction.z * 2
                        ),
                        new CANNON.Vec3(0,0,0)
                    );
                }
            }
        });
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        const delta = this.clock.getDelta();
        const time = this.clock.getElapsedTime();

        // Update physics
        this.world.step(1/60, delta, 3);
        
        // Sync meshes with physics bodies
        for(let i=0; i<this.meshes.length; i++) {
            this.meshes[i].position.copy(this.bodies[i].position);
            this.meshes[i].quaternion.copy(this.bodies[i].quaternion);
            
            // Soft boundary to keep objects in view
            const p = this.bodies[i].position;
            if(p.length() > 15) {
                p.scale(0.99, p);
            }
        }

        // Animate fluid
        if(this.fluidUniforms) {
            this.fluidUniforms.uTime.value = time;
        }

        // Animate hyperspace
        if(this.particles) {
            const positions = this.particles.geometry.attributes.position.array;
            for(let i=0; i<positions.length; i+=3) {
                positions[i+2] += 0.5; // move forward
                if(positions[i+2] > 20) {
                    positions[i+2] = -40; // reset back
                }
            }
            this.particles.geometry.attributes.position.needsUpdate = true;
            this.particles.rotation.z += 0.001;
        }

        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize on DOM load or immediately if defer
new WebGLBackground();
