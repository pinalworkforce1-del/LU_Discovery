// BOOST 2.0 resume bridge — branch-only integration helper.
// This script is inactive unless the page explicitly opts in.
(function () {
  const enabled = new URLSearchParams(location.search).get("source") === "boost2";
  if (!enabled || window.parent === window) return;
  const hostOrigin = "https://pinalworkforce1-del.github.io";
  window.boostResumeBridge = {
    notifyReady() {
      window.parent.postMessage({type: "boost2-resume-ready"}, hostOrigin);
    },
    saveDraft(draft) {
      window.parent.postMessage({type: "boost2-resume-request", action: "save", id: Date.now(), payload: draft}, hostOrigin);
    }
  };
})();
