(function () {
  "use strict";

  var CATEGORIES = {
    ao: { label: "Áo", icon: '<path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3a3 3 0 0 1-8 0Z"/>' },
    quan: { label: "Quần", icon: '<path d="M6 3h12l1 18h-5l-2-11-2 11H5L6 3Z"/><path d="M6 7h12"/>' },
    giay: { label: "Giày", icon: '<path d="M2 17v-6l5-3 3 3c2 1 5 1 7 2l4 1.5V17H2Z"/><path d="M2 17h19"/>' },
    phukien: { label: "Phụ kiện", icon: '<path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>' }
  };
  var SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
  var ICON = {
    bag: '<path d="M5 8h14l-1 13H6L5 8Z" fill="currentColor" stroke="none"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    heart: '<path d="M12 20s-7-4.4-9-9a4.6 4.6 0 0 1 9-3 4.6 4.6 0 0 1 9 3c-2 4.6-9 9-9 9Z"/>',
    share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6h14v-6"/>',
    play: '<path d="M8 5v14l11-7Z" fill="currentColor" stroke="none"/>',
    ruler: '<path d="M3 17 17 3l4 4L7 21Z"/><path d="m7 13 2 2m1-5 2 2m1-5 2 2"/>'
  };

  function svg(paths, cls) {
    return '<svg class="' + (cls || "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">' + paths + "</svg>";
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // Bỏ dấu tiếng Việt để tìm "giay" vẫn ra "giày"
  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
  }
  function money(n) { return n ? n.toLocaleString("vi-VN") + "đ" : ""; }
  function meters(cm) { return (cm / 100).toFixed(2).replace(".", "m"); }
  function sizeRank(s) {
    var i = SIZE_ORDER.indexOf(String(s).toUpperCase());
    if (i >= 0) return i;
    var n = parseFloat(s);
    return isNaN(n) ? 999 : 100 + n;
  }
  function store(key, val) {
    try {
      if (val === undefined) return JSON.parse(localStorage.getItem(key) || "null");
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { return null; }
  }

  var state = { q: "", part: "", cat: "", gender: "", height: "", weight: "", sizes: [], sort: "new", saved: false, style: "" };
  var data = { videos: [], products: [] };
  var videoByPart = {}, byId = {};
  var favs = store("mt-favs") || [];
  var $ = function (id) { return document.getElementById(id); };

  function bodyGiven() { return !!(parseFloat(state.height) || parseFloat(state.weight)); }

  // Size gợi ý từ bảng size của sản phẩm
  function recommendSize(p) {
    var h = parseFloat(state.height), w = parseFloat(state.weight);
    if (!p.sizeChart || !p.sizeChart.length || (!h && !w)) return null;
    function dist(v, r) { return !v || !r ? 0 : v < r[0] ? r[0] - v : v > r[1] ? v - r[1] : 0; }
    var best = null, bestScore = Infinity;
    p.sizeChart.forEach(function (c) {
      var score = dist(h, c.height) / 5 + dist(w, c.weight) / 3; // lệch 5cm ~ lệch 3kg
      if (score < bestScore) { bestScore = score; best = c.size; }
    });
    return bestScore <= 2 ? best : null;
  }

  function fitsBody(p) {
    if (!p.fit) return true;
    var h = parseFloat(state.height), w = parseFloat(state.weight);
    if (h && p.fit.height && (h < p.fit.height[0] || h > p.fit.height[1])) return false;
    if (w && p.fit.weight && (w < p.fit.weight[0] || w > p.fit.weight[1])) return false;
    return true;
  }

  function styleOf(p) {
    var v = videoByPart[p.part] || {};
    return (p.style || []).concat(v.style || []);
  }

  function matches(p) {
    if (state.style && styleOf(p).indexOf(state.style) < 0) return false;
    if (state.saved && favs.indexOf(p.id) < 0) return false;
    if (state.part && String(p.part) !== state.part) return false;
    if (state.cat && p.category !== state.cat) return false;
    if (state.gender && p.gender !== state.gender && p.gender !== "unisex") return false;
    if (state.sizes.length) {
      var ps = (p.sizes || []).map(function (s) { return String(s).toUpperCase(); });
      if (!state.sizes.some(function (s) { return ps.indexOf(s) >= 0; })) return false;
    }
    if (bodyGiven() && !fitsBody(p)) return false;
    if (state.q) {
      var q = norm(state.q).trim();
      if (/^(phan\s*)?\d+$/.test(q)) return String(p.part) === q.replace(/\D/g, "");
      var v = videoByPart[p.part] || {};
      var hay = norm([p.name, "phan " + p.part, (CATEGORIES[p.category] || {}).label, (p.style || []).join(" "), v.title, (v.style || []).join(" ")].join(" "));
      if (!q.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; })) return false;
    }
    return true;
  }

  function filtersActive() {
    return !!(state.style || state.q || state.part || state.cat || state.saved || state.sizes.length || state.gender || bodyGiven());
  }

  function thumb(p, big) {
    var cat = CATEGORIES[p.category] || CATEGORIES.phukien;
    return p.image
      ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">'
      : svg(cat.icon, "ph") + (big ? "" : '<span class="ph-note">Chưa có ảnh</span>');
  }
  var REL = ' target="_blank" rel="nofollow sponsored noopener"';

  function card(p) {
    var rec = recommendSize(p);
    var fav = favs.indexOf(p.id) >= 0;
    var sizes = (p.sizes || []).length ? "Size " + p.sizes.join(" · ") : "";
    return '<article class="card" data-open="' + esc(p.id) + '">' +
      '<div class="thumb">' + thumb(p) +
      '<button class="fav" type="button" data-fav="' + esc(p.id) + '" aria-pressed="' + fav + '" aria-label="Lưu sản phẩm">' + svg(ICON.heart) + "</button>" +
      (rec ? '<span class="rec">Size hợp bạn: ' + esc(rec) + "</span>" : "") + "</div>" +
      '<h3 class="name"><button type="button" class="name-btn" data-open="' + esc(p.id) + '">' + esc(p.name) + "</button></h3>" +
      '<div class="price-row"><span class="price">' + money(p.price) + '</span><span class="size-list">' + esc(sizes) + "</span></div>" +
      (p.shopee ? '<a class="btn shopee" href="' + esc(p.shopee) + '"' + REL + ">" + svg(ICON.bag) + "Xem trên Shopee</a>" : "") +
      "</article>";
  }

  function partMeta(v) {
    var meta = "";
    if (v.title) meta += '<span class="title">' + esc(v.title) + "</span>";
    if (v.model && (v.model.height || v.model.weight)) {
      meta += "<span>Mẫu " + (v.model.height ? meters(v.model.height) : "") + (v.model.weight ? " · " + v.model.weight + "kg" : "") + "</span>";
    }
    (v.style || []).forEach(function (s) { meta += '<span class="tag">' + esc(s) + "</span>"; });
    return meta;
  }

  function sortItems(list) {
    if (state.sort === "low") return list.sort(function (a, b) { return (a.price || 0) - (b.price || 0); });
    if (state.sort === "high") return list.sort(function (a, b) { return (b.price || 0) - (a.price || 0); });
    return list;
  }

  // Dải "Video mới" chỉ hiện ở trang chủ (chưa lọc gì)
  function renderVideos() {
    var counts = {};
    data.products.forEach(function (p) { counts[p.part] = (counts[p.part] || 0) + 1; });
    var parts = Object.keys(counts).sort(function (a, b) { return b - a; }).slice(0, 12);
    return '<section class="strip"><div class="strip-head"><h2>Video mới</h2><span>Bấm để xem đồ trong video</span></div><div class="rail">' +
      parts.map(function (k) {
        var v = videoByPart[k] || {};
        return '<button type="button" class="vcard" data-part="' + k + '">' +
          (v.thumb ? '<img src="' + esc(v.thumb) + '" alt="" loading="lazy">' : "") +
          '<span class="vlabel">Phần</span><span class="vnum">' + k + "</span>" +
          '<span class="vtitle">' + esc(v.title || "") + '</span><span class="vcount">' + counts[k] + " món</span></button>";
      }).join("") + "</div></section>";
  }

  // Gợi ý outfit: các bộ (Phần + Ảnh) hợp dáng, xếp theo mẫu có dáng gần người xem nhất
  function renderLooksForYou() {
    var h = parseFloat(state.height), w = parseFloat(state.weight);
    if (!h && !w && !state.style) return "";
    var looks = {};
    data.products.forEach(function (p) {
      var key = p.part + "-" + (p.look || 1);
      (looks[key] = looks[key] || { part: p.part, look: p.look || 1, items: [] }).items.push(p);
    });
    var ranked = Object.keys(looks).map(function (k) {
      var L = looks[k], v = videoByPart[L.part] || {}, m = v.model || {};
      if (state.gender && L.items.some(function (p) { return p.gender !== state.gender && p.gender !== "unisex"; })) return null;
      if (state.style && !L.items.some(function (p) { return styleOf(p).indexOf(state.style) >= 0; })) return null;
      var clothes = L.items.filter(function (p) { return p.fit; });
      if ((h || w) && (!clothes.length || !clothes.every(fitsBody))) return null;
      var d = (m.height && h ? Math.abs(m.height - h) / 5 : 0) + (m.weight && w ? Math.abs(m.weight - w) / 3 : 0);
      return { L: L, v: v, d: d };
    }).filter(Boolean).sort(function (a, b) { return a.d - b.d; }).slice(0, 6);
    if (!ranked.length) return "";
    return '<section class="strip"><div class="strip-head"><h2>Gợi ý outfit cho bạn</h2><span>' +
      esc([h && meters(h), w && w + "kg", state.style].filter(Boolean).join(" · ")) + '</span></div><div class="rail">' +
      ranked.map(function (r) {
        var m = r.v.model || {};
        return '<button type="button" class="look" data-part="' + r.L.part + '" data-look="' + r.L.look + '">' +
          '<span class="look-imgs">' + r.L.items.slice(0, 4).map(function (p) { return '<span class="mini thumb">' + thumb(p, true) + "</span>"; }).join("") + "</span>" +
          '<span class="look-name">Phần ' + r.L.part + " · Ảnh " + r.L.look + "</span>" +
          '<span class="look-sub">' + (m.height ? "Mẫu " + meters(m.height) + (m.weight ? " · " + m.weight + "kg" : "") : esc(r.v.title || "")) + "</span></button>";
      }).join("") + "</div></section>";
  }

  function render() {
    var list = data.products.filter(matches);
    var html = "";
    var home = !state.q && !state.part && !state.cat && !state.saved && !state.sizes.length && !state.style;
    if (!state.part && !state.saved) html += renderLooksForYou();
    if (home) html += renderVideos();

    if (state.saved && !list.length) {
      html += '<div class="empty"><strong>Chưa lưu sản phẩm nào</strong>Bấm hình trái tim trên sản phẩm để lưu lại xem sau.</div>';
    } else if (!list.length) {
      html += '<div class="empty"><strong>Không tìm thấy sản phẩm phù hợp</strong>Thử bỏ bớt bộ lọc, hoặc gõ số phần trong video (ví dụ 104).</div>';
    } else if (state.sort !== "new" || state.saved) {
      html += '<div class="grid flat">' + sortItems(list.slice()).map(card).join("") + "</div>";
    } else {
      var parts = {};
      list.forEach(function (p) { (parts[p.part] = parts[p.part] || []).push(p); });
      html += Object.keys(parts).sort(function (a, b) { return b - a; }).map(function (k) {
        var items = parts[k], v = videoByPart[k] || {}, looks = {};
        items.forEach(function (p) { (looks[p.look || 1] = looks[p.look || 1] || []).push(p); });
        var meta = partMeta(v);
        var actions = '<button type="button" class="mini-btn" data-share="' + k + '">' + svg(ICON.share) + "Chia sẻ</button>";
        if (v.tiktok) actions = '<a class="mini-btn" href="' + esc(v.tiktok) + '" target="_blank" rel="noopener">' + svg(ICON.play) + "Xem video</a>" + actions;
        return '<section class="part" id="phan-' + esc(k) + '">' +
          '<div class="part-head"><h2>Phần ' + esc(k) + '</h2><div class="part-actions">' + actions + "</div></div>" +
          '<div class="part-meta">' + meta + '<span class="count">' + items.length + " sản phẩm</span></div>" +
          Object.keys(looks).sort(function (a, b) { return a - b; }).map(function (l) {
            return '<h3 class="look-title" id="phan-' + k + "-anh-" + l + '">Phần ' + esc(k) + " · Ảnh " + esc(l) + '</h3><div class="grid">' + looks[l].map(card).join("") + "</div>";
          }).join("") + "</section>";
      }).join("");
    }
    $("results").innerHTML = html;

    var np = {};
    list.forEach(function (p) { np[p.part] = 1; });
    np = Object.keys(np).length;
    $("summary").textContent = state.saved ? list.length + " sản phẩm đã lưu" : list.length + " sản phẩm" + (np > 1 ? " trong " + np + " phần" : "");

    var fitOn = !!(state.gender || bodyGiven() || state.sizes.length);
    $("fit").classList.toggle("on", fitOn);
    $("clearFit").hidden = !fitOn;
    $("fitSub").textContent = bodyGiven()
      ? "Đang hiện đồ vừa với " + [state.height && state.height + "cm", state.weight && state.weight + "kg"].filter(Boolean).join(", ") + ". Size gợi ý ghi trên từng món."
      : "Nhập chiều cao, cân nặng để xem đồ vừa với bạn và size nên chọn";
    updateSavedChip();
    $("savedToggle").setAttribute("aria-pressed", state.saved ? "true" : "false");
    $("clearAll").hidden = !filtersActive();
    writeUrl();
    store("mt-fit", { gender: state.gender, height: state.height, weight: state.weight });
  }
  function updateSavedChip() {
    $("savedToggle").querySelector("b").textContent = "Đã lưu" + (favs.length ? " (" + favs.length + ")" : "");
  }

  /* ---------- Chi tiết sản phẩm ---------- */
  function openSheet(id) {
    var p = byId[id];
    if (!p) return;
    var v = videoByPart[p.part] || {};
    var rec = recommendSize(p);
    var same = data.products.filter(function (x) { return x.part === p.part && (x.look || 1) === (p.look || 1) && x.id !== p.id; });
    var fitText = "";
    if (p.fit) {
      var parts = [];
      if (p.fit.height) parts.push("cao " + p.fit.height[0] + "–" + p.fit.height[1] + "cm");
      if (p.fit.weight) parts.push("nặng " + p.fit.weight[0] + "–" + p.fit.weight[1] + "kg");
      fitText = "Hợp người " + parts.join(", ");
    }
    var chart = "";
    if (p.sizeChart && p.sizeChart.length) {
      chart = '<div class="chart"><table><thead><tr><th>Size</th><th>Chiều cao</th><th>Cân nặng</th></tr></thead><tbody>' +
        p.sizeChart.map(function (c) {
          return "<tr" + (c.size === rec ? ' class="on"' : "") + "><td>" + esc(c.size) + "</td><td>" + (c.height ? c.height[0] + "–" + c.height[1] + "cm" : "") + "</td><td>" + (c.weight ? c.weight[0] + "–" + c.weight[1] + "kg" : "") + "</td></tr>";
        }).join("") + "</tbody></table></div>";
    }
    var recLine = "";
    if (rec) {
      recLine = '<p class="rec-line">' + svg(ICON.ruler) + "<span>Với " + [state.height && state.height + "cm", state.weight && state.weight + "kg"].filter(Boolean).join(", ") + " bạn nên chọn size <b>" + esc(rec) + "</b></span></p>";
    } else if (p.sizeChart && p.sizeChart.length) {
      recLine = '<p class="rec-line">' + svg(ICON.ruler) + '<span><button type="button" class="linkbtn" data-askfit="1">Nhập chiều cao, cân nặng</button> để được gợi ý size</span></p>';
    }
    var fav = favs.indexOf(p.id) >= 0;
    $("sheetBody").innerHTML =
      '<div class="sheet-img thumb">' + thumb(p, true) + "</div>" +
      '<div class="sheet-info">' +
      '<p class="eyebrow"><button type="button" class="linkbtn" data-goto="' + p.part + '">Phần ' + p.part + " · Ảnh " + (p.look || 1) + "</button>" + (v.title ? " · " + esc(v.title) : "") + "</p>" +
      '<h2 id="sheetTitle">' + esc(p.name) + "</h2>" +
      '<p class="sheet-price">' + money(p.price) + ' <span class="muted small">giá tham khảo, xem giá mới trên Shopee</span></p>' +
      ((p.sizes || []).length ? '<div class="sizes">' + p.sizes.map(function (s) { return '<span class="size" aria-pressed="' + (s === rec) + '">' + esc(s) + "</span>"; }).join("") + "</div>" : "") +
      recLine +
      (fitText ? '<p class="muted small">' + fitText + "</p>" : "") +
      chart +
      '<div class="sheet-actions">' +
      (p.shopee ? '<a class="btn shopee big" href="' + esc(p.shopee) + '"' + REL + ">" + svg(ICON.bag) + "Xem trên Shopee</a>" : "") +
      '<button type="button" class="btn outline" data-fav="' + esc(p.id) + '" aria-pressed="' + fav + '">' + svg(ICON.heart) + "<span>" + (fav ? "Đã lưu" : "Lưu") + "</span></button></div>" +
      "</div>" +
      (same.length ? '<div class="same"><h3>Cùng bộ trong video</h3>' + same.map(function (x) {
        return '<div class="same-row"><button type="button" class="same-open" data-open="' + esc(x.id) + '"><span class="mini thumb">' + thumb(x, true) + '</span><span class="same-name">' + esc(x.name) + "<small>" + money(x.price) + "</small></span></button>" +
          (x.shopee ? '<a class="btn shopee sm" href="' + esc(x.shopee) + '"' + REL + ">Shopee</a>" : "") + "</div>";
      }).join("") + "</div>" : "");
    $("sheet").hidden = false;
    document.body.classList.add("locked");
    $("sheetPanel").scrollTop = 0;
    $("sheetClose").focus();
  }
  function closeSheet() {
    $("sheet").hidden = true;
    document.body.classList.remove("locked");
  }

  /* ---------- URL ---------- */
  function readUrl() {
    var h = location.hash.match(/^#phan-(\d+)$/);
    if (h) state.part = h[1];
    try {
      var p = new URLSearchParams(location.search);
      if (p.get("phan")) state.part = p.get("phan");
      if (p.get("q")) state.q = p.get("q");
    } catch (e) {}
  }
  function writeUrl() {
    var hash = state.part ? "#phan-" + state.part : "";
    if (location.hash !== hash) {
      try { history.replaceState(null, "", hash || location.pathname + location.search); } catch (e) {}
    }
  }

  function toast(t) {
    var el = $("toast");
    el.textContent = t;
    el.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { el.hidden = true; }, 2200);
  }

  function setPart(k) {
    state.part = String(k || "");
    $("part").value = state.part;
    render();
    window.scrollTo({ top: 0 });
  }

  function toggleFav(id) {
    var i = favs.indexOf(id);
    if (i >= 0) favs.splice(i, 1); else favs.push(id);
    store("mt-favs", favs);
    toast(i >= 0 ? "Đã bỏ lưu" : "Đã lưu, xem lại ở mục Đã lưu");
    return i < 0;
  }

  /* ---------- Điều khiển ---------- */
  // Chỉ hiện size của danh mục đang chọn (áo S/M/L, giày 39/40...)
  function buildSizes() {
    var all = {};
    data.products.forEach(function (p) {
      if (state.cat && p.category !== state.cat) return;
      (p.sizes || []).forEach(function (s) { all[String(s).toUpperCase()] = 1; });
    });
    state.sizes = state.sizes.filter(function (s) { return all[s]; });
    var keys = Object.keys(all).sort(function (a, b) { return sizeRank(a) - sizeRank(b); });
    $("sizes").innerHTML = keys.length ? keys.map(function (s) {
      return '<button class="size" type="button" aria-pressed="' + (state.sizes.indexOf(s) >= 0) + '" data-size="' + esc(s) + '">' + esc(s) + "</button>";
    }).join("") : '<span class="muted small">Danh mục này không chia size</span>';
  }

  function focusFit() {
    $("fit").scrollIntoView({ behavior: "smooth", block: "center" });
    $("height").focus({ preventScroll: true });
  }
  function syncGender() {
    $("genderSeg").querySelectorAll("[data-g]").forEach(function (b) {
      b.setAttribute("aria-checked", b.getAttribute("data-g") === state.gender ? "true" : "false");
    });
  }
  function clearFit() {
    state.gender = state.height = state.weight = "";
    state.sizes = [];
    ["gender", "height", "weight"].forEach(function (id) { $(id).value = ""; });
    syncGender();
    $("sizes").querySelectorAll(".size").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
    render();
  }
  function share(k) {
    var url = location.origin + location.pathname + "#phan-" + k;
    if (navigator.share) {
      navigator.share({ title: "Đồ trong Phần " + k, url: url }).catch(function () {});
      return;
    }
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast("Đã copy link Phần " + k); }, function () { toast(url); });
    else toast(url);
  }

  function onClick(e) {
    var t;
    if ((t = e.target.closest("[data-fav]"))) {
      e.stopPropagation();
      var id = t.getAttribute("data-fav"), on = toggleFav(id);
      document.querySelectorAll('[data-fav="' + id + '"]').forEach(function (b) {
        b.setAttribute("aria-pressed", on ? "true" : "false");
        var s = b.querySelector("span");
        if (s) s.textContent = on ? "Đã lưu" : "Lưu";
      });
      updateSavedChip();
      if (state.saved) render();
      return;
    }
    if (e.target.closest("a")) return;
    if ((t = e.target.closest("[data-share]"))) { share(t.getAttribute("data-share")); return; }
    if ((t = e.target.closest("[data-goto]"))) { closeSheet(); setPart(t.getAttribute("data-goto")); return; }
    if ((t = e.target.closest("[data-askfit]"))) { closeSheet(); focusFit(); return; }
    if ((t = e.target.closest("[data-look]"))) {
      var part = t.getAttribute("data-part"), look = t.getAttribute("data-look");
      setPart(part);
      var el = document.getElementById("phan-" + part + "-anh-" + look);
      if (el) el.scrollIntoView({ block: "center" });
      return;
    }
    if ((t = e.target.closest("[data-part]"))) { setPart(t.getAttribute("data-part")); return; }
    if ((t = e.target.closest("[data-open]"))) openSheet(t.getAttribute("data-open"));
  }

  /* ---------- Hôm nay mặc gì? ---------- */
  // Từ khoá người xem hay gõ -> style trong dữ liệu
  var STYLE_WORDS = {
    "đi học": ["di hoc", "hoc", "truong", "sinh vien"],
    "hẹn hò": ["hen ho", "date", "hen", "gap crush"],
    "đi làm": ["di lam", "cong so", "van phong", "phong van"],
    "mùa đông": ["lanh", "mua dong", "ret", "troi lanh"],
    "basic": ["basic", "don gian", "toi gian"],
    "streetwear": ["street", "duong pho", "ca tinh", "ngau"],
    "hàn quốc": ["han quoc", "korea", "kieu han"],
    "nữ tính": ["nu tinh", "diu dang", "ngot ngao"]
  };
  var TRY_WORDS = ["áo thun", "áo khoác", "sơ mi", "hoodie", "polo", "quần jeans", "quần tây", "jogger", "kaki", "chân váy", "sneaker", "cao gót", "túi", "đồng hồ", "balo", "mũ"];

  function allStyles() {
    var seen = {}, out = [];
    data.videos.concat(data.products).forEach(function (x) {
      (x.style || []).forEach(function (s) { if (!seen[s]) { seen[s] = 1; out.push(s); } });
    });
    return out;
  }

  function parseAsk(text) {
    var t = norm(text), r = {};
    var m = t.match(/(\d)\s*m\s*(\d{1,2})/) || null;
    if (m) r.height = +m[1] * 100 + (m[2].length === 1 ? +m[2] * 10 : +m[2]);
    else if ((m = t.match(/(1\d\d)\s*(cm|phan)?/))) r.height = +m[1];
    if ((m = t.match(/(\d{2,3})\s*(kg|ky|ki|can|ky lo)/))) r.weight = +m[1];
    else if ((m = t.match(/nang\s*(\d{2,3})/))) r.weight = +m[1];
    if (/\b(nu|con gai|girl|ban gai)\b/.test(t)) r.gender = "nu";
    else if (/\b(nam|con trai|boy|ban trai)\b/.test(t)) r.gender = "nam";
    var styles = allStyles();
    styles.some(function (s) {
      var words = [norm(s)].concat(STYLE_WORDS[s] || []);
      if (words.some(function (w) { return new RegExp("(^|\\s)" + w + "(\\s|$|\\?|,)").test(t); })) { r.style = s; return true; }
      return false;
    });
    return r;
  }

  function runAsk(text) {
    var r = parseAsk(text);
    if (!r.height && !r.weight && !r.gender && !r.style) {
      // Không hiểu câu hỏi -> tìm theo chữ như ô tìm kiếm
      state.q = text.replace(/mặc gì|mac gi|\?/gi, "").trim();
      $("q").value = state.q;
      showAsk(null);
      render();
      return;
    }
    if (r.height) { state.height = String(r.height); $("height").value = state.height; }
    if (r.weight) { state.weight = String(r.weight); $("weight").value = state.weight; }
    state.gender = r.gender || "";
    $("gender").value = state.gender;
    syncGender();
    state.style = r.style || "";
    state.q = ""; $("q").value = "";
    if (state.part) { state.part = ""; $("part").value = ""; }
    showAsk(r);
    render();
    var target = document.querySelector("#results .strip") || $("results");
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showAsk(r) {
    var box = $("askResult");
    if (!r) { box.hidden = true; box.innerHTML = ""; return; }
    var tags = [];
    if (r.gender) tags.push(r.gender === "nu" ? "Nữ" : "Nam");
    if (r.height) tags.push(meters(r.height));
    if (r.weight) tags.push(r.weight + "kg");
    if (r.style) tags.push(r.style);
    box.innerHTML = "<span>Đang gợi ý cho:</span>" + tags.map(function (x) { return '<b class="tag">' + esc(x) + "</b>"; }).join("") +
      '<button type="button" class="linkbtn" id="askClear">Xoá</button>';
    box.hidden = false;
  }

  function buildAsk() {
    var styles = allStyles();
    var prompts = ["Cao 1m70, nặng 60kg mặc gì?"].concat(
      ["đi học", "hẹn hò", "đi làm", "mùa đông"].filter(function (s) { return styles.indexOf(s) >= 0; }).map(function (s) {
        return (s === "mùa đông" ? "Trời lạnh" : s.charAt(0).toUpperCase() + s.slice(1)) + " mặc gì?";
      })
    ).slice(0, 4);
    $("prompts").innerHTML = prompts.map(function (t) { return '<button type="button" class="prompt" data-ask="' + esc(t) + '">' + esc(t) + "</button>"; }).join("");
    var names = norm(data.products.map(function (p) { return p.name; }).join(" | "));
    var tries = TRY_WORDS.filter(function (w) { return names.indexOf(norm(w)) >= 0; }).slice(0, 8);
    $("tryRow").hidden = !tries.length;
    $("tryChips").innerHTML = tries.map(function (w) { return '<button type="button" class="try-chip" data-try="' + esc(w) + '">+ ' + esc(w) + "</button>"; }).join("");

    $("askForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var t = $("ask").value.trim();
      if (t) runAsk(t);
    });
    $("prompts").addEventListener("click", function (e) {
      var b = e.target.closest("[data-ask]");
      if (!b) return;
      $("ask").value = b.getAttribute("data-ask");
      runAsk($("ask").value);
    });
    $("tryChips").addEventListener("click", function (e) {
      var b = e.target.closest("[data-try]");
      if (!b) return;
      state.q = b.getAttribute("data-try");
      $("q").value = state.q;
      render();
    });
    $("askResult").addEventListener("click", function (e) {
      if (!e.target.closest("#askClear")) return;
      state.style = "";
      $("ask").value = "";
      showAsk(null);
      clearFit();
    });
  }

  function buildControls() {
    var partsList = {};
    data.products.forEach(function (p) { partsList[p.part] = 1; });
    var sel = $("part");
    sel.innerHTML = '<option value="">Tìm theo phần</option>' + Object.keys(partsList).sort(function (a, b) { return b - a; }).map(function (k) {
      var v = videoByPart[k];
      return '<option value="' + k + '">Phần ' + k + (v && v.title ? " – " + esc(v.title) : "") + "</option>";
    }).join("");
    sel.value = state.part;
    sel.addEventListener("change", function () { setPart(sel.value); });

    var chips = '<button class="chip" type="button" data-cat="" aria-pressed="true">Tất cả</button>';
    Object.keys(CATEGORIES).forEach(function (k) {
      chips += '<button class="chip" type="button" data-cat="' + k + '" aria-pressed="false">' + svg(CATEGORIES[k].icon) + CATEGORIES[k].label + "</button>";
    });
    chips += '<button class="chip" type="button" id="savedToggle" aria-pressed="false">' + svg(ICON.heart) + "<b>Đã lưu</b></button>";
    $("cats").innerHTML = chips;
    $("cats").addEventListener("click", function (e) {
      var b = e.target.closest("[data-cat]");
      if (!b) return;
      state.cat = b.getAttribute("data-cat");
      $("cats").querySelectorAll("[data-cat]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      buildSizes();
      render();
    });
    $("genderSeg").addEventListener("click", function (e) {
      var b = e.target.closest("[data-g]");
      if (!b) return;
      state.gender = b.getAttribute("data-g");
      $("gender").value = state.gender;
      syncGender();
      render();
    });
    $("savedToggle").addEventListener("click", function () { state.saved = !state.saved; render(); window.scrollTo({ top: 0 }); });

    buildSizes();
    $("sizes").addEventListener("click", function (e) {
      var b = e.target.closest("[data-size]");
      if (!b) return;
      var s = b.getAttribute("data-size"), i = state.sizes.indexOf(s);
      if (i >= 0) state.sizes.splice(i, 1); else state.sizes.push(s);
      b.setAttribute("aria-pressed", i >= 0 ? "false" : "true");
      render();
    });
    $("gender").value = state.gender;
    syncGender();
    if (state.sizes.length) $("sizeMore").open = true;
    ["height", "weight"].forEach(function (id) {
      var el = $(id);
      el.value = state[id];
      el.addEventListener("input", function () { state[id] = el.value; render(); });
    });
    $("clearFit").addEventListener("click", clearFit);
    $("clearAll").addEventListener("click", function () {
      state.q = ""; $("q").value = "";
      state.style = ""; $("ask").value = ""; showAsk(null);
      state.saved = false; state.cat = "";
      $("cats").querySelectorAll("[data-cat]").forEach(function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-cat") === "" ? "true" : "false"); });
      buildSizes();
      clearFit();
      setPart("");
    });
    $("sort").addEventListener("change", function () { state.sort = this.value; render(); });

    var q = $("q");
    q.value = state.q;
    q.addEventListener("input", function () { state.q = q.value; render(); });

    $("results").addEventListener("click", onClick);
    $("sheet").addEventListener("click", function (e) {
      if (e.target === $("sheet") || e.target.closest("#sheetClose")) { closeSheet(); return; }
      onClick(e);
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("sheet").hidden) closeSheet(); });

    window.addEventListener("hashchange", function () {
      var h = location.hash.match(/^#phan-(\d+)$/);
      state.part = h ? h[1] : "";
      sel.value = state.part;
      render();
    });
    window.addEventListener("scroll", function () {
      $("bar").classList.toggle("stuck", window.scrollY > 60);
      $("toTop").hidden = window.scrollY < 900;
    }, { passive: true });
    $("toTop").addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
  }

  function start(d) {
    data = d;
    data.videos = data.videos || [];
    data.videos.forEach(function (v) { videoByPart[v.part] = v; });
    data.products.forEach(function (p) {
      if (!p.shopee && p.links && p.links.shopee) p.shopee = p.links.shopee; // dữ liệu kiểu cũ
      byId[p.id] = p;
    });
    favs = favs.filter(function (id) { return byId[id]; });
    var s = store("mt-fit");
    if (s) { state.gender = s.gender || ""; state.height = s.height || ""; state.weight = s.weight || ""; }
    readUrl();
    buildControls();
    buildAsk();
    render();
  }

  var preview = null;
  try { if (/[?&]preview=1/.test(location.search)) preview = JSON.parse(sessionStorage.getItem("mt-preview") || "null"); } catch (e) {}
  if (preview) start(preview);
  else if (window.__DATA__) start(window.__DATA__);
  else fetch("data/products.json", { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(start)
    .catch(function () {
      $("results").innerHTML = '<div class="empty"><strong>Chưa tải được danh sách sản phẩm</strong>Kiểm tra lại file data/products.json (có thể sai dấu phẩy hoặc ngoặc).</div>';
    });
})();
