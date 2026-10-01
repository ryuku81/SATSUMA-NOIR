// ============================================================
//  Motion — 表示時・スクロール時のアニメーション（GSAP + ScrollTrigger）
//  ・動かすのは transform / opacity / clip-path だけ（レイアウトは変えない）
//  ・gsap.matchMedia の中で作り、条件が外れたらまとめて破棄する
//  ・あとから描画される要素（人気商品・TOPICS など）は MutationObserver で拾う
//  ・動きを減らす設定、または GSAP が読み込めなかったときは何もしない
// ============================================================
(function () {
  "use strict";

  if (window.Motion) return; // 二重に初期化しない

  const root = document.documentElement;
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;

  if (!root.classList.contains("has-motion") || !gsap || !ScrollTrigger) {
    root.classList.remove("has-motion");
    window.Motion = { leave: () => false };
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const EASE = "power3.out";
  const EASE_HEAD = "power4.out"; // 見出し：すっと出て長く減速する
  const EASE_LINE = "expo.out"; // 線：一気に伸びて静かに止まる
  const EASE_WIPE = "expo.inOut"; // 幕：ゆっくり動き出して一気に開く
  const START = "top 86%"; // 画面に入ってすぐ
  const INTRO_SKIP_SCALE = 2.5; // イントロ中に操作されたら早送りする倍率
  const LEAVE_MS = 760; // 金の線が伸びて面になり、画面を覆うまで
  const LEAVE_GUARD_MS = 4000;
  const REFRESH_DELAY_MS = 250;
  const MQ_MOTION = "(prefers-reduced-motion: no-preference)";
  const MQ_DESKTOP = "(min-width: 861px) and (prefers-reduced-motion: no-preference)";
  const MQ_MOBILE = "(max-width: 860px) and (prefers-reduced-motion: no-preference)";
  const MQ_WHEEL = "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";
  const MQ_POINTER = "(min-width: 861px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

  // 演出用に追加する要素（幕・カーソルなど）。片付けるときは戻り値の関数を呼ぶ
  function addNode(parent, className, tag = "span") {
    const node = document.createElement(tag);
    node.className = className;
    node.setAttribute("aria-hidden", "true");
    parent.append(node);
    return node;
  }

  // ---------- 共通の部品 ----------
  const hasTargets = (t) => Boolean(t) && (t.nodeType === 1 || t.length > 0);

  const timeline = (trigger, start = START) =>
    gsap.timeline({ defaults: { ease: EASE }, scrollTrigger: { trigger, start, once: true } });

  // 少し下（または横）から浮かび上がる
  function rise(tl, targets, at, { y = 36, x = 0, duration = 1.2, stagger = 0 } = {}) {
    if (!hasTargets(targets)) return;
    tl.fromTo(
      targets,
      { opacity: 0, y, x },
      { opacity: 1, y: 0, x: 0, duration, stagger, clearProps: "transform,opacity" },
      at
    );
  }

  // 見出し：見えない枠の下から文字がせり上がる（clip-path を移動量に合わせて開く）
  function maskUp(tl, el, at, duration = 1.3) {
    if (!el) return;
    tl.fromTo(
      el,
      { yPercent: 100, clipPath: "inset(-5% -5% 100% -5%)" },
      { yPercent: 0, clipPath: "inset(-5% -5% -5% -5%)", duration, ease: EASE_HEAD, clearProps: "transform,clipPath" },
      at
    );
  }

  // 区切り線：左から右へ伸びる
  function line(tl, el, at) {
    if (!el) return;
    tl.fromTo(
      el,
      { scaleX: 0, transformOrigin: "left center" },
      { scaleX: 1, duration: 1.3, ease: EASE_LINE, clearProps: "transform" },
      at
    );
  }

  // 飾り罫（ひし形つき）：形を歪めないよう、左から右へ切り出して見せる
  function wipe(tl, el, at) {
    if (!el) return;
    tl.fromTo(
      el,
      { clipPath: "inset(0% 100% 0% 0%)" },
      { clipPath: "inset(0% 0% 0% 0%)", duration: 1.6, ease: "power2.inOut", clearProps: "clipPath" },
      at
    );
  }

  const isPlainLatin = (el) =>
    el.children.length === 0 && /^[\x20-\x7E]{2,40}$/.test(el.textContent.trim());

  // 文字を 1 文字ずつの span に分ける（単語の途中で折り返さないよう単語ごとに包む）
  function splitChars(el) {
    const text = el.textContent.trim();
    const words = text.split(/\s+/).map((word) => {
      const wrap = document.createElement("span");
      wrap.className = "m-word";
      wrap.setAttribute("aria-hidden", "true");
      const chars = Array.from(word).map((ch) => {
        const span = document.createElement("span");
        span.className = "m-ch";
        span.textContent = ch;
        return span;
      });
      wrap.append(...chars);
      return { wrap, chars };
    });
    // 読み上げ用に元の文字列を残す（<p> では aria-label が無視されるため、見えない span で持つ）
    const label = document.createElement("span");
    label.className = "m-sr";
    label.textContent = text;
    el.replaceChildren(label, ...words.flatMap(({ wrap }, i) => (i === 0 ? [wrap] : [" ", wrap])));
    return words.flatMap(({ chars }) => chars);
  }

  // 英字見出し：広めの字間から、本来の字間へ静かに落ち着く（transform で表現）
  function tracking(tl, el, at) {
    const style = getComputedStyle(el);
    const centered = style.textAlign === "center";
    const fontSize = parseFloat(style.fontSize) || 16;
    const chars = splitChars(el);
    el.classList.add("m-track");
    const unit = fontSize * Math.min(0.28, 3 / chars.length);
    const mid = centered ? (chars.length - 1) / 2 : 0;
    tl.fromTo(
      chars,
      { opacity: 0, x: (i) => (i - mid) * unit },
      {
        opacity: 1,
        x: 0,
        duration: 1.6,
        ease: "power2.out",
        stagger: { each: 0.025, from: centered ? "center" : "start" },
      },
      at
    );
  }

  // <br> で区切られた文章を 1 行ずつの span に分ける（クラス付きの <br> は画面幅で切り替わるので行の中に残す）
  function splitLines(el) {
    const groups = Array.from(el.childNodes)
      .reduce(
        (acc, node) =>
          node.nodeName === "BR" && !node.className
            ? [...acc, []]
            : [...acc.slice(0, -1), [...acc[acc.length - 1], node]],
        [[]]
      )
      .filter((nodes) => nodes.length);
    // 外側（m-line）が見えない枠、内側（m-line__in）が下からせり上がる
    const lines = groups.map((nodes) => {
      const line = document.createElement("span");
      const inner = document.createElement("span");
      line.className = "m-line";
      inner.className = "m-line__in";
      inner.append(...nodes);
      line.append(inner);
      return { line, inner };
    });
    el.replaceChildren(...lines.map(({ line }) => line));
    return lines.map(({ inner }) => inner);
  }

  // 本文：1 行ずつ、枠の下からせり上がる
  function linesUp(tl, el, at) {
    tl.fromTo(
      splitLines(el),
      { yPercent: 100 },
      { yPercent: 0, duration: 1.2, ease: EASE_HEAD, stagger: 0.16, clearProps: "transform" },
      at
    );
  }

  // 見出しまわりの子要素を、種類に合った動きで順番に出す
  function headChild(tl, el, at) {
    if (el.matches(".overview__lead")) return linesUp(tl, el, at);
    if (el.matches('[class*="rule"]')) return line(tl, el, at);
    if (el.matches('[class*="orn"]')) return wipe(tl, el, at);
    if (isPlainLatin(el)) return tracking(tl, el, at);
    if (el.matches('[class*="title"]')) return maskUp(tl, el, at);
    return rise(tl, el, at, { y: 16 });
  }

  function headGroup(el, interval = 0.14, start = START) {
    const tl = timeline(el, start);
    Array.from(el.children).forEach((child, i) => headChild(tl, child, i * interval));
  }

  // ---------- セクションごとの動き ----------
  function rankRow(row) {
    const tl = timeline(row);
    rise(tl, row.querySelector(".rank-row__media"), 0, { y: 36, duration: 1.4 });
    rise(tl, row.querySelectorAll(".rank-row__info > *"), 0.25, { y: 18, duration: 1.1, stagger: 0.09 });
  }

  function overviewFacts(list) {
    rise(timeline(list), list.children, 0, { y: 34, duration: 1.3, stagger: 0.16 });
  }

  function statement(inner) {
    const tl = timeline(inner, "top 82%");
    maskUp(tl, inner.querySelector(".statement__head"), 0, 1.5);
    rise(tl, inner.querySelector(".statement__body"), 0.45, { y: 20, duration: 1.4 });
  }

  function howto(section) {
    const tl = timeline(section.querySelector(".howto__head") || section);
    maskUp(tl, section.querySelector(".howto__eyebrow"), 0);
    rise(tl, section.querySelectorAll(".howto__strip-img"), 0.3, { y: 32, duration: 1.3, stagger: 0.14 });
    const split = section.querySelector(".howto__split");
    if (split) rise(timeline(split), split, 0, { y: 20, duration: 1.3 });
  }

  // 横に並ぶカードは、横から少しずつ寄せて出す
  function topicCards(cards) {
    rise(timeline(cards[0].parentElement), cards, 0, { y: 0, x: 36, duration: 1.3, stagger: 0.1 });
  }

  function about(inner) {
    const tl = timeline(inner, "top 82%");
    maskUp(tl, inner.querySelector(".about__head"), 0, 1.4);
    rise(tl, inner.querySelector('[data-site-about="body"]'), 0.4, { y: 22, duration: 1.4 });
  }

  function footer(el) {
    rise(timeline(el, "top 96%"), el.children, 0, { y: 0, duration: 1.4, stagger: 0.12 });
  }

  const each = (fn) => (els) => els.forEach((el) => fn(el));

  const REVEALS = [
    [".section-head", each((el) => headGroup(el))],
    // ABOUT は固定中の FV に重ねてあり、写真の上にせり上がってくる。画面に入ったらすぐ出す
    [".overview__head", each((el) => headGroup(el, 0.14, "top 94%"))],
    [".mailmag__inner", each((el) => headGroup(el, 0.16))],
    ["body.home .section-more", each((el) => rise(timeline(el), el, 0, { y: 16 }))],
    [".rank-row", each(rankRow)],
    [".overview__facts", each(overviewFacts)],
    [".overview__sign", each((el) => isPlainLatin(el) && tracking(timeline(el), el, 0))],
    [".statement__inner", each(statement)],
    [".howto", each(howto)],
    [".topic-card", topicCards],
    [".about__inner", each(about)],
    [".store-card", each((el) => rise(timeline(el), el, 0, { y: 30, duration: 1.3 }))],
    [".footer", each(footer)],
  ];

  // 写真：枠（overflow: hidden）は動かさず、中の画像だけをゆっくり動かす
  const PARALLAX = [
    [".statement__bg, .about__bg", { scale: 1.12, shift: 5 }],
    [".store-card__media img, .news-feature__media img", { scale: 1.06, shift: 2.5 }],
    // 商品写真：わずかに寄った状態から引いていく。質感が主役なので動きは最小限
    [".rank-row__media img", { scale: 1.1, scaleTo: 1.05, shift: 2 }],
  ];

  function parallax(img, { scale, scaleTo = scale, shift }) {
    gsap.fromTo(
      img,
      { yPercent: -shift, scale },
      {
        yPercent: shift,
        scale: scaleTo,
        ease: "none",
        scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: 0.6 },
      }
    );
  }

  // ---------- メインビジュアル ----------
  // 表示時：暗い幕に小さなロゴ → 幕が中央から上下に開く → 写真が引く → タイトルが 1 文字ずつ現れる
  function heroIntro() {
    const hero = document.querySelector(".hero");
    if (!hero) return () => {};
    const q = gsap.utils.selector(hero);
    const brand = q(".hero__brand")[0];
    const header = document.getElementById("header");
    const blur = window.matchMedia("(min-width: 861px)").matches ? "blur(12px)" : "blur(0px)";

    const intro = addNode(document.body, "m-intro", "div");
    const top = addNode(intro, "m-intro__half m-intro__half--top");
    const bottom = addNode(intro, "m-intro__half m-intro__half--bottom");
    const logo = addNode(intro, "m-intro__logo");
    logo.textContent = "SATSUMA NOIR";

    const tl = gsap.timeline({ defaults: { ease: EASE }, onComplete: () => intro.remove() });

    // 1〜2：暗い画面に小さなロゴ
    tl.fromTo(logo, { opacity: 0, scaleX: 1.12 }, { opacity: 1, scaleX: 1, duration: 1.1, ease: "power2.out" }, 0.2);
    // 3：幕が中央から上下に開き、写真が現れる
    tl.to([top, bottom], { scaleY: 0, duration: 1.5, ease: EASE_WIPE }, 1.1);
    // 4：写真は寄った状態からゆっくり引く（CSS 変数で動かし、スクロール連動の transform と分ける）
    tl.fromTo(q(".hero__track"), { "--hero-zoom": 1.15 }, { "--hero-zoom": 1, duration: 2.8, ease: "power2.out" }, 1.1);
    tl.to(logo, { opacity: 0, duration: 0.5, ease: "power1.in" }, 1.7);
    // 5：タイトルは 1 文字ずつ、ぼけた状態から下からせり上がる
    if (brand) {
      // スクロールで字間を広げるとき用に、中央からの位置を各文字に持たせる
      const chars = splitChars(brand);
      const mid = (chars.length - 1) / 2;
      chars.forEach((ch, i) => ch.style.setProperty("--i", String(i - mid)));
      // SATSUMA は左へ、NOIR は右へ分かれる
      brand.querySelectorAll(".m-word").forEach((word, i) => word.style.setProperty("--dir", i === 0 ? "-1" : "1"));
      tl.fromTo(
        chars,
        { opacity: 0, yPercent: 60, filter: blur },
        { opacity: 1, yPercent: 0, filter: "blur(0px)", duration: 1.3, ease: EASE_HEAD, stagger: 0.045, clearProps: "filter" },
        1.9
      );
    }
    // 6：残りを少しずつ
    line(tl, q(".hero__rule")[0], 2.4);
    rise(tl, q(".hero__sub"), 2.55, { y: 16, duration: 1 });
    rise(tl, q(".hero__tagline"), 2.7, { y: 16, duration: 1 });
    if (header) {
      tl.fromTo(header, { opacity: 0, y: -14 }, { opacity: 1, y: 0, duration: 1.1, clearProps: "transform,opacity" }, 2.6);
    }
    tl.fromTo(
      q(".hero__side, .hero__news, .hero__dots, .hero__scroll"),
      { opacity: 0 },
      { opacity: 1, duration: 0.9, stagger: 0.08, clearProps: "opacity" },
      2.8
    );

    // 途中で操作されたら早送りして、待たせない
    const skip = () => tl.timeScale(INTRO_SKIP_SCALE);
    const events = ["wheel", "touchstart", "keydown", "pointerdown"];
    events.forEach((type) => window.addEventListener(type, skip, { once: true, passive: true }));

    return () => {
      events.forEach((type) => window.removeEventListener(type, skip));
      intro.remove();
    };
  }

  // スクロール：メインビジュアルを固定し、1 本のタイムラインで ABOUT へつなぐ。
  //   UI が消える → SATSUMA / NOIR が左右に分かれる → 中央へ寄りながらぼやける → 暗くなって濃茶 → ABOUT が重なる
  // 文字まわりは CSS 変数で動かす（表示時のイントロと同じプロパティを取り合わないため）。
  // 毎フレーム動かすのは transform と opacity だけ。ぼかしは「あらかじめぼかした写真」を重ねて濃くしていく
  // （ぼかしの量そのものを動かすと、全画面を毎フレーム計算し直すことになり重い）
  const DIM_DURING_ZOOM = 0.82; // ズームの終わりまでに重ねておく暗さ（中央の明るい断面を目立たせない）

  function heroPin({ distance, zoom, spread, baseScale }) {
    const hero = document.querySelector(".hero");
    if (!hero) return () => {};
    const track = hero.querySelector(".hero__track");
    const header = document.getElementById("header");
    const soft = addNode(hero, "m-soft");
    const vignette = addNode(hero, "m-scene m-scene--vignette");
    const brown = addNode(hero, "m-scene m-scene--void");
    const morph = addNode(hero, "m-scene m-scene--about");

    // ぼかした写真には、いま表示中のスライドを使う
    const syncSoft = () => {
      const slides = track.querySelectorAll(".hero__img");
      const current = slides[Math.round(track.scrollLeft / Math.max(track.clientWidth, 1))] || slides[0];
      const image = current ? `url("${current.currentSrc || current.src}")` : "";
      if (soft.style.backgroundImage !== image) soft.style.backgroundImage = image;
    };
    syncSoft();

    gsap.set([track, soft], { scale: baseScale });
    const tl = gsap
      .timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: hero,
          start: "top top",
          end: `+=${distance}%`,
          pin: true,
          scrub: 0.25, // スクロールへの追従を速めに
          anticipatePin: 1,
          // 固定で増える高さを、先に作った下のセクションの位置にも反映させるため、最初に測り直す
          refreshPriority: 1,
          onEnter: syncSoft,
          // 場面の間はヘッダーを退かせる（ABOUT が現れるころに戻す）
          onUpdate: (self) =>
            header && header.classList.toggle("is-away", self.progress > 0.02 && self.progress < 0.9),
        },
      })
      // スクロールし始めた瞬間からズームが動く（待ち時間を作らない。速さは一定）
      .fromTo([track, soft], { scale: baseScale }, { scale: zoom, duration: 0.76, immediateRender: false }, 0)
      // 0〜8%：補助の文字とコピーが消え、タイトルだけが残る
      .fromTo(hero, { "--hero-fade": 1 }, { "--hero-fade": 0, duration: 0.07 }, 0)
      .fromTo(hero, { "--hero-sub": 1 }, { "--hero-sub": 0, duration: 0.07 }, 0.01)
      // 3〜26%：SATSUMA は左へ、NOIR は右へ。字間も少し開く
      .fromTo(hero, { "--hero-spread": "0px" }, { "--hero-spread": `${spread}px`, duration: 0.24 }, 0.02)
      .fromTo(hero, { "--hero-split": "0vw" }, { "--hero-split": "75vw", duration: 0.22, ease: "power1.in" }, 0.03)
      .fromTo(hero, { "--hero-title": 1 }, { "--hero-title": 0, duration: 0.05 }, 0.22)
      // 8〜45%：ぼかした写真を濃くしていく（寄るほどぼやける）
      .fromTo(soft, { opacity: 0 }, { opacity: 1, duration: 0.37, ease: "power1.in" }, 0.08)
      // 周辺から暗くなり、全体も暗くなっていく。
      // このあたり（約 30% 以降）から、ABOUT が写真の上にせり上がってくる（styles.css の .overview の margin-top）
      .fromTo(vignette, { opacity: 0, scale: 2.2 }, { opacity: 1, scale: 1, duration: 0.34, ease: "power1.in" }, 0.14)
      .fromTo(brown, { opacity: 0 }, { opacity: DIM_DURING_ZOOM, duration: 0.45 }, 0.1)
      // 60〜74%：ABOUT の見出しが画面の中ほどに来るのに合わせて、背景が一色になる。
      // 何もない一色の画面は作らない
      .to(brown, { opacity: 1, duration: 0.14, ease: "power1.inOut" }, 0.6)
      .fromTo(morph, { opacity: 0 }, { opacity: 1, duration: 0.08 }, 0.66)
      .to({}, { duration: 0.26 });

    return () => {
      tl.kill();
      if (header) header.classList.remove("is-away");
      [soft, vignette, brown, morph].forEach((node) => node.remove());
    };
  }

  // マウス連動：写真はマウスと逆へ最大 14px、タイトルは同じ向きへ最大 6px。動いたときだけ処理する
  function heroPointer() {
    const hero = document.querySelector(".hero");
    if (!hero) return () => {};
    const q = gsap.utils.selector(hero);
    const drift = (nx, ny) => {
      gsap.to(q(".hero__track"), {
        "--hero-mx": `${-nx * 28}px`,
        "--hero-my": `${-ny * 20}px`,
        duration: 1.4,
        ease: EASE,
        overwrite: "auto",
      });
      gsap.to(q(".hero__center"), {
        "--hero-tx": `${nx * 12}px`,
        "--hero-ty": `${ny * 8}px`,
        duration: 1.4,
        ease: EASE,
        overwrite: "auto",
      });
    };
    const onMove = (e) => drift(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
    const onLeave = () => drift(0, 0);
    hero.addEventListener("mousemove", onMove, { passive: true });
    hero.addEventListener("mouseleave", onLeave);
    return () => {
      hero.removeEventListener("mousemove", onMove);
      hero.removeEventListener("mouseleave", onLeave);
    };
  }

  // ---------- マウスホイールの段差をならす（PC のみ） ----------
  // ホイール付きマウスは 1 目盛りごとに大きく飛ぶので、目標位置まで少しずつ追いかけて滑らかにする。
  // トラックパッド（もともと細かく滑らか）、拡大操作、入れ子のスクロール領域には手を出さない。
  // 動いている間だけ処理し、目標に着いたら止める
  const WHEEL_LINE_PX = 40; // 行単位で届く環境での 1 行ぶん
  const WHEEL_NOTCH = 120; // ホイール 1 目盛りの単位（トラックパッドはこの倍数にならない）
  const WHEEL_BIG_DELTA = 50;
  const WHEEL_FOLLOW_RATE = 9; // 大きいほど速く追いつく

  const isSteppedWheel = (e) =>
    e.deltaMode === 1 ||
    Math.abs(e.deltaY) >= WHEEL_BIG_DELTA ||
    (Boolean(e.wheelDeltaY) && Math.abs(e.wheelDeltaY) % WHEEL_NOTCH === 0);

  // 自分で縦スクロールできる祖先（ドロワーやモーダルなど）の中か
  function insideScroller(node) {
    for (let el = node; el && el !== document.body; el = el.parentElement) {
      if (el.nodeType !== 1 || el.scrollHeight <= el.clientHeight) continue;
      const overflowY = getComputedStyle(el).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") return true;
    }
    return false;
  }

  function smoothWheel() {
    let target = window.scrollY;
    let current = target;
    let running = false;
    const limit = () => document.documentElement.scrollHeight - window.innerHeight;

    const follow = (time, deltaTime) => {
      current += (target - current) * (1 - Math.exp((-deltaTime / 1000) * WHEEL_FOLLOW_RATE));
      if (Math.abs(target - current) < 0.5) {
        current = target;
        running = false;
        gsap.ticker.remove(follow);
      }
      window.scrollTo(0, current);
    };

    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (!running && !isSteppedWheel(e)) return;
      if (insideScroller(e.target)) return;
      e.preventDefault();
      if (!running) {
        current = window.scrollY;
        target = current;
      }
      const delta = e.deltaMode === 1 ? e.deltaY * WHEEL_LINE_PX : e.deltaY;
      target = Math.min(Math.max(target + delta, 0), limit());
      if (!running) {
        running = true;
        gsap.ticker.add(follow);
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
      gsap.ticker.remove(follow);
    };
  }

  // ---------- カーソル（PC のみ） ----------
  // 上から順に判定する：[対象, 状態のクラス, 表示する文字]
  const CURSOR_STATES = [
    ["input, textarea, select, iframe", "is-hidden", ""],
    [".topics__row", "is-label", "DRAG"],
    [".rank-row__media, .card__media, .store-card__media, .news-feature__media", "is-label", "VIEW"],
    ["a, button, [data-href], label", "is-link", ""],
  ];

  function cursor() {
    const el = addNode(document.body, "m-cursor", "div");
    addNode(el, "m-cursor__ring");
    const label = addNode(el, "m-cursor__label");
    // 標準のカーソルはそのまま残し、輪はリンクや写真の上でだけ添える（操作のしやすさを優先）
    const xTo = gsap.quickTo(el, "x", { duration: 0.18, ease: "power2.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.18, ease: "power2.out" });

    const onMove = (e) => {
      xTo(e.clientX);
      yTo(e.clientY);
      el.classList.add("is-on");
    };
    const onOver = (e) => {
      const target = e.target.nodeType === 1 ? e.target : null;
      const hit = target && CURSOR_STATES.find(([selector]) => target.closest(selector));
      CURSOR_STATES.forEach(([, state]) => el.classList.toggle(state, Boolean(hit) && hit[1] === state));
      const text = hit ? hit[2] : "";
      if (label.textContent !== text) label.textContent = text;
    };
    const onOut = () => el.classList.remove("is-on");

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseover", onOver, { passive: true });
    root.addEventListener("mouseleave", onOut);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      root.removeEventListener("mouseleave", onOut);
      el.remove();
    };
  }

  // ---------- あとから描画される要素への対応 ----------
  // 条件（画面幅など）ごとに「未処理の要素を探して動きを付ける関数」を登録する
  let scanners = [];
  let refreshTimer = null;

  function createScanner(context, recipes) {
    const bound = new WeakSet();
    const fresh = (selector) => {
      const els = Array.from(document.querySelectorAll(selector)).filter((el) => !bound.has(el));
      els.forEach((el) => bound.add(el));
      return els;
    };
    // 戻り値は、新しく動きを付けた要素の数
    return () => {
      const found = recipes.map(([selector, bind]) => [fresh(selector), bind]).filter(([els]) => els.length);
      if (found.length) context.add(() => found.forEach(([els, bind]) => bind(els)));
      return found.reduce((sum, [els]) => sum + els.length, 0);
    };
  }

  function register(scan) {
    scanners = [...scanners, scan];
    scan();
    return () => {
      scanners = scanners.filter((s) => s !== scan);
    };
  }

  // 再描画で DOM から外れた要素の ScrollTrigger を片付ける。戻り値は片付けた数
  function dropDetached() {
    const stale = ScrollTrigger.getAll().filter((t) => t.trigger && !t.trigger.isConnected);
    stale.forEach((t) => {
      if (t.animation) t.animation.kill();
      t.kill();
    });
    return stale.length;
  }

  // 演出用に足した要素（m- で始まるクラス）の中の変化は無視する
  const isOwnNode = (node) => {
    const el = node.nodeType === 1 ? node : node.parentElement;
    return Boolean(el) && Boolean(el.closest('[class^="m-"], [class*=" m-"]'));
  };

  function watchDom() {
    let queued = false;
    const observer = new MutationObserver((records) => {
      if (queued || records.every((r) => isOwnNode(r.target))) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const changed = dropDetached() + scanners.reduce((sum, scan) => sum + scan(), 0);
        // 位置の測り直しは重く、スクロール中に走ると引っかかるので、対象が増減したときだけ行う
        if (!changed) return;
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => ScrollTrigger.refresh(), REFRESH_DELAY_MS);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ---------- ページ切り替え ----------
  // 幕（html::after）が画面を覆ってから次のページへ移る。表示側は幕が引いて現れる。
  // ページが切り替わらない移動先（別オリジン、http(s) 以外、ハッシュだけの違い）では幕を出さない
  function changesPage(href) {
    try {
      const url = new URL(href, location.href);
      const samePage = url.pathname === location.pathname && url.search === location.search;
      return /^https?:$/.test(url.protocol) && url.origin === location.origin && !samePage;
    } catch (e) {
      return false;
    }
  }

  function leave(href) {
    if (!root.classList.contains("has-motion") || !changesPage(href)) return false;
    root.classList.add("is-leaving");
    setTimeout(() => {
      window.location.href = href;
    }, LEAVE_MS);
    // 移動が中止されたときに幕が残らないようにする
    setTimeout(() => root.classList.remove("is-leaving"), LEAVE_MS + LEAVE_GUARD_MS);
    return true;
  }

  // 「戻る」で復元されたページに幕が残らないようにする
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) root.classList.remove("is-leaving");
  });

  // ---------- 初期化 ----------
  const mm = gsap.matchMedia();

  try {
    mm.add(MQ_MOTION, (context) => {
      const stopIntro = heroIntro();
      const unregister = register(createScanner(context, REVEALS));
      return () => {
        stopIntro();
        unregister();
      };
    });

    mm.add(MQ_DESKTOP, (context) => {
      const unpin = heroPin({ distance: 140, zoom: 3.2, spread: 10, baseScale: 1.04 });
      const recipes = PARALLAX.map(([selector, opts]) => [selector, each((img) => parallax(img, opts))]);
      const unregister = register(createScanner(context, recipes));
      return () => {
        unpin();
        unregister();
      };
    });

    // モバイル：固定する長さとズームを抑える
    mm.add(MQ_MOBILE, () => heroPin({ distance: 130, zoom: 2.2, spread: 3, baseScale: 1 }));

    mm.add(MQ_WHEEL, () => smoothWheel());

    mm.add(MQ_POINTER, () => {
      const stopPointer = heroPointer();
      const stopCursor = cursor();
      return () => {
        stopPointer();
        stopCursor();
      };
    });

    watchDom();
    window.Motion = { leave };
  } catch (error) {
    // 途中で失敗したら、入れた初期状態をすべて戻して動きなしで表示する
    console.error("アニメーションの初期化に失敗しました:", error);
    mm.revert();
    root.classList.remove("has-motion");
    window.Motion = { leave: () => false };
    return;
  }

  // 初期状態を入れ終えてから幕を引く
  requestAnimationFrame(() => root.classList.add("is-entered"));
})();
