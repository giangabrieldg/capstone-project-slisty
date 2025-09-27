// cake-3d-renderer.js - Handles all 3D visualization and Three.js operations

class Cake3DRenderer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.cake = null;
    this.dracoLoader = null;
    this.loader = null;
    
    // Mouse control variables
    this.mouseControls = {
      down: false,
      x0: 0,
      y0: 0,
      tx: 0,
      ty: 0,
      cx: 0,
      cy: 0
    };
  }

  // Initialize Three.js scene and load models
  async init() {
    const THREE = window.THREE;
    
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#f5f1e9");
    THREE.RectAreaLightUniformsLib.init();
    
    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      60, 
      this.container.clientWidth / this.container.clientHeight, 
      0.1, 
      1000
    );
    this.camera.position.set(0, 0.2, 1.0);
    this.camera.lookAt(0, 0, 0);
    
    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.container.appendChild(this.renderer.domElement);
    
    // Window resize handler
    window.addEventListener("resize", () => {
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    });
    
    // Lighting setup
    this.setupLighting();
    
    // Load models
    await this.createCake();
    
    // Add mouse controls
    this.addMouseControls();
    
    // Start animation loop
    this.animate();
    
    // Hide loading screen
    setTimeout(() => {
      document.getElementById("loadingScreen")?.classList.add("hidden");
    }, 800);
  }

  // Setup scene lighting
  setupLighting() {
    const THREE = window.THREE;
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    this.scene.add(ambientLight);
    
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7);
    this.scene.add(hemisphereLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(1.5, 2, 1);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 500;
    dirLight.shadow.camera.left = -1;
    dirLight.shadow.camera.right = 1;
    dirLight.shadow.camera.top = 1;
    dirLight.shadow.camera.bottom = -1;
    this.scene.add(dirLight);
  }

  // Load and configure the 3D cake model
  async createCake() {
    const THREE = window.THREE;
    
    // Setup loaders
    this.dracoLoader = new THREE.DRACOLoader();
    this.dracoLoader.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/libs/draco/");
    
    this.loader = new THREE.GLTFLoader();
    this.loader.setDRACOLoader(this.dracoLoader);

    if (this.cake) this.scene.remove(this.cake);

    return new Promise((resolve, reject) => {
      this.loader.load(
        "/models/compressed_mainCake.glb",
        (gltf) => {
          this.cake = gltf.scene;

          // Configure cake meshes
          this.cake.traverse((obj) => {
            if (obj.isMesh) {
              if (obj.name === "BottomSponge") this.cake.bottomSpongeMesh = obj;
              if (obj.name === "TopSponge") this.cake.topSpongeMesh = obj;
              if (obj.name === "Filling") this.cake.fillingMesh = obj;
              if (obj.name === "mainCake") this.cake.mainCakeMesh = obj;

              if (obj.name === "bottomBeadsBorder") this.cake.bottomBeadsBorderMesh = obj;
              if (obj.name === "topBeadsBorder") this.cake.topBeadsBorderMesh = obj;
              if (obj.name === "bottomShellsBorder") this.cake.bottomShellsBorderMesh = obj;
              if (obj.name === "topShellsBorder") this.cake.topShellsBorderMesh = obj;

              obj.material.envMapIntensity = 1.5;
              obj.material.roughness = 0.6;
              obj.material.metalness = 0.1;
              obj.material.needsUpdate = true;
            }
          });

          this.cake.scale.set(0.27, 0.27, 0.27);
          this.cake.position.set(0, 0.05, 0.2);
          this.scene.add(this.cake);

          // Load additional meshes
          this.loadAdditionalMeshes().then(() => {
            resolve();
          });
        },
        undefined,
        (err) => {
          console.error("Draco/GLB load error:", err);
          reject(err);
        }
      );
    });
  }

  // Load additional decoration meshes
  async loadAdditionalMeshes() {
    const meshes = [
      { file: "bottomBeadsBorder", prop: "bottomBeadsMesh" },
      { file: "bottomShellsBorder", prop: "bottomShellsMesh" },
      { file: "topBeadsBorder", prop: "topBeadsMesh" },
      { file: "topShellsBorder", prop: "topShellsMesh" },
      { file: "Balloons", prop: "balloonsMesh" },
      { file: "Toppings", prop: "toppingsMesh" },
      { file: "Daisies", prop: "daisiesMesh" },
      { file: "buttonRoses", prop: "buttonRosesMesh" }
    ];

    const loadPromises = meshes.map(({ file, prop }) => {
      return new Promise((resolve) => {
        this.loader.load(
          `/models/compressed_${file}.glb`,
          (g) => {
            const m = g.scene;
            m.visible = false;
            this.cake.add(m);
            this.cake[prop] = m;
            resolve();
          },
          undefined,
          (err) => {
            console.error(`Error loading ${file}:`, err);
            resolve(); // Continue even if one fails
          }
        );
      });
    });

    await Promise.all(loadPromises);
  }

  // Update the 3D cake model based on configuration
  updateCake(config) {
    if (!this.cake) return;

    const fillingColors = {
      strawberry: "#B70824",
      bavarian: "#F1E7C3",
      none: "#FFFFFF",
    };

    // Update bottom border
    if (config.bottomBorder === "beads" && this.cake.bottomBeadsMesh) {
      this.cake.bottomBeadsMesh.visible = true;
      this.cake.bottomBeadsMesh.traverse((child) => {
        if (child.isMesh && child.material) {
          const hexColor = Number.parseInt(config.bottomBorderColor.replace("#", "0x"));
          child.material.color.setHex(hexColor);
        }
      });
    } else if (this.cake.bottomBeadsMesh) {
      this.cake.bottomBeadsMesh.visible = false;
    }

    if (config.bottomBorder === "shells" && this.cake.bottomShellsMesh) {
      this.cake.bottomShellsMesh.visible = true;
      this.cake.bottomShellsMesh.traverse((child) => {
        if (child.isMesh && child.material) {
          const hexColor = Number.parseInt(config.bottomBorderColor.replace("#", "0x"));
          child.material.color.setHex(hexColor);
        }
      });
    } else if (this.cake.bottomShellsMesh) {
      this.cake.bottomShellsMesh.visible = false;
    }

    // Update top border
    if (config.topBorder === "beads" && this.cake.topBeadsMesh) {
      this.cake.topBeadsMesh.visible = true;
      this.cake.topBeadsMesh.traverse((child) => {
        if (child.isMesh && child.material) {
          const hexColor = Number.parseInt(config.topBorderColor.replace("#", "0x"));
          child.material.color.setHex(hexColor);
        }
      });
    } else if (this.cake.topBeadsMesh) {
      this.cake.topBeadsMesh.visible = false;
    }

    if (config.topBorder === "shells" && this.cake.topShellsMesh) {
      this.cake.topShellsMesh.visible = true;
      this.cake.topShellsMesh.traverse((child) => {
        if (child.isMesh && child.material) {
          const hexColor = Number.parseInt(config.topBorderColor.replace("#", "0x"));
          child.material.color.setHex(hexColor);
        }
      });
    } else if (this.cake.topShellsMesh) {
      this.cake.topShellsMesh.visible = false;
    }

    // Update cake colors
    const hexCake = Number.parseInt(config.cakeColor.replace("#", "0x"));
    if (this.cake.bottomSpongeMesh) this.cake.bottomSpongeMesh.material.color.setHex(hexCake);
    if (this.cake.topSpongeMesh) this.cake.topSpongeMesh.material.color.setHex(hexCake);

    const hexIce = Number.parseInt(config.icingColor.replace("#", "0x"));
    if (this.cake.mainCakeMesh) this.cake.mainCakeMesh.material.color.setHex(hexIce);

    // Update filling color
    const fillColor = fillingColors[config.filling] || "#FFFFFF";
    const hexFills = Number.parseInt(fillColor.replace("#", "0x"));
    if (this.cake.fillingMesh) this.cake.fillingMesh.material.color.setHex(hexFills);

    // Hide all decorations first
    if (this.cake.balloonsMesh) this.cake.balloonsMesh.visible = false;
    if (this.cake.toppingsMesh) this.cake.toppingsMesh.visible = false;
    if (this.cake.daisiesMesh) this.cake.daisiesMesh.visible = false;
    if (this.cake.buttonRosesMesh) this.cake.buttonRosesMesh.visible = false;

    // Show selected decorations
    if (config.decorations === "balloons" && this.cake.balloonsMesh) {
      this.cake.balloonsMesh.visible = true;
    } else if (config.decorations === "toppings" && this.cake.toppingsMesh) {
      this.cake.toppingsMesh.visible = true;
      this.cake.toppingsMesh.traverse((child) => {
        if (child.isMesh && child.material) {
          const hexColor = Number.parseInt(config.toppingsColor.replace("#", "0x"));
          child.material.color.setHex(hexColor);
        }
      });
    } else if (config.decorations === "flowers") {
      if (config.flowerType === "daisies" && this.cake.daisiesMesh) {
        this.cake.daisiesMesh.visible = true;
      } else if (config.flowerType === "buttonRoses" && this.cake.buttonRosesMesh) {
        this.cake.buttonRosesMesh.visible = true;
      }
    }
  }

  // Add mouse controls for rotating the cake
  addMouseControls() {
    const mc = this.mouseControls;
    
    this.container.addEventListener("mousedown", (e) => {
      mc.down = true;
      mc.x0 = e.clientX;
      mc.y0 = e.clientY;
    });
    
    this.container.addEventListener("mouseup", () => (mc.down = false));
    
    this.container.addEventListener("mousemove", (e) => {
      if (!mc.down) return;
      const dx = e.clientX - mc.x0;
      const dy = e.clientY - mc.y0;
      mc.tx += dx * 0.01;
      mc.ty += dy * 0.01;
      mc.x0 = e.clientX;
      mc.y0 = e.clientY;
    });
    
    this.container.addEventListener("contextmenu", (e) => e.preventDefault());
    this.container.addEventListener("wheel", (e) => e.preventDefault());

    // Smooth rotation loop
    const rotationLoop = () => {
      mc.cx += (mc.tx - mc.cx) * 0.1;
      mc.cy += (mc.ty - mc.cy) * 0.1;
      if (this.cake) {
        this.cake.rotation.y = mc.cx;
        this.cake.rotation.x = mc.cy;
      }
      requestAnimationFrame(rotationLoop);
    };
    rotationLoop();
  }

  // Animate the 3D scene
  animate() {
    requestAnimationFrame(() => this.animate());
    this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }

  // Save the 3D cake design as an image
  saveDesignImage() {
    if (!this.renderer || !this.scene || !this.camera) {
      alert("3D model not ready. Please wait a moment and try again.");
      return;
    }
    
    try {
      this.renderer.render(this.scene, this.camera);
      const canvas = this.renderer.domElement;
      const dataURL = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `cake-design-${Date.now()}.png`;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      alert("Design image saved successfully!");
    } catch (error) {
      console.error("Error saving design:", error);
      alert("Sorry, there was an error saving your design. Please try again.");
    }
  }

  // Capture 3D design as data URL for order submission
  async captureDesignImage() {
    if (!this.renderer || !this.scene || !this.camera) {
      throw new Error("3D model not ready");
    }
    
    this.renderer.render(this.scene, this.camera);
    const canvas = this.renderer.domElement;
    return canvas.toDataURL("image/png");
  }

  // Dispose of resources
  dispose() {
    if (this.renderer) {
      this.renderer.dispose();
    }
    if (this.dracoLoader) {
      this.dracoLoader.dispose();
    }
  }
}

// Export for use in other modules
window.Cake3DRenderer = Cake3DRenderer;