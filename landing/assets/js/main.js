(function () {
  'use strict';

  // Clipboard copy for the install command
  const copyBtn = document.getElementById('copy-btn');
  if (copyBtn && navigator.clipboard) {
    copyBtn.addEventListener('click', function () {
      const text = copyBtn.dataset.copy;
      navigator.clipboard.writeText(text).then(function () {
        copyBtn.classList.add('copied');
        setTimeout(function () {
          copyBtn.classList.remove('copied');
        }, 2000);
      }).catch(function () {
        // Silently ignore clipboard errors (permissions denied, insecure context)
      });
    });
  }

  // Badge error handler: hide parent element when a badge image fails to load
  document.querySelectorAll('.badge').forEach(function (img) {
    img.addEventListener('error', function () {
      const parent = img.parentElement;
      if (parent) {
        parent.style.display = 'none';
      }
    });
  });
}());
