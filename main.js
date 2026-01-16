/* ============================================
           WINDOWS XP LOGIN LOADING GATE
           ============================================ */
(function () {
  const expectedModels = new Set(["model1", "model2"]);
  let windowLoaded = false;
  let finished = false;
  let startupAudio = null;
  let readyToStart = false;

  function getOverlayEl() {
    return document.getElementById("xp-login-screen");
  }

  function finishLoading() {
    if (finished) return;
    finished = true;

    // Play startup audio when user clicks to start
    tryPlayStartupAudio();

    const overlay = getOverlayEl();
    document.documentElement.classList.remove("xp-loading");
    if (document.body) document.body.classList.remove("xp-loading");

    if (!overlay) return;
    overlay.classList.add("xp-login--hiding");

    const remove = () => {
      const el = getOverlayEl();
      if (el) el.remove();
    };
    overlay.addEventListener("transitionend", remove, { once: true });
    // Fallback in case transitionend doesn't fire (e.g. display changes).
    setTimeout(remove, 800);
  }

  function checkReady() {
    if (readyToStart) return;
    if (windowLoaded && expectedModels.size === 0) {
      readyToStart = true;
      // Scroll to top before user clicks
      window.scrollTo({ top: 0, behavior: "smooth" });
      // Update loading text to indicate user can click
      const loadingText = document.querySelector(".xp-loading-text");
      if (loadingText) {
        loadingText.textContent = "Click to continue クリックして続ける";
      }
    }
  }

  function tryPlayStartupAudio() {
    if (!startupAudio) {
      startupAudio = new Audio("source/startup.mp3");
      startupAudio.preload = "auto";
      startupAudio.volume = 0.8;
      startupAudio.loop = false;
    }

    startupAudio.currentTime = 0;
    const p = startupAudio.play();
    if (p && typeof p.catch === "function") {
      p.catch((err) => {
        console.warn("Could not play startup audio:", err);
      });
    }
  }

  // Expose for GLTF loaders.
  window.markModelLoaded = function markModelLoaded(id) {
    if (!id) return;
    expectedModels.delete(String(id));
    checkReady();
  };

  // Ensure body gets the same class once it exists.
  if (document.body) {
    document.body.classList.add("xp-loading");
  } else {
    document.addEventListener(
      "DOMContentLoaded",
      () => document.body && document.body.classList.add("xp-loading"),
      { once: true }
    );
  }

  window.addEventListener(
    "load",
    () => {
      windowLoaded = true;
      checkReady();
    },
    { once: true }
  );

  // Wait for user click to start
  const overlay = getOverlayEl();
  if (overlay) {
    overlay.addEventListener("click", () => {
      if (readyToStart) {
        finishLoading();
      }
    });
  }

  // Safety net: never trap the user forever.
  setTimeout(() => {
    if (!finished) finishLoading();
  }, 45000);
})();

/* ============================================
           GENERATE ANIMATED STARS
           ============================================ */
(function () {
  const starsContainer = document.getElementById("stars");
  if (!starsContainer) return;
  const numStars = 150;

  for (let i = 0; i < numStars; i++) {
    const star = document.createElement("div");
    star.className = "star";
    star.style.left = Math.random() * 100 + "%";
    star.style.top = Math.random() * 100 + "%";
    star.style.width = Math.random() * 3 + 1 + "px";
    star.style.height = star.style.width;
    star.style.animationDelay = Math.random() * 3 + "s";
    star.style.animationDuration = Math.random() * 2 + 2 + "s";
    starsContainer.appendChild(star);
  }
})();

/* ============================================
           FLOOR STARS (CHECKERBOARD)
           ============================================ */
(function () {
  const floorStars = document.getElementById("floor-stars");
  if (!floorStars) return;

  const starCount = 26;

  for (let i = 0; i < starCount; i++) {
    const star = document.createElement("div");
    star.className = "floor-star";
    star.style.setProperty("--x", Math.random() * 100 + "%");
    star.style.setProperty("--y", 10 + Math.random() * 55 + "%");
    const size = 6 + Math.random() * 10;
    star.style.setProperty("--size", size + "px");
    const drift = 4 + Math.random() * 4;
    star.style.setProperty("--drift", drift + "s");
    star.style.animationDelay = Math.random() * 4 + "s";
    floorStars.appendChild(star);
  }
})();

/* ============================================
           PC SECTION - INTERACTIVE BOOT SEQUENCE
           ============================================ */
