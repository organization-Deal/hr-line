/* Change version here when publishing. Asset cache keys are separate. */
(() => {
  'use strict';
  const release = Object.freeze({ version: 'P10.11' });
  window.NaknaRelease = release;
  const render = () => {
    document.documentElement.dataset.naknaVersion = release.version;
    document.querySelectorAll('[data-nakna-version]').forEach(node => {
      node.textContent = `UI ${release.version}`;
      node.title = `เวอร์ชันหน้าเว็บที่โหลด: ${release.version}`;
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once: true });
  else render();
})();
