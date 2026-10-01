// アニメーションの準備。<head> で最初に読み込み、最初の描画より前に実行する。
//  - 保存済みのテーマを先に反映（ページ切り替えの幕の色がテーマと合うように）
//  - 動きを減らす設定でなければ <html> に has-motion を付ける（幕と初期状態の CSS が有効になる）
//  - motion.js が動かなかったときは has-motion を外し、幕が残らないようにする
(function (root) {
  var FAILSAFE_MS = 2000;
  try {
    if (localStorage.getItem("satsuma-theme") === "light") root.setAttribute("data-theme", "light");
  } catch (e) {
    // localStorage が使えない環境では既定（ダーク）のまま
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  root.classList.add("has-motion");
  setTimeout(function () {
    if (!window.Motion) root.classList.remove("has-motion");
  }, FAILSAFE_MS);
})(document.documentElement);