(function () {
  const pcContainer = document.getElementById("pc-container");
  const pcPowerBtn = document.getElementById("pc-power-btn");
  const screenMask =
    pcContainer && pcContainer.querySelector(".pc-screen-mask");
  const pcSection = document.getElementById("pc-section");
  const noSignalScreen = document.getElementById("no-signal-screen");
  const biosBootScreen = document.getElementById("bios-boot-screen");
  const biosBootText = document.getElementById("bios-boot-text");
  const xpBootScreen = document.getElementById("xp-boot-screen");
  const xpDesktop = document.getElementById("xp-desktop");
  const paintIcon = document.getElementById("paint-icon");
  const paintWindowContainer = document.getElementById(
    "paint-window-container"
  );
  const paintCloseBtn = document.getElementById("paint-close-btn");
  const xpClock = document.getElementById("xp-clock");

  let isBooting = false;
  let zoomAnchorScrollY = null;
  let zoomStart = null;
  let scrollingZoomDebounce = null;
  let zoomRaf = 0;

  if (!pcContainer || !pcPowerBtn) return;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const ZOOM_PADDING_PCT = 0.04; // tweak: smaller -> fills more of viewport
  const ZOOM_MAX_SCALE = 12;
  const ZOOM_SCROLL_RANGE_PX = 1100; // scroll distance to fully return to normal (bigger = less sensitive)
  const BOOT_TIMINGS = {
    screenPowerOnDelayMs: 160,
    biosLineDelayMs: prefersReducedMotion ? 10 : 120,
    biosDoneHoldMs: prefersReducedMotion ? 50 : 260,
    splashDurationMs: prefersReducedMotion ? 150 : 2500,
  };

  const BIOS_LINES = [
    "Copyright 1985-2003 Phoenix Technologies Ltd.",
    "CPU = Intel(R) Pentium(R) 4 CPU 2.80GHz",
    "Memory Test: 524288K OK",
    "Detecting IDE Primary Master ... VEKTROID HDD",
    "Detecting IDE Primary Slave  ... None",
    "Detecting IDE Secondary Master ... CD-ROM",
    "Detecting USB Devices ... 1 USB device(s) found",
    "Verifying DMI Pool Data .............",
    "Boot from CD: \u2014",
  ];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(t) {
    const x = clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
  }

  function setZoomVarsForViewport({ instant = false } = {}) {
    if (!screenMask) return;

    const wasZoomed = pcContainer.classList.contains("pc-zoomed");
    if (instant) pcContainer.classList.add("pc-zoomed--no-transition");

    // Measure unzoomed geometry for stable math.
    pcContainer.classList.remove("pc-zoomed");

    const containerRect = pcContainer.getBoundingClientRect();
    const maskRect = screenMask.getBoundingClientRect();
    if (maskRect.width <= 0 || maskRect.height <= 0) {
      if (instant) pcContainer.classList.remove("pc-zoomed--no-transition");
      if (wasZoomed) pcContainer.classList.add("pc-zoomed");
      return;
    }

    const padding = Math.round(
      Math.min(window.innerWidth, window.innerHeight) * ZOOM_PADDING_PCT
    );
    const targetW = Math.max(50, window.innerWidth - padding * 2);
    const targetH = Math.max(50, window.innerHeight - padding * 2);

    const scale = clamp(
      Math.min(targetW / maskRect.width, targetH / maskRect.height),
      1,
      ZOOM_MAX_SCALE
    );

    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    const maskCenterX = maskRect.left + maskRect.width / 2;
    const maskCenterY = maskRect.top + maskRect.height / 2;

    const scaledMaskCenterX =
      containerRect.left + (maskCenterX - containerRect.left) * scale;
    const scaledMaskCenterY =
      containerRect.top + (maskCenterY - containerRect.top) * scale;

    const tx = viewportCenterX - scaledMaskCenterX;
    const ty = viewportCenterY - scaledMaskCenterY;

    pcContainer.style.setProperty("--pc-zoom-scale", scale.toFixed(4));
    pcContainer.style.setProperty("--pc-zoom-tx", `${tx.toFixed(1)}px`);
    pcContainer.style.setProperty("--pc-zoom-ty", `${ty.toFixed(1)}px`);

    // Return numbers so callers can store a "zoom start" snapshot.
    const result = { scale, tx, ty };

    if (wasZoomed) pcContainer.classList.add("pc-zoomed");
    if (instant) {
      requestAnimationFrame(() =>
        pcContainer.classList.remove("pc-zoomed--no-transition")
      );
    }

    return result;
  }

  function zoomToScreen() {
    // Compute vars without animating the measurement step.
    const computed = setZoomVarsForViewport({ instant: true });
    if (computed) {
      zoomStart = {
        scale: computed.scale,
        tx: computed.tx,
        ty: computed.ty,
        scrollY: window.scrollY,
      };
    }
    // Re-enable transitions for the actual zoom-in.
    pcContainer.classList.remove("pc-zoomed--no-transition");
    requestAnimationFrame(() => pcContainer.classList.add("pc-zoomed"));
  }

  function applyScrollZoom() {
    // Only drive zoom when we're in the interactive (zoomable) state.
    // Cassette ejection uses its own zoom-out logic.
    if (pcContainer.classList.contains("cassette-ejecting")) return;
    if (!pcContainer.classList.contains("pc-zoomed")) return;
    if (!zoomStart) return;

    // Distance scrolled away from the "zoom-in" moment.
    const deltaY = window.scrollY - zoomStart.scrollY;
    const t = clamp(Math.abs(deltaY) / ZOOM_SCROLL_RANGE_PX, 0, 1);
    const eased = smoothstep(t);

    // Keep the zoomed view stable while scrolling by compensating the scroll in Y.
    // As we ease out, we also ease out that compensation so it returns to the normal flow.
    const startTyWithScrollComp = zoomStart.ty + deltaY;

    const nextScale = lerp(zoomStart.scale, 1, eased);
    const nextTx = lerp(zoomStart.tx, 0, eased);
    const nextTy = lerp(startTyWithScrollComp, 0, eased);

    pcContainer.style.setProperty("--pc-zoom-scale", nextScale.toFixed(4));
    pcContainer.style.setProperty("--pc-zoom-tx", `${nextTx.toFixed(1)}px`);
    pcContainer.style.setProperty("--pc-zoom-ty", `${nextTy.toFixed(1)}px`);

    pcContainer.classList.add("pc-zoomed--scrolling");
    clearTimeout(scrollingZoomDebounce);
    scrollingZoomDebounce = setTimeout(() => {
      pcContainer.classList.remove("pc-zoomed--scrolling");
    }, 140);

    // IMPORTANT: do NOT remove the zoom state at t==1.
    // Keeping it means scrolling back toward the anchor smoothly re-zooms in.
  }

  function runBiosTyping(onDone) {
    if (!biosBootText) {
      onDone && onDone();
      return;
    }
    biosBootText.textContent = "";

    let index = 0;
    const next = () => {
      if (index >= BIOS_LINES.length) {
        onDone && onDone();
        return;
      }

      const prefix = index === 0 ? "" : "\n";
      biosBootText.textContent += prefix + BIOS_LINES[index];
      index += 1;

      const jitter = prefersReducedMotion ? 0 : Math.random() * 80;
      setTimeout(next, BOOT_TIMINGS.biosLineDelayMs + jitter);
    };

    next();
  }

  // Update XP clock
  function updateClock() {
    if (!xpClock) return;
    const now = new Date();
    xpClock.textContent = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  updateClock();
  setInterval(updateClock, 1000);

  // Switch screen content
  function showScreen(screenId) {
    [noSignalScreen, biosBootScreen, xpBootScreen, xpDesktop].forEach(
      (screen) => {
        if (screen) screen.classList.remove("active");
      }
    );
    const target = document.getElementById(screenId);
    if (target) target.classList.add("active");
  }

  // PC boot sequence
  pcPowerBtn.addEventListener("click", () => {
    if (isBooting || pcContainer.classList.contains("pc-on")) return;
    isBooting = true;

    pcContainer.classList.remove("pc-off");
    pcContainer.classList.add("pc-booting");

    // Record where the user was when they zoomed in.
    zoomAnchorScrollY = window.scrollY;

    // Zoom so the PC screen fills the viewport (responsive)
    zoomToScreen();
    // Apply the scroll-zoom baseline immediately in case the user is already mid-scroll.
    requestAnimationFrame(() => applyScrollZoom());

    // Power on -> BIOS -> XP splash -> Desktop
    setTimeout(() => {
      showScreen("bios-boot-screen");
      runBiosTyping(() => {
        setTimeout(() => {
          showScreen("xp-boot-screen");

          setTimeout(() => {
            showScreen("xp-desktop");
            pcContainer.classList.remove("pc-booting");
            pcContainer.classList.add("pc-on");
            isBooting = false;
          }, BOOT_TIMINGS.splashDurationMs);
        }, BOOT_TIMINGS.biosDoneHoldMs);
      });
    }, BOOT_TIMINGS.screenPowerOnDelayMs);
  });

  // Paint icon click - open Paint
  if (paintIcon) {
    paintIcon.addEventListener("click", () => {
      if (paintWindowContainer) {
        paintWindowContainer.classList.remove("hidden");
        paintWindowContainer.classList.add("visible");
      }
    });

    // Double-click also works
    paintIcon.addEventListener("dblclick", () => {
      if (paintWindowContainer) {
        paintWindowContainer.classList.remove("hidden");
        paintWindowContainer.classList.add("visible");
      }
    });
  }

  // Paint close button
  if (paintCloseBtn) {
    paintCloseBtn.addEventListener("click", () => {
      if (paintWindowContainer) {
        paintWindowContainer.classList.remove("visible");
        paintWindowContainer.classList.add("hidden");
      }
    });
  }

  // Expose function to zoom out PC when cassette is created
  window.zoomOutPC = function () {
    pcContainer.classList.remove("pc-zoomed");
    pcContainer.classList.add("pc-zoomed-out", "cassette-ejecting");
    zoomAnchorScrollY = null;
    zoomStart = null;
    if (zoomRaf) {
      cancelAnimationFrame(zoomRaf);
      zoomRaf = 0;
    }
  };

  // Gradual zoom-out: proportional to how far the user has scrolled since zoom-in.
  window.addEventListener(
    "scroll",
    () => {
      if (!pcContainer.classList.contains("pc-zoomed")) return;
      if (!zoomStart) return;
      if (zoomRaf) return;
      zoomRaf = requestAnimationFrame(() => {
        zoomRaf = 0;
        applyScrollZoom();
      });
    },
    { passive: true }
  );

  // Keep the zoom stable across resizes / different screen sizes.
  window.addEventListener(
    "resize",
    () => {
      if (!pcContainer.classList.contains("pc-zoomed")) return;
      const computed = setZoomVarsForViewport({ instant: true });
      if (computed) {
        // Treat resize as updating the "zoom start" baseline so scroll zoom continues to feel stable.
        zoomStart = {
          scale: computed.scale,
          tx: computed.tx,
          ty: computed.ty,
          scrollY: zoomStart ? zoomStart.scrollY : window.scrollY,
        };
      }
    },
    { passive: true }
  );
})();

/* ============================================
           PLACEHOLDER - OLD TV CODE REMOVED
           ============================================ */
// Old TV transition wrapper code removed - now using PC boot sequence above

/* ============================================
           SCENE 1: HERO - VAPORWAVE GRID TERRAIN
           ============================================ */
(function () {
  const container = document.getElementById("hero-canvas");
  const heroSection = document.getElementById("hero");
  const modelRevealEl = document.getElementById("hero-model-reveal");
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x1a0a2e, 0.015);

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    300
  );
  camera.position.set(0, 2, 7.5);
  camera.lookAt(0, 0.2, -18);
  camera.layers.set(0);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  container.appendChild(renderer.domElement);

  // Separate renderer/camera layers for masked content (hero model + pillars)
  const modelCamera = new THREE.PerspectiveCamera(
    camera.fov,
    1,
    camera.near,
    camera.far
  );
  modelCamera.position.copy(camera.position);
  modelCamera.quaternion.copy(camera.quaternion);
  modelCamera.layers.set(1);

  // Pillars get the same clip/scanline mask, but should NOT follow the hero model orbit.
  // Render them with a fixed camera into the same masked container.
  const pillarsCamera = new THREE.PerspectiveCamera(
    camera.fov,
    1,
    camera.near,
    camera.far
  );
  pillarsCamera.position.copy(camera.position);
  pillarsCamera.quaternion.copy(camera.quaternion);
  pillarsCamera.layers.set(2);

  const pillarsRenderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
  });
  pillarsRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  pillarsRenderer.outputEncoding = THREE.sRGBEncoding;

  const modelRenderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
  });
  modelRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  modelRenderer.outputEncoding = THREE.sRGBEncoding;
  if (modelRevealEl) {
    // Append pillars first so the hero model renders on top.
    modelRevealEl.appendChild(pillarsRenderer.domElement);
    modelRevealEl.appendChild(modelRenderer.domElement);
  }

  function resizeModelRenderer() {
    if (!modelRevealEl) return;
    const w = Math.max(1, modelRevealEl.clientWidth);
    const h = Math.max(1, modelRevealEl.clientHeight);
    modelCamera.aspect = w / h;
    modelCamera.updateProjectionMatrix();
    pillarsCamera.aspect = w / h;
    pillarsCamera.updateProjectionMatrix();
    modelRenderer.setSize(w, h);
    pillarsRenderer.setSize(w, h);
  }
  resizeModelRenderer();

  // Lights for the GLB model
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x140021, 0.8);
  hemiLight.position.set(0, 5, 0);
  hemiLight.layers.set(1);
  hemiLight.layers.enable(2);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
  dirLight.position.set(4, 6, 3);
  dirLight.layers.set(1);
  dirLight.layers.enable(2);
  scene.add(dirLight);

  // Marble pillars loaded from GLB (masked like hero model, but rendered with fixed camera)
  const pillarsRoot = new THREE.Group();
  pillarsRoot.layers.set(2);
  scene.add(pillarsRoot);

  const leftPillar = new THREE.Group();
  const rightPillar = new THREE.Group();
  leftPillar.layers.set(2);
  rightPillar.layers.set(2);
  pillarsRoot.add(leftPillar);
  pillarsRoot.add(rightPillar);

  // Lower them so they sit in the scene (closer to the wireframe plane at y=-5)
  const pillarsBaseY = -5.0;
  const pillarsZ = -12;
  const pillarsSideOffset = 6.2 * 3; // ~3x more off to the sides
  leftPillar.position.set(-pillarsSideOffset, pillarsBaseY, pillarsZ);
  rightPillar.position.set(pillarsSideOffset, pillarsBaseY, pillarsZ);

  // Mirror slight twist so they don't look perfectly identical
  leftPillar.rotation.y = 0.3;
  rightPillar.rotation.y = -0.25;

  // Add a little light so marble reads against the background
  const pillarGlowLeft = new THREE.PointLight(0xff71ce, 1.25, 26);
  pillarGlowLeft.position.set(-pillarsSideOffset + 1.5, 1.5, -8);
  pillarGlowLeft.layers.set(2);
  pillarsRoot.add(pillarGlowLeft);
  const pillarGlowRight = new THREE.PointLight(0x01cdfe, 1.25, 26);
  pillarGlowRight.position.set(pillarsSideOffset - 1.5, 1.5, -8);
  pillarGlowRight.layers.set(2);
  pillarsRoot.add(pillarGlowRight);

  (function loadMarblePillars() {
    if (!THREE.GLTFLoader) {
      console.warn(
        "GLTFLoader not found. Ensure the GLTFLoader script is loaded."
      );
      // Don't block the boot overlay if the loader script is missing.
      if (window.markModelLoaded) window.markModelLoaded("model1");
      return;
    }

    const loader = new THREE.GLTFLoader();
    loader.load(
      "source/marble_pillar.glb",
      (gltf) => {
        const pillarTemplate = gltf.scene;

        // Make sure textures look correct under sRGB output.
        pillarTemplate.traverse((obj) => {
          obj.layers.set(2);
          if (!obj.isMesh) return;
          obj.castShadow = false;
          obj.receiveShadow = false;
          if (obj.material && obj.material.map) {
            obj.material.map.encoding = THREE.sRGBEncoding;
          }
        });

        // Scale to a consistent visual height so it matches the scene.
        const targetHeight = 10.5;
        const yStretch = 1.5; // elongate vertically a bit
        const bbox = new THREE.Box3().setFromObject(pillarTemplate);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const currentHeight = Math.max(0.001, size.y);
        const s = targetHeight / currentHeight;

        const leftInstance = pillarTemplate.clone(true);
        const rightInstance = pillarTemplate.clone(true);

        leftInstance.scale.set(s, s * yStretch, s);
        rightInstance.scale.set(s, s * yStretch, s);

        // Keep bases on the same y
        const leftBox = new THREE.Box3().setFromObject(leftInstance);
        const rightBox = new THREE.Box3().setFromObject(rightInstance);
        const leftMin = leftBox.min.y;
        const rightMin = rightBox.min.y;
        leftInstance.position.y -= leftMin;
        rightInstance.position.y -= rightMin;

        leftPillar.add(leftInstance);
        rightPillar.add(rightInstance);

        // Mark pillar model as loaded
        if (window.markModelLoaded) {
          window.markModelLoaded("model1");
        }
      },
      undefined,
      (err) => {
        console.error("Failed to load marble pillar GLB:", err);
        // Mark as loaded even on error to prevent infinite loading
        if (window.markModelLoaded) {
          window.markModelLoaded("model1");
        }
      }
    );
  })();

  // Grid Terrain
  const tileDepth = 40;
  const tileWidth = 200;
  const segmentsW = 18;
  const segmentsD = 10;

  const geometry = new THREE.PlaneGeometry(
    tileWidth,
    tileDepth,
    segmentsW,
    segmentsD
  );
  const pos = geometry.attributes.position;

  // Use coefficient that ensures seamless tiling (2π/tileDepth for perfect periodicity)
  const yCoef = (3 * Math.PI) / tileDepth;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);

    let z = 0;
    z += Math.sin(x * 0.08) * 1.5;
    z += Math.cos(x * 0.2 + y * yCoef) * 2;

    const dist = Math.abs(x) / (tileWidth / 2);
    z += Math.pow(dist, 2.5) * 50;

    pos.setZ(i, z);
  }
  geometry.computeVertexNormals();

  // Gradient wireframe material
  const tiles = [];
  const tileMats = [];
  for (let i = 0; i < 4; i++) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xff71ce,
      wireframe: true,
      transparent: true,
      opacity: 0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, -5, -i * tileDepth);
    scene.add(mesh);
    tiles.push(mesh);
    tileMats.push(material);
  }

  // Load the hero GLB model.
  // Instead of offsetting the rotation axis (which can be fiddly depending on model origin/orientation),
  // we orbit the camera around the model based on scroll.
  const heroModelRoot = new THREE.Group();
  heroModelRoot.layers.set(1);
  heroModelRoot.visible = false;
  scene.add(heroModelRoot);
  let heroModel = null;
  const heroModelCenter = new THREE.Vector3();

  const heroOrbitCenter = new THREE.Vector3(0, -0.25, -2.5);
  let heroOrbitRadius = 7.8;
  let heroOrbitHeight = 1.9;
  let currentOrbitAngle = 0;

  (function loadHeroModel() {
    if (!THREE.GLTFLoader) {
      console.warn(
        "GLTFLoader not found. Ensure the GLTFLoader script is loaded."
      );
      // Don't block the boot overlay if the loader script is missing.
      if (window.markModelLoaded) window.markModelLoaded("model2");
      return;
    }

    const loader = new THREE.GLTFLoader();
    loader.load(
      "source/vaporwave.glb",
      (gltf) => {
        heroModel = gltf.scene;

        // Reasonable default transforms; adjust if your model is huge/tiny.
        heroModel.scale.setScalar(2.5);

        // Ensure materials look correct under sRGB output.
        heroModel.traverse((obj) => {
          if (!obj.isMesh) return;
          obj.castShadow = false;
          obj.receiveShadow = false;
          if (obj.material && obj.material.map) {
            obj.material.map.encoding = THREE.sRGBEncoding;
          }
          obj.layers.set(1);
        });

        // Center the pivot on the model (bounding box center), then move the rotation axis back ~100cm.
        new THREE.Box3().setFromObject(heroModel).getCenter(heroModelCenter);
        heroModel.position.sub(heroModelCenter);
        heroModelRoot.position.copy(heroOrbitCenter);
        heroModelRoot.add(heroModel);
        heroModelRoot.visible = true;

        // Reveal the model line-by-line (mask only covers the model canvas)
        // Wait for login screen fade-out to complete before starting
        if (modelRevealEl) {
          const loginScreen = document.getElementById("xp-login-screen");
          const startMaskReveal = () => {
            modelRevealEl.classList.add("is-revealing");

            const durationMs = 1200;
            const start = performance.now();
            const stepPx = 6; // controls "line-by-line" feel

            const tick = (now) => {
              const t = Math.max(0, Math.min(1, (now - start) / durationMs));
              const h = Math.max(1, modelRevealEl.clientHeight);
              const revealed = Math.floor((h * t) / stepPx) * stepPx;
              const topPx = Math.max(0, Math.round(h - revealed));
              modelRevealEl.style.clipPath = `inset(${topPx}px 0px 0px 0px)`;

              if (t < 1) {
                requestAnimationFrame(tick);
              } else {
                modelRevealEl.style.clipPath = "inset(0px 0px 0px 0px)";
                // fade scanlines out shortly after full reveal
                setTimeout(
                  () => modelRevealEl.classList.remove("is-revealing"),
                  350
                );
              }
            };
            requestAnimationFrame(tick);
          };

          // Check if login screen is already hidden or hiding
          if (
            !loginScreen ||
            loginScreen.classList.contains("xp-login--hiding")
          ) {
            // Wait for the CSS transition duration (420ms) + a small buffer
            setTimeout(startMaskReveal, 450);
          } else {
            // If login screen hasn't started hiding yet, wait for it
            const checkAndStart = setInterval(() => {
              if (
                !loginScreen ||
                loginScreen.classList.contains("xp-login--hiding")
              ) {
                clearInterval(checkAndStart);
                setTimeout(startMaskReveal, 450);
              }
            }, 50);
          }
        }

        // Mark hero model as loaded
        if (window.markModelLoaded) {
          window.markModelLoaded("model2");
        }
      },
      undefined,
      (err) => {
        console.error("Failed to load hero GLB:", err);
        // Mark as loaded even on error to prevent infinite loading
        if (window.markModelLoaded) {
          window.markModelLoaded("model2");
        }
      }
    );
  })();

  let time = 0;

  function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  function getPageScrollProgress() {
    const doc = document.documentElement;
    const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
    return clamp01(window.scrollY / maxScroll);
  }

  // Pause hero rendering when off-screen / tab hidden (performance)
  let heroRaf = 0;
  let heroIsRunning = false;
  let heroInView = true;

  function heroLoop() {
    if (!heroIsRunning) return;
    heroRaf = requestAnimationFrame(heroLoop);

    time += 0.01;

    // Orbit ONLY the model camera so the wireframe terrain stays stable.
    // (Main camera remains fixed, keeping the background orientation consistent.)
    if (heroModelRoot && heroModelRoot.visible) {
      const p = getPageScrollProgress();
      // 2 full orbits across the full page.
      const targetAngle = 3 * p * Math.PI * 4 + Math.PI / 2;
      currentOrbitAngle += (targetAngle - currentOrbitAngle) * 0.12;

      const x =
        heroOrbitCenter.x + Math.cos(currentOrbitAngle) * heroOrbitRadius;
      const z =
        heroOrbitCenter.z + Math.sin(currentOrbitAngle) * heroOrbitRadius;

      modelCamera.position.set(x, heroOrbitCenter.y + heroOrbitHeight, z);
      modelCamera.lookAt(
        heroOrbitCenter.x,
        heroOrbitCenter.y,
        heroOrbitCenter.z
      );

      // Subtle idle tilt on the model itself for depth.
      if (heroModel) heroModel.rotation.x = -0.05 + Math.sin(time * 0.3) * 0.02;
    }

    const speed = 0.12;
    tiles.forEach((tile) => {
      tile.position.z += speed;
      if (tile.position.z >= tileDepth) {
        tile.position.z -= tileDepth * 4;
      }
    });

    // Pillars: automatic spin + half-scroll parallax (semi-fixed feel)
    // Use hero section's top offset so effect is tied to the section while it's on screen.
    if (pillarsRoot && heroSection) {
      // Auto spin
      leftPillar.rotation.y += 0.007;
      rightPillar.rotation.y -= 0.008;

      const rectTopPx = heroSection.getBoundingClientRect().top;
      const depth = Math.max(0.1, Math.abs(camera.position.z - pillarsZ));
      const worldHeightAtDepth =
        2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
      const worldPerPx = worldHeightAtDepth / Math.max(1, window.innerHeight);

      // Compensate ~50% of scroll movement (correct direction)
      const parallaxY = rectTopPx * 0.5 * worldPerPx;
      pillarsRoot.position.y = parallaxY;
    }

    // Color cycling
    const hue = (Math.sin(time * 0.5) + 1) / 2;
    tileMats.forEach((mat, idx) => {
      mat.color.setHSL(hue * 0.1 + 0.85, 1, 0.6);

      // Distance-based fade: far tiles spawn fully transparent
      const z = tiles[idx].position.z;
      const farZ = -tileDepth * 3.0; // most distant tile start
      const nearZ = tileDepth * 0.35; // closer region becomes opaque
      const opacity = smoothstep(farZ, nearZ, z);
      mat.opacity = opacity;
    });

    renderer.render(scene, camera);
    // Render masked pillars with a fixed camera (so they don't orbit with the hero model)
    pillarsCamera.position.copy(camera.position);
    pillarsCamera.quaternion.copy(camera.quaternion);
    pillarsRenderer.render(scene, pillarsCamera);
    modelRenderer.render(scene, modelCamera);
  }

  function heroStart() {
    if (heroIsRunning) return;
    heroIsRunning = true;
    heroRaf = requestAnimationFrame(heroLoop);
  }

  function heroStop() {
    heroIsRunning = false;
    if (heroRaf) cancelAnimationFrame(heroRaf);
    heroRaf = 0;
  }

  function heroUpdateRunning() {
    const shouldRun = heroInView && !document.hidden;
    if (shouldRun) heroStart();
    else heroStop();
  }

  if (heroSection) {
    const heroObserver = new IntersectionObserver(
      (entries) => {
        heroInView = entries.some((e) => e.isIntersecting);
        heroUpdateRunning();
      },
      { threshold: 0.05 }
    );
    heroObserver.observe(heroSection);
  }
  document.addEventListener("visibilitychange", heroUpdateRunning);
  heroUpdateRunning();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

    modelCamera.fov = camera.fov;
    modelCamera.near = camera.near;
    modelCamera.far = camera.far;
    pillarsCamera.fov = camera.fov;
    pillarsCamera.near = camera.near;
    pillarsCamera.far = camera.far;
    resizeModelRenderer();
  });
})();

