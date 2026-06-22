/* ─── Theme toggle ──────────────────────────────────────── */
(function () {
  function applyTheme(theme) {
    if (theme !== "light" && theme !== "dark") theme = "light";
    document.documentElement.dataset.theme = theme;
    document.querySelectorAll(".theme__btn").forEach(function (btn) {
      btn.setAttribute(
        "aria-current",
        btn.dataset.theme === theme ? "true" : "false"
      );
    });
  }

  function currentTheme() {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyTheme(currentTheme()); // sync button state with early-detected theme

    document.querySelectorAll(".theme__btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var theme = btn.dataset.theme;
        localStorage.setItem("qa-theme", theme);
        applyTheme(theme);
      });
    });
  });
})();
