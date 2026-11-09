document.getElementById('btnOpenStudio').addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:5173' });
});

document.getElementById('btnCopyPage').addEventListener('click', async () => {
  const statusEl = document.getElementById('status');
  statusEl.textContent = 'Extracting code...';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    statusEl.textContent = 'No active tab found';
    return;
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        let name = document.title || 'Page Component';
        let html = '';
        let css = '';
        let js = '';

        const nextDataEl = document.getElementById('__NEXT_DATA__');
        if (nextDataEl) {
          try {
            const nextData = JSON.parse(nextDataEl.textContent || '{}');
            const post = nextData.props?.pageProps?.post;
            if (post) {
              name = post.name || name;
              html = post.html || '';
              css = post.css || '';
            }
          } catch {
            // ignore
          }
        }

        if (!html && !css) {
          const codeBlocks = Array.from(document.querySelectorAll('pre, code'));
          codeBlocks.forEach((block) => {
            const text = block.textContent || '';
            if (text.includes('{') && text.includes('}') && (text.includes('px') || text.includes('color'))) {
              if (!css) css = text;
            } else if (text.includes('<') && text.includes('>')) {
              if (!html) html = text;
            }
          });
        }

        return { name, html, css, js, sourceUrl: window.location.href };
      },
    });

    if (results && results[0] && results[0].result) {
      const data = results[0].result;
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      statusEl.textContent = `✅ Copied "${data.name}"!`;
    } else {
      statusEl.textContent = 'Could not extract code.';
    }
  } catch (err) {
    statusEl.textContent = 'Error: ' + (err.message || 'Script injection error');
  }
});
