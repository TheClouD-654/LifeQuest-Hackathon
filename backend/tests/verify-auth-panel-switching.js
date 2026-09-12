const { spawn } = require('child_process');
const http = require('http');

async function run() {
  const serverProcess = spawn('node', ['backend/src/server.js'], {
    env: { ...process.env, PORT: '5098' },
    cwd: 'c:\\Users\\aruna\\Desktop\\PRGS\\LifeQuest'
  });

  await new Promise((resolve) => {
    const check = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:5098/pages/auth.html');
        if (res.status === 200) {
          clearInterval(check);
          resolve();
        }
      } catch (e) {}
    }, 300);
  });
  console.log('Test server ready on port 5098');

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const edge = spawn(edgePath, [
    '--headless',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const pageTarget = targets.find(t => t.type === 'page');
  if (!pageTarget) {
    console.error('No page target found');
    edge.kill();
    serverProcess.kill();
    return;
  }

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let id = 1;
  const callbacks = new Map();

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = id++;
      callbacks.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      const cb = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      cb(msg);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      console.log('BROWSER CONSOLE:', msg.params.type, msg.params.args.map(a => a.value || a.description));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      console.error('BROWSER EXCEPTION:', JSON.stringify(msg.params.exceptionDetails));
    }
  });

  await new Promise(r => ws.addEventListener('open', r));

  await send('Runtime.enable');
  await send('Page.enable');

  const testUrl = 'http://localhost:5098/pages/auth.html?mode=signup';
  console.log('Navigating to ' + testUrl + ' ...');
  await send('Page.navigate', { url: testUrl });

  await new Promise(r => setTimeout(r, 2000));

  // Listen for CSP violations
  await send('Runtime.evaluate', {
    expression: `
      window.cspViolations = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        window.cspViolations.push({
          directive: e.effectiveDirective,
          blockedURI: e.blockedURI,
          violatedDirective: e.violatedDirective
        });
      });
    `
  });

  // Check state before click
  const beforeState = await send('Runtime.evaluate', {
    expression: `(() => {
      const pLogin = document.getElementById('panel-login');
      const pSignup = document.getElementById('panel-signup');
      return {
        loginActive: pLogin?.classList.contains('active'),
        loginHidden: pLogin?.hasAttribute('hidden'),
        loginDisplay: window.getComputedStyle(pLogin).display,
        signupActive: pSignup?.classList.contains('active'),
        signupHidden: pSignup?.hasAttribute('hidden'),
        signupDisplay: window.getComputedStyle(pSignup).display,
        showPanelType: typeof window.showPanel
      };
    })()`,
    returnByValue: true
  });
  console.log('BEFORE CLICK STATE:', beforeState.result?.result?.value);

  // Now simulate click on the "Sign in" link
  console.log('Simulating click on "Sign in" link...');
  const clickResult = await send('Runtime.evaluate', {
    expression: `(() => {
      const links = Array.from(document.querySelectorAll('.auth-switch a'));
      const signInLink = links.find(a => a.textContent.includes('Sign in'));
      if (!signInLink) return { found: false };
      
      const beforeClickHref = signInLink.getAttribute('href');
      const beforeClickOnclick = signInLink.getAttribute('onclick');

      // Dispatch click directly on the element
      signInLink.click();
      
      const pLogin = document.getElementById('panel-login');
      const pSignup = document.getElementById('panel-signup');
      return {
        found: true,
        beforeClickHref,
        beforeClickOnclick,
        loginActive: pLogin?.classList.contains('active'),
        loginHidden: pLogin?.hasAttribute('hidden'),
        loginDisplay: window.getComputedStyle(pLogin).display,
        signupActive: pSignup?.classList.contains('active'),
        signupHidden: pSignup?.hasAttribute('hidden'),
        signupDisplay: window.getComputedStyle(pSignup).display,
        currentUrl: window.location.href,
        cspViolations: window.cspViolations
      };
    })()`,
    returnByValue: true
  });
  console.log('AFTER FIRST CLICK (Sign In):', clickResult.result?.result?.value);

  // Now test switching back to "Create Account"
  console.log('Simulating click on "Create one here" link...');
  const switchBackResult = await send('Runtime.evaluate', {
    expression: `(() => {
      const link = document.getElementById('link-switch-signup');
      link.click();
      const pLogin = document.getElementById('panel-login');
      const pSignup = document.getElementById('panel-signup');
      return {
        loginActive: pLogin?.classList.contains('active'),
        signupActive: pSignup?.classList.contains('active'),
        currentUrl: window.location.href
      };
    })()`,
    returnByValue: true
  });
  console.log('AFTER SWITCH BACK TO SIGNUP:', switchBackResult.result?.result?.value);

  // Test password toggle
  console.log('Testing password toggle...');
  const toggleResult = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.getElementById('toggle-signup-password');
      const input = document.getElementById('signup-password');
      const beforeType = input.type;
      btn.click();
      const afterClick1 = input.type;
      btn.click();
      const afterClick2 = input.type;
      return { beforeType, afterClick1, afterClick2 };
    })()`,
    returnByValue: true
  });
  console.log('PASSWORD TOGGLE RESULT:', toggleResult.result?.result?.value);

  edge.kill();
  serverProcess.kill();
  process.exit(0);
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
