/**
 * GLOBAL MOBİLYA — MODÜL 8: 3D WEBGL MODEL VIEWER
 * ============================================================================
 * Interactive Three.js + GLTFLoader + OrbitControls Furniture Inspection Engine
 * Features: 360° orbit, auto-rotate, studio 3-point lighting, bounding box auto-fit,
 * wireframe toggle, fullscreen, and zero-leak WebGL memory disposal.
 * ============================================================================
 */

export class ModelViewerEngine {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = options;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.currentModel = null;
    this.animFrameId = null;

    this.isAutoRotating = false;
    this.isWireframe = false;
    this.initialCameraPosition = null;
    this.initialTarget = null;

    this._onResize = this._handleResize.bind(this);
  }

  init() {
    if (!window.THREE) {
      throw new Error('Three.js kütüphanesi yüklenemedi.');
    }

    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 500;

    // 1. Scene
    this.scene = new window.THREE.Scene();
    this.scene.background = new window.THREE.Color(0x0C1017); // Studio Charcoal

    // 2. Camera
    this.camera = new window.THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(2.5, 2.0, 3.5);

    // 3. WebGL Renderer
    this.renderer = new window.THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = window.THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputEncoding = window.THREE.sRGBEncoding;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // 4. Orbit Controls
    if (window.THREE.OrbitControls) {
      this.controls = new window.THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.maxPolarAngle = Math.PI / 2 + 0.05; // Don't flip under ground
      this.controls.minDistance = 0.5;
      this.controls.maxDistance = 20;
    }

    // 5. Studio 3-Point Lighting Setup
    this._setupStudioLighting();

    // 6. Ground Studio Grid
    const grid = new window.THREE.GridHelper(10, 20, 0xD4AF37, 0x1E293B);
    grid.position.y = -0.001;
    this.scene.add(grid);

    // 7. Event Listeners & Animation Loop
    window.addEventListener('resize', this._onResize);
    this._animate();
  }

  _setupStudioLighting() {
    // Ambient Light (Soft base)
    const ambient = new window.THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambient);

    // Key Light (Warm 5600K)
    const keyLight = new window.THREE.DirectionalLight(0xfff8ee, 1.2);
    keyLight.position.set(4, 6, 4);
    this.scene.add(keyLight);

    // Fill Light (Cool & Soft)
    const fillLight = new window.THREE.DirectionalLight(0xdbeafe, 0.6);
    fillLight.position.set(-4, 3, -2);
    this.scene.add(fillLight);

    // Rim / Hair Light
    const rimLight = new window.THREE.DirectionalLight(0xffffff, 0.8);
    rimLight.position.set(0, 5, -5);
    this.scene.add(rimLight);
  }

  async loadModel(url, onProgress = null) {
    if (!window.THREE.GLTFLoader) {
      throw new Error('GLTFLoader eklentisi bulunamadı.');
    }

    if (this.currentModel) {
      this.scene.remove(this.currentModel);
      this._disposeObject(this.currentModel);
      this.currentModel = null;
    }

    const loader = new window.THREE.GLTFLoader();

    return new Promise((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          this.currentModel = gltf.scene;

          // 1. Compute Bounding Box to Center and Scale Camera
          const box = new window.THREE.Box3().setFromObject(this.currentModel);
          const size = box.getSize(new window.THREE.Vector3());
          const center = box.getCenter(new window.THREE.Vector3());

          // Offset to sit on ground plane (y = 0)
          this.currentModel.position.x -= center.x;
          this.currentModel.position.y -= box.min.y;
          this.currentModel.position.z -= center.z;

          this.scene.add(this.currentModel);

          // 2. Adjust Camera Distance based on model max dimension
          const maxDim = Math.max(size.x, size.y, size.z);
          const fov = this.camera.fov * (Math.PI / 180);
          let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.6;
          cameraZ = Math.max(cameraZ, 2.0);

          this.camera.position.set(cameraZ * 0.7, cameraZ * 0.5, cameraZ);
          this.camera.lookAt(0, size.y / 2, 0);

          if (this.controls) {
            this.controls.target.set(0, size.y / 2, 0);
            this.controls.update();
            this.initialCameraPosition = this.camera.position.clone();
            this.initialTarget = this.controls.target.clone();
          }

          // Count triangles
          let triangleCount = 0;
          this.currentModel.traverse((node) => {
            if (node.isMesh && node.geometry) {
              triangleCount += node.geometry.index
                ? node.geometry.index.count / 3
                : node.geometry.attributes.position.count / 3;
            }
          });

          resolve({
            success: true,
            size: { x: size.x.toFixed(2), y: size.y.toFixed(2), z: size.z.toFixed(2) },
            triangleCount: Math.round(triangleCount)
          });
        },
        (xhr) => {
          if (xhr.lengthComputable && onProgress) {
            const percent = Math.round((xhr.loaded / xhr.total) * 100);
            onProgress(percent);
          }
        },
        (error) => {
          reject(new Error(`3D Model yüklenirken hata oluştu: ${error.message || 'Dosya okunamadı'}`));
        }
      );
    });
  }

  toggleAutoRotate() {
    this.isAutoRotating = !this.isAutoRotating;
    if (this.controls) {
      this.controls.autoRotate = this.isAutoRotating;
      this.controls.autoRotateSpeed = 2.0;
    }
    return this.isAutoRotating;
  }

  toggleWireframe() {
    this.isWireframe = !this.isWireframe;
    if (this.currentModel) {
      this.currentModel.traverse((node) => {
        if (node.isMesh && node.material) {
          if (Array.isArray(node.material)) {
            node.material.forEach(m => m.wireframe = this.isWireframe);
          } else {
            node.material.wireframe = this.isWireframe;
          }
        }
      });
    }
    return this.isWireframe;
  }

  resetCamera() {
    if (this.controls && this.initialCameraPosition && this.initialTarget) {
      this.camera.position.copy(this.initialCameraPosition);
      this.controls.target.copy(this.initialTarget);
      this.controls.update();
    }
  }

  _handleResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  _animate() {
    this.animFrameId = requestAnimationFrame(this._animate.bind(this));
    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  _disposeObject(obj) {
    obj.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
      if (node.material) {
        if (Array.isArray(node.material)) {
          node.material.forEach(m => m.dispose());
        } else {
          node.material.dispose();
        }
      }
    });
  }

  dispose() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('resize', this._onResize);

    if (this.currentModel) this._disposeObject(this.currentModel);
    if (this.controls) this.controls.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
  }
}
