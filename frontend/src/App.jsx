import React, { useEffect, useCallback } from 'react';

// Get the actual host IP to connect to FastAPI. Since React is served by Nginx 
// in Docker, `window.location.hostname` gives the Mac's local IP address.
const API_URL = `http://${window.location.hostname}:8000`;

let audioCtx = null;
const playClickSound = () => {
  try {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    // Subtle physical "tick" sound
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.02);
    
    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime); 
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.02);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.02);
  } catch (err) {
    // Ignore constraints
  }
};

function App() {
  const [player, setPlayer] = React.useState(null);
  const [authCode, setAuthCode] = React.useState(() => {
    return localStorage.getItem('macpad_auth_code') || '';
  });
  const [authError, setAuthError] = React.useState(false);
  const [customKeys, setCustomKeys] = React.useState(() => {
    const saved = localStorage.getItem('macpad_keys');
    return saved ? JSON.parse(saved) : {};
  });
  const [showSettings, setShowSettings] = React.useState(false);
  const [editLayoutMode, setEditLayoutMode] = React.useState(false);
  const [controllerType, setControllerType] = React.useState(() => {
    return localStorage.getItem('macpad_controller_type') || '1';
  });
  const [layout, setLayout] = React.useState(() => {
    const saved = localStorage.getItem('macpad_layout_offsets');
    return saved ? JSON.parse(saved) : {};
  });
  const draggingGroup = React.useRef(null);
  const dragStartOffset = React.useRef({x: 0, y: 0});
  const ws = React.useRef(null);

  useEffect(() => {
    if (player && ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ action: "configure", player, mapping: customKeys }));
    }
  }, [customKeys, player]);

  useEffect(() => {
    let reconnectTimeout;
    const connectWS = () => {
      const wsUrl = API_URL.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws';
      const socket = new WebSocket(wsUrl);
      
      socket.onopen = () => {
        console.log("WebSocket Connected");
        const savedCode = localStorage.getItem('macpad_auth_code');
        if (savedCode) {
          socket.send(JSON.stringify({ action: "auth", code: savedCode }));
        }
      };
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'auth') {
            if (msg.success) {
              setPlayer(msg.player);
              setAuthError(false);
              localStorage.setItem('macpad_auth_code', localStorage.getItem('macpad_auth_code') || '');
              socket.send(JSON.stringify({ action: "configure", player: msg.player, mapping: customKeys }));
            } else {
              localStorage.removeItem('macpad_auth_code');
              setPlayer(null);
              setAuthError(true);
            }
          }
        } catch (e) {}
      };
      socket.onclose = () => {
        console.log("WebSocket Disconnected, reconnecting...");
        reconnectTimeout = setTimeout(connectWS, 1000);
      };
      socket.onerror = (err) => console.error("WebSocket Error", err);
      
      ws.current = socket;
    };

    connectWS();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws.current) {
        ws.current.onclose = null;
        ws.current.close();
      }
    };
  }, []);

  // Aggressively prevent iOS Safari from hijacking touches for "rubber banding",
  // "pull to refresh", or "double tap to zoom" gestures which cause controls to hang.
  // We strictly ONLY apply this to iPhones/iPads because Android handles touch-action: none perfectly,
  // and overriding Android's native touch cycle breaks React Synthetic Drag gestures.
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!isIOS) return;
    
    const preventNative = (e) => {
      // Allow input interactions inside settings modal, header UI, and auth screen
      if (e.target.closest('.settings-modal, .header-actions, .player-toggle, .auth-screen, .controller-select')) return;
      if (e.cancelable) e.preventDefault();
    };
    
    document.addEventListener('touchstart', preventNative, { passive: false });
    document.addEventListener('touchmove', preventNative, { passive: false });
    document.addEventListener('contextmenu', preventNative, { passive: false });
    
    return () => {
      document.removeEventListener('touchstart', preventNative);
      document.removeEventListener('touchmove', preventNative);
      document.removeEventListener('contextmenu', preventNative);
    };
  }, []);
  
  // Keep WebSocket alive natively 
  useEffect(() => {
    const pingInterval = setInterval(() => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ action: "ping" }));
      }
    }, 2000);
    return () => clearInterval(pingInterval);
  }, []);

  const handleAuth = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      setAuthError(false);
      localStorage.setItem('macpad_auth_code', authCode);
      ws.current.send(JSON.stringify({ action: "auth", code: authCode }));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('macpad_auth_code');
    setPlayer(null);
    setAuthCode('');
    setAuthError(false);
  };

  const toggleFullScreen = () => {
    const doc = window.document;
    const docEl = doc.documentElement;

    const requestFn = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
    const exitFn = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;

    const isFullscreen = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;

    if (!isFullscreen) {
      if (requestFn) {
        // Some older browsers don't return a promise, so we optional chain the catch
        const promise = requestFn.call(docEl);
        if (promise) promise.catch(() => {});
      } else {
        // iOS Safari does not support the Fullscreen API. 
        alert("Your browser does not support the fullscreen button (this is common on iOS Safari).\n\nTo play in true fullscreen, tap the Safari 'Share' icon at the bottom and choose 'Add to Home Screen'.");
      }
    } else {
      if (exitFn) {
        exitFn.call(doc);
      }
    }
  };

  const handleDragStart = (group) => (e) => {
    if (!editLayoutMode) return;
    // Removing preventDefault here ensures Android touch dispatch engines don't silently drop the gesture chain
    draggingGroup.current = group;
    const touch = e.touches[0];
    const groupLayout = layout[group] || {x: 0, y: 0};
    dragStartOffset.current = {
      x: touch.clientX - groupLayout.x,
      y: touch.clientY - groupLayout.y
    };
  };

  const handleDragMove = (e) => {
    if (!editLayoutMode || !draggingGroup.current) return;
    // Let CSS touch-action: none handle the scroll lock. 
    // Manual preventDefault sometimes breaks Android Chrome's React Event pool.
    const touch = e.touches[0];
    setLayout(prev => ({
      ...prev,
      [draggingGroup.current]: {
        x: touch.clientX - dragStartOffset.current.x,
        y: touch.clientY - dragStartOffset.current.y
      }
    }));
  };

  const handleDragEnd = (e) => {
    if (!editLayoutMode || !draggingGroup.current) return;
    if (e && e.target && e.target.closest('.header-actions')) return;
    draggingGroup.current = null;
    localStorage.setItem('macpad_layout_offsets', JSON.stringify(layout));
  };

  const sendCommand = useCallback((action, key) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ action, key, player, controller: `controller${controllerType}` }));
    }
  }, [player, controllerType]);

  const lastTouchTime = React.useRef(0);

  const handlePress = (key, isTouch) => (e) => {
    if (isTouch) {
      if (e.cancelable) e.preventDefault();
      lastTouchTime.current = Date.now();
      if (navigator.vibrate) {
        try { navigator.vibrate(15); } catch(err) {}
      }
    } else {
      // Ignore mouse events that were synthesized closely after a touch
      if (Date.now() - lastTouchTime.current < 500) return;
    }
    
    if (editLayoutMode) return;
    playClickSound();

    if (key === 'c') {
      sendCommand('press', 'a');
      sendCommand('press', 'b');
    } else {
      sendCommand('press', key);
    }
  };

  const handleRelease = (key, isTouch) => (e) => {
    if (isTouch) {
      if (e.cancelable) e.preventDefault();
    } else {
      if (Date.now() - lastTouchTime.current < 500) return;
    }
    
    if (editLayoutMode) return;

    if (key === 'c') {
      sendCommand('release', 'a');
      sendCommand('release', 'b');
    } else {
      sendCommand('release', key);
    }
  };

  const bindKey = (key) => ({
    onTouchStart: handlePress(key, true),
    onTouchEnd: handleRelease(key, true),
    onTouchCancel: handleRelease(key, true),
    onMouseDown: handlePress(key, false),
    onMouseUp: handleRelease(key, false),
    onMouseLeave: handleRelease(key, false)
  });

  const Button = ({ name, cls }) => (
    <div className={`btn ${cls}`} {...bindKey(name)}>
      {name.toUpperCase()}
    </div>
  );

  if (!player) {
    return (
      <div className="gamepad">
        <div className="auth-screen">
          <h1>MacPad</h1>
          <p>Enter your 4-digit player code</p>
          <input
            className="auth-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength="4"
            placeholder="0000"
            value={authCode}
            onChange={(e) => {
              setAuthCode(e.target.value.replace(/\D/g, ''));
              setAuthError(false);
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAuth(); }}
            autoFocus
          />
          {authError && <p className="auth-error">Invalid code. Try again.</p>}
          <button className="pill-btn auth-btn" onClick={handleAuth} disabled={authCode.length !== 4}>
            Connect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gamepad" onTouchMove={handleDragMove} onTouchEnd={handleDragEnd} onTouchCancel={handleDragEnd}>
      {showSettings && (
        <div className="settings-modal">
          <div className="settings-content">
            <h2>P{player} Custom Keys</h2>
            <p>Type a key like 'space', 'enter', or 'z'. Leave blank to use defaults.</p>
            <div className="settings-grid">
              {(controllerType === '2'
                ? ['up', 'down', 'left', 'right', 'a', 'b', 'x', 'y', 'select', 'start']
                : ['up', 'down', 'left', 'right', 'a', 'b', 'select', 'start']
              ).map(k => (
                <div key={k} className="settings-row">
                  <label>{k.toUpperCase()}</label>
                  <input 
                    type="text" 
                    placeholder="default" 
                    maxLength="10"
                    value={customKeys[k] || ''} 
                    onChange={(e) => setCustomKeys({...customKeys, [k]: e.target.value.toLowerCase()})} 
                  />
                </div>
              ))}
            </div>
            <button className="pill-btn save-btn" onClick={() => {
              localStorage.setItem('macpad_keys', JSON.stringify(customKeys));
              setShowSettings(false);
            }}>Save & Close</button>
          </div>
        </div>
      )}

      <div className="header">
        <h1>MacPad</h1>
        <p>Connected as Player {player}</p>
        <div className="header-actions">
          <button className="fullscreen-btn" onClick={toggleFullScreen}>
            ⛶ Fullscreen
          </button>
          <button className="fullscreen-btn" onClick={() => setShowSettings(true)}>
            ⚙ Settings
          </button>
          <button className={`fullscreen-btn ${editLayoutMode ? 'active' : ''}`} onClick={() => setEditLayoutMode(!editLayoutMode)}>
            {editLayoutMode ? "✅ Done Layout" : "🖌 Edit Layout"}
          </button>
          <button className="fullscreen-btn logout-btn" onClick={handleLogout}>
            ⏻ Exit
          </button>
          <select
            className="controller-select"
            value={controllerType}
            onChange={(e) => {
              setControllerType(e.target.value);
              localStorage.setItem('macpad_controller_type', e.target.value);
            }}
          >
            <option value="1">Controller 1</option>
            <option value="2">Controller 2</option>
          </select>
        </div>
      </div>

      <div className="controls">
        <div 
          className={`dpad-container ${editLayoutMode ? 'edit-mode' : ''}`}
          onTouchStart={handleDragStart('dpad')}
          style={{ transform: `translate(${(layout.dpad || {}).x || 0}px, ${(layout.dpad || {}).y || 0}px)` }}
        >
          <div className="dpad">
            <div className="dpad-row">
              <div className="dpad-btn empty"></div>
              <div className="dpad-btn up" {...bindKey('up')}></div>
              <div className="dpad-btn empty"></div>
            </div>
            <div className="dpad-row">
              <div className="dpad-btn left" {...bindKey('left')}></div>
              <div className="dpad-btn center"></div>
              <div className="dpad-btn right" {...bindKey('right')}></div>
            </div>
            <div className="dpad-row">
              <div className="dpad-btn empty"></div>
              <div className="dpad-btn down" {...bindKey('down')}></div>
              <div className="dpad-btn empty"></div>
            </div>
          </div>
        </div>

        <div 
          className={`center-actions ${editLayoutMode ? 'edit-mode' : ''}`}
          onTouchStart={handleDragStart('center')}
          style={{ transform: `translate(${(layout.center || {}).x || 0}px, ${(layout.center || {}).y || 0}px)` }}
        >
          <div className="pill-btn" {...bindKey('select')}>
            SELECT
          </div>
          <div className="pill-btn" {...bindKey('start')}>
            START
          </div>
        </div>

        <div 
          className={`action-buttons-container ${editLayoutMode ? 'edit-mode' : ''}`}
          onTouchStart={handleDragStart('actions')}
          style={{ transform: `translate(${(layout.actions || {}).x || 0}px, ${(layout.actions || {}).y || 0}px)` }}
        >
          {controllerType === '2' ? (
            <div className="action-buttons abxy-buttons">
              <Button name="x" cls="btn-x" />
              <Button name="a" cls="btn-a" />
              <Button name="y" cls="btn-y" />
              <Button name="b" cls="btn-b" />
            </div>
          ) : (
            <div className="action-buttons">
              <Button name="b" cls="btn-b" />
              <Button name="c" cls="btn-c" />
              <Button name="a" cls="btn-a" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
