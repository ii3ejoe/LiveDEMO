window.IOWA_NEIGHBOR_VERSION = "4.2.5.40-LiveDemo";
window.IOWA_NEIGHBOR_BRAND = "Iowa Neighbor V" + window.IOWA_NEIGHBOR_VERSION;
document.addEventListener("DOMContentLoaded", function () {
  document.title = window.IOWA_NEIGHBOR_BRAND;
  document.querySelectorAll(".logo-text .brand").forEach(function (el) { el.textContent = window.IOWA_NEIGHBOR_BRAND; });
});
