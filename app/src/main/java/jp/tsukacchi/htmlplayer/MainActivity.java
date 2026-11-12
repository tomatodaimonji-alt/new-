package jp.tsukacchi.htmlplayer;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.view.Window;
import android.view.WindowManager;
import android.view.View;
import android.view.WindowInsets;
import java.io.BufferedInputStream;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.RenderProcessGoneDetail;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.security.MessageDigest;
import java.util.Arrays;
import android.widget.EditText;
import java.nio.charset.StandardCharsets;

/** Standalone offline HTML game player. No old RPG version gates. */
public class MainActivity extends Activity {
    private static final int PICK_HTML = 73;
    private static final String URL = "https://game.tsukacchi.local/index.html";
    private static final String HOST = "game.tsukacchi.local";
    private static final String DEFAULT_UPDATE_URL = "https://raw.githubusercontent.com/tomatodaimonji-alt/new-/main/index.html";
    private static final long MAX_HTML_BYTES = 12L * 1024 * 1024;
    private File pending;
    private volatile boolean checking = false;
    private WebView web;
    private LinearLayout outer;
    private TextView status;
    private File current, previous;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        current = new File(getFilesDir(), "current.html");
        previous = new File(getFilesDir(), "previous.html");
        pending = new File(getFilesDir(), "pending.html");
        try { ensureInitial(); } catch (IOException e) { toast("初期HTMLの準備に失敗: " + e.getMessage()); }
        // Use one consistent inset strategy across Android versions.
        // Android 15+ enforces edge-to-edge for target 35.
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN |
                               WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS |
                               WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
        getWindow().setStatusBarColor(Color.rgb(13, 20, 28));
        getWindow().setNavigationBarColor(Color.rgb(13, 20, 28));
        buildUi();
        if (pending.isFile()) {
            importHtml(Uri.fromFile(pending));
            pending.delete();
        }
        checkRemote(false);
    }

    private void buildUi() {
        outer = new LinearLayout(this);
        outer.setOrientation(LinearLayout.VERTICAL);
        outer.setBackgroundColor(Color.rgb(13, 20, 28));
        // Keep update buttons out of status/navigation bars even in edge-to-edge mode.
        outer.setOnApplyWindowInsetsListener((view, insets) -> {
            int top, bottom, left, right;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                top = bars.top;
                bottom = bars.bottom;
                left = bars.left;
                right = bars.right;
            } else {
                top = insets.getSystemWindowInsetTop();
                bottom = insets.getSystemWindowInsetBottom();
                left = insets.getSystemWindowInsetLeft();
                right = insets.getSystemWindowInsetRight();
            }
            if (view.getPaddingTop() != top + dp(5) || view.getPaddingBottom() != bottom) {
                view.setPadding(left, top + dp(5), right, bottom);
            }
            return insets;
        });
        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setPadding(dp(5), dp(4), dp(5), dp(3));
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        Button importBtn = button("HTML更新");
        Button reloadBtn = button("再読込");
        Button restoreBtn = button("前に戻す");
        Button updateBtn = button("自動更新");
        toolbar.addView(importBtn, new LinearLayout.LayoutParams(0, dp(42), 1.2f));
        toolbar.addView(reloadBtn, new LinearLayout.LayoutParams(0, dp(42), 1f));
        toolbar.addView(restoreBtn, new LinearLayout.LayoutParams(0, dp(42), 1.1f));
        toolbar.addView(updateBtn, new LinearLayout.LayoutParams(0, dp(42), 1.1f));
        importBtn.setOnClickListener(v -> chooseHtml());
        reloadBtn.setOnClickListener(v -> reload());
        restoreBtn.setOnClickListener(v -> confirmRestore());
        updateBtn.setOnClickListener(v -> checkRemote(true));
        updateBtn.setOnLongClickListener(v -> { showUpdateSettings(); return true; });
        status = new TextView(this);
        status.setTextSize(10); status.setTextColor(Color.rgb(190, 203, 212));
        status.setPadding(dp(10), 0, dp(6), dp(4));
        status.setText("月影の遺跡 ／ 自動更新ON（設定: 自動更新ボタン長押し）");
        outer.addView(toolbar);
        outer.addView(status);
        setContentView(outer);
        createWeb();
    }

    private Button button(String label) {
        Button b = new Button(this);
        b.setAllCaps(false);
        b.setText(label);
        b.setTextSize(12);
        return b;
    }

    private void createWeb() {
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(12, 18, 24));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        if (Build.VERSION.SDK_INT >= 26) s.setSafeBrowsingEnabled(true);
        if (Build.VERSION.SDK_INT >= 26) { s.setMediaPlaybackRequiresUserGesture(false); }
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        // No JavaScript interface: imported HTML cannot call native update APIs.
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if ("https".equals(u.getScheme()) && HOST.equals(u.getHost()) && "/index.html".equals(u.getPath())) {
                    try {
                        InputStream in = new FileInputStream(current);
                        WebResourceResponse res = new WebResourceResponse("text/html", "UTF-8", in);
                        res.setResponseHeaders(java.util.Collections.singletonMap("Cache-Control", "no-store"));
                        return res;
                    } catch (IOException e) {
                        return new WebResourceResponse("text/plain", "UTF-8", 500, "HTML読み込みエラー", java.util.Collections.emptyMap(),
                            new java.io.ByteArrayInputStream("HTMLが見つかりません".getBytes(StandardCharsets.UTF_8)));
                    }
                }
                // Offline-only: all requests other than the main document are blocked.
                return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", java.util.Collections.emptyMap(),
                    new java.io.ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !URL.equals(request.getUrl().toString());
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                if (request.isForMainFrame()) status.setText("読み込みエラー：前に戻すを試してください");
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                outer.removeView(view); view.destroy(); web = null;
                status.setText("HTMLの描画処理が停止しました。再読込してください");
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage msg) {
                if (msg.messageLevel() == ConsoleMessage.MessageLevel.ERROR)
                    android.util.Log.e("TsukacchiHTML", msg.message() + " @" + msg.lineNumber());
                return true;
            }
        });
        outer.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        reload();
    }

    private void reload() {
        if (web == null) { createWeb(); return; }
        web.loadUrl(URL + "?t=" + System.nanoTime());
        status.setText("現在のHTMLを読み込み中 ／ 更新後もゲームの保存領域は維持");
    }
    private void chooseHtml() {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.setType("*/*");
        i.addCategory(Intent.CATEGORY_OPENABLE);
        try { startActivityForResult(i, PICK_HTML); }
        catch (ActivityNotFoundException ex) { toast("ファイル選択アプリが見つかりません"); }
    }
    @Override protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code != PICK_HTML || result != RESULT_OK || data == null || data.getData() == null) return;
        Uri uri = data.getData();
        new AlertDialog.Builder(this)
            .setTitle("HTMLを更新")
            .setMessage("選択したHTMLでゲームを置き換えます。現在のHTMLは『前に戻す』用に保存します。ゲーム内の保存データは保持します。")
            .setNegativeButton("キャンセル", null)
            .setPositiveButton("更新", (d,w) -> importHtml(uri)).show();
    }
    private void importHtml(Uri uri) {
        File temp = new File(getFilesDir(), "incoming.tmp");
        File oldTemp = new File(getFilesDir(), "backup.tmp");
        try {
            try (InputStream in = getContentResolver().openInputStream(uri)) {
                if (in == null) throw new IOException("ファイルを開けません");
                copy(in, temp);
            }
            validateHtml(temp);
            if (current.exists()) {
                try (InputStream in = new FileInputStream(current)) { copy(in, oldTemp); }
            }
            // The original stays in place until the replacement is validated.
            // Keep one rollback copy without deleting a good current file on failures.
            if (current.exists() && oldTemp.exists()) {
                if (previous.exists() && !previous.delete())
                    throw new IOException("前回のバックアップを更新できません");
                if (!oldTemp.renameTo(previous))
                    throw new IOException("バックアップを保存できません");
            }
            if (current.exists() && !current.delete())
                throw new IOException("旧HTMLを交換できません");
            if (!temp.renameTo(current)) {
                // Restore previous copy before surfacing the error.
                if (previous.exists()) {
                    try (InputStream restoreIn = new FileInputStream(previous)) {
                        copy(restoreIn, current);
                    }
                }
                throw new IOException("新HTMLを保存できません");
            }
            reload();
            toast("HTMLを更新しました");
        } catch (Exception e) {
            // If replace failed after delete, recover using a backup.
            if ((!current.exists() || current.length() == 0) && previous.exists()) {
                try (InputStream recovery = new FileInputStream(previous)) {
                    copy(recovery, current);
                } catch (IOException ignored) { }
            }
            status.setText("更新失敗: " + e.getMessage());
            toast("更新できませんでした: " + e.getMessage());
        } finally { if (temp.exists()) temp.delete(); if (oldTemp.exists()) oldTemp.delete(); }
    }
    private static void validateHtml(File input) throws IOException {
        if (!input.isFile() || input.length() == 0) throw new IOException("空のファイルです");
        if (input.length() > MAX_HTML_BYTES) throw new IOException("HTML容量が12MBを超えています");
        // A small header check prevents accidentally installing an APK, ZIP or image.
        byte[] header = new byte[(int)Math.min(4096, input.length())];
        int n;
        try (InputStream in = new BufferedInputStream(new FileInputStream(input))) {
            n = in.read(header);
        }
        if (n <= 0) throw new IOException("HTMLを読み取れません");
        String start = new String(header, 0, n, StandardCharsets.UTF_8).trim().toLowerCase(java.util.Locale.ROOT);
        if (!(start.startsWith("<!doctype html") || start.startsWith("<html") ||
              start.startsWith("<!--") || start.startsWith("<head")))
            throw new IOException("HTMLファイルを選択してください");
    }


    private void showUpdateSettings() {
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setText(getPreferences(0).getString("update_url", DEFAULT_UPDATE_URL));
        input.setSelectAllOnFocus(true);
        LinearLayout layout = new LinearLayout(this);
        layout.setPadding(dp(18), dp(8), dp(18), dp(4));
        layout.addView(input);
        new AlertDialog.Builder(this).setTitle("HTML配信URL")
            .setMessage("HTTPSのHTML公開URLを指定。Privateリポジトリは直接取得できません。")
            .setView(layout).setNegativeButton("キャンセル", null)
            .setNeutralButton("自動更新OFF", (d, w) -> {
                getPreferences(0).edit().putBoolean("auto", false).apply();
                status.setText("自動更新OFF");
            })
            .setPositiveButton("保存して確認", (d, w) -> {
                String u = input.getText().toString().trim();
                if (!u.startsWith("https://") || u.contains("@") || u.contains(" ") || u.contains("#")) {
                    toast("HTTPSの公開URLを入力してください"); return;
                }
                getPreferences(0).edit().putString("update_url", u).putBoolean("auto", true).apply();
                checkRemote(true);
            }).show();
    }

    private static byte[] digest(File f) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new FileInputStream(f)) {
            byte[] buf = new byte[16384]; int n;
            while ((n = in.read(buf)) != -1) md.update(buf, 0, n);
        }
        return md.digest();
    }

    private void checkRemote(boolean manual) {
        if (!getPreferences(0).getBoolean("auto", true)) {
            if (manual) showUpdateSettings();
            return;
        }
        if (checking) return;
        checking = true;
        if (manual) status.setText("最新版を確認しています…");
        final String address = getPreferences(0).getString("update_url", DEFAULT_UPDATE_URL);
        new Thread(() -> {
            File temp = new File(getFilesDir(), "remote.download");
            HttpURLConnection conn = null;
            try {
                java.net.URL url = new java.net.URL(address);
                if (!"https".equals(url.getProtocol()) || url.getUserInfo() != null) throw new IOException("HTTPS URLが必要");
                conn = (HttpURLConnection) url.openConnection();
                conn.setInstanceFollowRedirects(false);
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(15000);
                conn.setRequestProperty("User-Agent", "MoonRuinsHTMLUpdater/1.0");
                int code = conn.getResponseCode();
                if (code != 200) throw new IOException("配信先 HTTP " + code + "（非公開の場合は取得不可）");
                if (conn.getContentLengthLong() > MAX_HTML_BYTES) throw new IOException("HTML容量超過");
                try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(temp)) {
                    byte[] buf = new byte[16384]; int n; long total = 0;
                    while ((n = in.read(buf)) != -1) {
                        total += n;
                        if (total > MAX_HTML_BYTES) throw new IOException("HTML容量が12MBを超えました");
                        out.write(buf, 0, n);
                    }
                }
                validateHtml(temp);
                boolean same = current.isFile() && Arrays.equals(digest(temp), digest(current));
                if (!same && pending.isFile()) same = Arrays.equals(digest(temp), digest(pending));
                if (same) {
                    if (manual) runOnUiThread(() -> status.setText("最新版です"));
                } else {
                    // Do not interrupt an ongoing game; install on next launch.
                    if (pending.exists() && !pending.delete()) throw new IOException("更新待ちファイルの削除に失敗");
                    if (!temp.renameTo(pending)) throw new IOException("更新の保存に失敗");
                    runOnUiThread(() -> status.setText("新しいHTMLを取得しました。次回起動時に自動反映します"));
                }
            } catch (Exception ex) {
                if (manual) runOnUiThread(() -> status.setText("更新を確認できません: " + ex.getMessage()));
            } finally {
                if (conn != null) conn.disconnect();
                if (temp.exists()) temp.delete();
                checking = false;
            }
        }, "html-update-check").start();
    }

    private void confirmRestore() {
        if (!previous.exists()) { toast("戻せる前のHTMLはありません"); return; }
        new AlertDialog.Builder(this).setTitle("ひとつ前のHTMLに戻す")
            .setMessage("現在のHTMLを、ひとつ前のHTMLと入れ替えます。保存データは消しません。")
            .setNegativeButton("やめる", null).setPositiveButton("戻す", (d,w) -> restore()).show();
    }
    private void restore() {
        File swap = new File(getFilesDir(), "swap.tmp");
        if (!current.exists()) { toast("現在のHTMLがありません"); return; }
        if (current.renameTo(swap)) {
            if (previous.renameTo(current)) {
                if (!swap.renameTo(previous)) toast("前の版のバックアップ保存に失敗");
                reload(); toast("前のHTMLに戻しました"); return;
            }
            swap.renameTo(current);
        }
        toast("復元に失敗しました");
    }
    private void ensureInitial() throws IOException {
        if (current.isFile() && current.length() > 0) return;
        try (InputStream in = getAssets().open("starter.html")) { copy(in, current); }
    }
    private static void copy(InputStream in, File out) throws IOException {
        try (OutputStream dest = new FileOutputStream(out)) {
            byte[] buf = new byte[65536]; int n;
            while ((n = in.read(buf)) != -1) dest.write(buf, 0, n);
            dest.flush();
        }
    }
    private int dp(int value) { return (int)(getResources().getDisplayMetrics().density * value + 0.5f); }
    private void toast(String message) { Toast.makeText(this, message, Toast.LENGTH_LONG).show(); }
    @Override public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else new AlertDialog.Builder(this).setTitle("月影の遺跡を終了")
            .setMessage("アプリを閉じますか？")
            .setNegativeButton("キャンセル", null)
            .setPositiveButton("終了", (d,w) -> finish()).show();
    }
    @Override protected void onDestroy() {
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
