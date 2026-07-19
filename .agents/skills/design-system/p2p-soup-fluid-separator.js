/* NeonSoup P2P soup fluid separator.
   Extracted mechanically from ../index.html on 2026-07-09.
   Preserve current behavior unless the landing animation changes first. */

// P2P soup fluid separator module: config, stage builder, anchor geometry, and scroll update loop.
    window.p2p_soup_fluid_separator_config = {
      selector: "[data-p2p-soup-fluid-separator]",
      assets: {
        potBg: "design-system/assets/images/empty_pot_bg.png",
        potFg: "design-system/assets/images/empty_pot_fg.png",
        cybernekos: [
          "design-system/assets/cybernekos/serving-soup_AD.png",
          "design-system/assets/cybernekos/soup-machine_AP.png",
          "design-system/assets/cybernekos/order-tablet_O.png",
          "design-system/assets/cybernekos/hologram-wave_AO.png",
          "design-system/assets/cybernekos/peeking-counter_A.png"
        ],
        kitchen: [
          "design-system/assets/kitchen/whisk_A.png",
          "design-system/assets/kitchen/whisk_B.png",
          "design-system/assets/kitchen/chef_knife_A.png",
          "design-system/assets/kitchen/peeler_A.png",
          "design-system/assets/kitchen/measuring_spoon_A.png",
          "design-system/assets/kitchen/strainer_ladle_A.png",
          "design-system/assets/kitchen/chef_hat_A.png",
          "design-system/assets/kitchen/soup_bowl_A.png",
          "design-system/assets/kitchen/blender_A.png"
        ]
      },
      tokens: ["ADA", "MIN", "iUSD", "DJED", "USDM", "WMT", "SNEK"],
      payloadCount: 9,
      directionStrategy: "alternate",
      arc: {
        liftRatio: 0.32,
        wobbleRatio: 0.035,
        laneGapRatio: 0.018
      },
      anchors: {
        mouthX: 0.5,
        mouthY: 0.52
      },
      track: {
        minHeight: 118,
        maxHeight: 292,
        heightRatio: 0.78,
        minWidth: 140,
        mouthOverlapRatio: 0
      },
      payloadScale: {
        min: 0.36,
        max: 0.78,
        referenceWidth: 1180,
        keywordDimming: 0.38
      },
      bubbles: {
        count: 14,
        minSize: 7,
        maxSize: 18,
        window: 0.56
      },
      payloadWindow: 0.42,
      scrollWindow: {
        startViewport: 0.92,
        endViewport: 0.08
      },
      potRotation: {
        sourceThrow: 42,
        receiverCatch: 34
      }
    };

    function create_p2p_soup_fluid_separator(customConfig = {}) {
      const config = {
        ...window.p2p_soup_fluid_separator_config,
        ...customConfig,
        assets: {
          ...window.p2p_soup_fluid_separator_config.assets,
          ...(customConfig.assets || {})
        },
        arc: {
          ...window.p2p_soup_fluid_separator_config.arc,
          ...(customConfig.arc || {})
        },
        anchors: {
          ...window.p2p_soup_fluid_separator_config.anchors,
          ...(customConfig.anchors || {})
        },
        track: {
          ...window.p2p_soup_fluid_separator_config.track,
          ...(customConfig.track || {})
        },
        payloadScale: {
          ...window.p2p_soup_fluid_separator_config.payloadScale,
          ...(customConfig.payloadScale || {})
        },
        bubbles: {
          ...window.p2p_soup_fluid_separator_config.bubbles,
          ...(customConfig.bubbles || {})
        },
        scrollWindow: {
          ...window.p2p_soup_fluid_separator_config.scrollWindow,
          ...(customConfig.scrollWindow || {})
        },
        potRotation: {
          ...window.p2p_soup_fluid_separator_config.potRotation,
          ...(customConfig.potRotation || {})
        }
      };

      const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
      const lerp = (a, b, t) => a + (b - a) * t;
      const shuffle = (items) => {
        const copy = [...items];
        for (let i = copy.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
      };
      const buildStage = (section) => {
        if (section.querySelector("[data-p2p-soup-fluid-separator-stage]")) return;
        const keywordSource = section.querySelector("[data-p2p-soup-fluid-separator-keyword]");
        const keywordNode = keywordSource ? keywordSource.cloneNode(true) : null;
        section.innerHTML = `
          <div class="p2p_soup_fluid_separator-stage" data-p2p-soup-fluid-separator-stage>
            <div class="p2p_soup_fluid_separator-pot-back p2p_soup_fluid_separator-pot-left" aria-hidden="true">
              <img class="p2p_soup_fluid_separator-pot-img" src="${config.assets.potBg}" alt="">
              <span class="p2p_soup_fluid_separator-pot-glow"></span>
              <span class="p2p_soup_fluid_separator-pot-fluid"></span>
              <span class="p2p_soup_fluid_separator-pot-mouth"></span>
            </div>
            <div class="p2p_soup_fluid_separator-pot-back p2p_soup_fluid_separator-pot-right" aria-hidden="true">
              <img class="p2p_soup_fluid_separator-pot-img" src="${config.assets.potBg}" alt="">
              <span class="p2p_soup_fluid_separator-pot-glow"></span>
              <span class="p2p_soup_fluid_separator-pot-fluid"></span>
              <span class="p2p_soup_fluid_separator-pot-mouth"></span>
            </div>
            <div class="p2p_soup_fluid_separator-track" aria-hidden="true">
              <svg class="p2p_soup_fluid_separator-wave" viewBox="0 0 1200 300" preserveAspectRatio="none" focusable="false">
                <path class="p2p_soup_fluid_separator-wave-body" pathLength="1" d="M 0 164 C 94 78 166 82 244 145 S 398 254 522 160 S 716 50 842 145 S 1040 250 1200 116"/>
                <path class="p2p_soup_fluid_separator-wave-hot" pathLength="1" d="M 0 141 C 114 54 188 76 270 132 S 402 224 544 138 S 730 42 858 126 S 1038 222 1200 96"/>
                <path class="p2p_soup_fluid_separator-wave-cool" pathLength="1" d="M 0 190 C 114 112 190 116 286 170 S 428 278 558 186 S 748 86 878 168 S 1034 276 1200 146"/>
              </svg>
            </div>
            <div class="p2p_soup_fluid_separator-bubble-layer" data-p2p-soup-fluid-separator-bubble-layer aria-hidden="true"></div>
            <div class="p2p_soup_fluid_separator-payload-layer" data-p2p-soup-fluid-separator-payload-layer aria-hidden="true"></div>
            <div class="p2p_soup_fluid_separator-pot-front p2p_soup_fluid_separator-pot-left" aria-hidden="true">
              <img class="p2p_soup_fluid_separator-pot-img" src="${config.assets.potFg}" alt="">
            </div>
            <div class="p2p_soup_fluid_separator-pot-front p2p_soup_fluid_separator-pot-right" aria-hidden="true">
              <img class="p2p_soup_fluid_separator-pot-img" src="${config.assets.potFg}" alt="">
            </div>
          </div>
        `;
        const payloadLayer = section.querySelector("[data-p2p-soup-fluid-separator-payload-layer]");
        if (payloadLayer && keywordNode) {
          const keywordLayer = document.createElement("div");
          keywordLayer.className = "p2p_soup_fluid_separator-keyword-layer";
          keywordLayer.dataset.p2pSoupFluidSeparatorKeywordLayer = "";
          keywordLayer.setAttribute("aria-hidden", "true");
          keywordNode.classList.add("p2p_soup_fluid_separator-keyword");
          keywordLayer.appendChild(keywordNode);
          payloadLayer.before(keywordLayer);
        }
      };

      const makePayloadPool = () => {
        const nekos = shuffle(config.assets.cybernekos).map((src, index) => ({
          type: "image",
          kind: "neko",
          src,
          alt: "",
          size: 64 + (index % 3) * 13
        }));
        const kitchen = shuffle(config.assets.kitchen || []).map((src, index) => ({
          type: "image",
          kind: "kitchen",
          src,
          alt: "",
          size: 48 + (index % 4) * 6
        }));
        const tokens = shuffle(config.tokens).map((label, index) => ({
          type: "token",
          label,
          tone: index % 2 === 0 ? "tok-a" : "tok-b",
          size: 58
        }));
        return shuffle([...nekos, ...kitchen, ...tokens]).slice(0, config.payloadCount);
      };

      const sections = Array.from(document.querySelectorAll(config.selector));
      const instances = sections.map((section, sectionIndex) => {
        buildStage(section);
        const layer = section.querySelector("[data-p2p-soup-fluid-separator-payload-layer]");
        const bubbleLayer = section.querySelector("[data-p2p-soup-fluid-separator-bubble-layer]");
        const stage = section.querySelector("[data-p2p-soup-fluid-separator-stage]");
        const track = section.querySelector(".p2p_soup_fluid_separator-track");
        const wavePaths = Array.from(section.querySelectorAll(".p2p_soup_fluid_separator-wave path"));
        const leftPot = section.querySelector(".p2p_soup_fluid_separator-pot-back.p2p_soup_fluid_separator-pot-left");
        const rightPot = section.querySelector(".p2p_soup_fluid_separator-pot-back.p2p_soup_fluid_separator-pot-right");
        const keyword = section.querySelector("[data-p2p-soup-fluid-separator-keyword]");
        if (!layer || !bubbleLayer || !stage || !track || !leftPot || !rightPot) return null;

        layer.textContent = "";
        bubbleLayer.textContent = "";
        const direction = section.dataset.direction || (config.directionStrategy === "alternate" && sectionIndex % 2 ? "rtl" : "ltr");
        const bubbles = Array.from({ length: config.bubbles.count }, (_, index) => {
          const node = document.createElement("span");
          const phase = index / Math.max(1, config.bubbles.count - 1);
          const size = lerp(config.bubbles.minSize, config.bubbles.maxSize, (index % 5) / 4);
          node.className = "p2p_soup_fluid_separator-bubble";
          node.style.setProperty("--p2p-separator-bubble-size", `${size.toFixed(1)}px`);
          bubbleLayer.appendChild(node);
          return {
            node,
            offset: phase * 0.46,
            lane: ((index % 7) - 3) * 0.42,
            float: index % 2 === 0 ? 1 : -1
          };
        });
        const payloads = makePayloadPool().map((payload, index) => {
          const node = document.createElement("span");
          node.className = "p2p_soup_fluid_separator-rider";
          node.dataset.p2pSoupFluidSeparatorRider = payload.kind || payload.type;
          if (payload.kind === "kitchen") node.classList.add("is-kitchen");
          if (index > 5) node.dataset.mobileHide = "true";
          node.style.setProperty("--p2p-separator-rider-size", `${payload.size}px`);
          node.style.setProperty("--p2p-separator-chip-size", index % 3 === 0 ? "0.56rem" : "0.6rem");

          if (payload.type === "image") {
            const img = document.createElement("img");
            img.src = payload.src;
            img.alt = payload.alt;
            img.loading = "lazy";
            node.appendChild(img);
          } else {
            const chip = document.createElement("span");
            chip.className = `p2p_soup_fluid_separator-chip ${payload.tone}`;
            chip.textContent = `$${payload.label}`;
            node.appendChild(chip);
          }

          layer.appendChild(node);
          return {
            node,
            offset: 0.03 + (index / Math.max(1, config.payloadCount - 1)) * 0.42,
            lane: (index % 5) - 2,
            spin: index % 2 === 0 ? 1 : -1
          };
        });

        return { section, stage, track, wavePaths, leftPot, rightPot, direction, bubbles, payloads, keyword };
      }).filter(Boolean);

      function getMouthAnchor(stageRect, pot) {
        const potRect = pot.getBoundingClientRect();
        return {
          x: potRect.left - stageRect.left + potRect.width * config.anchors.mouthX,
          y: potRect.top - stageRect.top + potRect.height * config.anchors.mouthY,
          potWidth: potRect.width
        };
      }

      function getAnchorSet(instance, stageRect) {
        const left = getMouthAnchor(stageRect, instance.leftPot);
        const right = getMouthAnchor(stageRect, instance.rightPot);
        const leftIsSource = instance.direction !== "rtl";
        return {
          left,
          right,
          source: leftIsSource ? left : right,
          target: leftIsSource ? right : left
        };
      }

      function pointOnArc(t, lane, stageRect, anchors) {
        const x = lerp(anchors.source.x, anchors.target.x, t);
        const baseY = lerp(anchors.source.y, anchors.target.y, t);
        const arch = Math.sin(t * Math.PI);
        const lift = Math.min(stageRect.height * config.arc.liftRatio, stageRect.height * 0.42);
        const wobble = Math.sin((t * Math.PI * 2) + lane) * stageRect.height * config.arc.wobbleRatio;
        const y = baseY - arch * lift + lane * stageRect.height * config.arc.laneGapRatio + wobble;
        return {
          x,
          y
        };
      }

      function updateTrackGeometry(instance, anchors, stageRect, streamStart, streamEnd, trackOpacity) {
        const distance = Math.abs(anchors.target.x - anchors.source.x);
        const overlap = Math.min(Math.min(anchors.source.potWidth, anchors.target.potWidth) * config.track.mouthOverlapRatio, 38);
        const trackHeight = clamp(stageRect.height * config.track.heightRatio, config.track.minHeight, config.track.maxHeight);
        const trackWidth = Math.max(config.track.minWidth, distance + overlap * 2);
        const trackLeft = Math.min(anchors.source.x, anchors.target.x) - overlap;
        const trackTop = lerp(anchors.source.y, anchors.target.y, 0.5) - trackHeight * 0.54;

        instance.section.style.setProperty("--p2p-separator-track-left", `${trackLeft.toFixed(1)}px`);
        instance.section.style.setProperty("--p2p-separator-track-top", `${trackTop.toFixed(1)}px`);
        instance.section.style.setProperty("--p2p-separator-track-width", `${trackWidth.toFixed(1)}px`);
        instance.section.style.setProperty("--p2p-separator-track-height", `${trackHeight.toFixed(1)}px`);
        instance.section.style.setProperty("--p2p-separator-stream-start", `${(streamStart * 100).toFixed(1)}%`);
        instance.section.style.setProperty("--p2p-separator-stream-end", `${(streamEnd * 100).toFixed(1)}%`);
        instance.section.style.setProperty("--p2p-separator-track-opacity", Math.max(0, trackOpacity).toFixed(3));
        const visibleSpan = Math.max(0.001, streamEnd - streamStart);
        instance.wavePaths.forEach((path) => {
          path.style.strokeDasharray = `${visibleSpan.toFixed(4)} 1`;
          path.style.strokeDashoffset = (-streamStart).toFixed(4);
        });
      }

      function updateInstance(instance) {
        const rect = instance.section.getBoundingClientRect();
        const start = window.innerHeight * config.scrollWindow.startViewport;
        const end = window.innerHeight * config.scrollWindow.endViewport;
        const progress = clamp((start - rect.top) / Math.max(1, start - end + rect.height));
        const local = progress;
        const dir = instance.direction === "rtl" ? -1 : 1;
        const sourceThrowProgress = clamp(local / 0.66);
        const catcherProgress = clamp((local - 0.34) / 0.66);
        const throwPower = Math.sin(sourceThrowProgress * Math.PI);
        const catchPower = Math.sin(catcherProgress * Math.PI);
        const catchFill = catcherProgress;
        const leftIsSource = instance.direction !== "rtl";
        const leftRot = leftIsSource
          ? lerp(0, config.potRotation.sourceThrow, throwPower)
          : lerp(0, config.potRotation.receiverCatch, catchPower);
        const rightRot = leftIsSource
          ? lerp(0, -config.potRotation.receiverCatch, catchPower)
          : lerp(0, -config.potRotation.sourceThrow, throwPower);
        const stageRect = instance.stage.getBoundingClientRect();
        const anchors = getAnchorSet(instance, stageRect);
        const payloadResponsiveScale = clamp(
          stageRect.width / Math.max(1, config.payloadScale.referenceWidth),
          config.payloadScale.min,
          config.payloadScale.max
        );
        const streamStart = clamp((local - 0.7) / 0.3);
        const streamEnd = clamp(local / 0.52);
        const streamSpan = Math.max(0.001, streamEnd - streamStart);
        const streamPresence = clamp(streamSpan * 2.15);
        const trackScale = 0.98 + Math.sin(local * Math.PI) * 0.06;
        const trackOpacity = streamPresence * Math.sin(local * Math.PI);
        const keywordPulse = instance.keyword
          ? clamp(1 - Math.abs(local - 0.5) / 0.18)
          : 0;
        const keywordOpacity = Math.sin(keywordPulse * Math.PI * 0.5) * trackOpacity;
        const keywordScale = lerp(0.92, 1.04, keywordPulse);
        const leftFluid = leftIsSource
          ? clamp(0.72 - local * 0.48, 0.18, 0.72)
          : clamp(0.16 + catchFill * 0.62, 0.16, 0.78);
        const rightFluid = leftIsSource
          ? clamp(0.16 + catchFill * 0.62, 0.16, 0.78)
          : clamp(0.72 - local * 0.48, 0.18, 0.72);

        instance.section.style.setProperty("--p2p-separator-progress", progress.toFixed(4));
        instance.section.style.setProperty("--p2p-separator-dir", dir);
        instance.section.style.setProperty("--p2p-separator-track-scale", trackScale.toFixed(3));
        updateTrackGeometry(instance, anchors, stageRect, streamStart, streamEnd, trackOpacity);
        instance.section.style.setProperty("--p2p-separator-left-rotate", `${leftRot.toFixed(2)}deg`);
        instance.section.style.setProperty("--p2p-separator-right-rotate", `${rightRot.toFixed(2)}deg`);
        instance.section.style.setProperty("--p2p-separator-left-fluid", leftFluid.toFixed(3));
        instance.section.style.setProperty("--p2p-separator-right-fluid", rightFluid.toFixed(3));
        instance.section.style.setProperty("--p2p-separator-left-mouth", (leftIsSource ? clamp(1 - local / 0.7) : catchFill).toFixed(3));
        instance.section.style.setProperty("--p2p-separator-right-mouth", (leftIsSource ? catchFill : clamp(1 - local / 0.7)).toFixed(3));
        instance.section.style.setProperty("--p2p-separator-keyword-opacity", keywordOpacity.toFixed(3));
        instance.section.style.setProperty("--p2p-separator-keyword-scale", keywordScale.toFixed(3));

        instance.bubbles.forEach((bubble) => {
          const raw = (local - bubble.offset) / config.bubbles.window;
          const active = raw >= 0 && raw <= 1;
          const t = clamp(raw);
          const pos = pointOnArc(t, bubble.lane, stageRect, anchors);
          const lift = Math.sin(t * Math.PI) * stageRect.height * 0.026 * bubble.float;
          const opacity = active ? Math.sin(t * Math.PI) * streamPresence * 0.72 : 0;
          const scale = active ? lerp(0.58, 1.14, Math.sin(t * Math.PI)) : 0.5;
          bubble.node.style.opacity = opacity.toFixed(3);
          bubble.node.style.transform = `translate3d(${pos.x.toFixed(1)}px, ${(pos.y + lift).toFixed(1)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)})`;
        });

        instance.payloads.forEach((payload) => {
          const windowSize = config.payloadWindow;
          const raw = (local - payload.offset) / windowSize;
          const active = raw >= 0 && raw <= 1;
          const t = clamp(raw);
          const pathT = clamp(raw);
          const pos = pointOnArc(pathT, payload.lane, stageRect, anchors);
          const keywordClearance = lerp(1, 1 - config.payloadScale.keywordDimming, keywordPulse);
          const opacity = active ? Math.sin(t * Math.PI) * streamPresence * keywordClearance : 0;
          const scale = (active ? lerp(0.72, 1.18, Math.sin(t * Math.PI)) : 0.6) * payloadResponsiveScale;
          const rotate = lerp(instance.direction === "rtl" ? 42 : -42, instance.direction === "rtl" ? -46 : 46, pathT) + payload.spin * local * 80;
          payload.node.style.opacity = opacity.toFixed(3);
          payload.node.style.transform = `translate3d(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${rotate.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
        });
      }

      let ticking = false;
      function updateAll() {
        ticking = false;
        instances.forEach(updateInstance);
      }
      function requestUpdate() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(updateAll);
      }

      window.addEventListener("scroll", requestUpdate, { passive: true });
      window.addEventListener("resize", requestUpdate);
      updateAll();

      return {
        config,
        update: updateAll,
        destroy() {
          window.removeEventListener("scroll", requestUpdate);
          window.removeEventListener("resize", requestUpdate);
        }
      };
    }

    const p2p_soup_fluid_separator = create_p2p_soup_fluid_separator();
    window.p2p_soup_fluid_separator = p2p_soup_fluid_separator;
