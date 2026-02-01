import * as THREE from 'three';
import { Hands, type Results } from '@mediapipe/hands';
import * as dat from 'dat.gui';

// --- 1. CONFIGURATION ---
let PARTICLE_COUNT = 25000; 
let SMOOTHING = 0.05;       
let ROTATION_DAMPING = 0.08; 
let SHAPE_SCALE = 2.2;      

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

camera.position.z = 5;

// --- 2. GEOMETRY & MATERIAL SETUP ---
const geometry = new THREE.BufferGeometry();
const posArray = new Float32Array(PARTICLE_COUNT * 3);
const targetArray = new Float32Array(PARTICLE_COUNT * 3);
const colorArray = new Float32Array(PARTICLE_COUNT * 3);

for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 10;
    targetArray[i] = posArray[i];
}

geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

const material = new THREE.PointsMaterial({
    size: 0.018, 
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
});

const points = new THREE.Points(geometry, material);
scene.add(points);

// --- 3. RUMUS BENTUK (TIDAK DIUBAH SAMA SEKALI) ---
function generateShapePositions(shapeIndex: number) {
    const newTarget = new Float32Array(PARTICLE_COUNT * 3);
    const colors = geometry.attributes.color.array as Float32Array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const t = Math.random() * Math.PI * 2;
        const r_rand = Math.sqrt(Math.random()); 
        let x = 0, y = 0, z = 0;

        if (shapeIndex === 1) { 
            const s = SHAPE_SCALE * 0.13; 
            x = 16 * Math.pow(Math.sin(t), 3);
            y = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
            x *= s * r_rand; y *= s * r_rand;
            z = (Math.random() - 0.5) * 0.4 * r_rand;
            colors[i3] = 1.0; colors[i3+1] = 0.2; colors[i3+2] = 0.4;
        } 
        else if (shapeIndex === 2) { 
            const petals = 8;
            const flowerSize = SHAPE_SCALE * 1.3;
            const r = Math.abs(Math.cos(petals / 2 * t)) * flowerSize * r_rand;
            x = r * Math.cos(t); y = r * Math.sin(t);
            z = Math.sin(r * 1.5) * 0.6 + (Math.random() - 0.5) * 0.2;
            colors[i3] = 0.4; colors[i3+1] = 0.5; colors[i3+2] = 1.0;
        }
        else if (shapeIndex === 3) { 
            const spikes = 5;
            const outer = 1.8 * SHAPE_SCALE;
            const inner = 0.7 * SHAPE_SCALE;
            const section = Math.floor(t / (Math.PI * 2 / spikes));
            const baseAngle = section * (Math.PI * 2 / spikes);
            const relAngle = t - baseAngle;
            const halfSection = Math.PI / spikes;
            let currentR = relAngle < halfSection 
                ? THREE.MathUtils.lerp(outer, inner, relAngle / halfSection)
                : THREE.MathUtils.lerp(inner, outer, (relAngle - halfSection) / halfSection);
            currentR *= r_rand;
            x = Math.cos(t) * currentR; y = Math.sin(t) * currentR;
            z = (Math.random() - 0.5) * 0.3;
            colors[i3] = 0.2; colors[i3+1] = 0.9; colors[i3+2] = 1.0;
        }
        else { 
            const r = (2 + Math.random() * 2.5) * SHAPE_SCALE;
            x = Math.cos(t) * r; y = Math.sin(t) * r;
            z = (Math.random() - 0.5) * 5;
            colors[i3] = 0.2; colors[i3+1] = 0.2; colors[i3+2] = 0.3;
        }
        newTarget[i3] = x; newTarget[i3 + 1] = y; newTarget[i3 + 2] = z;
    }
    return newTarget;
}

// --- 4. PERBAIKAN HAND TRACKING LOGIC (AGAR DETEKSI DI PRODUCTION) ---
let currentShape = -1;
let rotX = 0, rotY = 0;

// Versi MediaPipe yang lebih stabil untuk hosting
const hands = new Hands({ 
    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${f}` 
});

hands.setOptions({ 
    maxNumHands: 1, 
    modelComplexity: 1, 
    minDetectionConfidence: 0.6, // Disedikit turunin biar lebih responsif
    minTrackingConfidence: 0.6 
});

hands.onResults((res: Results) => {
    if (res.multiHandLandmarks?.length) {
        const lm = res.multiHandLandmarks[0];
        rotY = (lm[0].x - 0.5) * 5;
        rotX = (lm[0].y - 0.5) * 5;

        let count = 0;
        if (lm[8].y < lm[6].y) count++;  
        if (lm[12].y < lm[10].y) count++; 
        if (lm[16].y < lm[14].y) count++; 
        
        if (count !== currentShape) {
            currentShape = count;
            targetArray.set(generateShapePositions(currentShape));
        }
    } else if (currentShape !== 0) {
        currentShape = 0;
        targetArray.set(generateShapePositions(0));
    }
});

// Fix Video Preview untuk Production
const video = document.createElement('video');
Object.assign(video.style, { 
    position:'fixed', bottom:'15px', left:'15px', width:'130px', 
    borderRadius:'10px', transform:'scaleX(-1)', opacity:'0.4', border:'1px solid white',
    zIndex: '1000' 
});
// Atribut wajib buat iOS & Chrome Production
video.setAttribute('autoplay', '');
video.setAttribute('muted', '');
video.setAttribute('playsinline', ''); 
document.body.appendChild(video);

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480, facingMode: "user" } 
        });
        video.srcObject = stream;
        
        video.onloadedmetadata = () => {
            video.play();
            // Start detection loop
            const detect = async () => {
                if (video.readyState >= 2) {
                    await hands.send({ image: video });
                }
                requestAnimationFrame(detect);
            };
            detect();
        };
    } catch (err) {
        console.error("Kamera Error bro:", err);
    }
}

startCamera();

// --- 5. ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);
    const pos = geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < pos.length; i++) {
        pos[i] += (targetArray[i] - pos[i]) * SMOOTHING;
    }
    points.rotation.y += (rotY - points.rotation.y) * ROTATION_DAMPING;
    points.rotation.x += (rotX - points.rotation.x) * ROTATION_DAMPING;
    points.rotation.z += 0.003;

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    renderer.render(scene, camera);
}
animate();

// --- 6. DAT.GUI (ANTI ERROR) ---
const gui = new dat.GUI();
const params = { kehalusan: SMOOTHING, skala: SHAPE_SCALE, ukuranTitik: material.size };
gui.add(params, 'kehalusan', 0.01, 0.2).name('Transition').onChange(v => SMOOTHING = v);
gui.add(params, 'skala', 0.5, 4.0).name('Global Scale').onChange(v => {
    SHAPE_SCALE = v;
    targetArray.set(generateShapePositions(currentShape));
});
gui.add(params, 'ukuranTitik', 0.005, 0.05).name('Particle Size').onChange(v => material.size = v);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});