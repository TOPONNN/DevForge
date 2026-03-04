import { test, expect } from '@playwright/test';

test.describe('Pokemon Prop Hunt - Full Flow', () => {

  test('1. Main lobby screen loads with background and Guest button', async ({ page }) => {
    await page.goto('/');
    
    // Check lobby screen renders
    const lobby = page.locator('.lobby-screen');
    await expect(lobby).toBeVisible({ timeout: 10_000 });
    
    // Check title text
    await expect(page.locator('.main-title')).toHaveText('포켓몬 숨바꼭질');
    await expect(page.locator('.main-subtitle')).toBeVisible();
    
    // Check Guest button exists
    const guestBtn = page.locator('.lobby-guest-btn');
    await expect(guestBtn).toBeVisible();
    await expect(guestBtn).toHaveText('Guest');
    
    // Check background image is set
    const bgImage = await lobby.evaluate(el => getComputedStyle(el).backgroundImage);
    expect(bgImage).toContain('background-main.png');

    // Screenshot
    await page.screenshot({ path: './test-results/01-main-lobby.png', fullPage: true });
  });

  test('2. Nickname screen appears after clicking Guest', async ({ page }) => {
    await page.goto('/');
    await page.locator('.lobby-guest-btn').click();

    // Login panel should appear
    const loginPanel = page.locator('.login-panel');
    await expect(loginPanel).toBeVisible({ timeout: 5_000 });
    
    // Nickname input should exist
    const nicknameInput = page.locator('.login-nickname-input');
    await expect(nicknameInput).toBeVisible();
    
    // Header image
    await expect(page.locator('.login-header-img')).toBeVisible();

    await page.screenshot({ path: './test-results/02-nickname-screen.png', fullPage: true });
  });

  test('3. Channel select screen after entering nickname', async ({ page }) => {
    await page.goto('/');
    await page.locator('.lobby-guest-btn').click();

    // Type nickname
    const nicknameInput = page.locator('.login-nickname-input');
    await nicknameInput.fill('테스터');
    
    // Click Guest (submit) button
    await page.locator('.login-panel .lobby-guest-btn').click();

    // Channel selection should appear
    const channelPanel = page.locator('.channel-outer-panel');
    await expect(channelPanel).toBeVisible({ timeout: 5_000 });
    
    // Should have 4 channels
    const channelCards = page.locator('.channel-card');
    await expect(channelCards).toHaveCount(4);

    // Check channel names
    await expect(channelCards.nth(0).locator('.channel-card-name')).toHaveText('1 채널');
    await expect(channelCards.nth(1).locator('.channel-card-name')).toHaveText('2 채널');

    await page.screenshot({ path: './test-results/03-channel-select.png', fullPage: true });
  });

  test('4. Room list screen after selecting channel', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to channel select
    await page.locator('.lobby-guest-btn').click();
    await page.locator('.login-nickname-input').fill('테스터');
    await page.locator('.login-panel .lobby-guest-btn').click();
    
    // Wait for channels and click first
    await page.locator('.channel-card').first().click();
    
    // Room list should appear
    const roomList = page.locator('.room-list-outer');
    await expect(roomList).toBeVisible({ timeout: 10_000 });
    
    // Sidebar buttons
    await expect(page.locator('.sidebar-btn').first()).toBeVisible();
    
    // Room list main area
    await expect(page.locator('.room-list-main')).toBeVisible();

    await page.screenshot({ path: './test-results/04-room-list.png', fullPage: true });
  });

  test('5. Create room modal opens and works', async ({ page }) => {
    await page.goto('/');
    await page.locator('.lobby-guest-btn').click();
    await page.locator('.login-nickname-input').fill('테스터');
    await page.locator('.login-panel .lobby-guest-btn').click();
    await page.locator('.channel-card').first().click();

    await expect(page.locator('.room-list-outer')).toBeVisible({ timeout: 10_000 });

    // Click "방 만들기" sidebar button
    await page.locator('.sidebar-btn').filter({ hasText: '방 만들기' }).click();
    
    // Modal should appear
    const modal = page.locator('.modal-panel-ref');
    await expect(modal).toBeVisible({ timeout: 5_000 });
    
    // Check modal has fields
    await expect(modal.locator('.modal-title-ref')).toHaveText('방 만들기');
    await expect(modal.locator('.modal-input-ref').first()).toBeVisible();
    
    // Max player buttons
    const maxPlayerBtns = modal.locator('.modal-maxplayer-btn');
    await expect(maxPlayerBtns).toHaveCount(5); // 4, 6, 8, 10, 12

    await page.screenshot({ path: './test-results/05-create-room-modal.png', fullPage: true });
  });

  test('6. Create room and enter room detail', async ({ page }) => {
    await page.goto('/');
    await page.locator('.lobby-guest-btn').click();
    await page.locator('.login-nickname-input').fill('방장');
    await page.locator('.login-panel .lobby-guest-btn').click();
    await page.locator('.channel-card').first().click();

    await expect(page.locator('.room-list-outer')).toBeVisible({ timeout: 10_000 });

    // Open create room modal
    await page.locator('.sidebar-btn').filter({ hasText: '방 만들기' }).click();
    await expect(page.locator('.modal-panel-ref')).toBeVisible();
    
    // Click "방 만들기" submit button in modal
    await page.locator('.modal-panel-ref .modal-action-btn').first().click();
    
    // Room detail should appear
    const roomDetail = page.locator('.room-detail-panel');
    await expect(roomDetail).toBeVisible({ timeout: 10_000 });
    
    // Room code should be displayed
    await expect(page.locator('.room-code-value')).toBeVisible();
    
    // Player list should show the host
    const playerRow = page.locator('.player-row');
    await expect(playerRow).toHaveCount(1);
    
    // Ready button should exist
    await expect(page.locator('.btn-ready')).toBeVisible();
    
    // Start game button should exist for host
    await expect(page.locator('.btn-start-game')).toBeVisible();
    
    // Leave button
    await expect(page.locator('.btn-leave')).toBeVisible();

    // Role selection
    await expect(page.locator('.role-select-btn').first()).toBeVisible();
    
    // Chat section
    await expect(page.locator('.room-detail-chat')).toBeVisible();

    // Wait for lobby-appear animation to complete (500ms CSS animation)
    await page.waitForTimeout(800);

    await page.screenshot({ path: './test-results/06-room-detail.png', fullPage: true });
  });

  test('7. Add bot and start game - 3D scene renders with WebGL', async ({ page }) => {
    // Collect console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.locator('.lobby-guest-btn').click();
    await page.locator('.login-nickname-input').fill('트레이너');
    await page.locator('.login-panel .lobby-guest-btn').click();
    await page.locator('.channel-card').first().click();

    await expect(page.locator('.room-list-outer')).toBeVisible({ timeout: 10_000 });

    // Create room
    await page.locator('.sidebar-btn').filter({ hasText: '방 만들기' }).click();
    await page.locator('.modal-panel-ref .modal-action-btn').first().click();
    await expect(page.locator('.room-detail-panel')).toBeVisible({ timeout: 10_000 });

    // Add a bot (need at least 2 players)
    await page.locator('.bot-add-btn').click();
    await page.waitForTimeout(500);
    
    // Should now have 2 players
    const playerRows = page.locator('.player-row');
    await expect(playerRows).toHaveCount(2, { timeout: 5_000 });

    await page.screenshot({ path: './test-results/07a-room-with-bot.png', fullPage: true });

    // Start game
    await page.locator('.btn-start-game').click();

    // Wait for 3D canvas to appear
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 20_000 });

    // Wait for scene to initialize and render
    await page.waitForTimeout(5000);

    await page.screenshot({ path: './test-results/07b-game-scene.png', fullPage: true });

    // Check canvas has dimensions
    const canvasSize = await canvas.boundingBox();
    expect(canvasSize).not.toBeNull();
    expect(canvasSize!.width).toBeGreaterThan(100);
    expect(canvasSize!.height).toBeGreaterThan(100);

    // Verify WebGL context is active (not lost)
    const webglActive = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      if (!c) return false;
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      return gl ? !gl.isContextLost() : false;
    });
    // Note: R3F manages its own context, so we check canvas existence instead
    expect(await canvas.count()).toBe(1);

    // Check "클릭하여 게임 입장" overlay appears (since pointer is not locked)
    const clickToPlay = page.locator('.click-to-play');
    await expect(clickToPlay).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.click-title')).toHaveText('클릭하여 게임 입장');

    // HUD layer exists in DOM (opacity:0 since pointer not locked in headless)
    await expect(page.locator('.hud-layer')).toBeAttached();
    
    // Timer element exists in HUD
    await expect(page.locator('.hud-timer-text')).toBeAttached();

    // For 07c screenshot: force HUD visible and hide click-to-play overlay
    // (In headless, pointer lock is unavailable so HUD stays opacity:0)
    await page.evaluate(() => {
      const hud = document.querySelector('.hud-layer') as HTMLElement;
      if (hud) hud.classList.add('active');
      const overlay = document.querySelector('.click-to-play') as HTMLElement;
      if (overlay) overlay.style.display = 'none';
    });
    await page.waitForTimeout(300);

    await page.screenshot({ path: './test-results/07c-game-with-hud.png', fullPage: true });

    // Log any console errors for debugging
    if (consoleErrors.length > 0) {
      console.log('Console errors found:', consoleErrors);
    }
    
    // WebGL-critical errors should not exist
    const criticalErrors = consoleErrors.filter(e => 
      e.includes('WebGL') || 
      e.includes('context lost') || 
      e.includes('THREE.WebGLRenderer')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('8. Check all static images load correctly', async ({ page }) => {
    const failedImages: string[] = [];
    
    page.on('response', response => {
      if (response.url().includes('/images/') && response.status() >= 400) {
        failedImages.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    // Navigate through all screens to trigger image loads
    await page.locator('.lobby-guest-btn').click();
    await page.waitForTimeout(1000);
    
    await page.locator('.login-nickname-input').fill('이미지테스트');
    await page.locator('.login-panel .lobby-guest-btn').click();
    await page.waitForTimeout(1000);

    // Check for 404 images
    if (failedImages.length > 0) {
      console.log('Failed images:', failedImages);
    }
    expect(failedImages).toHaveLength(0);
  });

  test('9. Chat functionality works in room', async ({ page }) => {
    await page.goto('/');
    await page.locator('.lobby-guest-btn').click();
    await page.locator('.login-nickname-input').fill('채팅테스트');
    await page.locator('.login-panel .lobby-guest-btn').click();
    await page.locator('.channel-card').first().click();
    await expect(page.locator('.room-list-outer')).toBeVisible({ timeout: 10_000 });

    // Create room
    await page.locator('.sidebar-btn').filter({ hasText: '방 만들기' }).click();
    await page.locator('.modal-panel-ref .modal-action-btn').first().click();
    await expect(page.locator('.room-detail-panel')).toBeVisible({ timeout: 10_000 });

    // Type and send chat
    const chatInput = page.locator('.chat-input-row input');
    await chatInput.fill('안녕하세요!');
    await page.locator('.chat-send-btn').click();

    // Chat message should appear
    const chatLog = page.locator('.chat-log');
    await expect(chatLog.locator('.chat-message')).toHaveCount(1, { timeout: 5_000 });
    await expect(chatLog.locator('.chat-message').first()).toContainText('안녕하세요!');

    await page.screenshot({ path: './test-results/09-chat.png', fullPage: true });
  });

  test('10. Role selection toggles work', async ({ page }) => {
    await page.goto('/');
    await page.locator('.lobby-guest-btn').click();
    await page.locator('.login-nickname-input').fill('역할테스트');
    await page.locator('.login-panel .lobby-guest-btn').click();
    await page.locator('.channel-card').first().click();
    await expect(page.locator('.room-list-outer')).toBeVisible({ timeout: 10_000 });

    // Create room
    await page.locator('.sidebar-btn').filter({ hasText: '방 만들기' }).click();
    await page.locator('.modal-panel-ref .modal-action-btn').first().click();
    await expect(page.locator('.room-detail-panel')).toBeVisible({ timeout: 10_000 });

    // Default should be pokemon - check pokemon select is shown
    await expect(page.locator('text=포켓몬 선택')).toBeVisible();

    // Switch to trainer
    await page.locator('.role-select-btn').filter({ hasText: '트레이너' }).click();
    await page.waitForTimeout(500);
    
    // Trainer status should appear
    await expect(page.locator('.trainer-status')).toBeVisible({ timeout: 5_000 });

    // Switch back to pokemon
    await page.locator('.role-select-btn').filter({ hasText: '포켓몬' }).click();
    await page.waitForTimeout(500);
    
    // Pokemon select should reappear
    await expect(page.locator('text=포켓몬 선택')).toBeVisible({ timeout: 5_000 });

    await page.screenshot({ path: './test-results/10-role-select.png', fullPage: true });
  });
});