/* ============================================
           RETRO PAINT INTERFACE
           ============================================ */
(function () {
  const canvas = document.getElementById("paint-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const colorPalette = document.getElementById("color-palette");
  const stickersPanel = document.getElementById("stickers-panel");
  const stickersLayer = document.getElementById("stickers-layer");
  const generateArtBtn = document.getElementById("generate-art-btn");
  const paintMenubar = document.querySelector(".paint-menubar");
  const paintToolColors = document.getElementById("paint-tool-colors");
  const paintToolStickers = document.getElementById("paint-tool-stickers");

  function setStatus(text) {
    // Statusbar removed; keep a lightweight signal for debugging.
    // (No UI element to write to.)
    if (typeof text === "string" && text) console.debug("[Paint]", text);
  }

  function clearSelection(selector) {
    document.querySelectorAll(selector).forEach((el) => {
      el.classList.remove("selected");
    });
  }

  function setCursor(value) {
    if (canvas) canvas.style.cursor = value;
  }

  function setMenubarActive(tab) {
    if (!paintMenubar) return;
    paintMenubar
      .querySelectorAll("[data-paint-tab]")
      .forEach((el) =>
        el.classList.toggle("is-active", el.dataset.paintTab === tab)
      );
  }

  function showToolPanel(panel) {
    // panel: 'colors' | 'stickers' | 'background'
    if (paintToolColors) {
      paintToolColors.style.display = panel === "colors" ? "flex" : "none";
    }
    if (paintToolStickers) {
      paintToolStickers.style.display = panel === "stickers" ? "flex" : "none";
    }
    if (generateArtBtn) {
      generateArtBtn.style.display =
        panel === "background" ? "inline-flex" : "none";
    }
  }

  function enterColorsMode() {
    selectedSticker = null;
    clearSelection(".paint-sticker");
    setCursor("crosshair");
    showToolPanel("colors");
    setMenubarActive("colors");
    setStatus("色ツール Colors (BG)\u3000クリックで背景色を変更");
  }

  function enterStickersMode() {
    renderMode = "default";
    renderCanvas();
    showToolPanel("stickers");
    setMenubarActive("stickers");
    setCursor(selectedSticker ? "copy" : "crosshair");
    setStatus("ステッカー Stickers\u3000選んでクリックで配置");
  }

  function enterBackgroundMode() {
    selectedSticker = null;
    clearSelection(".paint-sticker");
    showToolPanel("background");
    setMenubarActive("background");
    setCursor("crosshair");
    setStatus("背景アート Background\u3000GENERATE ART で生成");
  }

  // Color palette - vaporwave + classic Paint colors
  const colors = [
    "#000000",
    "#808080",
    "#800000",
    "#808000",
    "#008000",
    "#008080",
    "#000080",
    "#800080",
    "#ffffff",
    "#c0c0c0",
    "#ff0000",
    "#ffff00",
    "#00ff00",
    "#00ffff",
    "#0000ff",
    "#ff00ff",
    "#ff71ce",
    "#01cdfe",
    "#b967ff",
    "#05ffa1",
    "#fffb96",
    "#1a0a2e",
    "#ff6b6b",
    "#4ecdc4",
    "#ffe66d",
    "#95e1d3",
    "#f38181",
    "#aa96da",
  ];

  // Stickers list - images from image_paint folder
  const stickers = [
    {
      src: "image_paint/pngtree-dolphin-on-transparent-background-png-image_14018423.png",
      name: "dolphin",
    },
    {
      src: "image_paint/pngtree-cute-cat-image-png-image_14938303.png",
      name: "cat",
    },
    {
      src: "image_paint/hd-windows-xp-logo-icon-sign-png-701751694713908n79xquyu8a.png",
      name: "windows",
    },
    {
      src: "image_paint/png-clipart-red-and-silver-crowbar-used-crowbar-tools-and-parts-crowbars-thumbnail.png",
      name: "crowbar",
    },
    {
      src: "image_paint/pngtree-water-bottle-to-drink-png-image_13038051.png",
      name: "bottle",
    },
    {
      src: "image_paint/png-clipart-hephaestus-bust-liebieghaus-athena-parthenos-zeus-greek-statue-stone-carving-aphrodite-thumbnail.png",
      name: "statue",
    },
    {
      src: "image_paint/png-clipart-wikipedia-logo-wordmark-wikimedia-foundation-bolder-globe-text.png",
      name: "wikipedia",
    },
    {
      src: "image_paint/png-clipart-anime-pixel-art-kawaii-anime-child-face.png",
      name: "anime",
    },
    {
      src: "image_paint/png-clipart-sunglasses-graphy-glasses-angle-text-thumbnail.png",
      name: "sunglasses",
    },
    {
      src: "image_paint/pngtree-cd-png-element-png-image_2344136.jpg",
      name: "cd",
    },
  ];

  let currentBgColor = "#ff71ce"; // Pink vaporwave default (so turquoise text is visible)
  let selectedSticker = null;
  let renderMode = "default";

  const PAINT_CANVAS_CSS_W = 248;
  const PAINT_CANVAS_CSS_H = 100;
  const STICKER_SIZE_PX = 24;
  const STICKER_HALF_PX = STICKER_SIZE_PX / 2;

  // Setup canvas size
  function resizeCanvas() {
    const container = canvas.parentElement;
    if (!container) return;

    // Fixed Paint canvas size (requested): 248x100 CSS pixels.
    const cssW = PAINT_CANVAS_CSS_W;
    const cssH = PAINT_CANVAS_CSS_H;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    renderCanvas();
  }

  function renderCanvas() {
    if (renderMode === "art") {
      renderProceduralArt();
      return;
    }
    renderDefaultCanvas();
  }

  // Draw canvas with background and default text
  function renderDefaultCanvas() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    // Background
    ctx.fillStyle = currentBgColor;
    ctx.fillRect(0, 0, w, h);

    // Default Japanese text - Macintosh Plus Floral Shoppe
    // Text color: turquoise (#01cdfe) on dark backgrounds, dark on light backgrounds
    const textColor = isLightColor(currentBgColor) ? "#1a0a2e" : "#01cdfe";
    ctx.fillStyle = textColor;
    const rootFontPx =
      parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const fontPx = rootFontPx * 0.4;
    ctx.font = `bold ${fontPx}px "Noto Sans JP", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Add text shadow for better readability
    ctx.shadowColor = isLightColor(currentBgColor)
      ? "rgba(255,255,255,0.5)"
      : "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 1;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    // マッキントッシュ・プラス = Macintosh Plus
    // フローラルの専門店 = Floral Shoppe
    ctx.fillText("マッキントッシュ・プラス", w / 2, h / 2 - fontPx * 0.75);
    ctx.fillText("フローラルの専門店", w / 2, h / 2 + fontPx * 0.85);

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
  }

  function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0;
    let g = 0;
    let b = 0;

    if (h >= 0 && h < 60) {
      r = c;
      g = x;
    } else if (h >= 60 && h < 120) {
      r = x;
      g = c;
    } else if (h >= 120 && h < 180) {
      g = c;
      b = x;
    } else if (h >= 180 && h < 240) {
      g = x;
      b = c;
    } else if (h >= 240 && h < 300) {
      r = x;
      b = c;
    } else {
      r = c;
      b = x;
    }

    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255),
    ];
  }

  function renderProceduralArt() {
    // Use backing-store size for pixel art generation.
    const w = canvas.width;
    const h = canvas.height;
    const img = ctx.createImageData(w, h);
    const data = img.data;
    const seed = Math.random() * 1000;
    const freqA = 0.012 + Math.random() * 0.01;
    const freqB = 0.016 + Math.random() * 0.012;
    const freqC = 0.02 + Math.random() * 0.015;

    for (let y = 0; y < h; y++) {
      const ny = y / h - 0.5;
      for (let x = 0; x < w; x++) {
        const nx = x / w - 0.5;
        const wave =
          Math.sin((x + seed) * freqA) +
          Math.cos((y - seed) * freqB) +
          Math.sin((x + y) * freqC + seed * 0.02);
        const swirl = Math.sin(6 * Math.hypot(nx, ny) + seed * 0.01);
        const mix = (wave + swirl) * 0.5;
        const hue = (mix * 140 + x * 0.15 + y * 0.12 + seed) % 360;
        const sat = 0.75;
        const light = 0.5 + 0.15 * Math.sin(mix * 3);
        const [r, g, b] = hslToRgb(hue, sat, light);
        const idx = (y * w + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(img, 0, 0);
  }

  // Check if color is light (used by the default canvas render)
  function isLightColor(color) {
    const hex = color.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128;
  }

  // Create color palette
  colors.forEach((color, index) => {
    const colorDiv = document.createElement("div");
    colorDiv.className = "paint-color";
    colorDiv.style.backgroundColor = color;
    if (color === currentBgColor) colorDiv.classList.add("selected");

    colorDiv.addEventListener("click", () => {
      // Remove selected from all
      clearSelection(".paint-color");
      colorDiv.classList.add("selected");
      currentBgColor = color;

      // Switching background color is a "colors" action.
      selectedSticker = null;
      clearSelection(".paint-sticker");

      // Redraw canvas with new background and text
      renderMode = "default";
      renderCanvas();
      setStatus("背景色変更 Background changed");
    });

    colorPalette.appendChild(colorDiv);
  });

  // Create stickers panel
  stickers.forEach((sticker) => {
    const stickerDiv = document.createElement("div");
    stickerDiv.className = "paint-sticker";

    const img = document.createElement("img");
    img.src = sticker.src;
    img.alt = sticker.name;
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "contain";
    stickerDiv.appendChild(img);

    stickerDiv.addEventListener("click", () => {
      clearSelection(".paint-sticker");
      stickerDiv.classList.add("selected");
      selectedSticker = sticker;
      setStatus("クリックして配置 Click to place: " + sticker.name);
      setCursor("copy");
    });

    stickersPanel.appendChild(stickerDiv);
  });

  if (generateArtBtn) {
    generateArtBtn.addEventListener("click", () => {
      renderMode = "art";
      renderCanvas();
      setStatus("アート生成完了 Art generated!");
      setCursor("crosshair");
    });
  }

  // Menubar interactions: use existing XP-ish menu labels as tool switches.
  if (paintMenubar) {
    paintMenubar.addEventListener("click", (e) => {
      const item = e.target.closest("[data-paint-tab]");
      if (!item) return;

      const tab = item.dataset.paintTab;
      switch (tab) {
        case "colors":
          enterColorsMode();
          break;
        case "stickers":
          enterStickersMode();
          break;
        case "background":
          enterBackgroundMode();
          break;
        case "file":
          setMenubarActive("file");
          setStatus("File: セーブ機能はまだありません (demo)");
          break;
        case "edit":
          setMenubarActive("edit");
          setStatus("Edit: Ctrl+Z は未実装 (demo)");
          break;
        case "help":
          setMenubarActive("help");
          setStatus("Help: Colors / Image / View をクリック");
          break;
        default:
          break;
      }
    });
  }

  // Place sticker on canvas click
  let dragSticker = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  function getCanvasLocalXY(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function startStickerDrag(stickerEl, e) {
    dragSticker = stickerEl;
    dragSticker.classList.add("dragging");
    dragSticker.setPointerCapture?.(e.pointerId);

    const local = getCanvasLocalXY(e.clientX, e.clientY);
    dragOffsetX = local.x - (parseFloat(dragSticker.style.left) || 0);
    dragOffsetY = local.y - (parseFloat(dragSticker.style.top) || 0);
    e.stopPropagation();
  }

  function stopStickerDrag() {
    if (!dragSticker) return;
    dragSticker.classList.remove("dragging");
    dragSticker = null;
  }

  // Single document-level drag handlers (avoid adding listeners per sticker)
  document.addEventListener("pointermove", (e) => {
    if (!dragSticker) return;
    const local = getCanvasLocalXY(e.clientX, e.clientY);
    dragSticker.style.left = local.x - dragOffsetX + "px";
    dragSticker.style.top = local.y - dragOffsetY + "px";
  });

  document.addEventListener("pointerup", stopStickerDrag);
  document.addEventListener("pointercancel", stopStickerDrag);

  canvas.addEventListener("click", (e) => {
    if (!selectedSticker) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const stickerEl = document.createElement("div");
    stickerEl.className = "canvas-sticker";

    const img = document.createElement("img");
    img.src = selectedSticker.src;
    img.alt = selectedSticker.name;
    img.style.width = STICKER_SIZE_PX + "px";
    img.style.height = STICKER_SIZE_PX + "px";
    img.style.objectFit = "contain";
    img.draggable = false;
    stickerEl.appendChild(img);

    stickerEl.style.left = x + "px";
    stickerEl.style.top = y + "px";
    stickerEl.dataset.src = selectedSticker.src;

    // Make sticker draggable
    stickerEl.addEventListener("pointerdown", (ev) =>
      startStickerDrag(stickerEl, ev)
    );

    // Double click to remove
    stickerEl.addEventListener("dblclick", () => {
      stickerEl.remove();
      setStatus("ステッカー削除 Sticker removed");
    });

    stickersLayer.appendChild(stickerEl);
    setStatus("ステッカー配置完了 Sticker placed!");
  });

  // Initialize
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // Also re-measure whenever the canvas container changes size (open/close, layout shifts, etc.)
  const containerEl = canvas.parentElement;
  if (containerEl && "ResizeObserver" in window) {
    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(containerEl);
  }

  // Default tool state
  enterColorsMode();

  // Make stickers layer match canvas position
  stickersLayer.style.position = "absolute";
  stickersLayer.style.inset = "4px";
  stickersLayer.style.pointerEvents = "none";

  // ============================================
  // CASSETTE GENERATOR - INDUSTRIAL MACHINE
  // ============================================
  const generateBtn = document.getElementById("generate-cassette-btn");
  const cassetteGenCanvas = document.getElementById("cassette-gen-canvas");
  const paintCanvasContainer = document.querySelector(
    ".paint-canvas-container"
  );
  const paintWindow = document.querySelector(".paint-window");
  const paintStage = document.querySelector(".paint-stage");

  const VEKTROID = (window.VEKTROID = window.VEKTROID || {});
  VEKTROID.generatedCassette = VEKTROID.generatedCassette || {
    ready: false,
    labelCanvas: null,
  };

  let smokeInterval = null;
  let isGenerating = false;

  // Create pixel smoke effect
  function createSmoke(container) {
    const smokeContainer = document.createElement("div");
    smokeContainer.className = "smoke-container";
    container.appendChild(smokeContainer);

    smokeInterval = setInterval(() => {
      for (let i = 0; i < 3; i++) {
        const smoke = document.createElement("div");
        smoke.className = "smoke-pixel";
        smoke.style.left = Math.random() * 100 + "%";
        smoke.style.bottom = "0";
        smoke.style.setProperty("--drift", Math.random() * 40 - 20 + "px");
        smoke.style.background = ["#666", "#888", "#aaa", "#555"][
          Math.floor(Math.random() * 4)
        ];
        smoke.style.width = 6 + Math.random() * 6 + "px";
        smoke.style.height = smoke.style.width;
        smokeContainer.appendChild(smoke);
        setTimeout(() => smoke.remove(), 2000);
      }
    }, 150);

    return smokeContainer;
  }

  // Create machine screen overlay
  function showMachineScreen() {
    const machineScreen = document.createElement("div");
    machineScreen.className = "machine-screen shake";
    machineScreen.innerHTML = `
                    <div class="machine-title">⚙️ CASSETTE FACTORY カセット工場 ⚙️</div>
                    <div class="machine-progress">
                        <div class="machine-progress-bar" id="machine-progress-bar"></div>
                        <div class="machine-progress-text" id="machine-progress-text">INITIALIZING... 初期化中</div>
                    </div>
                    <div class="machine-gears">
                        <div class="machine-gear"></div>
                        <div class="machine-gear"></div>
                        <div class="machine-gear"></div>
                    </div>
                `;
    paintCanvasContainer.appendChild(machineScreen);
    return machineScreen;
  }

  // Animate progress bar with messages
  function animateProgress(progressBar, progressText, callback) {
    const messages = [
      { pct: 0, text: "LOADING DESIGN... デザイン読込中" },
      { pct: 20, text: "MIXING COLORS... 色を混合中" },
      { pct: 40, text: "HEATING PLASTIC... プラスチック加熱" },
      { pct: 60, text: "MOLDING CASSETTE... カセット成形" },
      { pct: 80, text: "APPLYING LABEL... ラベル貼付" },
      { pct: 95, text: "FINISHING... 仕上げ中" },
      { pct: 100, text: "COMPLETE! 完成!" },
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep >= messages.length) {
        clearInterval(interval);
        callback();
        return;
      }
      const msg = messages[currentStep];
      progressBar.style.width = msg.pct + "%";
      progressText.textContent = msg.text;
      currentStep++;
    }, 400);
  }

  // Capture Paint canvas with stickers
  function capturePaintDesign() {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(canvas, 0, 0);

    const dpr = canvas.clientWidth ? canvas.width / canvas.clientWidth : 1;

    const stickerElements = stickersLayer.querySelectorAll(".canvas-sticker");
    stickerElements.forEach((stickerEl) => {
      const x = parseInt(stickerEl.style.left) || 0;
      const y = parseInt(stickerEl.style.top) || 0;
      const img = stickerEl.querySelector("img");
      if (img && img.complete) {
        tempCtx.drawImage(
          img,
          (x - STICKER_HALF_PX) * dpr,
          (y - STICKER_HALF_PX) * dpr,
          STICKER_SIZE_PX * dpr,
          STICKER_SIZE_PX * dpr
        );
      }
    });

    return tempCanvas;
  }

  // ===============================
  // 3D CASSETTE (Three.js) OUTPUT
  // ===============================
  let genRenderer = null;
  let genScene = null;
  let genCamera = null;
  let cassetteGroup = null;
  let cassetteLabelMat = null;
  let labelCanvas = null;
  let labelTexture = null;
  let genRaf = 0;
  let genIsRunning = false;
  let slideAnim = null;
  let resizeObserver = null;

  function worldPointFromCanvasPx(px, py, targetZ) {
    if (!genCamera || !cassetteGenCanvas) return null;

    const rect = cassetteGenCanvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);

    const ndc = new THREE.Vector2((px / w) * 2 - 1, -(py / h) * 2 + 1);
    const from = genCamera.position.clone();
    const to = new THREE.Vector3(ndc.x, ndc.y, 0.5).unproject(genCamera);
    const dir = to.sub(from).normalize();

    const dz = dir.z;
    if (Math.abs(dz) < 1e-5) return null;
    const t = (targetZ - from.z) / dz;
    return from.add(dir.multiplyScalar(t));
  }

  function getOutputSlotWorldCenter() {
    if (!cassetteGenCanvas) return null;
    const slotEl = paintWindow?.querySelector(".cassette-output-slot");
    if (!slotEl) return null;

    const slotRect = slotEl.getBoundingClientRect();
    const canvasRect = cassetteGenCanvas.getBoundingClientRect();
    const px = slotRect.left + slotRect.width / 2 - canvasRect.left;
    const py = slotRect.top + slotRect.height / 2 - canvasRect.top + 80;

    // Cassette sits near z~0 in this generator scene.
    return worldPointFromCanvasPx(px, py, 0);
  }

  function ensureCassette3D() {
    if (!cassetteGenCanvas || genRenderer) return;

    genRenderer = new THREE.WebGLRenderer({
      canvas: cassetteGenCanvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    genRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    genRenderer.outputEncoding = THREE.sRGBEncoding;
    genRenderer.setClearColor(0x000000, 0);

    genScene = new THREE.Scene();
    genScene.background = null;

    genCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 50);
    genCamera.position.set(0, 0.75, 6.2);
    genCamera.lookAt(0, 0.1, 0);

    const amb = new THREE.AmbientLight(0xffffff, 0.75);
    genScene.add(amb);

    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(3, 4, 5);
    genScene.add(key);

    const rim = new THREE.PointLight(0x01cdfe, 1.3, 20);
    rim.position.set(-4, 1.5, 2);
    genScene.add(rim);

    const fill = new THREE.PointLight(0xff71ce, 1.1, 20);
    fill.position.set(4, 1.2, 2);
    genScene.add(fill);

    cassetteGroup = buildCassetteGroup();
    cassetteGroup.visible = false;
    genScene.add(cassetteGroup);

    resizeCassette3D();
    window.addEventListener("resize", resizeCassette3D);

    if (typeof ResizeObserver !== "undefined" && paintStage) {
      resizeObserver = new ResizeObserver(() => resizeCassette3D());
      resizeObserver.observe(paintStage);
    }
  }

  function resizeCassette3D() {
    if (!genRenderer || !genCamera || !cassetteGenCanvas) return;
    const rect = cassetteGenCanvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    genRenderer.setSize(w, h, false);
    genCamera.aspect = w / h;
    genCamera.updateProjectionMatrix();
  }

  function buildCassetteGroup() {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x171717,
      roughness: 0.45,
      metalness: 0.25,
      clearcoat: 0.55,
      clearcoatRoughness: 0.18,
    });
    const faceMat = new THREE.MeshPhysicalMaterial({
      color: 0x0d0d0d,
      roughness: 0.25,
      metalness: 0.15,
      clearcoat: 0.35,
      clearcoatRoughness: 0.12,
    });
    const windowMat = new THREE.MeshPhysicalMaterial({
      color: 0x0b0b0b,
      transmission: 0.85,
      thickness: 0.6,
      roughness: 0.05,
    });

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 1.95, 0.34),
      bodyMat
    );
    body.position.set(0, 0.02, 0);
    group.add(body);

    // Thin edge plate for a slightly more "bevelled" read
    const edgePlate = new THREE.Mesh(
      new THREE.BoxGeometry(3.04, 1.99, 0.08),
      new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.35,
        metalness: 0.55,
        emissive: 0x000000,
      })
    );
    edgePlate.position.set(0, 0.02, 0.13);
    group.add(edgePlate);

    const front = new THREE.Mesh(
      new THREE.BoxGeometry(2.92, 1.87, 0.02),
      faceMat
    );
    front.position.set(0, 0.02, 0.18);
    group.add(front);

    // Label material (updated on generation)
    cassetteLabelMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(2.55, 0.78),
      cassetteLabelMat
    );
    label.position.set(0, 0.56, 0.191);
    group.add(label);

    // Window cutout
    const windowPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(2.0, 0.62),
      windowMat
    );
    windowPanel.position.set(0, -0.35, 0.191);
    group.add(windowPanel);

    // Reels
    const reelMat = new THREE.MeshStandardMaterial({
      color: 0x2b2b2b,
      roughness: 0.35,
      metalness: 0.65,
    });
    const reelGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.12, 20);
    const leftReel = new THREE.Mesh(reelGeo, reelMat);
    const rightReel = new THREE.Mesh(reelGeo, reelMat);
    leftReel.rotation.x = Math.PI / 2;
    rightReel.rotation.x = Math.PI / 2;
    leftReel.position.set(-0.62, -0.35, 0.12);
    rightReel.position.set(0.62, -0.35, 0.12);
    group.add(leftReel);
    group.add(rightReel);

    // Tape strip
    const tape = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.04, 0.01),
      new THREE.MeshStandardMaterial({
        color: 0x6b3d1a,
        roughness: 0.6,
        metalness: 0.0,
      })
    );
    tape.position.set(0, -0.35, 0.17);
    group.add(tape);

    group.userData.leftReel = leftReel;
    group.userData.rightReel = rightReel;

    // Base pose (actual slide positioning is computed from the output slot)
    group.position.set(0, 0, 0);
    group.rotation.set(0.1, 0.62, 0.0);
    group.scale.set(1.12, 1.12, 1.12);

    return group;
  }

  function applyLabelFromDesign(designCanvas) {
    // Make sure the 3D cassette exists before we try to assign its material.
    ensureCassette3D();

    labelCanvas = document.createElement("canvas");
    labelCanvas.width = 512;
    labelCanvas.height = 160;
    const ctx = labelCanvas.getContext("2d");

    // White paper base
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, labelCanvas.width, labelCanvas.height);

    // Draw the Paint design cropped to a wide strip
    ctx.drawImage(designCanvas, 0, 0, labelCanvas.width, labelCanvas.height);

    // Small border
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, labelCanvas.width - 6, labelCanvas.height - 6);

    if (!labelTexture) {
      labelTexture = new THREE.CanvasTexture(labelCanvas);
      labelTexture.encoding = THREE.sRGBEncoding;
      labelTexture.minFilter = THREE.LinearFilter;
      labelTexture.magFilter = THREE.LinearFilter;
    } else {
      labelTexture.image = labelCanvas;
    }
    labelTexture.needsUpdate = true;

    // If WebGL isn't available, still expose the label for the player.
    if (cassetteLabelMat) {
      cassetteLabelMat.map = labelTexture;
      cassetteLabelMat.needsUpdate = true;
    }

    // Expose for the player scene
    VEKTROID.generatedCassette.ready = true;
    VEKTROID.generatedCassette.labelCanvas = labelCanvas;
    window.dispatchEvent(new CustomEvent("vektroid:cassette-generated"));
  }

  function getCassetteState() {
    VEKTROID.cassetteState = VEKTROID.cassetteState || {
      created: false,
      inserted: false,
      inFlight: false,
      x: 0,
      y: 0,
      dragging: false,
      handlersReady: false,
    };
    return VEKTROID.cassetteState;
  }

  function isPcSectionOnScreen() {
    const pc = document.getElementById("pc-section");
    if (!pc) return false;
    const r = pc.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  }

  function positionFloatingCassette() {
    const state = getCassetteState();
    if (!state.created || state.inserted || state.dragging) return;

    const cassetteEl = document.getElementById("floating-cassette-3d");
    if (!cassetteEl || cassetteEl.hidden) return;

    // Default position - sticky on screen
    if (!state.x && !state.y) {
      state.x = Math.round(window.innerWidth * 0.75);
      state.y = Math.round(window.innerHeight * 0.5);
    }

    cassetteEl.style.left = state.x + "px";
    cassetteEl.style.top = state.y + "px";
    resizeFloatingCassette3D();
  }

  function ensureCassetteFollowHandlers() {
    const state = getCassetteState();
    if (state.handlersReady) return;
    state.handlersReady = true;

    const cassetteEl = document.getElementById("floating-cassette-3d");
    if (!cassetteEl) return;

    let dragOffsetX = 0;
    let dragOffsetY = 0;

    // Dragging functionality
    cassetteEl.addEventListener("pointerdown", (e) => {
      if (state.inserted) return;
      state.dragging = true;
      cassetteEl.classList.add("is-dragging");
      cassetteEl.setPointerCapture(e.pointerId);

      const rect = cassetteEl.getBoundingClientRect();
      dragOffsetX = e.clientX - (rect.left + rect.width / 2);
      dragOffsetY = e.clientY - (rect.top + rect.height / 2);
      e.preventDefault();
    });

    cassetteEl.addEventListener("pointermove", (e) => {
      if (!state.dragging || state.inserted) return;

      state.x = e.clientX - dragOffsetX;
      state.y = e.clientY - dragOffsetY;

      cassetteEl.style.left = state.x + "px";
      cassetteEl.style.top = state.y + "px";

      // Check if over player section
      checkPlayerDropZone(state.x, state.y);
    });

    cassetteEl.addEventListener("pointerup", (e) => {
      if (!state.dragging) return;
      state.dragging = false;
      cassetteEl.classList.remove("is-dragging");
      cassetteEl.releasePointerCapture(e.pointerId);

      // Check if dropped on player
      tryInsertCassette(state.x, state.y);
    });

    cassetteEl.addEventListener("pointercancel", () => {
      state.dragging = false;
      cassetteEl.classList.remove("is-dragging");
    });

    window.addEventListener("resize", positionFloatingCassette);
  }

  function checkPlayerDropZone(x, y) {
    const playerSection = document.getElementById("player-section");
    if (!playerSection) return false;

    const rect = playerSection.getBoundingClientRect();
    const inZone =
      y > rect.top && y < rect.bottom && x > rect.left && x < rect.right;

    // Visual feedback - highlight drop zone
    playerSection.classList.toggle("drop-active", inZone);
    return inZone;
  }

  function tryInsertCassette(x, y) {
    const playerSection = document.getElementById("player-section");
    if (!playerSection) return;

    playerSection.classList.remove("drop-active");

    const rect = playerSection.getBoundingClientRect();
    const inZone =
      y > rect.top && y < rect.bottom && x > rect.left && x < rect.right;

    if (inZone) {
      insertCassetteIntoPlayer();
    }
  }

  function insertCassetteIntoPlayer() {
    const state = getCassetteState();
    const cassetteEl = document.getElementById("floating-cassette-3d");

    if (!cassetteEl || state.inserted) return;

    state.inserted = true;
    cassetteEl.classList.add("is-inserting");

    // Animate to player center
    const playerSection = document.getElementById("player-section");
    if (playerSection) {
      const rect = playerSection.getBoundingClientRect();
      cassetteEl.style.left = rect.left + rect.width / 2 + "px";
      cassetteEl.style.top = rect.top + rect.height / 2 + "px";
      cassetteEl.style.transform = "translate(-50%, -50%) scale(0.3)";
    }

    // Hide after animation and trigger player insertion
    setTimeout(() => {
      cassetteEl.classList.remove("is-visible", "is-inserting");
      cassetteEl.hidden = true;
      floatStop();

      // Trigger the player to insert the tape
      if (window.VEKTROID && window.VEKTROID.insertGeneratedTape) {
        window.VEKTROID.insertGeneratedTape();
      }
    }, 600);
  }

  function forcePcZoomOut() {
    // Use the new zoomOutPC function
    if (window.zoomOutPC) {
      window.zoomOutPC();
    }
  }

  // ===============================
  // FLOATING 3D CASSETTE (overlay)
  // ===============================
  let floatRenderer = null;
  let floatScene = null;
  let floatCamera = null;
  let floatCassette = null;
  let floatRaf = 0;
  let floatIsRunning = false;
  let floatSpawn = null;
  let floatRotVel = { x: 0, y: 0 };

  function getFloatingCassetteCanvas() {
    return document.getElementById("floating-cassette-3d");
  }

  function resizeFloatingCassette3D() {
    const canvas = getFloatingCassetteCanvas();
    if (!canvas || !floatRenderer || !floatCamera) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    floatRenderer.setSize(w, h, false);
    floatCamera.aspect = w / h;
    floatCamera.updateProjectionMatrix();
  }

  function ensureFloatingCassette3D() {
    const canvas = getFloatingCassetteCanvas();
    if (!canvas || floatRenderer) return;

    floatRenderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    floatRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    floatRenderer.outputEncoding = THREE.sRGBEncoding;
    floatRenderer.setClearColor(0x000000, 0);

    floatScene = new THREE.Scene();
    floatScene.background = null;

    floatCamera = new THREE.PerspectiveCamera(48, 1, 0.1, 50);
    floatCamera.position.set(0, 0.65, 6.2);
    floatCamera.lookAt(0, 0.1, 0);

    const amb = new THREE.AmbientLight(0xffffff, 0.85);
    floatScene.add(amb);
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(3, 4, 5);
    floatScene.add(key);
    const rim = new THREE.PointLight(0x01cdfe, 1.35, 20);
    rim.position.set(-4, 1.6, 2);
    floatScene.add(rim);
    const fill = new THREE.PointLight(0xff71ce, 1.05, 20);
    fill.position.set(4, 1.2, 2);
    floatScene.add(fill);

    // Reuse the cassette geometry builder (ensures label material is the same).
    floatCassette = buildCassetteGroup();
    // Facing direction: tweak these to match the exact "coming out" orientation.
    floatCassette.rotation.set(Math.PI / 2, Math.PI, Math.PI / 2);
    floatCassette.position.set(0, 0, 0);
    floatScene.add(floatCassette);

    resizeFloatingCassette3D();
    window.addEventListener("resize", resizeFloatingCassette3D);

    // Note: Drag-to-move is handled by ensureCassetteFollowHandlers
    // The canvas just renders - dragging moves the entire canvas element
  }

  function floatStart() {
    if (floatIsRunning) return;
    floatIsRunning = true;
    floatRaf = requestAnimationFrame(floatLoop);
  }

  function floatStop() {
    floatIsRunning = false;
    if (floatRaf) cancelAnimationFrame(floatRaf);
    floatRaf = 0;
  }

  // Allow other sections (player) to stop the floating cassette renderer.
  VEKTROID.stopFloatingCassette3D = floatStop;

  function floatLoop(now) {
    if (!floatIsRunning || !floatRenderer || !floatScene || !floatCamera)
      return;
    floatRaf = requestAnimationFrame(floatLoop);

    const t = now * 0.001;

    if (floatSpawn && floatCassette) {
      const p = Math.min(1, Math.max(0, (now - floatSpawn.t0) / floatSpawn.d));
      const e = 1 - Math.pow(1 - p, 3);
      floatCassette.position.x =
        floatSpawn.x0 + (floatSpawn.x1 - floatSpawn.x0) * e;
      if (p >= 1) floatSpawn = null;
    }

    if (floatCassette?.userData?.leftReel) {
      floatCassette.userData.leftReel.rotation.y -= 0.06;
      floatCassette.userData.rightReel.rotation.y += 0.06;
    }

    if (floatCassette) {
      // Gentle idle floating animation
      floatCassette.position.y = Math.sin(t * 1.1) * 0.02;
      // Slow auto-rotation for visual appeal
      floatCassette.rotation.y += 0.003;
    }

    floatRenderer.render(floatScene, floatCamera);
  }

  function showFloatingCassetteFromReader() {
    const state = getCassetteState();
    const canvas = getFloatingCassetteCanvas();
    if (!canvas) return;

    ensureFloatingCassette3D();
    ensureCassetteFollowHandlers();
    floatStart();

    if (floatCassette) {
      // Start tucked in, then slide out in 3D space.
      floatCassette.position.x = -0.8;
      floatSpawn = { t0: performance.now(), d: 900, x0: -0.8, x1: 0.3 };
    }

    // Position the cassette initially near the PC
    const pcSection = document.getElementById("pc-section");
    if (pcSection) {
      const rect = pcSection.getBoundingClientRect();
      state.x = rect.left + rect.width * 0.7;
      state.y = rect.top + rect.height * 0.5;
    } else {
      state.x = window.innerWidth * 0.75;
      state.y = window.innerHeight * 0.5;
    }

    canvas.hidden = false;
    canvas.style.left = state.x + "px";
    canvas.style.top = state.y + "px";
    canvas.style.transform = "translate(-50%, -50%)";

    // Show with animation
    requestAnimationFrame(() => {
      canvas.classList.add("is-visible");
      resizeFloatingCassette3D();
    });
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function startCassetteSlideOut() {
    ensureCassette3D();
    if (!cassetteGroup) {
      paintWindow?.classList.remove("printing");
      setStatus("WEBGL ERROR (cassette preview unavailable)");
      generateBtn.disabled = false;
      generateBtn.style.opacity = "1";
      isGenerating = false;
      return;
    }

    cassetteGroup.visible = true;
    resizeCassette3D();

    // Try to align the cassette to the Paint output slot (centered).
    const slotWorld = getOutputSlotWorldCenter();
    const baseY = slotWorld ? slotWorld.y : 0;
    const baseX = slotWorld ? slotWorld.x : 0;

    // Start slightly inside the slot, then slide out until fully visible.
    // (Tune these offsets if you change camera/cassette scale.)
    const x0 = baseX - 0.55;
    const x1 = baseX + 1.85;
    cassetteGroup.userData.baseY = baseY;

    slideAnim = {
      t0: performance.now(),
      durationMs: 1200,
      x0,
      x1,
    };

    // Light up the output slot LED during printing
    paintWindow?.classList.add("printing");

    genStart();
  }

  function genStart() {
    if (genIsRunning) return;
    genIsRunning = true;
    genRaf = requestAnimationFrame(genLoop);
  }

  function genLoop(now) {
    if (
      !genIsRunning ||
      !genRenderer ||
      !genScene ||
      !genCamera ||
      !cassetteGroup
    )
      return;
    genRaf = requestAnimationFrame(genLoop);

    const t = now * 0.001;

    // Reels spin subtly when visible
    if (cassetteGroup.visible) {
      cassetteGroup.userData.leftReel.rotation.y -= 0.08;
      cassetteGroup.userData.rightReel.rotation.y += 0.08;
    }

    if (slideAnim) {
      const p = Math.min(
        1,
        Math.max(0, (now - slideAnim.t0) / slideAnim.durationMs)
      );
      const e = easeOutCubic(p);

      // Smooth slide out to the right (minimal shake)
      const baseX = slideAnim.x0 + (slideAnim.x1 - slideAnim.x0) * e;
      const microShake = (1 - e) * 0.02 * Math.sin(t * 55);
      cassetteGroup.position.x = baseX;
      cassetteGroup.position.y =
        (cassetteGroup.userData.baseY || 0) + microShake;
      cassetteGroup.rotation.z = microShake * 0.6;

      if (p >= 1) {
        slideAnim = null;
        paintWindow?.classList.remove("printing");
        setStatus("カセット完成! Cassette created!");
        generateBtn.disabled = false;
        generateBtn.style.opacity = "1";
        isGenerating = false;
      }
    } else if (cassetteGroup.visible) {
      // Idle float (very subtle)
      cassetteGroup.position.y =
        (cassetteGroup.userData.baseY || 0) + Math.sin(t * 1.2) * 0.01;
      cassetteGroup.rotation.z = Math.sin(t * 1.1) * 0.01;
    }

    genRenderer.render(genScene, genCamera);
  }

  generateBtn.addEventListener("click", () => {
    if (isGenerating) return;
    isGenerating = true;

    // Update status
    setStatus("カセット生成中... Generating cassette...");

    // Disable button
    generateBtn.disabled = true;
    generateBtn.style.opacity = "0.6";

    // Zoom the PC back out while the cassette is generating.
    forcePcZoomOut();

    // Capture design BEFORE showing machine screen
    const designCanvas = capturePaintDesign();

    // Show machine screen
    const machineScreen = showMachineScreen();

    // Add smoke effect
    const smokeContainer = createSmoke(paintWindow);

    // Get progress elements
    const progressBar = document.getElementById("machine-progress-bar");
    const progressText = document.getElementById("machine-progress-text");

    // Animate progress
    setTimeout(() => {
      animateProgress(progressBar, progressText, () => {
        // Stop smoke
        if (smokeInterval) {
          clearInterval(smokeInterval);
          smokeInterval = null;
        }

        // Remove machine screen
        setTimeout(() => {
          machineScreen.classList.remove("shake");
          setTimeout(() => {
            machineScreen.remove();
            smokeContainer.remove();

            // Apply label + spawn a single cassette from the PC reader.
            applyLabelFromDesign(designCanvas);
            const state = getCassetteState();
            state.created = true;
            state.inserted = false;
            state.inFlight = false;
            ensureCassetteFollowHandlers();
            showFloatingCassetteFromReader();

            setStatus("カセット完成! Scroll to the player and insert.");
            generateBtn.disabled = false;
            generateBtn.style.opacity = "1";
            isGenerating = false;
          }, 300);
        }, 500);
      });
    }, 300);
  });
})();

/* ============================================
           SCENE 3: VAPORWAVE CASSETTE PLAYER
           ============================================ */
(function () {
  const container = document.getElementById("player-canvas");
  const visualizerCanvas = document.getElementById("audio-visualizer");
  const playerSection = document.getElementById("player-section");
  let width = container.clientWidth;
  let height = container.clientHeight;

  const VEKTROID = (window.VEKTROID = window.VEKTROID || {});

  const scene = new THREE.Scene();
  // Transparent so the canvas visualizer can show through behind the 3D.
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(8, 5, 8);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  // Vaporwave Lighting
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
  dirLight.position.set(5, 10, 7);
  dirLight.castShadow = true;
  scene.add(dirLight);

  const pinkLight = new THREE.PointLight(0xff71ce, 2, 20);
  pinkLight.position.set(-5, 3, 5);
  scene.add(pinkLight);

  const cyanLight = new THREE.PointLight(0x01cdfe, 2, 20);
  cyanLight.position.set(5, 3, -5);
  scene.add(cyanLight);

  const ambLight = new THREE.AmbientLight(0x404040, 1);
  scene.add(ambLight);

  // Grid Floor
  const gridHelper = new THREE.GridHelper(20, 20, 0xff71ce, 0x01cdfe);
  gridHelper.position.y = -3;
  gridHelper.material.opacity = 0.3;
  gridHelper.material.transparent = true;
  scene.add(gridHelper);

  const playerGroup = new THREE.Group();
  scene.add(playerGroup);

  // Materials with vaporwave colors
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    roughness: 0.3,
    metalness: 0.5,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xff71ce,
    roughness: 0.2,
    metalness: 0.8,
    emissive: 0xff71ce,
    emissiveIntensity: 0.2,
  });
  const windowMat = new THREE.MeshPhysicalMaterial({
    color: 0x111111,
    transmission: 0.8,
    thickness: 1,
    roughness: 0.1,
  });
  const innerDarkMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

  const chassisGroup = new THREE.Group();
  playerGroup.add(chassisGroup);

  // Back Plate
  const back = new THREE.Mesh(new THREE.BoxGeometry(4.5, 5.5, 0.5), bodyMat);
  back.position.z = -0.8;
  back.castShadow = true;
  chassisGroup.add(back);

  // Accent strips
  const stripGeo = new THREE.BoxGeometry(4.6, 0.1, 0.6);
  const topStrip = new THREE.Mesh(stripGeo, accentMat);
  topStrip.position.set(0, 2.5, 0);
  chassisGroup.add(topStrip);

  const bottomStrip = new THREE.Mesh(stripGeo, accentMat);
  bottomStrip.position.set(0, -2.5, 0);
  chassisGroup.add(bottomStrip);

  // Dark inner void
  const voidBox = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 2.8, 0.1),
    innerDarkMat
  );
  voidBox.position.set(0, 0.25, -0.54);
  chassisGroup.add(voidBox);

  // Bottom Block
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.5, 1.5), bodyMat);
  bottom.position.set(0, -1.75, 0);
  bottom.castShadow = true;
  chassisGroup.add(bottom);

  // Top Block
  const top = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1, 1.5), bodyMat);
  top.position.set(0, 2, 0);
  top.castShadow = true;
  chassisGroup.add(top);

  // Sides
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.75, 1.5), bodyMat);
  left.position.set(-1.95, 0.125, 0);
  chassisGroup.add(left);

  const right = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.75, 1.5), bodyMat);
  right.position.set(1.95, 0.125, 0);
  chassisGroup.add(right);

  // Door Frame
  const doorGroup = new THREE.Group();
  doorGroup.position.set(0, 0.25, 0.75);
  playerGroup.add(doorGroup);

  const glassPanel = new THREE.Mesh(
    new THREE.BoxGeometry(3.0, 2.0, 0.05),
    windowMat
  );
  doorGroup.add(glassPanel);

  // Vaporwave Buttons
  const buttons = [];
  const btnColors = [0xff71ce, 0x01cdfe, 0xb967ff, 0x05ffa1];

  function createBtn(x, colorIndex, name) {
    const geo = new THREE.BoxGeometry(0.8, 0.3, 0.4);
    const mat = new THREE.MeshStandardMaterial({
      color: btnColors[colorIndex],
      emissive: btnColors[colorIndex],
      emissiveIntensity: 0.3,
      roughness: 0.2,
      metalness: 0.8,
    });
    const btn = new THREE.Mesh(geo, mat);
    btn.position.set(x, 2.65, 0);
    btn.castShadow = true;
    btn.userData = { isButton: true, name: name, originalY: 2.65 };
    playerGroup.add(btn);
    buttons.push(btn);
  }

  createBtn(-1.5, 0, "stop");
  createBtn(-0.5, 1, "rewind");
  createBtn(0.5, 2, "play");
  createBtn(1.5, 3, "ff");

  // Cassette Tape with vaporwave styling
  const tapeGroup = new THREE.Group();
  const tapeBody = new THREE.Mesh(
    new THREE.BoxGeometry(3, 1.8, 0.3),
    new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.25,
      metalness: 0.15,
    })
  );

  // Label texture (updated from the generated Paint cassette when available)
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 256;
  labelCanvas.height = 64;
  const labelCtx = labelCanvas.getContext("2d");

  function drawImageCover(ctx, img, dx, dy, dw, dh) {
    const sw = img.width || 1;
    const sh = img.height || 1;
    const sAspect = sw / sh;
    const dAspect = dw / dh;

    let sx = 0,
      sy = 0,
      sWidth = sw,
      sHeight = sh;
    if (sAspect > dAspect) {
      sWidth = sh * dAspect;
      sx = (sw - sWidth) / 2;
    } else {
      sHeight = sw / dAspect;
      sy = (sh - sHeight) / 2;
    }

    ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dw, dh);
  }

  function drawDefaultPlayerLabel(text) {
    if (!labelCtx) return;
    labelCtx.clearRect(0, 0, labelCanvas.width, labelCanvas.height);

    const g = labelCtx.createLinearGradient(0, 0, labelCanvas.width, 0);
    g.addColorStop(0, "#ff71ce");
    g.addColorStop(0.5, "#b967ff");
    g.addColorStop(1, "#01cdfe");
    labelCtx.fillStyle = g;
    labelCtx.fillRect(0, 0, labelCanvas.width, labelCanvas.height);

    labelCtx.fillStyle = "rgba(255,255,255,0.95)";
    labelCtx.font = "bold 16px sans-serif";
    labelCtx.textAlign = "center";
    labelCtx.textBaseline = "middle";
    labelCtx.fillText(
      text || "FLORAL SHOPPE",
      labelCanvas.width / 2,
      labelCanvas.height / 2
    );
  }

  function drawGeneratedPlayerLabel() {
    const generated = VEKTROID.generatedCassette?.ready
      ? VEKTROID.generatedCassette.labelCanvas
      : null;
    if (!generated || !labelCtx) return false;

    labelCtx.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
    labelCtx.fillStyle = "#fff";
    labelCtx.fillRect(0, 0, labelCanvas.width, labelCanvas.height);

    drawImageCover(
      labelCtx,
      generated,
      0,
      0,
      labelCanvas.width,
      labelCanvas.height
    );

    // subtle border
    labelCtx.strokeStyle = "rgba(0,0,0,0.25)";
    labelCtx.lineWidth = 2;
    labelCtx.strokeRect(1, 1, labelCanvas.width - 2, labelCanvas.height - 2);
    return true;
  }

  const labelTexture = new THREE.CanvasTexture(labelCanvas);
  labelTexture.encoding = THREE.sRGBEncoding;
  labelTexture.minFilter = THREE.LinearFilter;
  labelTexture.magFilter = THREE.LinearFilter;
  const tapeLabel = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.5, 0.32),
    new THREE.MeshBasicMaterial({ map: labelTexture })
  );
  tapeLabel.position.y = 0.5;
  tapeGroup.add(tapeBody);
  tapeGroup.add(tapeLabel);

  // Tape Reels
  const reelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.35, 16);
  const reelMat = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.3,
    metalness: 0.7,
  });
  const leftReel = new THREE.Mesh(reelGeo, reelMat);
  const rightReel = new THREE.Mesh(reelGeo, reelMat);
  leftReel.rotation.x = Math.PI / 2;
  rightReel.rotation.x = Math.PI / 2;
  leftReel.position.set(-0.8, -0.2, 0.1);
  rightReel.position.set(0.8, -0.2, 0.1);

  const tooth = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.4, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x000 })
  );
  leftReel.add(tooth);
  rightReel.add(tooth.clone());
  tapeGroup.add(leftReel);
  tapeGroup.add(rightReel);

  // Keep the tape in playerGroup local space so it always matches rotation
  tapeGroup.position.set(6, 0.25, 0);
  tapeGroup.visible = false;
  playerGroup.add(tapeGroup);

  // Initialize label based on whether a cassette has already been generated
  if (!drawGeneratedPlayerLabel()) drawDefaultPlayerLabel("NO CASSETTE");
  labelTexture.needsUpdate = true;

  window.addEventListener("vektroid:cassette-generated", () => {
    if (drawGeneratedPlayerLabel()) {
      labelTexture.needsUpdate = true;
    }
  });

  // Interaction
  let isDragging = false;
  let pointerId = null;
  let previousPointer = { x: 0, y: 0 };
  let rotVel = { x: 0, y: 0 };
  const dragSensitivity = 0.01;
  const damping = 0.9;
  let tapeInserted = false;
  let isPlaying = false;

  // ==========================
  // AUDIO: FloralShoppeCassette
  // ==========================
  const statusEl = document.getElementById("status-display");
  const audioEl = new Audio();
  audioEl.preload = "metadata";
  audioEl.loop = false;

  // Keep this list in sync with the files in FloralShoppeCassette/
  const tapePlaylist = [
    {
      title: "A1 ブート",
      audio: "FloralShoppeCassette/A1 ブート.mp3",
      cover: "FloralShoppeCassette/A1 ブート.png",
    },
    {
      title: "A2 リサフランク420 現代のコンピュー",
      audio: "FloralShoppeCassette/A2 リサフランク420 現代のコンピュー.mp3",
      cover: "FloralShoppeCassette/A2 リサフランク420 現代のコンピュー.png",
    },
    {
      title: "A3 花の専門店",
      audio: "FloralShoppeCassette/A3 花の専門店.mp3",
      cover: "FloralShoppeCassette/A3 花の専門店.png",
    },
    {
      title: "A4 ライブラリ",
      audio: "FloralShoppeCassette/A4 ライブラリ.mp3",
      cover: "FloralShoppeCassette/A4 ライブラリ.png",
    },
    {
      title: "A5 地理",
      audio: "FloralShoppeCassette/A5 地理.mp3",
      cover: "FloralShoppeCassette/A5 地理.png",
    },
    {
      title: "B1 Eccoと悪寒ダイビング",
      audio: "FloralShoppeCassette/B1 Eccoと悪寒ダイビング.mp3",
      cover: "FloralShoppeCassette/B1 Eccoと悪寒ダイビング.png",
    },
    {
      title: "B2 数学",
      audio: "FloralShoppeCassette/B2 数学.mp3",
      cover: "FloralShoppeCassette/B2 数学.png",
    },
    {
      title: "B3 待機",
      audio: "FloralShoppeCassette/B3 待機.mp3",
      cover: "FloralShoppeCassette/B3 待機.png",
    },
    {
      title: "B4 ピコ",
      audio: "FloralShoppeCassette/B4 ピコ.mp3",
      cover: "FloralShoppeCassette/B4 ピコ.png",
    },
    {
      title: "B5 外ギン Aviation",
      audio: "FloralShoppeCassette/B5 外ギン Aviation.mp3",
      cover: "FloralShoppeCassette/B5 外ギン Aviation.png",
    },
    {
      title: "B6 て",
      audio: "FloralShoppeCassette/B6 て.mp3",
      cover: "FloralShoppeCassette/B6 て.png",
    },
  ];

  let currentTrackIndex = 0;

  let audioCtx = null;
  let analyser = null;
  let analyserData = null;
  let audioSource = null;

  function ensureAudioGraph() {
    if (audioCtx && analyser && audioSource) return;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      console.warn("Web Audio API not available; visualizer disabled.");
      return;
    }
    audioCtx = new AudioContextCtor();
    analyser = audioCtx.createAnalyser();
    // Lower fftSize + smoothing = less CPU + less "glitch"/jitter.
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.86;
    analyserData = new Uint8Array(analyser.frequencyBinCount);
    audioSource = audioCtx.createMediaElementSource(audioEl);
    audioSource.connect(analyser);
    analyser.connect(audioCtx.destination);
  }

  function setStatus(text, color) {
    if (!statusEl) return;
    statusEl.innerText = text;
    if (color) statusEl.style.color = color;
  }

  function setTapeLabel(track) {
    // Prefer the generated Paint cassette label (so the inserted cassette matches the one created in Paint).
    if (drawGeneratedPlayerLabel()) {
      labelTexture.needsUpdate = true;
      return;
    }

    drawDefaultPlayerLabel(track?.title ? track.title : "FLORAL SHOPPE");
    labelTexture.needsUpdate = true;
  }

  function loadTrack(index) {
    currentTrackIndex = (index + tapePlaylist.length) % tapePlaylist.length;
    const track = tapePlaylist[currentTrackIndex];

    // encodeURI keeps japanese + spaces safe for URL paths
    audioEl.src = encodeURI(track.audio);
    setTapeLabel(track);
    setStatus(`READY 準備完了\n${track.title}`, "#01cdfe");
  }

  async function playCurrent() {
    if (!tapeInserted) {
      setStatus("NO TAPE テープなし", "#ff71ce");
      return;
    }

    ensureAudioGraph();
    if (audioCtx && audioCtx.state === "suspended") {
      try {
        await audioCtx.resume();
      } catch (_) {}
    }

    try {
      await audioEl.play();
      isPlaying = true;
      setStatus(
        `再生中 PLAYING >>\n${tapePlaylist[currentTrackIndex].title}`,
        "#05ffa1"
      );
      startVisualizer();
    } catch (e) {
      console.warn(
        "Audio play failed (autoplay restriction or missing file):",
        e
      );
      isPlaying = false;
      setStatus("PLAY FAILED 再生失敗", "#ff71ce");
      stopVisualizer();
    }
  }

  function stopPlayback() {
    audioEl.pause();
    audioEl.currentTime = 0;
    isPlaying = false;
    setStatus(
      `停止 STOPPED\n${tapePlaylist[currentTrackIndex]?.title ?? ""}`,
      "#ff71ce"
    );
    stopVisualizer();
  }

  function pausePlayback() {
    audioEl.pause();
    isPlaying = false;
    setStatus(
      `一時停止 PAUSED\n${tapePlaylist[currentTrackIndex]?.title ?? ""}`,
      "#b967ff"
    );
    stopVisualizer();
  }

  function nextTrack() {
    loadTrack(currentTrackIndex + 1);
    if (tapeInserted && isPlaying) playCurrent();
  }

  function prevTrack() {
    loadTrack(currentTrackIndex - 1);
    if (tapeInserted && isPlaying) playCurrent();
  }

  audioEl.addEventListener("ended", () => {
    // Autoplay next track when current ends
    nextTrack();
  });

  // ================
  // VISUALIZER (REWORKED)
  // ================
  const visualizer = (() => {
    if (!visualizerCanvas) return null;
    const ctx = visualizerCanvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });
    if (!ctx) return null;

    const TARGET_FPS = 60;
    const FRAME_MS = 1000 / TARGET_FPS;
    const SAMPLES = 256;
    const AUDIO_WAVE_GAIN = 10;

    let running = false;
    let raf = 0;
    let lastFrameMs = 0;

    let dpr = 1;
    let cssW = 1;
    let cssH = 1;

    let timeFloat = null;
    let timeByte = null;
    let freqByte = null;
    const down = new Float32Array(SAMPLES);
    const smooth = new Float32Array(SAMPLES);

    // Pre-rendered background (radial + scanlines) rebuilt only on resize
    const bg = document.createElement("canvas");
    const bgCtx = bg.getContext("2d");

    function rebuildBackground() {
      if (!bgCtx) return;
      bg.width = Math.max(1, cssW);
      bg.height = Math.max(2, cssH);

      bgCtx.clearRect(0, 0, bg.width, bg.height);

      // Soft radial neon "sun" behind everything
      const r = Math.max(bg.width, bg.height) * 0.55;
      const cx = bg.width * 0.5;
      const cy = bg.height * 0.52;
      const g = bgCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "rgba(1, 205, 254, 0.14)");
      g.addColorStop(0.35, "rgba(185, 103, 255, 0.08)");
      g.addColorStop(0.7, "rgba(255, 113, 206, 0.05)");
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      bgCtx.fillStyle = g;
      bgCtx.fillRect(0, 0, bg.width, bg.height);

      // Thin scanlines (cheap, static)
      bgCtx.globalCompositeOperation = "screen";
      bgCtx.fillStyle = "rgba(255,255,255,0.025)";
      for (let y = 0; y < bg.height; y += 4) bgCtx.fillRect(0, y, bg.width, 1);
      bgCtx.globalCompositeOperation = "source-over";
    }

    function resize() {
      const rect = container
        ? container.getBoundingClientRect()
        : visualizerCanvas.getBoundingClientRect();
      cssW = Math.max(1, Math.floor(rect.width));
      cssH = Math.max(2, Math.floor(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      visualizerCanvas.style.width = cssW + "px";
      visualizerCanvas.style.height = cssH + "px";
      visualizerCanvas.width = Math.floor(cssW * dpr);
      visualizerCanvas.height = Math.floor(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      rebuildBackground();
    }

    function sampleTimeDomain(tSeconds) {
      const audioActive = !!(analyser && isPlaying && !audioEl.paused);

      if (audioActive) {
        // Prefer float data for smoother visuals.
        if (typeof analyser.getFloatTimeDomainData === "function") {
          if (!timeFloat || timeFloat.length !== analyser.fftSize)
            timeFloat = new Float32Array(analyser.fftSize);
          analyser.getFloatTimeDomainData(timeFloat);

          const step = timeFloat.length / SAMPLES;
          for (let i = 0; i < SAMPLES; i++) {
            // RMS-ish sampling over a small window to reduce jitter
            const start = Math.floor(i * step);
            const end = Math.min(timeFloat.length, Math.floor((i + 1) * step));
            let acc = 0;
            let count = 0;
            for (let j = start; j < end; j++) {
              const v = timeFloat[j];
              acc += v;
              count++;
            }
            down[i] = count ? acc / count : 0;
          }
        } else {
          if (!timeByte || timeByte.length !== analyser.fftSize)
            timeByte = new Uint8Array(analyser.fftSize);
          analyser.getByteTimeDomainData(timeByte);
          const step = timeByte.length / SAMPLES;
          for (let i = 0; i < SAMPLES; i++) {
            down[i] = (timeByte[Math.floor(i * step)] - 128) / 128;
          }
        }
      } else {
        // Idle: lissajous-style ribbon (stable, smooth)
        for (let i = 0; i < SAMPLES; i++) {
          const p = i / (SAMPLES - 1);
          const a = Math.sin(p * Math.PI * 6 + tSeconds * 1.6) * 0.55;
          const b = Math.sin(p * Math.PI * 2 - tSeconds * 0.9) * 0.25;
          const c = Math.sin(p * Math.PI * 12 + tSeconds * 0.35) * 0.12;
          down[i] = (a + b + c) * 0.85;
        }
      }

      // Boost audio amplitude (keep idle unchanged)
      if (audioActive) {
        for (let i = 0; i < SAMPLES; i++) {
          const v = down[i] * AUDIO_WAVE_GAIN;
          down[i] = Math.max(-1, Math.min(1, v));
        }
      }

      // Critically damped smoothing for stability
      const follow = audioActive ? 0.22 : 0.12;
      for (let i = 0; i < SAMPLES; i++) {
        smooth[i] = smooth[i] + (down[i] - smooth[i]) * follow;
      }

      // Frequency data for a subtle bottom haze (optional)
      if (audioActive && analyserData) {
        if (!freqByte || freqByte.length !== analyserData.length)
          freqByte = analyserData;
        analyser.getByteFrequencyData(freqByte);
        visualizerCanvas.classList.add("is-active");
      } else {
        visualizerCanvas.classList.remove("is-active");
      }
    }

    function drawWave(tSeconds) {
      // Background
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.drawImage(bg, 0, 0, cssW, cssH);

      // Wave ribbon
      const mid = cssH * 0.56;
      const amp = cssH * 0.34;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      // Glow passes (big -> small)
      const passes = [
        { w: 14, a: 0.08, c: "rgba(255, 113, 206, 1)", blur: 24 },
        { w: 7, a: 0.16, c: "rgba(185, 103, 255, 1)", blur: 16 },
        { w: 3, a: 0.9, c: "rgba(1, 205, 254, 1)", blur: 8 },
      ];

      for (const p of passes) {
        ctx.beginPath();
        ctx.lineWidth = p.w;
        ctx.strokeStyle = p.c;
        ctx.globalAlpha = p.a;
        ctx.shadowColor = p.c;
        ctx.shadowBlur = p.blur;

        // Quadratic smoothing
        let x0 = 0;
        let y0 = mid + smooth[0] * amp;
        ctx.moveTo(x0, y0);

        for (let i = 1; i < SAMPLES; i++) {
          const x = (i / (SAMPLES - 1)) * cssW;
          const y = mid + smooth[i] * amp;
          const cx = (x0 + x) * 0.5;
          const cy = (y0 + y) * 0.5;
          ctx.quadraticCurveTo(x0, y0, cx, cy);
          x0 = x;
          y0 = y;
        }
        ctx.lineTo(cssW, y0);
        ctx.stroke();
      }

      ctx.restore();
    }

    function tick(nowMs) {
      if (!running) return;
      raf = requestAnimationFrame(tick);

      if (nowMs - lastFrameMs < FRAME_MS) return;
      lastFrameMs = nowMs;

      // Keep canvas size stable; only resize when needed.
      const rect = container
        ? container.getBoundingClientRect()
        : visualizerCanvas.getBoundingClientRect();
      const nextW = Math.max(1, Math.floor(rect.width));
      const nextH = Math.max(1, Math.floor(rect.height));
      const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
      if (nextW !== cssW || nextH !== cssH || nextDpr !== dpr) resize();

      const t = nowMs * 0.001;
      sampleTimeDomain(t);
      drawWave(t);
    }

    function start() {
      if (running) return;
      running = true;
      resize();
      lastFrameMs = performance.now();
      raf = requestAnimationFrame(tick);
    }

    function stop(clear = false) {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (clear) ctx.clearRect(0, 0, cssW, cssH);
    }

    return { start, stop, resize };
  })();

  function resizeVisualizerCanvas() {
    visualizer?.resize();
  }

  function startVisualizer() {
    visualizer?.start();
  }

  function stopVisualizer(offscreen) {
    // If offscreen, fully stop + clear. Otherwise keep it visible (idle mode).
    if (offscreen) visualizer?.stop(true);
  }

  // Pause 3D render + visualizer when off-screen / tab hidden
  let playerRaf = 0;
  let playerIsRunning = false;
  let playerInView = true;

  function playerLoop() {
    if (!playerIsRunning) return;
    playerRaf = requestAnimationFrame(playerLoop);

    const t = Date.now() * 0.001;

    if (!isDragging) {
      // Inertia
      playerGroup.rotation.x += rotVel.x;
      playerGroup.rotation.y += rotVel.y;
      playerGroup.rotation.x = Math.max(
        -0.9,
        Math.min(0.6, playerGroup.rotation.x)
      );
      rotVel.x *= damping;
      rotVel.y *= damping;
    }

    renderer.render(scene, camera);

    if (tapeInserted && isPlaying) {
      leftReel.rotation.y -= 0.1;
      rightReel.rotation.y -= 0.1;
    }

    // Animate lights
    pinkLight.position.x = Math.sin(t * 0.5) * 5;
    cyanLight.position.z = Math.cos(t * 0.5) * 5;

    // Subtle grid animation
    gridHelper.rotation.y += 0.001;
  }

  function playerStart() {
    if (playerIsRunning) return;
    playerIsRunning = true;
    playerRaf = requestAnimationFrame(playerLoop);
  }

  function playerStop() {
    playerIsRunning = false;
    if (playerRaf) cancelAnimationFrame(playerRaf);
    playerRaf = 0;
  }

  function playerUpdateRunning() {
    const shouldRun = playerInView && !document.hidden;
    if (shouldRun) {
      playerStart();
      // Always show the oscillator as a background when the cassette area is visible.
      startVisualizer();
    } else {
      playerStop();
      // Keep audio playing, but stop drawing the visualizer when off-screen.
      stopVisualizer(true);
    }
  }

  if (playerSection) {
    const playerObserver = new IntersectionObserver(
      (entries) => {
        playerInView = entries.some((e) => e.isIntersecting);
        playerUpdateRunning();
      },
      { threshold: 0.05 }
    );
    playerObserver.observe(playerSection);
  }
  document.addEventListener("visibilitychange", playerUpdateRunning);

  container.style.touchAction = "none";

  container.addEventListener("pointerdown", (e) => {
    isDragging = true;
    pointerId = e.pointerId;
    container.setPointerCapture(pointerId);
    previousPointer = { x: e.clientX, y: e.clientY };
  });

  container.addEventListener("pointerup", () => {
    isDragging = false;
    pointerId = null;
  });

  container.addEventListener("pointercancel", () => {
    isDragging = false;
    pointerId = null;
  });

  container.addEventListener("pointermove", (e) => {
    if (!isDragging || e.pointerId !== pointerId) return;
    const deltaX = e.clientX - previousPointer.x;
    const deltaY = e.clientY - previousPointer.y;

    const vy = deltaX * dragSensitivity;
    const vx = deltaY * dragSensitivity;

    playerGroup.rotation.y += vy;
    playerGroup.rotation.x += vx;

    // Clamp X rotation a bit so it doesn't flip
    playerGroup.rotation.x = Math.max(
      -0.9,
      Math.min(0.6, playerGroup.rotation.x)
    );

    rotVel.x = vx;
    rotVel.y = vy;
    previousPointer = { x: e.clientX, y: e.clientY };
  });

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  container.addEventListener("click", (event) => {
    const rect = container.getBoundingClientRect();
    const currentWidth = rect.width;
    const currentHeight = rect.height;
    mouse.x = ((event.clientX - rect.left) / currentWidth) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / currentHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(playerGroup.children);
    for (let i = 0; i < intersects.length; i++) {
      if (intersects[i].object.userData.isButton)
        pressButton(intersects[i].object);
    }
  });

  function pressButton(btn) {
    const targetY = btn.userData.originalY - 0.2;
    buttons.forEach((b) => (b.position.y = b.userData.originalY));
    btn.position.y = targetY;

    if (!tapeInserted) {
      setStatus("NO TAPE テープなし", "#ff71ce");
      return;
    }

    if (btn.userData.name === "play") {
      // Toggle play/pause when already playing
      if (isPlaying && !audioEl.paused) {
        pausePlayback();
      } else {
        playCurrent();
      }
    } else if (btn.userData.name === "stop") {
      stopPlayback();
    } else if (btn.userData.name === "rewind") {
      setStatus("巻き戻し <<", "#01cdfe");
      prevTrack();
    } else {
      setStatus("早送り >>", "#b967ff");
      nextTrack();
    }
  }

  document.getElementById("insert-tape-btn").addEventListener("click", () => {
    if (tapeInserted) return;

    const cassetteState = VEKTROID.cassetteState;

    if (!VEKTROID.generatedCassette?.ready || !cassetteState?.created) {
      setStatus("NO CASSETTE\nPaintで先に生成してね", "#ff71ce");
      return;
    }

    if (cassetteState.inserted || cassetteState.inFlight) return;

    // Hide the floating cassette if visible
    const floatingEl = document.getElementById("floating-cassette-3d");
    if (floatingEl && !floatingEl.hidden) {
      floatingEl.hidden = true;
      floatingEl.classList.remove("is-visible");
      VEKTROID.stopFloatingCassette3D?.();
    }

    cassetteState.created = false;
    cassetteState.inserted = true;
    cassetteState.inFlight = false;

    // Ensure the tape label matches the generated cassette before inserting.
    setTapeLabel({ title: "" });

    insertTapeAnimation();
  });

  // Expose function for drag-and-drop cassette insertion
  VEKTROID.insertGeneratedTape = function () {
    if (tapeInserted) return;

    const cassetteState = VEKTROID.cassetteState;

    if (!VEKTROID.generatedCassette?.ready || !cassetteState?.created) {
      setStatus("NO CASSETTE\nPaintで先に生成してね", "#ff71ce");
      return;
    }

    cassetteState.created = false;
    cassetteState.inserted = true;
    cassetteState.inFlight = false;

    // Ensure the tape label matches the generated cassette before inserting.
    setTapeLabel({ title: "" });

    insertTapeAnimation();
  };

  function insertTapeAnimation() {
    // Only show the player tape once we start inserting.
    tapeGroup.visible = true;

    const startX = tapeGroup.position.x;
    const endX = 0;
    const t0 = performance.now();
    const dur = 650;

    function step(now) {
      const p = Math.min(1, Math.max(0, (now - t0) / dur));
      const e = 1 - Math.pow(1 - p, 3);
      tapeGroup.position.x = startX + (endX - startX) * e;
      if (p < 1) {
        requestAnimationFrame(step);
        return;
      }

      tapeGroup.position.set(0, 0.25, 0);
      tapeInserted = true;
      loadTrack(0);
      setStatus("ロード完了 LOADED", "#01cdfe");
    }

    requestAnimationFrame(step);
  }

  // Start/stop loop based on visibility
  playerUpdateRunning();

  window.addEventListener("resize", () => {
    width = container.clientWidth;
    height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    resizeVisualizerCanvas();
  });
})();

/* ============================================
           NAVBAR SCROLL HIDE/SHOW
           ============================================ */
(function () {
  const navbar = document.querySelector(".xp-navbar");
  const pcSection = document.getElementById("pc-section");
  const playerSection = document.getElementById("player-section");

  if (!navbar) return;

  let lastScrollY = window.scrollY;
  let isScrollingUp = false;

  function updateNavbarVisibility() {
    const currentScrollY = window.scrollY;
    isScrollingUp = currentScrollY < lastScrollY;
    lastScrollY = currentScrollY;

    const pcRect = pcSection ? pcSection.getBoundingClientRect() : null;
    const playerRect = playerSection
      ? playerSection.getBoundingClientRect()
      : null;

    // Always show navbar if scrolling up
    if (isScrollingUp) {
      navbar.classList.remove("navbar-hidden");
    }
    // Hide navbar when PC section is in view and scrolling down
    else if (
      pcRect &&
      pcRect.top <= 0 &&
      pcRect.bottom > window.innerHeight * 0.3
    ) {
      navbar.classList.add("navbar-hidden");
    } else if (playerRect && playerRect.top <= window.innerHeight * 0.5) {
      // Reached player section - show navbar
      navbar.classList.remove("navbar-hidden");
    }
  }

  let scrollTicking = false;
  window.addEventListener("scroll", () => {
    if (!scrollTicking) {
      requestAnimationFrame(() => {
        updateNavbarVisibility();
        scrollTicking = false;
      });
      scrollTicking = true;
    }
  });

  // Initial check
  updateNavbarVisibility();
})();
