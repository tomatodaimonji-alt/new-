package jp.tsukacchi.htmlplayer;

import android.app.Activity;
import android.app.AlertDialog;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.ConsoleMessage;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.BufferedInputStream;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Collections;

/**
 * Lightweight auto-updating 3D editor launcher.
 * No AI service, JavaScript bridge, local HTML picker, or visible update toolbar.
 * The app downloads editor HTML from its pinned public HTTPS endpoint at launch.
 */
public class MainActivity extends Activity {
    private static final String GAME_URL = "https://game.tsukacchi.local/index.html";
    private static final String LOCAL_HOST = "game.tsukacchi.local";
    private static final String UPDATE_URL =
        "https://raw.githubusercontent.com/tomatodaimonji-alt/new-/main/world-editor.html";
    private static final long MAX_HTML_BYTES = 12L * 1024 * 1024;
    private File current;
    private File previous;
    private File pending;
    private WebView web;
    private FrameLayout root;
    private volatile boolean checking;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        current = new File(getFilesDir(), "current.html");
        previous = new File(getFilesDir(), "previous.html");
        pending = new File(getFilesDir(), "pending.html");
        try {
            ensureInitial();
            activatePending();
        } catch (Exception e) {
            Toast.makeText(this, "3D工房を準備できません: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
        // Render the game edge-to-edge, without any native toolbar/status strip.
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
        }
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_FULLSCREEN |
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        getWindow().setStatusBarColor(Color.BLACK);
        getWindow().setNavigationBarColor(Color.BLACK);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(8, 20, 26));
        setContentView(root);
        createWeb();
        checkForUpdate();
    }

    private void createWeb() {
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(8, 20, 26));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        if (Build.VERSION.SDK_INT >= 26) {
            settings.setSafeBrowsingEnabled(true);
            settings.setMediaPlaybackRequiresUserGesture(false);
        }
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) &&
                    LOCAL_HOST.equals(uri.getHost()) && "/index.html".equals(uri.getPath())) {
                    try {
                        WebResourceResponse response = new WebResourceResponse(
                            "text/html", "UTF-8", new FileInputStream(current));
                        response.setResponseHeaders(Collections.singletonMap("Cache-Control", "no-store"));
                        return response;
                    } catch (IOException e) {
                        return blocked(500, "Game file unavailable");
                    }
                }
                return blocked(403, "Offline resources only");
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                return !("https".equals(uri.getScheme()) && LOCAL_HOST.equals(uri.getHost())
                    && "/index.html".equals(uri.getPath()));
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                if (web == view) {
                    root.removeView(view);
                    view.destroy();
                    web = null;
                    runOnUiThread(() -> createWeb());
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage m) {
                if (m.messageLevel() == ConsoleMessage.MessageLevel.ERROR)
                    android.util.Log.e("MoonRuins", m.message() + " @" + m.lineNumber());
                return true;
            }
        });
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        web.loadUrl(GAME_URL);
    }

    private static WebResourceResponse blocked(int status, String message) {
        return new WebResourceResponse("text/plain", "UTF-8", status, message,
            Collections.emptyMap(), new ByteArrayInputStream(message.getBytes(StandardCharsets.UTF_8)));
    }

    private void ensureInitial() throws IOException {
        // One-time migration: replace the old game HTML with the bundled editor.
        // Clear queued game updates before they can be activated.
        if (!getPreferences(MODE_PRIVATE).getBoolean("editor_migrated_v1", false)) {
            File starter = new File(getFilesDir(), "editor-starter.tmp");
            try (InputStream input = getAssets().open("starter.html")) {
                copyLimited(input, starter);
            }
            validateHtml(starter);
            if (pending.exists() && !pending.delete())
                throw new IOException("Cannot remove old queued game update");
            if (current.exists() && !current.delete())
                throw new IOException("Cannot replace old game");
            if (!starter.renameTo(current))
                throw new IOException("Cannot activate editor starter");
            getPreferences(MODE_PRIVATE).edit().putBoolean("editor_migrated_v1", true).apply();
            return;
        }
        if (current.isFile() && current.length() > 0) return;
        try (InputStream input = getAssets().open("starter.html")) {
            copyLimited(input, current);
        }
        validateHtml(current);
    }

    private void activatePending() throws IOException {
        if (!pending.exists()) return;
        try {
            validateHtml(pending);
        } catch (IOException invalid) {
            pending.delete();
            return;
        }
        // Keep a valid old version as a silent recovery copy.
        if (current.exists()) {
            File tempBackup = new File(getFilesDir(), "previous.tmp");
            if (tempBackup.exists() && !tempBackup.delete())
                throw new IOException("Cannot clear backup temp");
            try (InputStream input = new FileInputStream(current)) {
                copyLimited(input, tempBackup);
            }
            if (previous.exists() && !previous.delete())
                throw new IOException("Cannot rotate backup");
            if (!tempBackup.renameTo(previous))
                throw new IOException("Cannot save previous version");
        }
        if (current.exists() && !current.delete())
            throw new IOException("Cannot switch current version");
        if (!pending.renameTo(current)) {
            if (previous.exists()) {
                try (InputStream backup = new FileInputStream(previous)) {
                    copyLimited(backup, current);
                }
            }
            throw new IOException("Cannot activate update");
        }
    }

    private void checkForUpdate() {
        if (checking) return;
        checking = true;
        new Thread(() -> {
            File downloading = new File(getFilesDir(), "download.tmp");
            HttpURLConnection connection = null;
            try {
                URL url = new URL(UPDATE_URL);
                connection = (HttpURLConnection) url.openConnection();
                connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(8000);
                connection.setReadTimeout(15000);
                connection.setRequestProperty("User-Agent", "MoonRuinsGame/2.0");
                if (connection.getResponseCode() != 200)
                    throw new IOException("Update endpoint unavailable");
                if (connection.getContentLengthLong() > MAX_HTML_BYTES)
                    throw new IOException("Update too large");
                try (InputStream input = connection.getInputStream()) {
                    copyLimited(input, downloading);
                }
                validateHtml(downloading);
                if (equalContents(downloading, current) ||
                    (pending.exists() && equalContents(downloading, pending))) return;
                if (pending.exists() && !pending.delete())
                    throw new IOException("Cannot replace queued update");
                if (!downloading.renameTo(pending))
                    throw new IOException("Cannot queue update");
                // Never interrupt active modeling. Updated HTML loads on the next launch.
            } catch (Exception ex) {
                // Offline, Private/404, or bad update: current game remains available.
                android.util.Log.i("MoonRuins", "Editor update skipped: " + ex.getMessage());
            } finally {
                if (connection != null) connection.disconnect();
                if (downloading.exists()) downloading.delete();
                checking = false;
            }
        }, "game-html-updater").start();
    }

    private static boolean equalContents(File a, File b) throws Exception {
        return a.isFile() && b.isFile() && Arrays.equals(sha256(a), sha256(b));
    }

    private static byte[] sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[16384];
            int n;
            while ((n = input.read(buffer)) != -1) digest.update(buffer, 0, n);
        }
        return digest.digest();
    }

    private static void validateHtml(File file) throws IOException {
        if (!file.isFile() || file.length() < 12 || file.length() > MAX_HTML_BYTES)
            throw new IOException("Invalid HTML file size");
        byte[] first = new byte[(int) Math.min(4096, file.length())];
        int n;
        try (InputStream in = new BufferedInputStream(new FileInputStream(file))) {
            n = in.read(first);
        }
        if (n <= 0) throw new IOException("Empty HTML");
        String head = new String(first, 0, n, StandardCharsets.UTF_8)
            .trim().toLowerCase(java.util.Locale.ROOT);
        if (!(head.startsWith("<!doctype html") || head.startsWith("<html")))
            throw new IOException("Not an HTML document");
    }

    private static void copyLimited(InputStream input, File output) throws IOException {
        try (OutputStream out = new FileOutputStream(output)) {
            byte[] buffer = new byte[16384];
            int n;
            long count = 0;
            while ((n = input.read(buffer)) != -1) {
                count += n;
                if (count > MAX_HTML_BYTES) throw new IOException("HTML exceeds 12 MiB");
                out.write(buffer, 0, n);
            }
        }
    }

    @Override public void onBackPressed() {
        new AlertDialog.Builder(this)
            .setTitle("3Dワールド工房を終了")
            .setMessage("アプリを閉じますか？")
            .setNegativeButton("キャンセル", null)
            .setPositiveButton("終了", (dialog, which) -> finish())
            .show();
    }
    @Override protected void onDestroy() {
        if (web != null) {
            root.removeView(web);
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
